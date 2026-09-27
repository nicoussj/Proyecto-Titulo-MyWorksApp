import { corsHeadersFor, jsonResponse } from "../_shared/cors.ts";
import { escrowJson, persistWebpayOutcome } from "../_shared/escrow.ts";
import { sanitizeClientReturn } from "../_shared/security.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { tbkCommit, tbkStatus } from "../_shared/tbk.ts";

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function withQuery(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readToken(req: Request): Promise<{ token: string; clientReturn: string | null }> {
  const reqUrl = new URL(req.url);
  let token = reqUrl.searchParams.get("token_ws") || "";
  const clientReturn = sanitizeClientReturn(reqUrl.searchParams.get("cr"));

  if (req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      token = String(body.token_ws || body.token || token);
    } else {
      const form = await req.formData();
      token = String(form.get("token_ws") || token);
    }
  }

  return { token, clientReturn };
}

function wantsJson(req: Request): boolean {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/json");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }

  try {
    const { token, clientReturn } = await readToken(req);
    if (!token) {
      return jsonResponse(req, { error: "token_ws ausente" }, 400);
    }

    const admin = serviceClient();
    const { data: existing } = await admin
      .from("pagos")
      .select("estado, buy_order, monto")
      .eq("token_tbk", token)
      .maybeSingle();

    let commit: Record<string, unknown>;
    if (
      existing &&
      (existing.estado === "retenido" || existing.estado === "liberado")
    ) {
      commit = {
        response_code: 0,
        status: "AUTHORIZED",
        buy_order: existing.buy_order,
        amount: existing.monto,
      };
    } else {
      try {
        commit = await tbkCommit(token);
      } catch (err) {
        try {
          commit = await tbkStatus(token);
        } catch {
          const msg = err instanceof Error ? err.message : String(err);
          return jsonResponse(req, { error: msg }, 502);
        }
      }
    }

    const outcome = await persistWebpayOutcome(admin, { token, commit });
    if (!outcome) {
      return jsonResponse(req, { error: "Pago no encontrado" }, 404);
    }

    const payload = escrowJson(outcome);
    if (wantsJson(req)) {
      return jsonResponse(req, payload);
    }

    const appBase = clientReturn ||
      Deno.env.get("WEBPAY_APP_RETURN_URL") ||
      "myworksapp://payment-result";
    const webBase = sanitizeClientReturn(Deno.env.get("WEBPAY_WEB_RETURN_URL")) ||
      clientReturn ||
      "http://localhost:5173/payment-result";

    const query = {
      token_ws: token,
      approved: outcome.approved ? "1" : "0",
      paymentId: outcome.paymentId,
      jobId: outcome.jobId,
      pago: outcome.approved ? "ok" : "fail",
    };
    const appReturn = withQuery(appBase, query);
    const webReturn = withQuery(webBase, query);

    const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"/>
<title>Pago Webpay</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="refresh" content="0;url=${htmlEscape(appReturn)}"/>
<style>
  body{font-family:system-ui,sans-serif;background:#0b1220;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
  a{color:#FF5E03}
</style>
</head><body>
<h1>${outcome.approved ? "Pago retenido en garantía" : "Pago rechazado"}</h1>
<p>Volviendo a My Works App…</p>
<p><a id="app" href="${htmlEscape(appReturn)}">Abrir app</a> · <a id="web" href="${htmlEscape(webReturn)}">Ver resultado</a></p>
<script>
(function(){
  var app = ${JSON.stringify(appReturn)};
  var web = ${JSON.stringify(webReturn)};
  try { location.replace(app); } catch (e) { location.replace(web); }
})();
</script>
</body></html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...corsHeadersFor(req),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonResponse(
      req,
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
