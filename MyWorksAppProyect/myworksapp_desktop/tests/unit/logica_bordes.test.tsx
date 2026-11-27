import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { maskId, maskRut, shortId } from '../../src/lib/format';
import { isOtpauthUri, makeScannableTotpQr } from '../../src/lib/totpQr';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';

/** Bordes de utilidades y del diálogo de confirmación que el recorrido no alcanza. */
describe('enmascarado de identificadores', () => {
  it('id, rut y id corto', () => {
    expect(maskId(null)).toBe('—');
    expect(maskId('abc')).toBe('abc');
    expect(maskId('1234567890abcdef')).toBe('1234…cdef');
    expect(maskRut('12 345')).toBe('••••');
    expect(maskRut('12.345.678-9')).toBe('12••••-9');
    expect(shortId('abc')).toBe('abc');
    expect(shortId('1234567890')).toBe('12345678');
  });
});

describe('código QR del segundo factor', () => {
  it('rechaza una URI con formato inválido y usa el QR del servidor', async () => {
    expect(isOtpauthUri('otpauth://totp/%E0%A4%A')).toBe(false);
    expect(isOtpauthUri('otpauth://totp/x?secret=')).toBe(false);
    expect(await makeScannableTotpQr({ uri: 'no-uri', qr_code: '  ' })).toBeNull();
    expect(await makeScannableTotpQr({ uri: null, qr_code: null })).toBeNull();
    const svg = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    expect(await makeScannableTotpQr({ qr_code: svg })).toMatch(/^data:image\/svg\+xml/);
  });
});

describe('diálogo de confirmación', () => {
  it('mientras trabaja no se cierra ni confirma dos veces', () => {
    const cancelar = vi.fn();
    const confirmar = vi.fn();
    const { rerender } = render(<ConfirmDialog title="T" summary="S" busy onCancel={cancelar} onConfirm={confirmar} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cancelar).not.toHaveBeenCalled();
    rerender(<ConfirmDialog title="T" summary="S" requireTotp onCancel={cancelar} onConfirm={confirmar} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Motivo/ }), { target: { value: 'motivo suficiente' } });
    fireEvent.change(screen.getByLabelText(/Código de la aplicación/), { target: { value: '123456' } });
    const boton = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith('motivo suficiente', '123456');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cancelar).toHaveBeenCalledTimes(1);
  });
});
