import assert from "node:assert/strict";
import { test } from "node:test";
import { isHeldCobro } from "./refund_job_cobros.ts";

test("retenido, autorizado y pendiente siguen en escrow", () => {
  assert.equal(isHeldCobro("retenido"), true);
  assert.equal(isHeldCobro("autorizado"), true);
  assert.equal(isHeldCobro("pendiente"), true);
});

test("liberado o reembolsado ya no está retenido", () => {
  assert.equal(isHeldCobro("liberado"), false);
  assert.equal(isHeldCobro("reembolsado"), false);
  assert.equal(isHeldCobro("anulado"), false);
  assert.equal(isHeldCobro(null), false);
  assert.equal(isHeldCobro(undefined), false);
  assert.equal(isHeldCobro(""), false);
});
