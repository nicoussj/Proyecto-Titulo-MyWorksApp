import { serviceClient } from "./supabase.ts";

type Admin = ReturnType<typeof serviceClient>;

/** Códigos de BD. ESCROW/HOLD = retenido. PAID_PENDING_EXECUTION = aceptado. */
export const DB_PAYMENT_ESCROW = "retenido";
export const DB_PAYMENT_PENDING = "pendiente";
export const DB_JOB_PAID_PENDING = "aceptado";
export const DB_JOB_AWAITING_PAYMENT = "esperando_pago";

export type EscrowOutcome = {
  approved: boolean;
  alreadyProcessed: boolean;
  paymentId: string;
  jobId: string;
  paymentStatus: "ESCROW" | "REJECTED";
  paymentStatusDb: string;
  jobStatus: "PAID_PENDING_EXECUTION" | null;
  jobStatusDb: string | null;
  responseCode: number;
  buyOrder: string;
  authorizationCode: string | null;
  amount: number | null;
  tbkStatus: string;
  transaction: Record<string, unknown>;
};

export function isApprovedCommit(commit: Record<string, unknown>): boolean {
  const responseCode = Number(commit.response_code ?? -1);
  const status = String(commit.status || "");
  return responseCode === 0 || status.toUpperCase() === "AUTHORIZED";
}

export function publicTransaction(
  commit: Record<string, unknown>,
): Record<string, unknown> {
  return {
    status: commit.status ?? null,
    response_code: commit.response_code ?? null,
    buy_order: commit.buy_order ?? null,
    session_id: commit.session_id ?? null,
    amount: commit.amount ?? null,
    authorization_code: commit.authorization_code ?? null,
    transaction_date: commit.transaction_date ?? null,
    payment_type_code: commit.payment_type_code ?? null,
    installments_number: commit.installments_number ?? null,
  };
}

type PaymentRow = {
  id: string;
  id_trabajo: string;
  monto: number;
  estado: string;
  buy_order: string | null;
};

async function findPayment(
  admin: Admin,
  token: string,
  buyOrder: string,
): Promise<PaymentRow | null> {
  const byToken = await admin
    .from("pagos")
    .select("id, id_trabajo, monto, estado, buy_order")
    .eq("token_tbk", token)
    .maybeSingle();
  if (byToken.data) return byToken.data as PaymentRow;

  if (!buyOrder) return null;
  const byOrder = await admin
    .from("pagos")
    .select("id, id_trabajo, monto, estado, buy_order")
    .eq("buy_order", buyOrder)
    .maybeSingle();
  return (byOrder.data as PaymentRow | null) ?? null;
}

function outcomeFrom(
  payment: PaymentRow,
  commit: Record<string, unknown>,
  approved: boolean,
  jobStatusDb: string | null,
  alreadyProcessed: boolean,
): EscrowOutcome {
  const responseCode = Number(commit.response_code ?? (approved ? 0 : -1));
  return {
    approved,
    alreadyProcessed,
    paymentId: payment.id,
    jobId: payment.id_trabajo,
    paymentStatus: approved ? "ESCROW" : "REJECTED",
    paymentStatusDb: approved ? DB_PAYMENT_ESCROW : payment.estado,
    jobStatus: approved && jobStatusDb === DB_JOB_PAID_PENDING
      ? "PAID_PENDING_EXECUTION"
      : null,
    jobStatusDb: approved ? jobStatusDb : null,
    responseCode,
    buyOrder: String(commit.buy_order || payment.buy_order || ""),
    authorizationCode: commit.authorization_code
      ? String(commit.authorization_code)
      : null,
    amount: commit.amount != null ? Number(commit.amount) : Number(payment.monto),
    tbkStatus: String(commit.status || (approved ? "AUTHORIZED" : "")),
    transaction: publicTransaction(commit),
  };
}

/**
 * Persiste el resultado Webpay.
 * Aprobado: pagos.estado = retenido (HOLD/ESCROW) y, si el trabajo esperaba
 * pago, trabajos.estado = aceptado (PAID_PENDING_EXECUTION).
 */
export async function persistWebpayOutcome(
  admin: Admin,
  input: { token: string; commit: Record<string, unknown> },
): Promise<EscrowOutcome | null> {
  const commit = input.commit;
  const buyOrder = String(commit.buy_order || "");
  const payment = await findPayment(admin, input.token, buyOrder);
  if (!payment) return null;

  const approved = isApprovedCommit(commit);
  const now = new Date().toISOString();

  if (
    payment.estado === DB_PAYMENT_ESCROW ||
    payment.estado === "liberado" ||
    payment.estado === "autorizado"
  ) {
    const { data: job } = await admin
      .from("trabajos")
      .select("estado")
      .eq("id", payment.id_trabajo)
      .maybeSingle();
    let jobEstado = String(job?.estado || "");
    if (
      payment.estado === DB_PAYMENT_ESCROW &&
      jobEstado === DB_JOB_AWAITING_PAYMENT
    ) {
      const now = new Date().toISOString();
      await admin
        .from("trabajos")
        .update({
          estado: DB_JOB_PAID_PENDING,
          estado_pago: DB_PAYMENT_ESCROW,
          actualizado_en: now,
        })
        .eq("id", payment.id_trabajo);
      jobEstado = DB_JOB_PAID_PENDING;
    }
    return outcomeFrom(
      payment,
      commit,
      true,
      jobEstado || null,
      true,
    );
  }

  await admin
    .from("pagos")
    .update({
      estado: approved ? DB_PAYMENT_ESCROW : DB_PAYMENT_PENDING,
      autorizado_en: approved ? now : null,
      id_transaccion: String(
        commit.authorization_code || buyOrder || input.token,
      ),
      actualizado_en: now,
    })
    .eq("id", payment.id);

  let jobStatusDb: string | null = null;
  if (approved) {
    const { data: job } = await admin
      .from("trabajos")
      .select("estado")
      .eq("id", payment.id_trabajo)
      .maybeSingle();
    const current = String(job?.estado || "");
    const patch: Record<string, string> = {
      estado_pago: DB_PAYMENT_ESCROW,
      actualizado_en: now,
    };
    if (current === DB_JOB_AWAITING_PAYMENT) {
      patch.estado = DB_JOB_PAID_PENDING;
      jobStatusDb = DB_JOB_PAID_PENDING;
    } else {
      jobStatusDb = current || null;
    }
    await admin.from("trabajos").update(patch).eq("id", payment.id_trabajo);
  }

  return outcomeFrom(payment, commit, approved, jobStatusDb, false);
}

export function escrowJson(outcome: EscrowOutcome) {
  return {
    ok: outcome.approved,
    approved: outcome.approved,
    alreadyProcessed: outcome.alreadyProcessed,
    paymentStatus: outcome.paymentStatus,
    hold: outcome.approved ? "HOLD" : null,
    paymentStatusDb: outcome.paymentStatusDb,
    jobStatus: outcome.jobStatus,
    jobStatusDb: outcome.jobStatusDb,
    paymentId: outcome.paymentId,
    jobId: outcome.jobId,
    buyOrder: outcome.buyOrder,
    responseCode: outcome.responseCode,
    authorizationCode: outcome.authorizationCode,
    amount: outcome.amount,
    status: outcome.tbkStatus,
    transaction: outcome.transaction,
  };
}
