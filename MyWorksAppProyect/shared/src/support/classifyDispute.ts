/**
 * Espejo de public.clasificar_disputa (migración
 * 20261113000002_clasificar_disputa_sin_auto_liberar.sql).
 *
 * El silencio del cliente (48 h, sin disputa) ya libera el escrow.
 * Una disputa abierta nunca debe pagar sola al profesional.
 */
export type DisputeAutoDecision = 'liberar' | 'reembolsar' | 'humano';

export type ClassifyDisputeInput = {
  reason: string;
  amountClp: number;
  priorResolvedDisputes: number;
  hasEvidence: boolean;
  hasArrival: boolean;
  maxAutoAmountClp?: number;
  maxRecidivism?: number;
};

export type ClassifyDisputeResult = {
  decision: DisputeAutoDecision;
  rule: string;
  status: 'abierta' | 'requiere_humano';
};

export function classifyDispute(
  input: ClassifyDisputeInput,
): ClassifyDisputeResult {
  const reason = input.reason.trim().toLowerCase();
  const maxAmount = input.maxAutoAmountClp ?? 80_000;
  const maxRecidivism = input.maxRecidivism ?? 1;

  if (reason === 'conducta') {
    return { decision: 'humano', rule: 'conducta', status: 'requiere_humano' };
  }
  if (input.priorResolvedDisputes >= maxRecidivism) {
    return {
      decision: 'humano',
      rule: 'reincidencia',
      status: 'requiere_humano',
    };
  }
  if (input.amountClp > maxAmount) {
    return { decision: 'humano', rule: 'monto_alto', status: 'requiere_humano' };
  }
  if (!input.hasEvidence && !input.hasArrival) {
    return {
      decision: 'reembolsar',
      rule: 'sin_llegada_ni_evidencia',
      status: 'abierta',
    };
  }
  return {
    decision: 'humano',
    rule: 'revision_manual',
    status: 'requiere_humano',
  };
}
