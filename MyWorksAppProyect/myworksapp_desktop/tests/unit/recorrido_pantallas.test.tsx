import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar, perfil } from './harness';

const cli = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../src/supabaseClient', async () => {
  const { clienteCaptura } = await import('../../src/captura/cliente');
  cli.current = clienteCaptura();
  return { get supabase() { return cli.current; }, supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true } };
});

import App from '../../src/App';
import { NAV } from '../../src/shell/nav';

const rutas = [...NAV.map((item) => item.to), '/', '/pedidos/job-1', '/usuarios/u-1', '/profesionales/w-1', '/pagos/p-1', '/cuenta', '/no-existe'];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('recorrido de todas las pantallas con datos de captura', () => {
  it.each(rutas)('%s carga sin error de ruta', async (ruta) => {
    window.history.pushState({}, '', ruta);
    montar(<App />);
    await waitFor(() => expect(document.querySelector('main, [role="main"]')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/Algo falló en esta pantalla/i)).toBeNull();
  });

  it.each(['soporte', 'qa'])('rol %s recorre sus módulos', async (role) => {
    for (const ruta of NAV.map((item) => item.to)) {
      window.history.pushState({}, '', ruta);
      const view = montar(<App />, auth({ profile: perfil(role) }));
      await new Promise((r) => setTimeout(r, 10));
      view.unmount();
    }
  });
});
