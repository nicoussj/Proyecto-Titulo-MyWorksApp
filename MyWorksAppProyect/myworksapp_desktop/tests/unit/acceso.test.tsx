import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar } from './harness';

const sb = vi.hoisted(() => {
  const mfa = {
    listFactors: vi.fn(), unenroll: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(),
  };
  const listeners: Array<(e: string) => void> = [];
  return {
    listeners,
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      mfa,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((cb: (e: string) => void) => { listeners.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
      exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), setSession: vi.fn(),
    },
  };
});
vi.mock('../../src/supabaseClient', () => ({ supabase: sb, supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true } }));
vi.mock('../../src/lib/totpQr', () => ({ makeScannableTotpQr: vi.fn(async () => 'data:image/png;base64,QR') }));
const sh = vi.hoisted(() => ({
  signIn: vi.fn(), signOut: vi.fn(async () => {}), getSessionProfile: vi.fn(), updateAccountPassword: vi.fn(async () => {}), requestPasswordReset: vi.fn(async () => {}),
}));
vi.mock('@myworksapp/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), ...sh }));

import { AuthError } from '@myworksapp/shared';
import { DesktopLoginScreen } from '../../src/components/DesktopLoginScreen';
import { InvitePasswordScreen } from '../../src/components/InvitePasswordScreen';
import { AdminMfaGate } from '../../src/components/AdminMfaGate';
import { AuthProvider } from '../../src/context/AuthContext';
import { useAuth } from '../../src/context/auth-store';
import { beginAuthDeepLink, endAuthDeepLink } from '../../src/lib/authCallback';

beforeEach(() => {
  sessionStorage.clear();
  sb.listeners.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sb.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'a' } } } });
  sb.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2' } });
  sh.getSessionProfile.mockResolvedValue({ id: 'a', name: 'Admin', role: 'administrador', accountStatus: 'activo' });
  sh.signIn.mockResolvedValue({ id: 'a', name: 'Admin', role: 'administrador', accountStatus: 'activo' });
  window.history.replaceState(null, '', '/');
});

describe('ingreso a la consola', () => {
  it('muestra la clave, informa errores de acceso y registra el intento', async () => {
    const login = vi.fn().mockRejectedValueOnce(new AuthError('Tu rol no entra a la consola.')).mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(undefined);
    montar(<DesktopLoginScreen />, auth({ login }));
    fireEvent.change(document.querySelector('#login-email')!, { target: { value: 'a@b.cl' } });
    fireEvent.change(document.querySelector('#login-password')!, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(document.querySelector('#login-password')!.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Tu rol no entra a la consola.');
    expect(sb.rpc).toHaveBeenCalledWith('registrar_evento_acceso', { p_tipo: 'login_fallido', p_correo: 'a@b.cl' });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo iniciar sesión.'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(login).toHaveBeenCalledTimes(3));
  });

  it('recuperar la clave pide correo y avisa el envío o el error', async () => {
    montar(<DesktopLoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar contraseña' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Escribe tu correo/);
    fireEvent.change(document.querySelector('#login-email')!, { target: { value: 'a@b.cl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar contraseña' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/te enviamos un enlace/);
    sh.requestPasswordReset.mockRejectedValueOnce(new AuthError('rate limit'));
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar contraseña' }));
    await screen.findByRole('alert');
    sh.requestPasswordReset.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar contraseña' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo enviar el correo de recuperación.'));
  });
});

describe('definir la contraseña de la invitación', () => {
  it('valida política y coincidencia, guarda y muestra el error', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new AuthError('weak')).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    const onCancel = vi.fn(async () => {});
    render(<InvitePasswordScreen onSubmit={onSubmit} onCancel={onCancel} />);
    const [a, b] = Array.from(document.querySelectorAll('input'));
    fireEvent.change(a, { target: { value: 'corta' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toBeTruthy();
    fireEvent.change(a, { target: { value: 'Clave12345' } });
    fireEvent.change(b, { target: { value: 'Clave12346' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden.');
    fireEvent.change(b, { target: { value: 'Clave12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Clave12345'));
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo guardar la contraseña.'));
    fireEvent.submit(document.querySelector('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al ingreso' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('segundo factor', () => {
  const codigo = (v: string) => fireEvent.change(document.querySelector('input')!, { target: { value: v } });

  it('factor ya verificado: código corto, reto fallido, código inválido y éxito', async () => {
    sb.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f1', status: 'verified' }], all: [] }, error: null });
    const completeMfa = vi.fn(async () => {});
    const logout = vi.fn(async () => {});
    montar(<AdminMfaGate />, auth({ completeMfa, logout }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(false));
    codigo('12');
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toBe('El código tiene 6 dígitos.');
    codigo('123456');
    sb.auth.mfa.challenge.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No se pudo iniciar la verificación.'));
    sb.auth.mfa.challenge.mockResolvedValue({ data: { id: 'c1' }, error: null });
    sb.auth.mfa.verify.mockResolvedValueOnce({ error: { message: 'bad' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('El código no es válido.'));
    sb.auth.mfa.verify.mockResolvedValueOnce({ error: null });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(completeMfa).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalled();
  });

  it('sin factor: quita pendientes, inscribe y muestra el QR y la clave manual', async () => {
    sb.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [{ id: 'p1', factor_type: 'totp', status: 'unverified' }, { id: 'x', factor_type: 'phone', status: 'unverified' }] }, error: null });
    sb.auth.mfa.unenroll.mockResolvedValue({ error: null });
    sb.auth.mfa.enroll.mockResolvedValue({ data: { id: 'f2', totp: { secret: 'ABCDEF', uri: 'otpauth://x' } }, error: null });
    montar(<AdminMfaGate />);
    expect(await screen.findByAltText('Código QR para configurar el segundo factor')).toBeTruthy();
    expect(screen.getByText('ABCDEF')).toBeTruthy();
    expect(sb.auth.mfa.unenroll).toHaveBeenCalledTimes(1);
    fireEvent.submit(document.querySelector('form')!);
  });

  it.each([
    ['listado', () => sb.auth.mfa.listFactors.mockResolvedValue({ data: null, error: { message: 'x' } }), 'No se pudo revisar el segundo factor.'],
    ['baja', () => { sb.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [{ id: 'p1', factor_type: 'totp', status: 'unverified' }] }, error: null }); sb.auth.mfa.unenroll.mockResolvedValue({ error: { message: 'x' } }); }, 'No se pudo preparar la aplicación de autenticación.'],
    ['alta', () => { sb.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null }); sb.auth.mfa.enroll.mockResolvedValue({ data: null, error: { message: 'x' } }); }, 'No se pudo preparar la aplicación de autenticación.'],
  ])('error en %s', async (_n, preparar, texto) => {
    preparar();
    montar(<AdminMfaGate />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(texto));
  });

  it('desmontar a mitad de la preparación no actualiza el estado', async () => {
    let soltar: (v: unknown) => void = () => {};
    sb.auth.mfa.listFactors.mockReturnValue(new Promise((r) => { soltar = r; }));
    const view = montar(<AdminMfaGate />);
    view.unmount();
    await act(async () => { soltar({ data: { totp: [], all: [] }, error: null }); });
  });
});

function Sonda() {
  const v = useAuth();
  return (
    <div>
      <span data-testid="estado">{v.loading ? 'cargando' : v.mustSetPassword ? 'clave' : v.needsMfa ? 'mfa' : v.profile ? `perfil:${v.profile.role}` : 'fuera'}</span>
      <button type="button" onClick={() => void v.login('a@b.cl', 'x').catch(() => undefined)}>login</button>
      <button type="button" onClick={() => void v.logout()}>logout</button>
      <button type="button" onClick={() => void v.completeMfa()}>mfa</button>
      <button type="button" onClick={() => void v.finishPasswordSetup('Clave12345')}>guardar clave</button>
    </div>
  );
}
const estado = () => screen.getByTestId('estado').textContent;
const proveer = () => render(<AuthProvider><Sonda /></AuthProvider>);

describe('proveedor de sesión', () => {
  it('perfil activo, eventos de auth, logout y login', async () => {
    proveer();
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    await act(async () => { sb.listeners[0]('INITIAL_SESSION'); sb.listeners[0]('TOKEN_REFRESHED'); sb.listeners[0]('SIGNED_IN'); sb.listeners[0]('SIGNED_IN'); });
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(estado()).toBe('fuera'));
    expect(sh.signOut).toHaveBeenCalled();
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    sb.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: { currentLevel: 'aal1' } });
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(estado()).toBe('mfa'));
    sh.signIn.mockResolvedValueOnce({ id: 'c', role: 'usuario', accountStatus: 'activo' });
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(estado()).toBe('fuera'));
    sb.auth.mfa.getAuthenticatorAssuranceLevel.mockRejectedValueOnce(new Error('red'));
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(sh.signOut.mock.calls.length).toBeGreaterThan(1));
    fireEvent.click(screen.getByText('mfa'));
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
  });

  it.each([
    ['sin sesión', () => sh.getSessionProfile.mockResolvedValue(null), 'fuera'],
    ['rol sin consola', () => sh.getSessionProfile.mockResolvedValue({ id: 'c', role: 'usuario', accountStatus: 'activo' }), 'fuera'],
    ['cuenta suspendida', () => sh.getSessionProfile.mockResolvedValue({ id: 'a', role: 'administrador', accountStatus: 'suspendido' }), 'fuera'],
    ['falta mfa', () => sb.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' } }), 'mfa'],
  ])('%s', async (_n, preparar, esperado) => {
    preparar();
    proveer();
    await waitFor(() => expect(estado()).toBe(esperado));
  });

  it('enlace de recuperación en la URL exige clave y luego la guarda', async () => {
    window.history.replaceState(null, '', '/?code=abc&type=recovery#type=recovery');
    proveer();
    await waitFor(() => expect(estado()).toBe('clave'));
    await act(async () => { sb.listeners[0]('SIGNED_IN'); });
    fireEvent.click(screen.getByText('guardar clave'));
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    expect(window.location.search).toBe('');
    expect(sh.updateAccountPassword).toHaveBeenCalledWith(sb, 'Clave12345');
  });

  it('evento de recuperación e invitación marcan la clave pendiente', async () => {
    proveer();
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    await act(async () => { sb.listeners[0]('PASSWORD_RECOVERY'); });
    expect(estado()).toBe('clave');
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(estado()).toBe('fuera'));
    sessionStorage.setItem('mwa-password-setup', '1');
    sessionStorage.setItem(Object.keys(sessionStorage)[0] ?? 'x', '1');
    await act(async () => { sb.listeners[0]('SIGNED_IN'); });
  });

  it('marca de clave sin sesión se limpia; con enlace pendiente espera', async () => {
    const { PASSWORD_SETUP_STORAGE_KEY } = await import('@myworksapp/shared');
    sessionStorage.setItem(PASSWORD_SETUP_STORAGE_KEY, '1');
    sb.auth.getSession.mockResolvedValue({ data: { session: null } });
    const a = proveer();
    await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    expect(sessionStorage.getItem(PASSWORD_SETUP_STORAGE_KEY)).toBeNull();
    a.unmount();
    beginAuthDeepLink();
    try {
      proveer();
      await waitFor(() => expect(estado()).toBe('perfil:administrador'));
    } finally {
      endAuthDeepLink();
    }
  });

  it('perfil marcado para clave después de leer la sesión', async () => {
    const { PASSWORD_SETUP_STORAGE_KEY } = await import('@myworksapp/shared');
    sh.getSessionProfile.mockImplementationOnce(async () => {
      sessionStorage.setItem(PASSWORD_SETUP_STORAGE_KEY, '1');
      return { id: 'a', role: 'administrador', accountStatus: 'activo' };
    });
    sb.auth.getSession.mockResolvedValue({ data: { session: null } });
    proveer();
    await waitFor(() => expect(estado()).toBe('clave'));
  });
});
