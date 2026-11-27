import { afterEach, describe, expect, it, vi } from 'vitest';

const render = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render })) }));
vi.mock('@fontsource/inter/400.css', () => ({}));
vi.mock('@fontsource/inter/500.css', () => ({}));
vi.mock('@fontsource/inter/600.css', () => ({}));
vi.mock('../../src/index.css', () => ({}));
vi.mock('../../src/App.tsx', () => ({ default: () => null }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  render.mockClear();
  window.history.replaceState(null, '', '/');
});

describe('arranque de la consola', () => {
  it('en desarrollo no registra', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const register = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    vi.stubEnv('PROD', false);
    await import('../../src/main.tsx');
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });
  it('aplica tema y densidad, monta y registra el service worker solo en producción', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const register = vi.fn(() => Promise.reject(new Error('x')));
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    vi.stubEnv('PROD', true);
    await import('../../src/main.tsx');
    expect(render).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

});

describe('cliente de Supabase', () => {
  it('sin variables usa valores de relleno y lo informa', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('../../src/supabaseClient');
    expect(mod.supabaseConfigStatus).toEqual({ urlConfigured: false, anonKeyConfigured: false });
    expect(typeof mod.supabase.from).toBe('function');
  });

  it('con variables locales queda configurado', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-local');
    const mod = await import('../../src/supabaseClient');
    expect(mod.supabaseConfigStatus).toEqual({ urlConfigured: true, anonKeyConfigured: true });
  });

  it('en modo captura local usa el cliente de muestra', async () => {
    vi.stubEnv('DEV', true);
    window.history.replaceState(null, '', '/?captura=local');
    const mod = await import('../../src/supabaseClient');
    const { data } = await mod.supabase.rpc('consola_estado_defensa' as never);
    expect(data).toEqual({ solo_lectura: false, bloqueo_total: false });
  });
});
