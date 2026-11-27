/**
 * Prueba de humo de cada Edge Function.
 *
 * Se captura el manejador que cada index.ts registra con Deno.serve y se le
 * envían pedidos típicos (preflight, sin cuerpo, JSON roto, JSON completo,
 * formulario de retorno de Transbank) con tres backends simulados: anónimo,
 * usuario con datos y backend que falla. No hay red: fetch está simulado y
 * responde como Supabase, Transbank, Resend o Google. La prueba exige que el
 * manejador siempre devuelva una respuesta HTTP válida y nunca deje escapar
 * una excepción.
 */
import assert from "node:assert/strict";

type Handler = (req: Request) => Response | Promise<Response>;
type Modo = "anonimo" | "usuario" | "falla";

const URL_SB = "https://proyecto-prueba.supabase.co";
const ENV: Record<string, string> = {
  SUPABASE_URL: URL_SB,
  SUPABASE_ANON_KEY: "anon-prueba",
  SUPABASE_SERVICE_ROLE_KEY: "service-prueba",
  WEBPAY_HANDOFF_SECRET: "secreto-handoff-de-prueba",
  TBK_ENV: "integration",
  RESEND_API_KEY: "re_prueba",
  RESEND_FROM: "MyWorksApp <hola@myworksapp.cl>",
  RECONCILE_CRON_SECRET: "cron-prueba",
  RESPALDO_CRON_SECRET: "cron-prueba",
  SOPORTE_CRON_SECRET: "cron-prueba",
  MWA_ALLOW_NO_CAPTCHA: "1",
  CORS_ALLOWED_ORIGINS: "https://myworksapp-cl.vercel.app",
  WEBPAY_ALLOWED_RETURN_ORIGINS: "https://myworksapp-cl.vercel.app",
};

const ID = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const fila = () => ({
  id: ID,
  id_trabajo: JOB,
  id_usuario: ID,
  id_trabajador: ID,
  id_pago: ID,
  id_cliente: ID,
  id_servicio: ID,
  estado: "pendiente",
  estado_pago: "retenido",
  monto: 25000,
  monto_total_clp: 25000,
  tarifa_visita: 20000,
  buy_order: "A1111111111111111111111100",
  orden_detalle_oneclick: "B1111111111111111111111100",
  token_tbk: "tok-prueba",
  metodo_pago: "webpay",
  tipo_pago: "principal",
  ambiente: "integration",
  origen_retorno: "https://myworksapp-cl.vercel.app",
  creado_en: new Date().toISOString(),
  autorizado_en: new Date().toISOString(),
  rol: "administrador",
  role: "administrador",
  es_demo: false,
  correo: "persona@correo.cl",
  email: "persona@correo.cl",
  nombre: "Ana",
  valor: "0",
  token: "tok-push",
  tbk_user: "tbk-user",
  username: "ana",
  estado_cuenta: "activo",
  modalidad_cobro: "visita",
});

let modo: Modo = "anonimo";
const fetchSimulado = (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
    ? input.href
    : input.url;
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const json = (
    status: number,
    body: unknown,
    extra: Record<string, string> = {},
  ) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json",
          "content-range": "0-0/1",
          ...extra,
        },
      }),
    );
  if (url.startsWith(URL_SB)) {
    const path = new URL(url).pathname;
    if (path.startsWith("/auth/v1/user")) {
      return modo === "anonimo"
        ? json(401, { msg: "invalid JWT" })
        : json(200, {
          id: ID,
          email: "persona@correo.cl",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        });
    }
    if (path.startsWith("/auth/v1/")) {
      if (modo === "falla") return json(400, { msg: "falla" });
      return json(200, {
        id: ID,
        email: "persona@correo.cl",
        user: { id: ID, email: "persona@correo.cl", user_metadata: {} },
        properties: { action_link: "https://x" },
      });
    }
    if (modo === "falla") {
      return json(400, { message: "falla simulada", code: "P0001" });
    }
    if (path.startsWith("/rest/v1/rpc/")) return json(200, true);
    if (path.startsWith("/rest/v1/")) {
      const objeto = (headers.get("Accept") || "").includes("vnd.pgrst.object");
      return json(200, objeto ? fila() : [fila()]);
    }
    return json(200, { signedURL: "/x", path: "x" });
  }
  if (modo === "falla") return json(500, { error: "caído" });
  return json(200, {
    success: true,
    id: "externo",
    token: "tok-prueba",
    url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction",
    url_webpay:
      "https://webpay3gint.transbank.cl/webpayserver/bp_inscription.cgi",
    status: "AUTHORIZED",
    response_code: 0,
    amount: 25000,
    buy_order: "A1111111111111111111111100",
    tbk_user: "tbk-user",
    card_number: "XXXX1234",
    details: [{
      response_code: 0,
      authorization_code: "1213",
      amount: 25000,
      status: "AUTHORIZED",
    }],
    access_token: "ya29.prueba",
    name: "projects/p/messages/1",
  });
};

const pedidos = (nombre: string): Request[] => {
  const base = `https://edge.local/${nombre}`;
  const origen = { Origin: "https://myworksapp-cl.vercel.app" };
  const auth = {
    Authorization: "Bearer jwt-prueba",
    "x-cron-secret": "cron-prueba",
    ...origen,
  };
  const cuerpo = {
    paymentId: ID,
    pagoId: ID,
    jobId: JOB,
    trabajoId: JOB,
    disputeId: ID,
    decision: "reembolsar",
    resolution: "motivo de prueba suficiente",
    motivo: "motivo de prueba suficiente",
    amount: 25000,
    monto: 25000,
    token: "tok-prueba",
    token_ws: "tok-prueba",
    ticket: "x",
    alta: "x",
    password: "Clave-Prueba-2026!",
    email: "persona@correo.cl",
    nombre: "Ana",
    rol: "soporte",
    accion: "listar",
    id: ID,
    userId: ID,
    title: "Hola",
    body: "Mensaje",
    returnUrl: "https://myworksapp-cl.vercel.app/pago",
    captchaToken: "captcha",
    guest: { email: "persona@correo.cl", name: "Ana", phone: "+56912345678" },
    servicio: ID,
    serviceId: ID,
    workerId: ID,
    direccion: "Calle Uno 123",
  };
  return [
    new Request(base, { method: "OPTIONS", headers: origen }),
    new Request(base, { method: "GET" }),
    new Request(
      `${base}?token_ws=tok-prueba&paymentId=${ID}&jobId=${JOB}&ticket=x&TBK_TOKEN=tok`,
      { method: "GET", headers: origen },
    ),
    new Request(base, { method: "POST", headers: origen }),
    new Request(base, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: "{roto",
    }),
    new Request(base, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
    new Request(base, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cuerpo,
        decision: "liberar",
        accion: "crear",
        rol: "administrador",
      }),
    }),
    new Request(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...origen,
      },
      body:
        `token_ws=tok-prueba&TBK_TOKEN=tok&TBK_ORDEN_COMPRA=A1&TBK_ID_SESION=${ID}`,
    }),
    new Request(base, { method: "PUT", headers: auth }),
  ];
};

const funciones = [...Deno.readDirSync(new URL(".", import.meta.url))]
  .filter((e) => e.isDirectory && !e.name.startsWith("_"))
  .map((e) => e.name)
  .sort();

for (const nombre of funciones) {
  Deno.test({
    name:
      `edge function ${nombre}: responde a pedidos válidos, rotos y con backend caído`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      for (const [k, v] of Object.entries(ENV)) Deno.env.set(k, v);
      const fetchReal = globalThis.fetch;
      const serveReal = Deno.serve;
      const logReal = [console.log, console.error, console.warn, console.info];
      let handler: Handler | null = null;
      // deno-lint-ignore no-explicit-any
      (Deno as any).serve = (a: unknown, b?: unknown) => {
        handler = (typeof a === "function"
          ? a
          : typeof b === "function"
          ? b
          : (a as { handler: Handler }).handler) as Handler;
        return {
          finished: Promise.resolve(),
          shutdown: () =>
            Promise.resolve(),
          ref() {},
          unref() {},
          addr: {},
        };
      };
      globalThis.fetch = fetchSimulado as typeof fetch;
      console.log =
        console.error =
        console.warn =
        console.info =
          () => {};
      try {
        await import(`./${nombre}/index.ts`);
        assert.ok(handler, `${nombre} no registró un manejador`);
        for (const m of ["anonimo", "usuario", "falla"] as const) {
          modo = m;
          for (const req of pedidos(nombre)) {
            const res = await (handler as Handler)(req);
            assert.ok(res instanceof Response, `${nombre} ${m} ${req.method}`);
            assert.ok(res.status >= 100 && res.status < 600);
            await res.body?.cancel();
          }
        }
      } finally {
        // deno-lint-ignore no-explicit-any
        (Deno as any).serve = serveReal;
        globalThis.fetch = fetchReal;
        [console.log, console.error, console.warn, console.info] = logReal;
      }
    },
  });
}
