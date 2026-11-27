import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  oneclickAuthCode,
  oneclickAuthorized,
  oneclickDeclined,
  tbkStatusAuthorized,
} from "./tbk.ts";
import { publicErrorMessage, secondChargeMessage } from "./safe_error.ts";
import {
  guardAdminMutation,
  motivoValido,
  registrarAuditoria,
  requestClientMeta,
  requireAdmin,
} from "./require_admin.ts";
import { scheduleAfterResponse, sendEmail } from "./email_send.ts";
import { renderEmail, safeHref } from "./email_layout.ts";
import { fcmSendUrl, fetchAccessToken, isDeadTokenResponse } from "./fcm.ts";
import { chileE164, postalAddress } from "./chile_input.ts";
import { resolveCorsAllowOrigin } from "./cors_origin.ts";
import { isReservedEmailDomain, parseGuestTicket } from "./guest_ticket.ts";
import { assessWebpayCommit } from "./commit_guard.ts";
import { allowRateDb } from "./rate_limit_db.ts";
import { safeInviteHref } from "./invite_html.ts";
import { openJobAfterHold } from "./open_job_after_hold.ts";
import { transbankBridgeUrl } from "./transbank_form.ts";
import { bridgeCustomSchemeReturn } from "./webpay_return.ts";
import { activatePendingInscription } from "./oneclick_inscription.ts";

const fetchReal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchReal;
  Deno.env.delete("RESEND_API_KEY");
  Deno.env.delete("RESEND_FROM");
  delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
});

describe("respuestas de Transbank", () => {
  it("autorización de Webpay y Oneclick", () => {
    assert.equal(tbkStatusAuthorized(null), false);
    assert.equal(tbkStatusAuthorized({ response_code: 0 }), true);
    assert.equal(
      tbkStatusAuthorized({ response_code: -1, status: "authorized" }),
      true,
    );
    assert.equal(
      tbkStatusAuthorized({ response_code: -1, status: "FAILED" }),
      false,
    );
    assert.equal(oneclickAuthorized(null), false);
    assert.equal(oneclickAuthorized({ details: "x" }), false);
    assert.equal(oneclickAuthorized({ details: [{ response_code: 0 }] }), true);
    assert.equal(oneclickDeclined(null), false);
    assert.equal(oneclickDeclined({}), false);
    assert.equal(oneclickDeclined({ details: [{ response_code: "" }] }), false);
    assert.equal(oneclickDeclined({ details: [{ response_code: -96 }] }), true);
    assert.equal(oneclickDeclined({ details: [{ response_code: 0 }] }), false);
    assert.equal(oneclickAuthCode(null), "");
    assert.equal(oneclickAuthCode({ details: [] }), "");
    assert.equal(
      oneclickAuthCode({ details: [{ authorization_code: "1213" }] }),
      "1213",
    );
  });

  it("evaluación del commit: reembolsado se rechaza", () => {
    const base = {
      responseCode: 0,
      status: "AUTHORIZED",
      commitAmount: 1000,
      expectedAmount: 1000,
      commitBuyOrder: "b",
      storedBuyOrder: "b",
    };
    assert.deepEqual(assessWebpayCommit({ ...base, estado: "reembolsado" }), {
      action: "reject",
    });
    assert.deepEqual(
      assessWebpayCommit({ ...base, estado: "reembolsado_auto" }),
      { action: "reject" },
    );
  });
});

describe("mensajes de error públicos", () => {
  it("oculta secretos, traduce choques y recorta textos largos", () => {
    assert.equal(
      publicErrorMessage(new Error("bad tbk token")),
      "No se pudo completar el pago. Inténtalo de nuevo.",
    );
    assert.equal(
      publicErrorMessage({ message: "ya hay un cobro en curso" }),
      secondChargeMessage,
    );
    assert.equal(publicErrorMessage({ message: null }, "fallo"), "fallo");
    assert.equal(
      publicErrorMessage("duplicate key value"),
      "No se pudo completar el pago. Inténtalo de nuevo.",
    );
    assert.equal(publicErrorMessage("x".repeat(200), "fallo"), "fallo");
    assert.equal(publicErrorMessage(undefined, "fallo"), "fallo");
    assert.equal(publicErrorMessage({}, "fallo"), "fallo");
    assert.equal(publicErrorMessage("Monto inválido"), "Monto inválido");
  });
});

describe("puerta de administración", () => {
  it("is_admin que lanza o rechaza bloquea la mutación", async () => {
    const lines: string[] = [];
    const lanza = { rpc: () => Promise.reject(new Error("caída")) };
    assert.deepEqual(await requireAdmin(lanza as never, (l) => lines.push(l)), {
      ok: false,
      status: 403,
      error: "No autorizado",
    });
    const lanzaTexto = { rpc: () => Promise.reject("x") };
    await requireAdmin(lanzaTexto as never, (l) => lines.push(l));
    const conError = {
      rpc: () => Promise.resolve({ data: null, error: { message: "jwt" } }),
    };
    let llamado = false;
    const r = await guardAdminMutation(conError, () => {
      llamado = true;
      return Promise.resolve();
    }, (l) => lines.push(l));
    assert.equal(r.status, 403);
    assert.equal(llamado, false);
    const ok = { rpc: () => Promise.resolve({ data: true, error: null }) };
    assert.deepEqual(await guardAdminMutation(ok, () => Promise.resolve(7)), {
      status: 200,
      value: 7,
    });
    const vacio = { rpc: () => Promise.resolve(undefined) };
    await requireAdmin(vacio as never, (l) => lines.push(l));
    assert.ok(lines.some((l) => l.includes("rpc_error")));
    assert.ok(lines.some((l) => l.includes("no se pudo evaluar: caída")));
  });

  it("metadatos del cliente, motivo y auditoría que nunca relanza", async () => {
    const req = new Request("https://x", {
      headers: {
        "x-forwarded-for": " 1.2.3.4 , 5.6.7.8",
        "user-agent": "u".repeat(400),
      },
    });
    assert.deepEqual(requestClientMeta(req), {
      ip: "1.2.3.4",
      userAgent: "u".repeat(300),
    });
    assert.deepEqual(
      requestClientMeta(
        new Request("https://x", {
          headers: { "cf-connecting-ip": "9.9.9.9" },
        }),
      ),
      { ip: "9.9.9.9", userAgent: null },
    );
    assert.deepEqual(requestClientMeta(new Request("https://x")), {
      ip: null,
      userAgent: null,
    });
    assert.equal(motivoValido("corto"), null);
    assert.equal(motivoValido("  motivo suficiente  "), "motivo suficiente");
    assert.equal(motivoValido("x".repeat(2001)), null);
    assert.equal(motivoValido(undefined), null);
    const errores: unknown[] = [];
    const errReal = console.error;
    console.error = (...a: unknown[]) => errores.push(a);
    try {
      assert.equal(
        await registrarAuditoria({
          rpc: () => Promise.resolve({ error: null }),
        }, {}),
        true,
      );
      assert.equal(
        await registrarAuditoria({
          rpc: () => Promise.resolve({ error: { message: "x" } }),
        }, {}),
        false,
      );
      assert.equal(
        await registrarAuditoria({
          rpc: () => Promise.reject(new Error("x")),
        }, {}),
        false,
      );
    } finally {
      console.error = errReal;
    }
    assert.equal(errores.length, 2);
  });
});

describe("correo", () => {
  const content = { html: "<p>x</p>", text: "x" };
  it("sin configuración, correo inválido o reservado no envía", async () => {
    assert.deepEqual(await sendEmail({ to: "a@b.cl", subject: "s", content }), {
      ok: false,
      reason: "correo_no_configurado",
    });
    Deno.env.set("RESEND_API_KEY", "re_prueba");
    Deno.env.set("RESEND_FROM", "MyWorksApp <hola@myworksapp.cl>");
    assert.deepEqual(
      await sendEmail({ to: "no-es-correo", subject: "s", content }),
      { ok: false, reason: "correo_invalido" },
    );
    assert.deepEqual(
      await sendEmail({ to: "a@example.com", subject: "s", content }),
      { ok: false, reason: "correo_reservado" },
    );
  });

  it("envía con idempotencia y etiquetas; rechazo, red caída y cuerpo sin id", async () => {
    Deno.env.set("RESEND_API_KEY", "re_prueba");
    Deno.env.set("RESEND_FROM", "MyWorksApp <hola@myworksapp.cl>");
    const pedidos: RequestInit[] = [];
    const cola: Array<Response | Error> = [
      new Response(JSON.stringify({ id: "em_1" }), { status: 200 }),
      new Response("no json", { status: 200 }),
      new Response("{}", { status: 422 }),
      new Error("red"),
    ];
    globalThis.fetch = ((_u: string, init: RequestInit) => {
      pedidos.push(init);
      const n = cola.shift()!;
      return n instanceof Error ? Promise.reject(n) : Promise.resolve(n);
    }) as typeof fetch;
    const logReal = console.log;
    console.log = () => {};
    try {
      assert.deepEqual(
        await sendEmail({
          to: " Ana@Correo.CL ",
          subject: "s",
          content,
          idempotencyKey: "k1",
          tags: [{ name: "t", value: "v" }],
        }),
        { ok: true, id: "em_1" },
      );
      assert.equal(
        (pedidos[0].headers as Record<string, string>)["Idempotency-Key"],
        "k1",
      );
      assert.deepEqual(JSON.parse(String(pedidos[0].body)).tags, [{
        name: "t",
        value: "v",
      }]);
      assert.deepEqual(
        await sendEmail({ to: "a@b.cl", subject: "s", content, tags: [] }),
        { ok: true, id: "" },
      );
      assert.deepEqual(
        await sendEmail({ to: "a@b.cl", subject: "s", content }),
        { ok: false, reason: "correo_rechazado" },
      );
      assert.deepEqual(
        await sendEmail({ to: "a@b.cl", subject: "s", content }),
        { ok: false, reason: "correo_error" },
      );
    } finally {
      console.log = logReal;
    }
  });

  it("deja la tarea viva con EdgeRuntime y no bloquea sin él", async () => {
    scheduleAfterResponse(Promise.reject(new Error("x")));
    const vivas: Promise<unknown>[] = [];
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = {
      waitUntil: (p: Promise<unknown>) => vivas.push(p),
    };
    scheduleAfterResponse(Promise.resolve(1));
    assert.equal(vivas.length, 1);
    await vivas[0];
  });

  it("enlaces seguros y plantilla con botón, filas y nota", () => {
    assert.equal(safeHref(null), null);
    assert.equal(safeHref("no url"), null);
    assert.equal(safeHref("javascript:alert(1)"), null);
    assert.equal(
      safeHref(" https://myworksapp-cl.vercel.app/x "),
      "https://myworksapp-cl.vercel.app/x",
    );
    const mail = renderEmail({
      preheader: "p",
      title: "Título <b>",
      paragraphs: ["Uno", "  "],
      rows: [{ label: "Monto", value: "$1.000" }],
      button: {
        label: "Ver pedido",
        url: "https://myworksapp-cl.vercel.app/pedido/1",
      },
      note: "Nota",
    });
    assert.ok(mail.html.includes("Ver pedido"));
    assert.ok(mail.html.includes("&lt;b&gt;"));
    assert.ok(mail.text.includes("Monto"));
    const sinBoton = renderEmail({
      preheader: "p",
      title: "t",
      paragraphs: ["x"],
      button: { label: "Mal", url: "ftp://x" },
    });
    assert.equal(sinBoton.html.includes(">Mal<"), false);
  });
});

describe("push FCM", () => {
  const pem = async () => {
    const k = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const der = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", k.privateKey),
    );
    const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
    return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
  };

  it("pide el token de acceso firmado y maneja rechazos", async () => {
    const sa = {
      project_id: "p",
      client_email: "sa@p.iam.gserviceaccount.com",
      private_key: await pem(),
    };
    let body = "";
    const ok = ((_u: string, init: RequestInit) => {
      body = String(init.body);
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: "ya29" })),
      );
    }) as typeof fetch;
    assert.equal(await fetchAccessToken(sa, ok), "ya29");
    assert.match(body, /grant_type=urn%3Aietf/);
    await assert.rejects(
      fetchAccessToken(
        sa,
        (() =>
          Promise.resolve(new Response("{}", { status: 401 }))) as typeof fetch,
      ),
      /OAuth de Google respondió 401/,
    );
    await assert.rejects(
      fetchAccessToken(
        sa,
        (() => Promise.resolve(new Response("{}"))) as typeof fetch,
      ),
      /sin access_token/,
    );
  });

  it("token muerto y URL de envío", () => {
    assert.equal(isDeadTokenResponse(404, ""), true);
    assert.equal(isDeadTokenResponse(400, "UNREGISTERED"), true);
    assert.equal(isDeadTokenResponse(400, "otro"), false);
    assert.equal(isDeadTokenResponse(500, "UNREGISTERED"), false);
    assert.equal(
      fcmSendUrl("mi proyecto"),
      "https://fcm.googleapis.com/v1/projects/mi%20proyecto/messages:send",
    );
  });
});

describe("validaciones de entrada y orígenes", () => {
  it("teléfono y dirección de Chile", () => {
    assert.equal(chileE164("56912345678"), "+56912345678");
    assert.equal(chileE164("9 1234 5678"), "+56912345678");
    assert.equal(chileE164("123"), null);
    assert.equal(postalAddress("corta"), null);
    assert.equal(postalAddress("12345678 90"), null);
    assert.equal(postalAddress("Avenida_sin_espacios"), null);
    assert.equal(postalAddress("  Calle   Uno 123  "), "Calle Uno 123");
  });

  it("CORS: sin origen, locales inválidos y producción", () => {
    assert.equal(resolveCorsAllowOrigin({ origin: " ", allowlist: [] }), "*");
    const fallback = resolveCorsAllowOrigin({
      origin: "https://otro.cl",
      allowlist: [],
    });
    assert.ok(fallback.startsWith("https://"));
    for (
      const o of [
        "http://u:p@localhost:3000",
        "http://localhost:3000/ruta",
        "http://localhost:99999",
        "nada",
        "https://localhost:3000",
        "http://evil.cl:3000",
      ]
    ) {
      assert.equal(
        resolveCorsAllowOrigin({
          origin: o,
          allowlist: ["https://a.cl"],
          tbkEnv: "integration",
        }),
        "https://a.cl",
      );
    }
    assert.equal(
      resolveCorsAllowOrigin({
        origin: "http://127.0.0.1",
        allowlist: ["https://a.cl"],
      }),
      "http://127.0.0.1",
    );
    assert.equal(
      resolveCorsAllowOrigin({
        origin: "http://localhost:5173",
        allowlist: ["https://a.cl"],
        tbkEnv: "production",
      }),
      "https://a.cl",
    );
  });

  it("ticket de invitado mal formado o vencido y dominios reservados", () => {
    assert.deepEqual(parseGuestTicket("pwd.u.abc.j.s"), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(parseGuestTicket("pwd.u.1.j.s"), {
      ok: false,
      error: "el enlace para crear la contraseña expiró",
    });
    assert.equal(isReservedEmailDomain("sin-arroba"), false);
    assert.equal(isReservedEmailDomain("a@"), false);
    assert.equal(isReservedEmailDomain("a@sub.example.org"), true);
  });

  it("enlaces de invitación y puente de Transbank", () => {
    assert.equal(safeInviteHref(undefined), null);
    assert.equal(safeInviteHref("no url"), null);
    assert.equal(safeInviteHref("javascript:x"), null);
    assert.equal(
      safeInviteHref("https://myworksapp-cl.vercel.app/invitar?t=a&b=1"),
      "https://myworksapp-cl.vercel.app/invitar?t=a&amp;b=1",
    );
    assert.throws(
      () =>
        transbankBridgeUrl({
          action: "https://webpay3gint.transbank.cl/x",
          fieldName: "otro" as never,
          token: "t",
        }),
      /campo de token inválido/,
    );
    assert.equal(
      bridgeCustomSchemeReturn("cl.myworksapp.auth://r?x=1", "http://inseguro"),
      "cl.myworksapp.auth://r?x=1",
    );
  });
});

describe("escrituras que fallan en el backend", () => {
  it("límite de tasa rechaza si la RPC lanza", async () => {
    assert.equal(
      await allowRateDb(
        { rpc: () => Promise.reject(new Error("x")) },
        "k",
        1,
        1000,
      ),
      false,
    );
  });

  it("abrir el pedido tras la retención informa los errores", async () => {
    const admin = (rpcError: unknown, updError: unknown) => ({
      rpc: () => Promise.resolve({ error: rpcError }),
      from: () => ({
        update: () => ({
          eq: () => ({ eq: () => Promise.resolve({ error: updError }) }),
        }),
      }),
    });
    await assert.rejects(
      openJobAfterHold(admin({ message: "" }, null) as never, "j", {
        changeOrderId: "c",
        paymentId: "p",
      }),
      /No se pudo marcar la orden de cambio/,
    );
    await assert.rejects(
      openJobAfterHold(admin(null, { message: "x" }) as never, "j"),
      /No se pudo abrir el pedido/,
    );
  });

  it("activar la inscripción devuelve la fila si la base falla", async () => {
    const card = {
      estado: "pendiente",
      token_inscripcion: "tok",
      tbk_user: null,
    } as never;
    const admin = {
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: { message: "x" } }),
          }),
        }),
      }),
    };
    const out = await activatePendingInscription(
      admin as never,
      "u",
      card,
      () =>
        Promise.resolve({
          response_code: 0,
          tbk_user: "tu",
          card_number: "XXXX1234",
        }),
    );
    assert.equal(out, card);
  });
});
