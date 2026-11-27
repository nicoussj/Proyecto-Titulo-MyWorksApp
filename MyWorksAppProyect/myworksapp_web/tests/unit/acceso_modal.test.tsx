import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@myworksapp/shared';

vi.mock('../../src/supabaseClient', () => ({
  supabase: {},
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}));

const ctl = vi.hoisted(() => ({ canRender: false, resend: vi.fn() }));
vi.mock('../../src/components/turnstileSite', () => ({ turnstileCanRender: () => ctl.canRender }));
vi.mock('../../src/components/TurnstileWidget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('captcha-ok')}>captcha</button>
  ),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  resendSignupConfirmation: ctl.resend,
}));

import { AuthModal } from '../../src/components/AuthModal';
import { AuthContext, type AuthContextValue } from '../../src/context/authContextValue';

function setup(props: Partial<Parameters<typeof AuthModal>[0]> = {}, settings: unknown = { external: { google: true, apple: true } }) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => settings })));
  const value = {
    login: vi.fn(async () => {}),
    loginWithOAuth: vi.fn(async () => {}),
    register: vi.fn(async () => 'signed_in'),
    sendPasswordReset: vi.fn(async () => {}),
  };
  const onClose = vi.fn();
  const view = render(
    <AuthContext.Provider value={value as unknown as AuthContextValue}>
      <AuthModal open onClose={onClose} {...props} />
    </AuthContext.Provider>,
  );
  return { value, onClose, view };
}

const type = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const submit = () => fireEvent.submit(screen.getByLabelText('Correo electrónico').closest('form')!);

beforeEach(() => {
  ctl.canRender = false;
  ctl.resend.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('diálogo de acceso', () => {
  it('cerrado no se muestra', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(
      <AuthContext.Provider value={{} as AuthContextValue}>
        <AuthModal open={false} onClose={() => {}} />
      </AuthContext.Provider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('entra con correo y cierra; trae el correo del invitado', async () => {
    const { value, onClose } = setup({ initialEmail: ' invitado@example.test ' });
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('invitado@example.test');
    type('Contraseña', 'segura123');
    submit();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(value.login).toHaveBeenCalledWith('invitado@example.test', 'segura123');
  });

  it('muestra Google; Apple solo con la variable activa', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continuar con Apple' })).toBeNull();
  });

  it('con Apple habilitado y errores de OAuth', async () => {
    vi.stubEnv('VITE_AUTH_APPLE_ENABLED', '1');
    const { value } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Apple' }));
    expect(value.loginWithOAuth).toHaveBeenCalledWith('apple');
    value.loginWithOAuth.mockRejectedValueOnce(new AuthError('Proveedor apagado'));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar con Google' }) as HTMLButtonElement).disabled).toBe(true));
  });

  it('error de OAuth visible', async () => {
    const { value } = setup();
    value.loginWithOAuth.mockRejectedValueOnce(new AuthError('Proveedor apagado')).mockRejectedValueOnce(new Error('x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Proveedor apagado');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo iniciar sesión social.'));
  });

  it('sin respuesta de ajustes no muestra botones sociales', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red'); }));
    render(
      <AuthContext.Provider value={{} as AuthContextValue}>
        <AuthModal open onClose={() => {}} />
      </AuthContext.Provider>,
    );
    await act(async () => {});
    expect(screen.queryByText('Continuar con Google')).toBeNull();
    setup({}, {});
    await act(async () => {});
    expect(screen.queryByText('Continuar con Google')).toBeNull();
  });

  it('login fallido: error de Auth, genérico y reenvío de confirmación con espera', async () => {
    const { value } = setup();
    value.login.mockRejectedValueOnce(new Error('x'));
    type('Correo electrónico', 'ana@example.test');
    type('Contraseña', 'segura123');
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo completar la operación.');
    value.login.mockRejectedValueOnce(new AuthError('Confirma tu correo antes de entrar (Email not confirmed)'));
    submit();
    const resend = await screen.findByRole('button', { name: 'Reenviar correo de confirmación' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(resend);
    await waitFor(() => expect(screen.getByText('Te enviamos un correo para confirmar.')).toBeTruthy());
    expect(ctl.resend).toHaveBeenCalledWith({}, 'ana@example.test');
    expect(screen.getByRole('button', { name: /Reenviar en 60 s/ })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByRole('button', { name: /Reenviar en 5\d s/ })).toBeTruthy();
    vi.useRealTimers();
  });

  it('reenvío de confirmación que falla', async () => {
    const { value } = setup();
    value.login.mockRejectedValueOnce(new AuthError('Email not confirmed'));
    type('Contraseña', 'segura123');
    type('Correo electrónico', 'ana@example.test');
    submit();
    ctl.resend.mockRejectedValueOnce(new AuthError('Demasiados correos')).mockRejectedValueOnce(new Error('x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(await screen.findByText('Demasiados correos')).toBeTruthy();
  });

  it('reenvío de confirmación con error genérico', async () => {
    const { value } = setup();
    value.login.mockRejectedValueOnce(new AuthError('Email not confirmed'));
    type('Contraseña', 'segura123');
    type('Correo electrónico', 'ana@example.test');
    submit();
    ctl.resend.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(await screen.findByText('No se pudo reenviar el correo.')).toBeTruthy();
  });

  it('recuperar contraseña: envía, reenvía y vuelve', async () => {
    const { value } = setup();
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeTruthy();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    type('Correo electrónico', ' ana@example.test ');
    submit();
    expect(await screen.findByText(/te llegará un correo/)).toBeTruthy();
    expect(value.sendPasswordReset).toHaveBeenCalledWith('ana@example.test');
    expect(screen.getByRole('button', { name: /Reenviar enlace/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a iniciar sesión' }));
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy();
  });

  it('registro: política, captcha y registro directo', async () => {
    ctl.canRender = true;
    const { value, onClose } = setup({ initialMode: 'register' });
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeTruthy();
    type('Nombre completo', 'Ana Pérez');
    type('Correo electrónico', 'ana@example.test');
    type('Contraseña', 'corta');
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('8 caracteres');
    type('Contraseña', 'segura123');
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('Confirma que no eres un robot');
    fireEvent.click(screen.getByRole('button', { name: 'captcha' }));
    submit();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(value.register).toHaveBeenCalledWith('Ana Pérez', 'ana@example.test', 'segura123', 'captcha-ok');
  });

  it('registro que pide confirmar el correo: reenviar y volver a entrar', async () => {
    const { value } = setup();
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }));
    value.register.mockResolvedValueOnce('confirmation_required');
    type('Nombre completo', 'Ana');
    type('Correo electrónico', ' ana@example.test ');
    type('Contraseña', 'segura123');
    submit();
    expect(await screen.findByText('ana@example.test')).toBeTruthy();
    expect(value.register).toHaveBeenCalledWith('Ana', 'ana@example.test', 'segura123', undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(await screen.findByText('Te enviamos el correo de nuevo.')).toBeTruthy();
    ctl.resend.mockRejectedValueOnce(new AuthError('Espera un minuto'));
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(await screen.findByText('Espera un minuto')).toBeTruthy();
    ctl.resend.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));
    expect(await screen.findByText('No se pudo reenviar el correo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ir a iniciar sesión/ }));
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('ana@example.test');
    fireEvent.click(screen.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }));
    fireEvent.click(screen.getByRole('button', { name: '¿Ya tienes cuenta? Inicia sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('al reabrir limpia el estado', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({}) })));
    const value = { login: vi.fn(), loginWithOAuth: vi.fn(), register: vi.fn(), sendPasswordReset: vi.fn() } as unknown as AuthContextValue;
    const ui = (open: boolean) => (
      <AuthContext.Provider value={value}>
        <AuthModal open={open} onClose={() => {}} initialEmail="x@y.z" />
      </AuthContext.Provider>
    );
    const { rerender } = render(ui(true));
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'otro@y.z' } });
    rerender(ui(false));
    rerender(ui(true));
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('x@y.z');
  });
});
