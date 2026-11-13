import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyDispute } from './classifyDispute.ts';

const qualityComplaint = {
  reason: 'calidad',
  amountClp: 25_000,
  priorResolvedDisputes: 0,
  hasEvidence: true,
  hasArrival: true,
};

describe('classifyDispute', () => {
  it('no libera el escrow cuando el cliente reclama calidad con evidencia', () => {
    assert.deepEqual(classifyDispute(qualityComplaint), {
      decision: 'humano',
      rule: 'revision_manual',
      status: 'requiere_humano',
    });
  });

  it('no libera el escrow si el profesional abre la disputa y hay fotos', () => {
    assert.equal(
      classifyDispute({ ...qualityComplaint, reason: 'otro' }).decision,
      'humano',
    );
  });

  it('programa reembolso automático solo si no hubo llegada ni evidencia', () => {
    assert.deepEqual(
      classifyDispute({
        reason: 'calidad',
        amountClp: 25_000,
        priorResolvedDisputes: 0,
        hasEvidence: false,
        hasArrival: false,
      }),
      {
        decision: 'reembolsar',
        rule: 'sin_llegada_ni_evidencia',
        status: 'abierta',
      },
    );
  });

  it('manda conducta, reincidencia y monto alto a una persona', () => {
    assert.equal(
      classifyDispute({ ...qualityComplaint, reason: 'conducta' }).rule,
      'conducta',
    );
    assert.equal(
      classifyDispute({ ...qualityComplaint, priorResolvedDisputes: 1 }).rule,
      'reincidencia',
    );
    assert.equal(
      classifyDispute({ ...qualityComplaint, amountClp: 80_001 }).rule,
      'monto_alto',
    );
  });
});
