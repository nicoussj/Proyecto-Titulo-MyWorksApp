/**
 * Estados que cuenta Inicio y que debe devolver consola_disputas_abiertas.
 * Tiene que coincidir con la migración 20261122231000.
 */
export const OPEN_DISPUTE_STATES = [
  'abierta',
  'en_revision',
  'requiere_humano',
  'reembolso_pendiente',
] as const;

export type OpenDisputeState = (typeof OPEN_DISPUTE_STATES)[number];

export function isOpenDispute(estado: string | null | undefined): boolean {
  return (OPEN_DISPUTE_STATES as readonly string[]).includes(estado ?? '');
}
