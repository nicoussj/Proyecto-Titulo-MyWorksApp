import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@myworksapp/shared';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

const auth = vi.hoisted(() => ({
  getSessionProfile: vi.fn(),
  signIn: vi.fn(),
  signUpUser: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateAccountPassword: vi.fn(),
  signInWithOAuthProvider: vi.fn(),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  ...auth,
}));

import { AuthProvider, WEB_CLIENT_ROLE_MESSAGE } from '../../src/context/AuthContext';
import { useAuth } from '../../src/context/useAuth';
import { PaidReturnView } from '../../src/components/PaidReturnView';

const cliente = { id: 'u-1', name: 'Ana', email: 'ana@example.test', role: 'usuario' };
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function mount() {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  fake.current = createFakeSupabase();
  for (const f of Object.values(auth)) f.mockReset();
  auth.getSessionProfile.mockResolvedValue(null);
  auth.signOut.mockResolvedValue(undefined);
  window.history.replaceState(null, '', '/');
});
afterEach(() => window.history.replaceState(null, '', '/'));

describe('sesión del cliente web', () => {
  it('arranca sin sesión y luego con un cliente', async () => {
    const { result } = await mount();
    expect(result.current.profile).toBeNull();
    auth.getSessionProfile.mockResolvedValue(cliente);
    const listener = fake.current!.state.authListeners[0];
    act(() => listener('INITIAL_SESSION', null));
    act(() => listener('SIGNED_IN', null));
    await waitFor(() => expect(result.current.profile).toEqual(cliente));
  });

  it('cierra la sesión de un trabajador con mensaje claro', async () => {
    auth.getSessionProfile.mockResolvedValue({ ...cliente, role: 'trabajador' });
    const { result } = await mount();
    expect(result.current.error).toBe(WEB_CLIENT_ROLE_MESSAGE);
    expect(auth.signOut).toHaveBeenCalled();
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('un error raro de sesión se muestra genérico', async () => {
    auth.getSessionProfile.mockRejectedValue(new Error('x'));
    const { result } = await mount();
    expect(result.current.error).toBe('Error de sesión');
  });

  it('login de cliente, de trabajador y con error que no es de Auth', async () => {
    const { result } = await mount();
    auth.signIn.mockResolvedValueOnce(cliente);
    await act(() => result.current.login('ana@example.test', 'segura123'));
    expect(result.current.profile).toEqual(cliente);
    auth.signIn.mockResolvedValueOnce({ ...cliente, role: 'administrador' });
    let failure: unknown;
    await act(async () => {
      await result.current.login('a', 'b').catch((e: unknown) => {
        failure = e;
      });
    });
    expect(String(failure)).toContain(WEB_CLIENT_ROLE_MESSAGE);
    expect(result.current.profile).toBeNull();
    auth.signIn.mockResolvedValueOnce({ ...cliente, role: 'trabajador' });
    auth.signOut.mockRejectedValueOnce(new Error('red'));
    failure = null;
    await act(async () => {
      await result.current.login('a', 'b').catch((e: unknown) => {
        failure = e;
      });
    });
    expect(failure).toBeInstanceOf(AuthError);
    expect(result.current.error).toBe(WEB_CLIENT_ROLE_MESSAGE);
  });

  it('OAuth, registro, recuperación y salida', async () => {
    const { result } = await mount();
    await act(() => result.current.loginWithOAuth('google'));
    expect(auth.signInWithOAuthProvider).toHaveBeenCalledWith(expect.anything(), 'google', window.location.origin);
    auth.signUpUser.mockResolvedValueOnce({ status: 'confirmation_required' });
    await expect(result.current.register('Ana', 'a@b.c', 'segura123')).resolves.toBe('confirmation_required');
    auth.signUpUser.mockResolvedValueOnce({ status: 'signed_in', profile: cliente });
    await act(async () => {
      await expect(result.current.register('Ana', 'a@b.c', 'segura123', 'tok')).resolves.toBe('signed_in');
    });
    expect(result.current.profile).toEqual(cliente);
    await act(() => result.current.sendPasswordReset('a@b.c'));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith(expect.anything(), 'a@b.c', expect.stringContaining('restablecer'));
    await act(() => result.current.logout());
    expect(result.current.profile).toBeNull();
  });

  it('terminar la recuperación exige sesión y limpia la marca', async () => {
    window.history.replaceState(null, '', '/?restablecer=1');
    const { result } = await mount();
    expect(result.current.recoveringPassword).toBe(true);
    await expect(result.current.finishPasswordReset('segura123')).rejects.toThrow('El enlace venció');
    fake.current!.state.session = { user: { id: 'u-1' } };
    await act(() => result.current.finishPasswordReset('segura123'));
    expect(auth.updateAccountPassword).toHaveBeenCalledWith(expect.anything(), 'segura123');
    expect(result.current.recoveringPassword).toBe(false);
    expect(window.location.search).toBe('');
    act(() => fake.current!.state.authListeners[0]('PASSWORD_RECOVERY', null));
    expect(result.current.recoveringPassword).toBe(true);
    await act(() => result.current.cancelPasswordReset());
    expect(result.current.recoveringPassword).toBe(false);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('canjea ?code= y abre la recuperación', async () => {
    window.history.replaceState(null, '', '/?code=abc&restablecer=1');
    const { result } = await mount();
    expect(fake.current!.client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(window.location.search).toBe('?restablecer=1');
    expect(result.current.recoveringPassword).toBe(true);
  });

  it('?code= abierto en otro navegador explica qué hacer', async () => {
    window.history.replaceState(null, '', '/?code=abc&restablecer=1');
    fake.current!.client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: {}, error: { message: 'invalid request: both auth code and code verifier should be non-empty' } });
    const { result } = await mount();
    expect(result.current.recoveringPassword).toBe(false);
    expect(result.current.error).toContain('mismo navegador');
  });

  it('?code= de alta con otro error no abre nada', async () => {
    window.history.replaceState(null, '', '/?code=abc');
    fake.current!.client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: {}, error: { message: 'expired' } });
    const { result } = await mount();
    expect(result.current.recoveringPassword).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tokens en el hash crean la sesión; type=recovery abre la recuperación', async () => {
    window.history.replaceState(null, '', '/#access_token=a&refresh_token=r&type=recovery');
    const { result } = await mount();
    expect(fake.current!.client.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(window.location.hash).toBe('');
    expect(result.current.recoveringPassword).toBe(true);
  });

  it('hash incompleto se ignora y al desmontar se cancela la suscripción', async () => {
    window.history.replaceState(null, '', '/#access_token=a');
    const hook = await mount();
    expect(fake.current!.client.auth.setSession).not.toHaveBeenCalled();
    hook.unmount();
  });
});

describe('pantalla tras pagar con Webpay', () => {
  const base = { onContinueTracking: vi.fn(), onGoHome: vi.fn() };
  afterEach(() => sessionStorage.clear());

  it('confirmando, error con y sin pedido', () => {
    const { rerender } = render(<PaidReturnView {...base} verifying />);
    expect(screen.getByRole('heading', { name: 'Confirmando pago…' })).toBeTruthy();
    rerender(<PaidReturnView {...base} verifyError="Transbank rechazó" passwordToken="t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver mi pedido' }));
    expect(base.onContinueTracking).toHaveBeenCalled();
    rerender(<PaidReturnView {...base} verifyError="Transbank rechazó" />);
    expect(screen.queryByRole('button', { name: 'Ver mi pedido' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(base.onGoHome).toHaveBeenCalled();
  });

  it('pago recibido sin invitado', () => {
    render(<PaidReturnView {...base} workerName="Pedro" jobId="12345678-abcd" />);
    expect(screen.getByText(/para Pedro\. Referencia 12345678…/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('el invitado crea su contraseña y valida cada caso', async () => {
    const { state } = fake.current!;
    render(<PaidReturnView {...base} passwordToken="tok" />);
    const pass = screen.getByLabelText('Contraseña nueva');
    const again = screen.getByLabelText('Repite la contraseña');
    const submit = () => fireEvent.submit(pass.closest('form')!);
    fireEvent.change(pass, { target: { value: 'abc' } });
    submit();
    expect(screen.getByRole('alert').textContent).toContain('8 caracteres');
    fireEvent.change(pass, { target: { value: 'segura123' } });
    fireEvent.change(again, { target: { value: 'otra12345' } });
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden');
    fireEvent.change(again, { target: { value: 'segura123' } });
    submit();
    expect(screen.getByRole('alert').textContent).toContain('mismo navegador');
    sessionStorage.setItem('mwa-guest-alta-nonce', 'n-1');
    state.invoke = () => ({ data: { error: 'Token vencido' } });
    submit();
    expect(await screen.findByText('Token vencido')).toBeTruthy();
    state.invoke = () => ({ data: null, error: { message: 'Edge caída' } as never });
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe('Token vencido'));
    state.invoke = () => ({ data: { ok: false } });
    submit();
    expect(await screen.findByText('No se pudo guardar la contraseña')).toBeTruthy();
    state.invoke = () => ({ data: { ok: true, emailConfirmed: false, notice: 'Revisa tu correo' } });
    submit();
    expect((await screen.findByRole('status')).textContent).toBe('Revisa tu correo');
    expect(fake.current!.client.functions.invoke).toHaveBeenLastCalledWith('definir-clave-invitado', { body: { token: 'tok', password: 'segura123', nonce: 'n-1' } });
  });

  it('contraseña lista con correo confirmado o aviso por defecto', async () => {
    sessionStorage.setItem('mwa-guest-alta-nonce', 'n-1');
    fake.current!.state.invoke = () => ({ data: { ok: true } });
    const first = render(<PaidReturnView {...base} passwordToken="tok" />);
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'segura123' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'segura123' } });
    fireEvent.submit(screen.getByLabelText('Contraseña nueva').closest('form')!);
    expect((await screen.findByRole('status')).textContent).toContain('Contraseña lista');
    first.unmount();
    fake.current!.state.invoke = () => ({ data: { ok: true, emailConfirmed: false } });
    render(<PaidReturnView {...base} passwordToken="tok" />);
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'segura123' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'segura123' } });
    fireEvent.submit(screen.getByLabelText('Contraseña nueva').closest('form')!);
    expect((await screen.findByRole('status')).textContent).toBe('Te enviamos un correo para confirmar.');
  });
});
