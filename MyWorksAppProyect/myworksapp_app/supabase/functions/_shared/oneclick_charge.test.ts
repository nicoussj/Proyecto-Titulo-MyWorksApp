import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  invitationBaseAmount,
  parseJobServiceMeta,
} from "./oneclick_expected_amount.ts";

describe("monto Oneclick al volver de inscribir la tarjeta", () => {
  it("una invitación por variante publicada no usa la tarifa de visita", () => {
    const meta = parseJobServiceMeta({
      request_type: "worker_tier_invitation",
      worker_tier_id: "plumbing_install",
      worker_tier_unit: "fixed",
    });
    assert.equal(meta?.tierId, "plumbing_install");
    assert.equal(
      invitationBaseAmount({
        tierId: meta!.tierId,
        unit: meta!.unit,
        squareMeters: meta!.squareMeters,
        visitFee: 15_000,
        publishedRate: 45_000,
      }),
      45_000,
    );
  });

  it("la opción visita cobra la tarifa de visita del profesional", () => {
    const meta = parseJobServiceMeta(
      '{"request_type":"worker_tier_invitation","worker_tier_id":"visita"}',
    );
    assert.equal(meta?.tierId, "visita");
    assert.equal(
      invitationBaseAmount({
        tierId: meta!.tierId,
        unit: meta!.unit,
        squareMeters: meta!.squareMeters,
        visitFee: 32_000,
        publishedRate: 99_000,
      }),
      32_000,
    );
  });

  it("un trabajo por m² multiplica la tarifa publicada", () => {
    const meta = parseJobServiceMeta({
      request_type: "worker_tier_invitation",
      worker_tier_id: "construction_per_sqm",
      worker_tier_unit: "perSqm",
      worker_tier_square_meters: "12",
    });
    assert.equal(
      invitationBaseAmount({
        tierId: meta!.tierId,
        unit: meta!.unit,
        squareMeters: meta!.squareMeters,
        visitFee: 20_000,
        publishedRate: 8_000,
      }),
      96_000,
    );
  });

  it("sin invitación por tarifa no interpreta metadatos ajenos", () => {
    assert.equal(parseJobServiceMeta({ pin: "1234" }), null);
    assert.equal(parseJobServiceMeta(""), null);
    assert.equal(parseJobServiceMeta("no-json"), null);
  });

  it("sin tarifa publicada no inventa un monto", () => {
    assert.equal(
      invitationBaseAmount({
        tierId: "plumbing_install",
        unit: "fixed",
        squareMeters: null,
        visitFee: 15_000,
        publishedRate: null,
      }),
      0,
    );
  });
});
