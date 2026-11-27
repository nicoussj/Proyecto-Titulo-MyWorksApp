import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  oneclickConfig,
  OneclickInscriptionInactiveError,
  tbkCommit,
  tbkConfig,
  tbkCreateTransaction,
  tbkOneclickAuthorize,
  tbkOneclickDeleteInscription,
  tbkOneclickFinish,
  tbkOneclickRefund,
  tbkOneclickStart,
  tbkOneclickStatus,
  tbkRefund,
  tbkTransactionStatus,
} from "./tbk.ts";

/**
 * Pruebas del cliente HTTP de Transbank con un fetch simulado.
 * No hay red: cada respuesta la entrega la cola `respuestas`.
 */
type Paso = Response | Error;
let respuestas: Paso[] = [];
let llamadas: Array<{ url: string; init: RequestInit }> = [];
const fetchReal = globalThis.fetch;
const timeoutReal = globalThis.setTimeout;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  respuestas = [];
  llamadas = [];
  Deno.env.set("TBK_ENV", "integration");
  for (
    const k of [
      "TBK_COMMERCE_CODE",
      "TBK_API_KEY",
      "TBK_ONECLICK_COMMERCE_CODE",
      "TBK_ONECLICK_API_KEY",
      "TBK_ONECLICK_CHILD_CODE",
    ]
  ) {
    Deno.env.delete(k);
  }
  globalThis.fetch = ((url: string, init: RequestInit) => {
    llamadas.push({ url: String(url), init });
    const next = respuestas.shift();
    if (!next) return Promise.reject(new Error("sin respuesta simulada"));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as typeof fetch;
  // Las esperas entre reintentos se acortan para que la prueba no dure segundos.
  globalThis.setTimeout = ((fn: () => void, ms?: number) =>
    timeoutReal(fn, Math.min(ms ?? 0, 1))) as typeof setTimeout;
});
afterEach(() => {
  globalThis.fetch = fetchReal;
  globalThis.setTimeout = timeoutReal;
  Deno.env.delete("TBK_ENV");
});

describe("Webpay Plus por HTTP", () => {
  it("configuración de integración desde el entorno", () => {
    assert.equal(tbkConfig().env, "integration");
    assert.equal(oneclickConfig().env, "integration");
  });

  it("crea, consulta, confirma y reembolsa con las cabeceras del comercio", async () => {
    respuestas.push(
      json(200, { token: "t1", url: "https://webpay3gint.transbank.cl/pay" }),
      json(200, { status: "AUTHORIZED", response_code: 0 }),
      json(200, { status: "AUTHORIZED", amount: 1000 }),
      json(200, { type: "REVERSED" }),
    );
    const created = await tbkCreateTransaction({
      buyOrder: "o1",
      sessionId: "s1",
      amount: 1000.4,
      returnUrl: "https://x/r",
    });
    assert.deepEqual(created, {
      token: "t1",
      url: "https://webpay3gint.transbank.cl/pay",
    });
    assert.equal(JSON.parse(String(llamadas[0].init.body)).amount, 1000);
    assert.equal(
      (llamadas[0].init.headers as Record<string, string>)["Tbk-Api-Key-Id"],
      "597055555532",
    );
    assert.equal((await tbkTransactionStatus("t1"))?.status, "AUTHORIZED");
    assert.equal((await tbkCommit("t1")).amount, 1000);
    assert.equal((await tbkRefund("t1", 999.6)).type, "REVERSED");
    assert.equal(JSON.parse(String(llamadas[3].init.body)).amount, 1000);
  });

  it("reintenta una vez ante 5xx o error de red y luego falla", async () => {
    respuestas.push(json(503, {}), json(200, { token: "t2", url: "u" }));
    assert.equal(
      (await tbkCreateTransaction({
        buyOrder: "o",
        sessionId: "s",
        amount: 1,
        returnUrl: "r",
      })).token,
      "t2",
    );
    respuestas.push(new Error("red caída"), new Error("red caída"));
    await assert.rejects(tbkCommit("t"), /red caída/);
    respuestas.push(new Error("uno"), json(200, { ok: 1 }));
    assert.deepEqual(await tbkCommit("t"), { ok: 1 });
    respuestas.push(json(502, { e: 1 }), json(502, { e: 2 }));
    await assert.rejects(tbkCommit("t"), /e/);
  });

  it("un rechazo no Error en el último intento usa el mensaje genérico", async () => {
    globalThis.fetch =
      (() => Promise.reject("texto")) as unknown as typeof fetch;
    await assert.rejects(tbkCommit("t"), /TBK timeout/);
  });

  it("errores del portal en crear, consultar, confirmar y reembolsar", async () => {
    respuestas.push(json(400, { error_message: "monto" }));
    await assert.rejects(
      tbkCreateTransaction({
        buyOrder: "o",
        sessionId: "s",
        amount: 1,
        returnUrl: "r",
      }),
      /monto/,
    );
    respuestas.push(json(404, {}));
    assert.equal(await tbkTransactionStatus("x"), null);
    respuestas.push(json(422, {}));
    await assert.rejects(
      tbkTransactionStatus("x"),
      /No se pudo consultar Transbank/,
    );
    respuestas.push(json(422, { error_message: "token" }));
    await assert.rejects(tbkCommit("x"), /token/);
    respuestas.push(json(422, { error_message: "ya reembolsado" }));
    await assert.rejects(tbkRefund("x", 1), /ya reembolsado/);
    respuestas.push(json(400, "texto"), json(400, "texto"), json(400, "texto"));
    await assert.rejects(
      tbkCreateTransaction({
        buyOrder: "o",
        sessionId: "s",
        amount: 1,
        returnUrl: "r",
      }),
      /TBK create failed 400|texto/,
    );
    await assert.rejects(tbkCommit("x"), /TBK commit failed 400|texto/);
    await assert.rejects(tbkRefund("x", 1), /TBK refund failed 400|texto/);
  });
});

describe("Oneclick Mall por HTTP", () => {
  it("inscribe, confirma, consulta, cobra, quita y reembolsa", async () => {
    respuestas.push(
      json(200, {
        token: "ins",
        url_webpay: "https://webpay3gint.transbank.cl/inscripcion",
      }),
      json(200, { response_code: 0, tbk_user: "u1" }),
      json(200, { buy_order: "b1" }),
      json(200, { details: [{ response_code: 0 }] }),
      new Response(null, { status: 204 }),
      json(200, { type: "REVERSED" }),
    );
    const start = await tbkOneclickStart({
      username: "x".repeat(60),
      email: "a@b.cl",
      responseUrl: "https://x/r",
    });
    assert.deepEqual(start, {
      token: "ins",
      url: "https://webpay3gint.transbank.cl/inscripcion",
    });
    assert.equal(JSON.parse(String(llamadas[0].init.body)).username.length, 40);
    assert.equal((await tbkOneclickFinish("ins")).tbk_user, "u1");
    assert.equal((await tbkOneclickStatus("b1"))?.buy_order, "b1");
    const auth = await tbkOneclickAuthorize({
      username: "u",
      tbkUser: "u1",
      buyOrder: "b".repeat(30),
      detailBuyOrder: "d".repeat(30),
      amount: 1500.2,
    });
    assert.ok(auth.details);
    const body = JSON.parse(String(llamadas[3].init.body));
    assert.equal(body.buy_order.length, 26);
    assert.equal(body.details[0].amount, 1500);
    await tbkOneclickDeleteInscription({ username: "u", tbkUser: "u1" });
    assert.equal(
      (await tbkOneclickRefund({
        buyOrder: "b1",
        detailBuyOrder: "d1",
        amount: 1500,
      })).type,
      "REVERSED",
    );
  });

  it("errores de Oneclick con mensajes para la persona", async () => {
    respuestas.push(json(200, { token: "" }));
    await assert.rejects(
      tbkOneclickStart({ username: "u", email: "e", responseUrl: "r" }),
      /No se pudo iniciar la inscripción/,
    );
    respuestas.push(json(400, {}));
    await assert.rejects(
      tbkOneclickFinish("t"),
      /Transbank no confirmó la tarjeta/,
    );
    respuestas.push(json(404, {}));
    assert.equal(await tbkOneclickStatus("b"), null);
    respuestas.push(new Response("no json", { status: 200 }));
    assert.equal(await tbkOneclickStatus("b"), null);
    respuestas.push(json(400, { x: 1 }));
    assert.equal(await tbkOneclickStatus("b"), null);
    respuestas.push(
      json(422, { error_message: "Inscription not found or inactive" }),
    );
    await assert.rejects(
      tbkOneclickAuthorize({
        username: "u",
        tbkUser: "x",
        buyOrder: "b",
        detailBuyOrder: "d",
        amount: 1,
      }),
      OneclickInscriptionInactiveError,
    );
    respuestas.push(new Response("no json", { status: 400 }));
    await assert.rejects(
      tbkOneclickAuthorize({
        username: "u",
        tbkUser: "x",
        buyOrder: "b",
        detailBuyOrder: "d",
        amount: 1,
      }),
      /El banco rechazó el cobro/,
    );
    respuestas.push(
      new Response(null, { status: 404 }),
      new Response(null, { status: 422 }),
    );
    await tbkOneclickDeleteInscription({ username: "u", tbkUser: "x" });
    await tbkOneclickDeleteInscription({ username: "u", tbkUser: "x" });
    respuestas.push(new Response(null, { status: 400 }));
    await assert.rejects(
      tbkOneclickDeleteInscription({ username: "u", tbkUser: "x" }),
      /No se pudo quitar la tarjeta/,
    );
    respuestas.push(json(400, {}));
    await assert.rejects(
      tbkOneclickRefund({ buyOrder: "b", detailBuyOrder: "d", amount: 1 }),
      /No se pudo devolver el cobro/,
    );
  });
});
