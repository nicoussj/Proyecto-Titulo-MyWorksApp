import { refundHeldPaymentOnce } from "./refund_once.ts";

export const COBRO_TIPOS = ["principal", "orden_cambio", "horas_extra"] as const;
export const HELD_ESTADOS = ["retenido", "autorizado", "pendiente"] as const;

type RefundAdmin = {
  from: (table: string) => any;
};

export function isHeldCobro(estado: unknown): boolean {
  return typeof estado === "string"
    && (HELD_ESTADOS as readonly string[]).includes(estado);
}

/**
 * Devuelve a la tarjeta cada cobro aún retenido del trabajo, en el orden
 * en que se creó. No cierra la disputa: eso lo hace aplicar_cierre_disputa.
 */
export async function refundHeldCobrosForJob(
  admin: RefundAdmin,
  jobId: string,
): Promise<string[]> {
  const { data: payments, error } = await admin
    .from("pagos")
    .select("id, estado")
    .eq("id_trabajo", jobId)
    .in("tipo_pago", [...COBRO_TIPOS])
    .order("creado_en", { ascending: true });
  if (error) {
    throw new Error("No se pudieron leer los cobros");
  }

  const refunded: string[] = [];
  for (const row of payments ?? []) {
    if (!isHeldCobro(row.estado)) continue;
    const result = await refundHeldPaymentOnce(admin, String(row.id));
    if (result.status === "refunded" || result.status === "already") {
      refunded.push(String(row.id));
    }
  }
  return refunded;
}
