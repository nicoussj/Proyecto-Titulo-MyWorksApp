import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { detailBuyOrder, freshBuyOrder } from "./buy_order.ts";
import { corsHeadersFor, jsonResponse } from "./cors.ts";
import { ipBloqueada, pagosPausados, registrosPausados } from "./defensa.ts";
import { jobHasOpenDispute } from "./dispute_guard.ts";
import { isKillSwitchOn, killSwitchResponse } from "./kill_switch.ts";
import { allowRate, clientIp, rateLimitExceededMessage } from "./rate_limit.ts";
import {
  asCoord,
  haversineKm,
  MAX_TRAVEL_WITH_SURCHARGE_KM,
  NEARBY_SERVICE_RADIUS_KM,
  quantizeChargeKm,
  resolveServiceRadiusKm,
  roundClp,
  TRANSPORT_MAX_SURCHARGE_CLP,
  TRANSPORT_MIN_SURCHARGE_CLP,
  transportExtraClp,
  transportQuote,
  withinTravelRange,
} from "./transport.ts";
import {
  allowedWebReturnOrigins,
  fallbackWebReturnOrigin,
  resolveCallerReturnOrigin,
  resolveReturnUrl,
  signGuestPasswordTicket,
  signHandoffTicket,
  verifyGuestPasswordTicket,
  verifyHandoffTicket,
  webPostMessageOrigins,
} from "./security.ts";

const VARS = [
  "CORS_ALLOWED_ORIGINS",
  "TBK_ENV",
  "MWA_KILL_WEBPAY",
  "MWA_RATE_LIMIT_FAIL_CLOSED",
  "WEBPAY_HANDOFF_SECRET",
  "WEBPAY_RETURN_URL",
  "SUPABASE_URL",
  "WEBPAY_ALLOWED_RETURN_ORIGINS",
  "WEBPAY_WEB_RETURN_URL",
];
afterEach(() => {
  for (const v of VARS) Deno.env.delete(v);
});

describe("orden de compra Oneclick", () => {
  it("primera orden, reintento, desborde y orden ajena", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    const first = freshBuyOrder(id, null);
    assert.equal(first.length, 26);
    assert.ok(first.endsWith("00"));
    assert.ok(freshBuyOrder(id, first).endsWith("01"));
    assert.ok(freshBuyOrder(id, first.slice(0, 24) + "ff").endsWith("00"));
    assert.ok(freshBuyOrder(id, first.slice(0, 24) + "zz").endsWith("00"));
    assert.ok(freshBuyOrder(id, "otra").endsWith("01"));
    assert.equal(detailBuyOrder(first), "B" + first.slice(1));
  });
});

describe("cabeceras CORS y respuestas JSON", () => {
  it("refleja el origen permitido y responde JSON", async () => {
    Deno.env.set("CORS_ALLOWED_ORIGINS", "https://a.cl");
    const req = new Request("https://x", {
      headers: { Origin: "https://a.cl" },
    });
    assert.equal(
      corsHeadersFor(req)["Access-Control-Allow-Origin"],
      "https://a.cl",
    );
    const sinOrigen = corsHeadersFor(new Request("https://x"));
    assert.equal(sinOrigen.Vary, "Origin");
    const res = jsonResponse(req, { ok: true }, 201);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("Content-Type"), "application/json");
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(jsonResponse(req, null).status, 200);
  });
});

describe("defensa del backend", () => {
  const cliente = (
    resp: { data: unknown; error: unknown },
    enDisputa = false,
  ) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) chain[m] = () => chain;
    chain.in = () => (enDisputa ? chain : Promise.resolve(resp));
    chain.limit = () => Promise.resolve(resp);
    return { from: () => chain } as never;
  };
  it("pausas activas, apagadas o sin migración", async () => {
    assert.equal(
      await pagosPausados(cliente({ data: [{ valor: "1" }], error: null })),
      true,
    );
    assert.equal(
      await registrosPausados(cliente({ data: [{ valor: "0" }], error: null })),
      false,
    );
    assert.equal(
      await pagosPausados(cliente({ data: null, error: { message: "x" } })),
      false,
    );
  });
  it("IP bloqueada, vacía, desconocida o con error", async () => {
    assert.equal(
      await ipBloqueada(
        cliente({ data: [{ id: 1 }], error: null }),
        " 1.2.3.4 ",
      ),
      true,
    );
    assert.equal(
      await ipBloqueada(cliente({ data: [], error: null }), "1.2.3.4"),
      false,
    );
    assert.equal(
      await ipBloqueada(
        cliente({ data: null, error: { message: "x" } }),
        "1.2.3.4",
      ),
      false,
    );
    assert.equal(
      await ipBloqueada(cliente({ data: [{ id: 1 }], error: null }), " "),
      false,
    );
    assert.equal(
      await ipBloqueada(cliente({ data: [{ id: 1 }], error: null }), "unknown"),
      false,
    );
  });
  it("disputa abierta, ninguna o error", async () => {
    assert.equal(
      await jobHasOpenDispute(
        cliente({ data: [{ id: 1 }], error: null }, true),
        "j",
      ),
      true,
    );
    assert.equal(
      await jobHasOpenDispute(cliente({ data: null, error: null }, true), "j"),
      false,
    );
    await assert.rejects(
      jobHasOpenDispute(
        cliente({ data: null, error: { message: "caída" } }, true),
        "j",
      ),
      /caída/,
    );
  });
});

describe("interruptores y límite de tasa en memoria", () => {
  it("interruptor encendido con 1, true u on", () => {
    assert.equal(isKillSwitchOn("MWA_KILL_WEBPAY"), false);
    for (const v of ["1", " TRUE ", "on"]) {
      Deno.env.set("MWA_KILL_WEBPAY", v);
      assert.equal(isKillSwitchOn("MWA_KILL_WEBPAY"), true);
    }
    Deno.env.set("MWA_KILL_WEBPAY", "no");
    assert.equal(isKillSwitchOn("MWA_KILL_WEBPAY"), false);
    assert.match(killSwitchResponse().error, /modo restringido/);
  });
  it("IP del cliente desde las cabeceras del borde", () => {
    const h = (o: Record<string, string>) =>
      new Request("https://x", { headers: o });
    assert.equal(clientIp(h({ "cf-connecting-ip": "1.1.1.1" })), "1.1.1.1");
    assert.equal(
      clientIp(h({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" })),
      "2.2.2.2",
    );
    assert.equal(clientIp(h({ "x-real-ip": "4.4.4.4" })), "4.4.4.4");
    assert.equal(clientIp(h({})), "unknown");
  });
  it("permite hasta el máximo, reinicia la ventana y falla cerrado sin clave", async () => {
    const k = `k-${crypto.randomUUID()}`;
    assert.equal(allowRate(k, 2, 20), true);
    assert.equal(allowRate(k, 2, 20), true);
    assert.equal(allowRate(k, 2, 20), false);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(allowRate(k, 2, 20), true);
    Deno.env.set("MWA_RATE_LIMIT_FAIL_CLOSED", "1");
    assert.equal(allowRate("  ", 5, 1000), false);
    Deno.env.delete("MWA_RATE_LIMIT_FAIL_CLOSED");
    assert.equal(allowRate("  ", 5, 1000), true);
    assert.match(rateLimitExceededMessage(), /Demasiados intentos/);
  });
});

describe("recargo de traslado", () => {
  it("coordenadas, distancia y redondeo", () => {
    assert.equal(asCoord(null), null);
    assert.equal(asCoord(""), null);
    assert.equal(asCoord("x"), null);
    assert.equal(asCoord("-41.47"), -41.47);
    assert.equal(haversineKm(0, 0, 0, 0), 0);
    assert.ok(
      Math.abs(haversineKm(-41.4693, -72.9424, -41.3193, -72.9854) - 17) < 1,
    );
    assert.equal(quantizeChargeKm(NaN), 0);
    assert.equal(quantizeChargeKm(-1), 0);
    assert.equal(quantizeChargeKm(1.23456), 1.235);
    assert.equal(roundClp(NaN), 0);
    assert.equal(roundClp(10.5), 11);
    assert.equal(roundClp(10.4), 10);
    assert.equal(roundClp(-10.5), -11);
  });
  it("radio, rango y cotización con mínimo y máximo", () => {
    assert.equal(resolveServiceRadiusKm(null), NEARBY_SERVICE_RADIUS_KM);
    assert.equal(resolveServiceRadiusKm(0), NEARBY_SERVICE_RADIUS_KM);
    assert.equal(resolveServiceRadiusKm(12), 12);
    assert.equal(withinTravelRange(null), true);
    assert.equal(withinTravelRange(NaN), true);
    assert.equal(withinTravelRange(MAX_TRAVEL_WITH_SURCHARGE_KM), true);
    assert.equal(withinTravelRange(MAX_TRAVEL_WITH_SURCHARGE_KM + 1), false);
    assert.deepEqual(
      transportQuote({ workerLat: null, workerLng: 1, jobLat: 1, jobLng: 1 }),
      { distanceKm: null, extraClp: 0 },
    );
    assert.equal(
      transportQuote({ workerLat: 0, workerLng: 0, jobLat: 0, jobLng: 0 })
        .extraClp,
      0,
    );
    const cerca = { workerLat: 0, workerLng: 0, jobLat: 0.0725, jobLng: 0 };
    assert.equal(transportExtraClp(cerca), TRANSPORT_MIN_SURCHARGE_CLP);
    assert.equal(
      transportExtraClp({ workerLat: 0, workerLng: 0, jobLat: 0.5, jobLng: 0 }),
      TRANSPORT_MAX_SURCHARGE_CLP,
    );
    const medio = transportQuote({
      workerLat: 0,
      workerLng: 0,
      jobLat: 0.1,
      jobLng: 0,
      radiusKm: 5,
    });
    assert.ok(
      medio.extraClp > TRANSPORT_MIN_SURCHARGE_CLP &&
        medio.extraClp < TRANSPORT_MAX_SURCHARGE_CLP,
    );
  });
});

describe("tickets firmados y orígenes de retorno", () => {
  const alterar = (t: string) => t.slice(0, -1) + (t.endsWith("0") ? "1" : "0");
  it("sin secreto o con secreto corto no firma", async () => {
    await assert.rejects(signHandoffTicket("p"), /WEBPAY_HANDOFF_SECRET/);
    Deno.env.set("WEBPAY_HANDOFF_SECRET", "corto");
    await assert.rejects(signHandoffTicket("p"), /WEBPAY_HANDOFF_SECRET/);
  });
  it("ticket de handoff válido, alterado, vencido o mal formado", async () => {
    Deno.env.set("WEBPAY_HANDOFF_SECRET", "secreto-de-prueba-largo");
    const t = await signHandoffTicket("pago1");
    assert.deepEqual(await verifyHandoffTicket(t), {
      ok: true,
      paymentId: "pago1",
    });
    assert.deepEqual(await verifyHandoffTicket(alterar(t)), {
      ok: false,
      error: "firma inválida",
    });
    assert.deepEqual(await verifyHandoffTicket(t + "0"), {
      ok: false,
      error: "firma inválida",
    });
    assert.deepEqual(await verifyHandoffTicket("a.b"), {
      ok: false,
      error: "ticket inválido",
    });
    assert.deepEqual(await verifyHandoffTicket(".1.x"), {
      ok: false,
      error: "ticket inválido",
    });
    assert.deepEqual(await verifyHandoffTicket("p.x.y"), {
      ok: false,
      error: "ticket inválido",
    });
    assert.deepEqual(
      await verifyHandoffTicket(await signHandoffTicket("p", -10)),
      { ok: false, error: "ticket expirado" },
    );
  });
  it("ticket de contraseña del invitado", async () => {
    Deno.env.set("WEBPAY_HANDOFF_SECRET", "secreto-de-prueba-largo");
    const t = await signGuestPasswordTicket("u1", "j1");
    assert.deepEqual(await verifyGuestPasswordTicket(t), {
      ok: true,
      userId: "u1",
      jti: "j1",
    });
    assert.deepEqual(await verifyGuestPasswordTicket(alterar(t)), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(await verifyGuestPasswordTicket("x.u.1.j.s"), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(await verifyGuestPasswordTicket("pwd.u.1"), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(await verifyGuestPasswordTicket("pwd..1.j.s"), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(await verifyGuestPasswordTicket("pwd.u.x.j.s"), {
      ok: false,
      error: "enlace inválido",
    });
    assert.deepEqual(
      await verifyGuestPasswordTicket(
        await signGuestPasswordTicket("u", "j", -10),
      ),
      {
        ok: false,
        error: "el enlace para crear la contraseña expiró",
      },
    );
  });
  it("URL de retorno de Transbank", () => {
    Deno.env.set("SUPABASE_URL", "https://proyecto.supabase.co");
    const base = "https://proyecto.supabase.co/functions/v1/webpay-commit";
    assert.equal(resolveReturnUrl(undefined), base);
    assert.equal(resolveReturnUrl("no url"), base);
    assert.equal(
      resolveReturnUrl("https://proyecto.supabase.co/otra"),
      "https://proyecto.supabase.co/otra",
    );
    assert.equal(
      resolveReturnUrl("http://localhost:5173/r"),
      "http://localhost:5173/r",
    );
    assert.equal(resolveReturnUrl("https://malo.cl/r"), base);
    Deno.env.set("TBK_ENV", "production");
    assert.equal(resolveReturnUrl("http://localhost:5173/r"), base);
    Deno.env.set("WEBPAY_ALLOWED_RETURN_ORIGINS", "https://a.cl, ");
    Deno.env.set("WEBPAY_RETURN_URL", "https://edge.cl/commit");
    assert.equal(resolveReturnUrl("https://a.cl/r"), "https://a.cl/r");
    assert.equal(
      resolveReturnUrl("http://localhost:5173/r"),
      "https://edge.cl/commit",
    );
  });
  it("origen del llamador, respaldo y postMessage", () => {
    Deno.env.set("WEBPAY_ALLOWED_RETURN_ORIGINS", "https://a.cl");
    const r = (o?: string) =>
      new Request("https://x", { headers: o ? { Origin: o } : {} });
    assert.ok(allowedWebReturnOrigins().includes("https://a.cl"));
    assert.equal(resolveCallerReturnOrigin(r("https://a.cl")), "https://a.cl");
    assert.equal(resolveCallerReturnOrigin(r()), null);
    assert.equal(resolveCallerReturnOrigin(r("https://a.cl/")), null);
    assert.equal(resolveCallerReturnOrigin(r("no url")), null);
    assert.equal(resolveCallerReturnOrigin(r("https://b.cl")), null);
    assert.deepEqual(webPostMessageOrigins(), ["https://a.cl"]);
    Deno.env.delete("WEBPAY_ALLOWED_RETURN_ORIGINS");
    assert.equal(webPostMessageOrigins().length, 4);
    assert.ok(fallbackWebReturnOrigin().startsWith("https://"));
    Deno.env.set("TBK_ENV", "production");
    assert.deepEqual(webPostMessageOrigins(), []);
    assert.throws(() => fallbackWebReturnOrigin(), /origen de retorno ausente/);
    Deno.env.set("WEBPAY_WEB_RETURN_URL", " https://w.cl ");
    assert.equal(fallbackWebReturnOrigin(), "https://w.cl");
  });
});

describe("clientes de Supabase", () => {
  it("crea el cliente del usuario y el de servicio sin conectarse", async () => {
    const { serviceClient, userClient } = await import("./supabase.ts");
    Deno.env.set("SUPABASE_URL", "https://proyecto.supabase.co");
    Deno.env.set("SUPABASE_ANON_KEY", "anon-de-prueba");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "servicio-de-prueba");
    try {
      const req = new Request("https://x", {
        headers: { Authorization: "Bearer t" },
      });
      assert.equal(typeof userClient(req).from, "function");
      assert.equal(
        typeof userClient(new Request("https://x")).from,
        "function",
      );
      assert.equal(typeof serviceClient().rpc, "function");
    } finally {
      Deno.env.delete("SUPABASE_ANON_KEY");
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
