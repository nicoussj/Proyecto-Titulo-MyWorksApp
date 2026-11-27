import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar, perfil } from './harness';
import { explorar, llenarCampos } from './explorar';

const cli = vi.hoisted(() => ({ modo: 'ok' as 'ok' | 'error' | 'mixto' | 'totp', base: null as null | Record<string, any> }));
vi.mock('../../src/supabaseClient', async () => {
  const { clienteCaptura } = await import('../../src/captura/cliente');
  cli.base = clienteCaptura() as Record<string, any>;
  const falla = { message: 'falla simulada', code: 'P0001' };
  const proxy = {
    from(tabla: string) {
      if (cli.modo !== 'error') {
        const api = cli.base!.from(tabla);
        if (cli.modo === 'mixto') {
          const ko = () => Promise.resolve({ data: null, error: falla });
          api.update = () => ({ eq: ko, in: ko });
          api.insert = ko;
          api.delete = () => ({ eq: ko });
          api.upsert = ko;
          return api;
        }
        const orig = api.update;
        api.update = (...a: unknown[]) => ({ eq: () => Promise.resolve({ data: null, error: null }), ...orig?.(...a) });
        api.insert = () => Promise.resolve({ data: null, error: null });
        api.delete = () => ({ eq: () => Promise.resolve({ data: null, error: null }) });
        api.upsert = () => Promise.resolve({ data: null, error: null });
        return api;
      }
      const chain: any = new Proxy({}, { get: (_t, p) => (p === 'then' ? (ok: any) => Promise.resolve({ data: null, error: falla, count: null }).then(ok) : () => chain) });
      return chain;
    },
    rpc(nombre: string, args?: Record<string, unknown>) {
      if (cli.modo === 'error') return Promise.resolve({ data: null, error: falla });
      if (cli.modo === 'mixto') {
        return cli.base!.rpc(nombre, args).then((r: { data: unknown }) =>
          r.data == null || (Array.isArray(r.data) && r.data.length === 0) ? { data: null, error: falla } : r);
      }
      return cli.base!.rpc(nombre, args);
    },
    functions: { invoke: async () => (cli.modo === 'ok' || cli.modo === 'totp' ? { data: { ok: true }, error: null } : { data: null, error: falla }) },
    channel: (...a: unknown[]) => cli.base!.channel(...a),
    removeChannel: () => Promise.resolve('ok'),
    storage: { from: () => ({ createSignedUrl: async () => (cli.modo !== 'error' ? { data: { signedUrl: 'https://example.test/doc.jpg' }, error: null } : { data: null, error: falla }) }) },
    auth: {
      ...cli.base!.auth,
      updateUser: async () => (cli.modo === 'ok' || cli.modo === 'totp' ? { data: {}, error: null } : { data: null, error: falla }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      mfa: {
        listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null }),
        challenge: async () => ({ data: { id: 'c1' }, error: null }),
        verify: async () => ({ data: {}, error: cli.modo === 'ok' || cli.modo === 'totp' ? null : falla }),
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }),
      },
    },
  };
  return { supabase: proxy, supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true } };
});

import App from '../../src/App';
import { markTotpVerified } from '../../src/lib/totp';
import { NAV } from '../../src/shell/nav';

const rutas = [...NAV.map((item) => item.to), '/pedidos/job-1', '/usuarios/u-1', '/profesionales/w-1', '/pagos/p-1', '/cuenta'];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'open').mockImplementation(() => null);
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe.each(['ok', 'error', 'mixto', 'totp'] as const)('operador recorre cada pantalla (backend %s)', (modo) => {
  it.each(rutas)('%s', async (ruta) => {
    cli.modo = modo;
    if (modo === 'totp') markTotpVerified();
    window.history.pushState({}, '', ruta);
    montar(<App />);
    const pulsados = await explorar(80);
    await llenarCampos(document.querySelector('main') ?? document);
    await explorar(10);
    expect(pulsados.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Algo falló en esta pantalla/i)).toBeNull();
  }, 30000);
});

describe('roles acotados', () => {
  it.each(['soporte', 'qa'])('%s explora sus pantallas', async (role) => {
    cli.modo = 'ok';
    for (const ruta of rutas) {
      window.history.pushState({}, '', ruta);
      const view = montar(<App />, auth({ profile: perfil(role) }));
      await explorar(25);
      view.unmount();
    }
  }, 60000);
});
