export type JobServiceMeta = {
  requestType: string;
  tierId: string;
  unit: string;
  squareMeters: number | null;
};

/** Misma lectura que `monto_esperado_trabajo` sobre `metadatos_servicio`. */
export function parseJobServiceMeta(raw: unknown): JobServiceMeta | null {
  let obj: Record<string, unknown> | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (!obj) return null;
  if (String(obj.request_type || "") !== "worker_tier_invitation") return null;
  const sq = Number(obj.worker_tier_square_meters);
  return {
    requestType: "worker_tier_invitation",
    tierId: String(obj.worker_tier_id || ""),
    unit: String(obj.worker_tier_unit || ""),
    squareMeters: Number.isFinite(sq) && sq > 0 ? sq : null,
  };
}

/**
 * Base de una invitación por tarifa. `visita` usa la tarifa de visita;
 * el resto, el monto publicado. `perSqm` multiplica por los m².
 */
export function invitationBaseAmount(input: {
  tierId: string;
  unit: string;
  squareMeters: number | null;
  visitFee: number;
  publishedRate: number | null;
}): number {
  const rate = input.tierId === "visita"
    ? Number(input.visitFee)
    : Number(input.publishedRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (input.unit === "perSqm" && input.squareMeters && input.squareMeters > 0) {
    return rate * input.squareMeters;
  }
  return rate;
}

export const PRICE_ALIASES: Record<string, string> = {
  construction_large_project: "construction_per_sqm",
  electrical_large_project: "electrical_per_sqm",
};
