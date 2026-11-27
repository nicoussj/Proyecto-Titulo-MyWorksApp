import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { refundHeldPaymentOnce } from "./refund_once.ts";
import {
  formatClp,
  formatSantiago,
  guestPasswordUrl,
  isDemoAccountEmail,
  scheduleGuestPasswordEmail,
  schedulePaymentReceivedEmail,
  scheduleRefundEmail,
  scheduleReleasedEmail,
} from "./payment_mail.ts";
import { chargeInscribedCard, expectedJobAmount } from "./oneclick_charge.ts";

/**
 * Cliente de servicio simulado: cada consulta toma la siguiente respuesta
 * del guion según "tabla:tipo" (select, update o insert), "rpc:nombre" o
 * "user:id". No hay base de datos ni red.
 */
type Resp = { data?: unknown; error?: unknown; count?: number };
function fakeAdmin(guion: Record<string, Resp[]>) {
  const log: string[] = [];
  const take = (k: string): Resp => {
    log.push(k);
    return guion[k]?.shift() ?? { data: null, error: null };
  };
  const from = (table: string) => {
    let kind = "select";
    const b: Record<string, unknown> = {};
    for (const m of ["select", "update", "insert", "eq", "in", "is", "limit"]) {
      b[m] = () => {
        if (m === "update" || m === "insert") kind = m;
        return b;
      };
    }
    const done = () => Promise.resolve(take(`${table}:${kind}`));
    b.maybeSingle = done;
    b.single = done;
    b.then = (ok: (v: Resp) => unknown, ko: (e: unknown) => unknown) =>
      done().then(ok, ko);
    return b;
  };
  return {
    log,
    from,
    rpc: (n: string) => Promise.resolve(take(`rpc:${n}`)),
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve(take(`user:${id}`)) as never,
      },
    },
  };
}

type Paso = Response | Error;
let respuestas: Paso[] = [];
let llamadas: Array<{ url: string; init: RequestInit }> = [];
const fetchReal = globalThis.fetch;
const timeoutReal = globalThis.setTimeout;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  respuestas = [];
  llamadas = [];
  Deno.env.set("TBK_ENV", "integration");
  globalThis.fetch = ((url: string, init: RequestInit) => {
    llamadas.push({ url: String(url), init });
    const next = respuestas.shift();
    if (!next) return Promise.reject(new Error("sin respuesta simulada"));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as typeof fetch;
  globalThis.setTimeout = ((fn: () => void, ms?: number) =>
    timeoutReal(fn, Math.min(ms ?? 0, 1))) as typeof setTimeout;
});
afterEach(() => {
  globalThis.fetch = fetchReal;
  globalThis.setTimeout = timeoutReal;
  for (const k of ["TBK_ENV", "RESEND_API_KEY", "RESEND_FROM"]) {
    Deno.env.delete(k);
  }
  delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
});

describe("reembolso una sola vez", () => {
  const pago = (extra: Record<string, unknown>) => ({
    id: "p1",
    monto: 25000,
    token_tbk: "tok",
    estado: "retenido",
    id_trabajo: "j1",
    metodo_pago: "webpay",
    reembolso_solicitado_en: null,
    ...extra,
  });
  const actualizado = { id: "p1", id_trabajo: "j1", estado: "reembolsado" };

  it("pago inexistente, ya reembolsado, liberado o en estado no reembolsable", async () => {
    await assert.rejects(
      refundHeldPaymentOnce(fakeAdmin({}), "p1"),
      /Pago no encontrado/,
    );
    await assert.rejects(
      refundHeldPaymentOnce(
        fakeAdmin({ "pagos:select": [{ error: { message: "x" } }] }),
        "p1",
      ),
      /Pago no encontrado/,
    );
    const ya = await refundHeldPaymentOnce(
      fakeAdmin({
        "pagos:select": [{ data: pago({ estado: "reembolsado" }) }],
      }),
      "p1",
    );
    assert.equal(ya.status, "already");
    await assert.rejects(
      refundHeldPaymentOnce(
        fakeAdmin({ "pagos:select": [{ data: pago({ estado: "liberado" }) }] }),
        "p1",
      ),
      /ya fue liberado/,
    );
    await assert.rejects(
      refundHeldPaymentOnce(
        fakeAdmin({ "pagos:select": [{ data: pago({ estado: "fallido" }) }] }),
        "p1",
      ),
      /Estado no reembolsable/,
    );
  });

  it("Webpay: reclama, devuelve a la tarjeta y cierra el pedido si no quedan cobros", async () => {
    respuestas.push(json(200, { type: "REVERSED" }));
    const admin = fakeAdmin({
      "pagos:select": [{ data: pago({}) }, { count: 0, error: null }],
      "pagos:update": [{ data: { id: "p1" } }, { data: actualizado }],
    });
    const r = await refundHeldPaymentOnce(admin, "p1");
    assert.equal(r.status, "refunded");
    assert.match(llamadas[0].url, /transactions\/tok\/refunds/);
    assert.ok(admin.log.includes("trabajos:update"));
  });

  it("Oneclick con cobros pendientes no cierra el pedido", async () => {
    respuestas.push(json(200, { type: "REVERSED" }));
    const admin = fakeAdmin({
      "pagos:select": [
        {
          data: pago({
            metodo_pago: "oneclick",
            buy_order: "A1",
            orden_detalle_oneclick: "B1",
          }),
        },
        { count: 2, error: null },
      ],
      "pagos:update": [{ data: { id: "p1" } }, { data: actualizado }],
    });
    await refundHeldPaymentOnce(admin, "p1");
    assert.match(llamadas[0].url, /oneclick.*A1\/refunds/);
    assert.equal(admin.log.includes("trabajos:update"), false);
  });

  it("si Transbank falla se libera el reclamo y se relanza", async () => {
    respuestas.push(json(400, { error_message: "no" }));
    const admin = fakeAdmin({
      "pagos:select": [{
        data: pago({
          metodo_pago: "oneclick",
          buy_order: "A1",
          token_tbk: "B1",
        }),
      }],
      "pagos:update": [{ data: { id: "p1" } }],
    });
    await assert.rejects(
      refundHeldPaymentOnce(admin, "p1"),
      /No se pudo devolver/,
    );
    assert.equal(admin.log.filter((k) => k === "pagos:update").length, 2);
  });

  it("reclamo perdido: otro proceso ya reembolsó o sigue en curso", async () => {
    const ya = fakeAdmin({
      "pagos:select": [{ data: pago({}) }, { data: { estado: "reembolsado" } }],
      "pagos:update": [{ data: null }],
    });
    assert.equal((await refundHeldPaymentOnce(ya, "p1")).status, "already");
    const curso = fakeAdmin({
      "pagos:select": [{ data: pago({}) }, { data: null }],
    });
    await assert.rejects(
      refundHeldPaymentOnce(curso, "p1"),
      /Reembolso en curso/,
    );
  });

  it("sin token: producción lo rechaza; integración solo marca el pago", async () => {
    Deno.env.set("TBK_ENV", "production");
    const prod = fakeAdmin({
      "pagos:select": [{ data: pago({ token_tbk: null }) }],
      "pagos:update": [{ data: { id: "p1" } }],
    });
    await assert.rejects(refundHeldPaymentOnce(prod, "p1"), /no tiene token/);
    Deno.env.set("TBK_ENV", "integration");
    const integ = fakeAdmin({
      "pagos:select": [{
        data: pago({ token_tbk: null, metodo_pago: "oneclick" }),
      }],
      "pagos:update": [{ data: { id: "p1" } }, {
        data: { id: "p1", id_trabajo: null },
      }],
    });
    assert.equal((await refundHeldPaymentOnce(integ, "p1")).status, "refunded");
    assert.equal(llamadas.length, 0);
  });

  it("reclamo previo pasa directo al registro y falla si la base no responde", async () => {
    const admin = fakeAdmin({
      "pagos:select": [{
        data: pago({ reembolso_solicitado_en: "2026-11-27T00:00:00Z" }),
      }],
      "pagos:update": [{ error: { message: "x" } }],
    });
    await assert.rejects(
      refundHeldPaymentOnce(admin, "p1"),
      /No se pudo registrar el reembolso/,
    );
  });
});

describe("correos de pago", () => {
  it("montos, fechas, cuentas demo y enlace de alta", () => {
    assert.equal(formatClp(1234567), "$1.234.567");
    assert.equal(formatClp(-1500.4), "-$1.500");
    assert.equal(formatClp(Number.NaN), "$0");
    assert.equal(formatSantiago(null), "Por coordinar");
    assert.equal(formatSantiago("no fecha"), "Por coordinar");
    assert.match(formatSantiago("2026-12-01"), /01 de diciembre de 2026/);
    assert.match(formatSantiago("2026-12-01T15:30:00Z"), /2026/);
    assert.equal(isDemoAccountEmail("a@demo.com"), true);
    assert.equal(isDemoAccountEmail("a@demo.myworksapp.cl."), true);
    assert.equal(isDemoAccountEmail("sin-arroba"), false);
    assert.equal(isDemoAccountEmail("a@b.cl"), false);
    const conHttps = guestPasswordUrl({
      origin: "cl.myworksapp.auth://r",
      paymentId: "p",
      jobId: "j",
      alta: "t",
      webReturnUrl: "https://w.cl/",
    });
    assert.ok(conHttps.startsWith("https://w.cl/"));
    const sinHttps = guestPasswordUrl({
      origin: "https://a.cl",
      paymentId: "p",
      jobId: "j",
      alta: "t",
      webReturnUrl: null,
    });
    assert.ok(sinHttps.startsWith("https://a.cl"));
  });

  const enviar = async (fn: () => void) => {
    const tareas: Promise<unknown>[] = [];
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = {
      waitUntil: (p: Promise<unknown>) => tareas.push(p),
    };
    fn();
    await Promise.all(tareas);
  };
  const destinatarios = () =>
    llamadas.map((l) => JSON.parse(String(l.init.body)).to[0] as string);
  const hechos = (extra: Record<string, Resp[]> = {}) =>
    fakeAdmin({
      "pagos:select": [{
        data: {
          id: "p1",
          monto: 25000,
          buy_order: "A1",
          id_trabajo: "j1",
          creado_en: "2026-11-27",
        },
      }],
      "trabajos:select": [{
        data: {
          id_usuario: "c1",
          id_trabajador: "w1",
          id_servicio: "s1",
          fecha_programada: null,
        },
      }],
      "servicios:select": [{ data: { nombre: "Gasfitería" } }],
      "user:c1": [{ data: { user: { email: "cliente@correo.cl" } } }],
      "user:w1": [{ data: { user: { email: "pro@correo.cl" } } }],
      ...extra,
    });
  const resend = (n: number) => {
    Deno.env.set("RESEND_API_KEY", "re_prueba");
    Deno.env.set("RESEND_FROM", "MyWorksApp <hola@myworksapp.cl>");
    for (let i = 0; i < n; i++) respuestas.push(json(200, { id: `em_${i}` }));
  };

  it("pago recibido llega al cliente y al profesional", async () => {
    resend(2);
    await enviar(() => schedulePaymentReceivedEmail(hechos() as never, "p1"));
    assert.deepEqual(destinatarios(), ["cliente@correo.cl", "pro@correo.cl"]);
    assert.match(String(llamadas[0].init.body), /Gasfiter/);
  });

  it("no escribe a cuentas demo, reservadas, sin correo ni repetidas", async () => {
    resend(1);
    await enviar(() =>
      schedulePaymentReceivedEmail(
        hechos({
          "servicios:select": [{ error: { message: "x" } }],
          "user:w1": [{ data: { user: { email: "cliente@correo.cl" } } }],
        }) as never,
        "p1",
      )
    );
    assert.deepEqual(destinatarios(), ["cliente@correo.cl"]);
    const casos: Resp[] = [
      { error: { message: "x" } },
      { data: { user: null } },
      { data: { user: { email: " " } } },
      {
        data: { user: { email: "a@b.cl", user_metadata: { es_demo: "true" } } },
      },
      { data: { user: { email: "a@demo.com" } } },
      { data: { user: { email: "a@example.com" } } },
    ];
    for (const c of casos) {
      llamadas = [];
      await enviar(() =>
        scheduleRefundEmail(hechos({ "user:c1": [c] }) as never, "p1")
      );
      assert.equal(llamadas.length, 0);
    }
    await enviar(() =>
      scheduleReleasedEmail(
        hechos({ "trabajadores:select": [{ data: { es_demo: 1 } }] }) as never,
        "p1",
      )
    );
    assert.equal(llamadas.length, 0);
  });

  it("alta de invitado, reembolso y liberación", async () => {
    resend(3);
    await enviar(() =>
      scheduleGuestPasswordEmail(hechos() as never, "p1", "https://a.cl/alta")
    );
    await enviar(() => scheduleRefundEmail(hechos() as never, "p1"));
    await enviar(() => scheduleReleasedEmail(hechos() as never, "p1"));
    assert.deepEqual(destinatarios(), [
      "cliente@correo.cl",
      "cliente@correo.cl",
      "pro@correo.cl",
    ]);
  });

  it("sin pago, sin enlace, sin cliente o sin profesional no envía", async () => {
    resend(0);
    const sinPago = () => fakeAdmin({});
    await enviar(() => schedulePaymentReceivedEmail(sinPago() as never, "p1"));
    await enviar(() =>
      scheduleGuestPasswordEmail(sinPago() as never, "p1", " ")
    );
    await enviar(() =>
      scheduleGuestPasswordEmail(sinPago() as never, "p1", "https://a.cl")
    );
    await enviar(() => scheduleRefundEmail(sinPago() as never, "p1"));
    await enviar(() => scheduleReleasedEmail(sinPago() as never, "p1"));
    const sinGente = () =>
      fakeAdmin({
        "pagos:select": [{ data: { id: "p1", id_trabajo: null, monto: null } }],
      });
    await enviar(() =>
      scheduleGuestPasswordEmail(sinGente() as never, "p1", "https://a.cl")
    );
    await enviar(() => scheduleReleasedEmail(sinGente() as never, "p1"));
    await enviar(() => schedulePaymentReceivedEmail(sinGente() as never, "p1"));
    const sinPro = hechos({ "user:w1": [{ data: { user: null } }] });
    await enviar(() => scheduleReleasedEmail(sinPro as never, "p1"));
    assert.equal(llamadas.length, 0);
  });
});

describe("cobro con tarjeta inscrita", () => {
  const input = (pago: Record<string, unknown>) => ({
    userId: "u1",
    username: "ana",
    tbkUser: "tu",
    jobId: "j1",
    amountClp: 25000.4,
    payment: { id: "12345678-1234-1234-1234-123456789abc", ...pago },
  });
  const autorizado = () =>
    json(200, { details: [{ response_code: 0, authorization_code: "1213" }] });
  const rechazado = () => json(200, { details: [{ response_code: -96 }] });

  it("pago ya retenido solo abre el pedido", async () => {
    const admin = fakeAdmin({});
    const r = await chargeInscribedCard(
      admin as never,
      input({ estado: "retenido" }),
    );
    assert.equal(r.amount, 25000);
    assert.deepEqual(admin.log, ["trabajos:update"]);
  });

  it("orden previa autorizada se registra sin volver a cobrar", async () => {
    respuestas.push(autorizado());
    const admin = fakeAdmin({});
    await chargeInscribedCard(
      admin as never,
      input({
        buy_order: "A0",
        metodo_pago: "oneclick",
        id_orden_cambio: "oc1",
      }),
    );
    assert.deepEqual(admin.log, [
      "pagos:update",
      "rpc:marcar_orden_cambio_pagada",
    ]);
  });

  it("orden previa rechazada usa una orden nueva y el reclamo listo abre el pedido", async () => {
    respuestas.push(rechazado());
    const admin = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "listo" }],
    });
    await chargeInscribedCard(
      admin as never,
      input({ buy_order: "A0", metodo_pago: "oneclick" }),
    );
    assert.deepEqual(admin.log, [
      "rpc:reclamar_cobro_oneclick",
      "trabajos:update",
    ]);
  });

  it("reclamo con error: cobro en curso u otro", async () => {
    await assert.rejects(
      chargeInscribedCard(
        fakeAdmin({
          "rpc:reclamar_cobro_oneclick": [{
            error: { message: "cobro en curso" },
          }],
        }) as never,
        input({}),
      ),
      /pago Webpay en curso/,
    );
    await assert.rejects(
      chargeInscribedCard(
        fakeAdmin({ "rpc:reclamar_cobro_oneclick": [{ error: {} }] }) as never,
        input({}),
      ),
      /No se pudo preparar el cobro/,
    );
  });

  it("Transbank ya autorizó la orden reclamada", async () => {
    respuestas.push(json(200, { details: [{ response_code: 0 }] }));
    const admin = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "nuevo" }],
    });
    await chargeInscribedCard(
      admin as never,
      input({ buy_order: "A0", metodo_pago: "webpay" }),
    );
    assert.deepEqual(admin.log, [
      "rpc:reclamar_cobro_oneclick",
      "pagos:update",
      "trabajos:update",
    ]);
  });

  it("cobro en curso: ya retenido, carrera autorizada, carrera pendiente y sin orden", async () => {
    const enCurso = (row: unknown) =>
      fakeAdmin({
        "rpc:reclamar_cobro_oneclick": [{ data: "en_curso" }],
        "pagos:select": [{ data: row }],
      });
    respuestas.push(new Response(null, { status: 404 }));
    const a = enCurso({ estado: "autorizado" });
    await chargeInscribedCard(a as never, input({}));
    assert.equal(a.log.at(-1), "trabajos:update");

    respuestas.push(new Response(null, { status: 404 }), autorizado());
    const b = enCurso({ estado: "pendiente", buy_order: "A9" });
    await chargeInscribedCard(b as never, input({}));
    assert.ok(b.log.includes("pagos:update"));

    respuestas.push(
      new Response(null, { status: 404 }),
      json(200, { details: [] }),
    );
    await assert.rejects(
      chargeInscribedCard(
        enCurso({ estado: "pendiente", buy_order: "A9" }) as never,
        input({}),
      ),
      /cobro en curso/,
    );

    respuestas.push(new Response(null, { status: 404 }));
    await assert.rejects(
      chargeInscribedCard(enCurso(null) as never, input({})),
      /cobro en curso/,
    );
  });

  it("autoriza, rechaza o falla la autorización", async () => {
    respuestas.push(new Response(null, { status: 404 }), autorizado());
    const ok = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "nuevo" }],
    });
    const r = await chargeInscribedCard(ok as never, input({}));
    assert.equal(r.paymentId, "12345678-1234-1234-1234-123456789abc");
    assert.match(String(llamadas[1].init.body), /"amount":25000/);

    respuestas.push(new Response(null, { status: 404 }), rechazado());
    const no = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "nuevo" }],
    });
    await assert.rejects(
      chargeInscribedCard(no as never, input({})),
      /no autorizó/,
    );
    assert.ok(no.log.includes("pagos:update"));

    respuestas.push(
      new Response(null, { status: 404 }),
      json(400, { error_message: "x" }),
    );
    const falla = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "nuevo" }],
    });
    await assert.rejects(chargeInscribedCard(falla as never, input({})));
    assert.ok(falla.log.includes("pagos:update"));

    respuestas.push(new Response(null, { status: 404 }), autorizado());
    const sinRegistro = fakeAdmin({
      "rpc:reclamar_cobro_oneclick": [{ data: "nuevo" }],
      "pagos:update": [{ error: { message: "x" } }],
    });
    await assert.rejects(
      chargeInscribedCard(sinRegistro as never, input({})),
      /No se pudo registrar el cobro/,
    );
  });
});

describe("monto esperado del pedido", () => {
  const faltaRpc = {
    error: { message: "function monto_esperado_trabajo_id does not exist" },
  };
  it("usa la RPC cuando responde", async () => {
    const a = fakeAdmin({
      "rpc:monto_esperado_trabajo_id": [{ data: "15000.4" }],
    });
    assert.equal(await expectedJobAmount(a as never, "j"), 15000);
    assert.equal(
      await expectedJobAmount(
        fakeAdmin({ "rpc:monto_esperado_trabajo_id": [{ data: 0 }] }) as never,
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        fakeAdmin({
          "rpc:monto_esperado_trabajo_id": [{ error: { message: "otro" } }],
        }) as never,
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        fakeAdmin({
          "rpc:monto_esperado_trabajo_id": [{ error: {} }],
        }) as never,
        "j",
      ),
      0,
    );
  });
  it("sin la RPC calcula con cotización, tarifa y traslado", async () => {
    const base = (job: unknown, extra: Record<string, Resp[]> = {}) =>
      fakeAdmin({
        "rpc:monto_esperado_trabajo_id": [faltaRpc],
        "trabajos:select": [{ data: job }],
        ...extra,
      }) as never;
    assert.equal(await expectedJobAmount(base(null), "j"), 0);
    assert.equal(
      await expectedJobAmount(
        base({ id_cotizacion_seleccionada: "q", id_trabajador: "w" }, {
          "propuestas_cotizacion:select": [{
            data: { monto_total_clp: "40000.5" },
          }],
        }),
        "j",
      ),
      40001,
    );
    assert.equal(
      await expectedJobAmount(
        base({ id_cotizacion_seleccionada: "q", id_trabajador: "w" }),
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        base({ modalidad_cobro: "cotizacion", id_trabajador: "w" }),
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        base({ modalidad_cobro: "cotizacion_abierta", id_trabajador: "w" }),
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(base({ modalidad_cobro: "visita" }), "j"),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        base({ modalidad_cobro: "visita", id_trabajador: "w" }),
        "j",
      ),
      0,
    );
    assert.equal(
      await expectedJobAmount(
        base({
          modalidad_cobro: "visita",
          id_trabajador: "w",
          latitud: 0.5,
          longitud: 0,
        }, {
          "trabajadores:select": [{
            data: {
              tarifa_visita: 20000,
              latitud_base: "0",
              longitud_base: "0",
              radio_servicio_km: null,
            },
          }],
        }),
        "j",
      ),
      38000,
    );
  });
});
