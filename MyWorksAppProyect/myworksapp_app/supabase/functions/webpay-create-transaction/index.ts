import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import {
  buildCommitReturnUrl,
  sanitizeClientReturn,
  signHandoffTicket,
} from "../_shared/security.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";
import { tbkConfig, tbkCreateTransaction } from "../_shared/tbk.ts";

/**
 * Crea una transacción Webpay Plus (integración o producción).
 * Credenciales solo desde WEBPAY_COMMERCE_CODE / WEBPAY_API_KEY.
 *
 * Body: jobId | buy_order (id del trabajo), session_id, amount.
 * Respuesta: token, url, buyOrder.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const userSb = userClient(req);
    const {
      data: { user },
      error: authErr,
    } = await userSb.auth.getUser();
    if (authErr || !user) {
      return jsonResponse(req, { error: "No autenticado" }, 401);
    }

    const body = await req.json();
    const jobId = String(
      body.jobId || body.job_id || body.buy_order || body.buyOrder || "",
    ).trim();
    const amount = Number(body.amount ?? body.amountClp);
    const sessionId = String(body.session_id || body.sessionId || user.id);

    if (!jobId || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse(
        req,
        { error: "buy_order (jobId) y amount requeridos" },
        400,
      );
    }
    if (sessionId !== user.id) {
      return jsonResponse(
        req,
        { error: "session_id no coincide con la sesión" },
        403,
      );
    }

    const { data: payment, error: payErr } = await userSb.rpc(
      "crear_intencion_pago",
      {
        p_id_trabajo: jobId,
        p_monto: Math.round(amount),
        p_buy_order: null,
      },
    );
    if (payErr || !payment) {
      return jsonResponse(
        req,
        { error: payErr?.message || "No se pudo crear la intención de pago" },
        400,
      );
    }

    const paymentId = String(payment.id);
    const buyOrder = `MWA${paymentId.replace(/-/g, "").slice(0, 23)}`;
    const clientReturn = sanitizeClientReturn(
      typeof body.clientReturn === "string" ? body.clientReturn : undefined,
    );
    const returnUrl = buildCommitReturnUrl(clientReturn);

    const { env } = tbkConfig();
    const { token, url } = await tbkCreateTransaction({
      buyOrder,
      sessionId,
      amount: Math.round(amount),
      returnUrl,
    });

    const admin = serviceClient();
    const { error: updErr } = await admin
      .from("pagos")
      .update({
        buy_order: buyOrder,
        token_tbk: token,
        url_tbk: url,
        ambiente: env,
        id_transaccion: buyOrder,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (updErr) {
      return jsonResponse(req, { error: updErr.message }, 500);
    }

    let redirectUrl: string | undefined;
    try {
      const ticket = await signHandoffTicket(paymentId);
      const base = Deno.env.get("SUPABASE_URL");
      if (base) {
        redirectUrl =
          `${base}/functions/v1/webpay-handoff?t=${encodeURIComponent(ticket)}`;
      }
    } catch {
      redirectUrl = undefined;
    }

    return jsonResponse(req, {
      token,
      url,
      buyOrder,
      paymentId,
      ambiente: env,
      ...(redirectUrl ? { redirectUrl } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("WEBPAY_COMMERCE_CODE") ||
        msg.includes("WEBPAY_API_KEY")
      ? 503
      : 500;
    return jsonResponse(req, { error: msg }, status);
  }
});
