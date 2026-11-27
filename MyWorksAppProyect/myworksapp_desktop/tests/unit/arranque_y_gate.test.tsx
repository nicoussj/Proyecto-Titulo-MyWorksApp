import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar } from './harness';

const h = vi.hoisted(() => ({
  config: { urlConfigured: true, anonKeyConfigured: true },
  auth: { exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), setSession: vi.fn() },
  deep: { current: [] as string[] | null, listener: null as null | ((u: string[]) => void), fail: false },
  update: { check: vi.fn() },
}));
vi.mock('../../src/supabaseClient', () => ({ supabase: { auth: h.auth }, supabaseConfigStatus: h.config }));
vi.mock('../../src/shell/Shell', () => ({ Shell: ({ children }: { children: unknown }) => <main>{children as never}</main> }));
vi.mock('../../src/features/screens', async () => {
  const names = ['AjustesPage', 'AuditoriaPage', 'CatalogoPage', 'ConciliacionPage', 'CuentaPage', 'DisputasPage', 'EquipoPage', 'ErroresPage', 'FinanzasPage', 'LiquidacionesPage', 'NotificacionesPage', 'PagosPage', 'PedidosPage', 'ProfesionalesPage', 'ReembolsosPage', 'ReportesPage', 'ResenasPage', 'ResumenPage', 'SaludPage', 'TicketsPage', 'UsuariosPage'];
  return Object.fromEntries(names.map((n) => [n, () => <h1>{n}</h1>]));
});
vi.mock('../../src/components/AdminMfaGate', () => ({ AdminMfaGate: () => <h1>mfa</h1> }));
vi.mock('../../src/components/DesktopLoginScreen', () => ({ DesktopLoginScreen: () => <h1>login</h1> }));
vi.mock('@tauri-apps/plugin-deep-link', () => ({
  getCurrent: async () => { if (h.deep.fail) throw new Error('sin plugin'); return h.deep.current; },
  onOpenUrl: async (cb: (u: string[]) => void) => { h.deep.listener = cb; },
}));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: () => h.update.check() }));

import App from '../../src/App';
import { RouteErrorBoundary } from '../../src/ui/boundary';
import { DesktopUpdateNotice } from '../../src/features/updateNotice';
import { queryClient, queryKeys } from '../../src/queryClient';
import { passwordSetupMarked } from '../../src/lib/authCallback';

beforeEach(() => {
  sessionStorage.clear();
  h.config.urlConfigured = true;
  h.config.anonKeyConfigured = true;
  h.deep.current = [];
  h.deep.fail = false;
  h.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  h.auth.verifyOtp.mockResolvedValue({ error: null });
  h.auth.setSession.mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.history.pushState({}, '', '/');
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.unstubAllEnvs();
});
const tick = (ms = 20) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('puerta de la consola', () => {
  it('sin variables de Supabase avisa la configuración', () => {
    h.config.urlConfigured = false;
    montar(<App />);
    expect(screen.getByText('Faltan las variables de Supabase')).toBeTruthy();
  });

  it.each([
    [{ loading: true }, 'Cargando sesión…'],
    [{ mustSetPassword: true }, 'Define tu contraseña'],
    [{ needsMfa: true }, 'mfa'],
    [{ profile: null }, 'login'],
  ])('estado %j muestra %s', (over, texto) => {
    montar(<App />, auth(over as never));
    expect(screen.getByText(texto)).toBeTruthy();
  });

  it('con perfil redirige a resumen y muestra la ruta desconocida', async () => {
    montar(<App />);
    expect(await screen.findByText('ResumenPage')).toBeTruthy();
    window.history.pushState({}, '', '/ruta-rara');
    const v = montar(<App />);
    expect(v.getByText('Esta ruta no existe.')).toBeTruthy();
  });
});

describe('deep links de Auth en la app instalada', () => {
  const tauri = () => { (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}; };

  it('procesa el enlace inicial y los siguientes por tipo', async () => {
    tauri();
    h.deep.current = ['myworksapp-admin://auth/callback?code=abc&type=invite'];
    montar(<App />, auth({ profile: null }));
    await tick();
    expect(h.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(passwordSetupMarked()).toBe(true);
    await act(async () => { h.deep.listener!(['myworksapp-admin://auth/callback?token_hash=t&type=recovery']); });
    await tick();
    expect(h.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 't', type: 'recovery' });
    await act(async () => { h.deep.listener!(['myworksapp-admin://auth/callback#access_token=a&refresh_token=r']); });
    await tick();
    expect(h.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    await act(async () => { h.deep.listener!(['no es url']); h.deep.listener!([]); });
  });

  it('un enlace rechazado borra la marca de clave que puso', async () => {
    tauri();
    h.deep.current = null;
    montar(<App />, auth({ profile: null }));
    await tick();
    for (const [url, mock] of [
      ['myworksapp-admin://auth/callback?code=abc&type=recovery', h.auth.exchangeCodeForSession],
      ['myworksapp-admin://auth/callback?token_hash=t&type=invite', h.auth.verifyOtp],
      ['myworksapp-admin://auth/callback#access_token=a&refresh_token=r&type=invite', h.auth.setSession],
    ] as const) {
      mock.mockResolvedValueOnce({ error: { message: 'x' } });
      await act(async () => { h.deep.listener!([url]); });
      await tick();
      expect(passwordSetupMarked()).toBe(false);
    }
    expect(console.error).toHaveBeenCalledWith('deep link de auth rechazado');
  });

  it('sin plugin la versión web sigue', async () => {
    tauri();
    h.deep.fail = true;
    const v = montar(<App />, auth({ profile: null }));
    await tick();
    v.unmount();
  });
});

describe('aviso de actualización', () => {
  const tauri = () => { (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}; };

  it('no consulta sin la bandera del build', async () => {
    tauri();
    render(<DesktopUpdateNotice />);
    await tick();
    expect(h.update.check).not.toHaveBeenCalled();
  });

  it('ofrece instalar, informa éxito y fallo', async () => {
    tauri();
    vi.stubEnv('VITE_DESKTOP_UPDATER', '1');
    const install = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('x'));
    h.update.check.mockResolvedValue({ version: '1.2.3', downloadAndInstall: install });
    render(<DesktopUpdateNotice />);
    expect(await screen.findByText(/Hay una versión nueva \(1.2.3\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar e instalar' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Actualización descargada/));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar e instalar' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/No se pudo descargar/));
  });

  it.each([[null], ['error']])('sin versión nueva (%s) no muestra nada', async (caso) => {
    tauri();
    vi.stubEnv('VITE_DESKTOP_UPDATER', '1');
    if (caso === 'error') h.update.check.mockRejectedValue(new Error('sin feed'));
    else h.update.check.mockResolvedValue(null);
    const v = render(<DesktopUpdateNotice />);
    await tick();
    expect(v.container.textContent).toBe('');
    v.unmount();
  });
});

describe('piezas de soporte', () => {
  it('el límite de errores muestra reintentar y vuelve a dibujar', () => {
    let romper = true;
    function Fragil() { if (romper) throw new Error('boom'); return <p>bien</p>; }
    function NoError() { if (romper) throw 'texto'; return <p>ok</p>; }
    render(<RouteErrorBoundary><Fragil /></RouteErrorBoundary>);
    expect(screen.getByText('Esta pantalla falló al mostrarse.')).toBeTruthy();
    romper = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('bien')).toBeTruthy();
    romper = true;
    render(<RouteErrorBoundary><NoError /></RouteErrorBoundary>);
  });

  it('el cliente de consultas no reintenta errores 4xx y reintenta una vez el resto', () => {
    const retry = queryClient.getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, { status: 403 })).toBe(false);
    expect(retry(0, { status: 500 })).toBe(true);
    expect(retry(1, new Error('x'))).toBe(false);
    expect(retry(0, null)).toBe(true);
    expect(queryKeys.openDisputes).toEqual(['admin', 'disputes', 'open']);
  });
});
