import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACADEMIC_ACTION_NOTE,
  ACADEMIC_BANNER_TEXT,
  ACADEMIC_META_DESCRIPTION,
  PAYMENTS_CONFIRMED_AS_INTEGRATION,
} from './academicCopy.ts';

describe('aviso académico', () => {
  it('no afirma pagos de prueba si el ambiente de Transbank no está fijado', () => {
    assert.equal(PAYMENTS_CONFIRMED_AS_INTEGRATION, false);
    assert.match(ACADEMIC_BANNER_TEXT, /No realices pagos con datos reales/);
    assert.doesNotMatch(ACADEMIC_BANNER_TEXT, /sin cobros reales/);
    assert.match(ACADEMIC_ACTION_NOTE, /No realices pagos con datos reales/);
    assert.match(ACADEMIC_META_DESCRIPTION, /Duoc UC/);
    assert.match(ACADEMIC_META_DESCRIPTION, /no es un servicio comercial/);
  });
});
