import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@myworksapp/shared';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

const pay = vi.hoisted(() => ({
  getSavedCard: vi.fn(),
  chargeSavedCard: vi.fn(),
  createWebpaySession: vi.fn(),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  getSavedCard: pay.getSavedCard,
  chargeSavedCard: pay.chargeSavedCard,
  createWebpaySession: pay.createWebpaySession,
}));

import { ChangeOrderPanel } from '../../src/components/ChangeOrderPanel';
import { PasswordRecoveryModal } from '../../src/components/PasswordRecoveryModal';
import { AuthContext, type AuthContextValue } from '../../src/context/authContextValue';

const order = { id: 'o-1', titulo: 'Cable extra', descripcion: '10 metros', monto_clp: 15000, estado: 'pendiente_cliente' };

beforeEach(() => {
  fake.current = createFakeSupabase();
  pay.getSavedCard.mockReset();
  pay.chargeSavedCard.mockReset().mockResolvedValue({ ok: true });
  pay.createWebpaySession.mockReset().mockResolvedValue({ redirectUrl: 'https://webpay3gint.transbank.cl/x' });
});

describe('cobro adicional del pedido', () => {
  it('no se muestra sin órdenes pendientes ni si la lectura falla', async () => {
    fake.current!.state.responder = () => ({ data: [{ ...order, estado: 'pagada' }] });
    const { container, unmount } = render(<ChangeOrderPanel jobId="j-1" />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
    unmount();
    fake.current!.state.responder = () => ({ data: null, error: { message: 'x' } });
    const second = render(<ChangeOrderPanel jobId="j-1" />);
    await act(async () => {});
    expect(second.container.innerHTML).toBe('');
  });

  it('con tarjeta guardada cobra Oneclick y recarga', async () => {
    const { state } = fake.current!;
    let paid = false;
    state.responder = () => ({ data: paid ? [] : [order] });
    state.rpc = () => ({ data: 21000 });
    pay.getSavedCard.mockResolvedValue({ enrolled: true, last4: '4242' });
    pay.chargeSavedCard.mockImplementation(async () => {
      paid = true;
      return { ok: true };
    });
    const { container } = render(<ChangeOrderPanel jobId="j-1" />);
    expect(await screen.findByText('Cable extra')).toBeTruthy();
    expect(screen.getByText(/Base \$15\.000/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(pay.chargeSavedCard).toHaveBeenCalledWith(expect.anything(), { jobId: 'j-1', amountClp: 21000, changeOrderId: 'o-1' });
  });

  it('sin tarjeta abre Webpay', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fake.current!.state.responder = () => ({ data: [order] });
    fake.current!.state.rpc = () => ({ data: 21000 });
    pay.getSavedCard.mockRejectedValue(new Error('sin tarjeta'));
    render(<ChangeOrderPanel jobId="j-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar y pagar' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://webpay3gint.transbank.cl/x'));
    expect(pay.createWebpaySession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ presentMode: 'redirect', changeOrderId: 'o-1' }));
    vi.unstubAllGlobals();
  });

  it('avisa si no puede calcular, pagar o rechazar, y rechaza', async () => {
    const { state } = fake.current!;
    let rejected = false;
    state.responder = () => ({ data: rejected ? [] : [order] });
    state.rpc = () => ({ data: 'no-numero' });
    const { container } = render(<ChangeOrderPanel jobId="j-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar y pagar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos calcular el cobro adicional.');
    state.rpc = () => ({ data: 21000 });
    pay.getSavedCard.mockResolvedValue({ enrolled: false });
    pay.createWebpaySession.mockRejectedValue(new Error('caído'));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y pagar' }));
    expect(await screen.findByText('No se pudo pagar el cobro adicional.')).toBeTruthy();
    state.rpc = () => ({ error: { message: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('No se pudo rechazar el cobro adicional.')).toBeTruthy();
    state.rpc = (fn) => {
      if (fn === 'rechazar_orden_cambio') rejected = true;
      return { data: null };
    };
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('si la recarga tras pagar falla, deja la lista vacía', async () => {
    const { state } = fake.current!;
    let reads = 0;
    state.responder = () => (++reads === 1 ? { data: [order] } : { data: null, error: { message: 'x' } });
    state.rpc = () => ({ data: 21000 });
    pay.getSavedCard.mockResolvedValue({ enrolled: true });
    const { container } = render(<ChangeOrderPanel jobId="j-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar y pagar' }));
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});

function recovery(overrides: Partial<AuthContextValue> = {}) {
  const value = {
    recoveringPassword: true,
    finishPasswordReset: vi.fn(async () => {}),
    cancelPasswordReset: vi.fn(async () => {}),
    ...overrides,
  } as unknown as AuthContextValue;
  const view = render(
    <AuthContext.Provider value={value}>
      <PasswordRecoveryModal />
    </AuthContext.Provider>,
  );
  return { value, view };
}

describe('nueva contraseña tras el enlace del correo', () => {
  it('no aparece si no se está recuperando', () => {
    const { view } = recovery({ recoveringPassword: false });
    expect(view.container.innerHTML).toBe('');
  });

  it('valida política y coincidencia, guarda y confirma', async () => {
    const { value } = recovery();
    const pass = screen.getByLabelText('Nueva contraseña');
    const again = screen.getByLabelText('Repite la contraseña');
    fireEvent.change(pass, { target: { value: 'abc' } });
    fireEvent.submit(pass.closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('8 caracteres');
    fireEvent.change(pass, { target: { value: 'segura123' } });
    fireEvent.change(again, { target: { value: 'segura124' } });
    fireEvent.submit(pass.closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden.');
    fireEvent.change(again, { target: { value: 'segura123' } });
    fireEvent.submit(pass.closest('form')!);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(value.finishPasswordReset).toHaveBeenCalledWith('segura123');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  });

  it('muestra el error de Auth o uno genérico, y cancela', async () => {
    const finish = vi.fn().mockRejectedValueOnce(new AuthError('El enlace expiró')).mockRejectedValueOnce(new Error('x'));
    const { value } = recovery({ finishPasswordReset: finish });
    const pass = screen.getByLabelText('Nueva contraseña');
    fireEvent.change(pass, { target: { value: 'segura123' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'segura123' } });
    fireEvent.submit(pass.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toBe('El enlace expiró');
    fireEvent.submit(pass.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo guardar la contraseña.'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(value.cancelPasswordReset).toHaveBeenCalledTimes(2);
  });
});
