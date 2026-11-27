import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentCheckoutModal } from '../../src/components/PaymentCheckoutModal';

function modal(props: Partial<Parameters<typeof PaymentCheckoutModal>[0]> = {}) {
  const h = {
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onPayWithWebpay: vi.fn(async () => ({ charged: true, amount: 32000, last4: '4242' }) as never),
  };
  const view = render(<PaymentCheckoutModal workerName="Pedro" profession="Electricista" payableTotalClp={32000} hasJobSite jobId="12345678-xyz" {...h} {...props} />);
  return { ...h, view };
}
const payButton = () => screen.getByRole('button', { name: /Confirmar pedido|Calculando|Indica la ubicación|Confirmando/ });

describe('confirmar pedido con tarjeta', () => {
  it('cobra la tarjeta guardada y muestra la confirmación', async () => {
    const loadSavedCard = vi.fn(async () => ({ enrolled: true, last4: '4242', cardType: 'Visa' }));
    const h = modal({ loadSavedCard });
    expect(await screen.findByText('Se cobrará a tu tarjeta Visa •••• 4242')).toBeTruthy();
    expect(screen.getByText('12345678…')).toBeTruthy();
    fireEvent.click(payButton());
    expect(await screen.findByText('Pedido confirmado')).toBeTruthy();
    expect(h.onPayWithWebpay).toHaveBeenCalledWith({ saveCard: false });
    expect(h.onSuccess).toHaveBeenCalledWith({ notice: expect.stringContaining('4242') });
    h.view.rerender(<PaymentCheckoutModal workerName="Pedro" profession="x" payableTotalClp={32000} onClose={h.onClose} onSuccess={h.onSuccess} onPayWithWebpay={h.onPayWithWebpay} loadSavedCard={loadSavedCard} />);
    expect(loadSavedCard).toHaveBeenCalledTimes(1);
  });

  it('sin tarjeta propone guardarla; redirige a Webpay', async () => {
    const h = modal({ loadSavedCard: async () => ({ enrolled: false, last4: '', cardType: '' }) });
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    h.onPayWithWebpay.mockResolvedValueOnce({ charged: false, redirected: true } as never);
    fireEvent.click(payButton());
    await waitFor(() => expect(h.onPayWithWebpay).toHaveBeenCalledWith({ saveCard: false }));
    expect(screen.getByRole('button', { name: 'Confirmando pedido…' })).toBeTruthy();
  });

  it('si no cobra ni redirige pide reintentar; errores con y sin mensaje', async () => {
    const h = modal({ loadSavedCard: async () => { throw new Error('x'); } });
    h.onPayWithWebpay
      .mockResolvedValueOnce({ charged: false } as never)
      .mockRejectedValueOnce(new Error('Tarjeta rechazada'))
      .mockRejectedValueOnce('raro')
      .mockResolvedValueOnce({ charged: true, amount: 0 } as never);
    fireEvent.click(payButton());
    expect(await screen.findByText('No se pudo abrir Webpay. Intenta de nuevo.')).toBeTruthy();
    fireEvent.click(payButton());
    expect(await screen.findByText('Tarjeta rechazada')).toBeTruthy();
    fireEvent.click(payButton());
    expect(await screen.findByText('No se pudo confirmar el pedido.')).toBeTruthy();
    fireEvent.click(payButton());
    expect(await screen.findByText(/Se descontará \$32\.000 CLP/)).toBeTruthy();
  });

  it('cambia la tarjeta guardada y avisa si no puede', async () => {
    const onRemoveSavedCard = vi.fn().mockRejectedValueOnce(new Error('Transbank no responde')).mockRejectedValueOnce('raro').mockResolvedValueOnce(undefined);
    modal({ loadSavedCard: async () => ({ enrolled: true, last4: '1111', cardType: '' }), onRemoveSavedCard });
    expect(await screen.findByText(/tarjeta guardada •••• 1111/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tarjeta' }));
    expect(await screen.findByText('Transbank no responde')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tarjeta' }));
    expect(await screen.findByText('No se pudo quitar la tarjeta.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tarjeta' }));
    expect(await screen.findByRole('checkbox')).toBeTruthy();
  });

  it('sin total ni con bloqueo no deja pagar; muestra el error de cobro con reintento', () => {
    const onRetryCharge = vi.fn();
    const h = modal({ payableTotalClp: null, chargeError: 'No se pudo calcular', onRetryCharge, jobId: null });
    expect(screen.getByText('Calculando tarifa y traslado…')).toBeTruthy();
    expect(screen.getByText('Se confirma antes de habilitar el pago')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetryCharge).toHaveBeenCalled();
    expect((payButton() as HTMLButtonElement).disabled).toBe(true);
    h.view.rerender(<PaymentCheckoutModal workerName="P" profession="x" payableTotalClp={1000} chargeLocking chargeError="Sin reintento" onClose={h.onClose} onSuccess={h.onSuccess} onPayWithWebpay={h.onPayWithWebpay} />);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    fireEvent.click(payButton());
    expect(h.onPayWithWebpay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('sin sitio del trabajo pide la dirección antes de pagar', async () => {
    const onUseAddress = vi.fn().mockRejectedValueOnce(new Error('No existe esa calle')).mockRejectedValueOnce('raro').mockResolvedValue(null);
    const h = modal({ hasJobSite: false, onUseAddress });
    expect(payButton().textContent).toContain('Indica la ubicación del trabajo');
    const input = screen.getByLabelText(/Dirección del trabajo/);
    fireEvent.submit(input.closest('form')!);
    expect(onUseAddress).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Calle falsa 1' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('No existe esa calle')).toBeTruthy();
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('No encontramos esa dirección.')).toBeTruthy();
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(onUseAddress).toHaveBeenCalledTimes(3));
    // El botón sigue deshabilitado: el aviso interno de handlePay es solo defensa.
    expect((payButton() as HTMLButtonElement).disabled).toBe(true);
    expect(h.onPayWithWebpay).not.toHaveBeenCalled();
  });

  it('buscando dirección lo indica; si se cierra antes de saber la tarjeta no cambia nada', async () => {
    let release: (v: unknown) => void = () => {};
    const loadSavedCard = vi.fn(() => new Promise((r) => { release = r; }) as never);
    const h = modal({ hasJobSite: false, onUseAddress: vi.fn(), locatingAddress: true, loadSavedCard });
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeTruthy();
    h.view.unmount();
    release({ enrolled: true, last4: '1', cardType: '' });
    await new Promise((r) => setTimeout(r, 0));
  });
});
