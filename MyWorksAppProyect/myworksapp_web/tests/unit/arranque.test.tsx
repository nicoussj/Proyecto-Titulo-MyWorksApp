import { afterEach, describe, expect, it, vi } from 'vitest';

const render = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render })) }));
vi.mock('@fontsource-variable/dm-sans/wght.css', () => ({}));
vi.mock('../../src/index.css', () => ({}));
vi.mock('../../src/App.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/AcademicNoticeBanner.tsx', () => ({ AcademicNoticeBanner: () => null }));
vi.mock('../../src/context/AuthContext.tsx', () => ({ AuthProvider: ({ children }: { children: unknown }) => children }));
vi.mock('../../src/components/PasswordRecoveryModal', () => ({ PasswordRecoveryModal: () => null }));
vi.mock('../../src/components/TestingSurveyModal', () => ({ TestingSurveyModal: () => null }));
vi.mock('../../src/queryClient', () => ({ queryClient: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  render.mockClear();
});

describe('arranque de la web', () => {
  it('monta la app en #root; en desarrollo no registra el service worker', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const register = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    vi.stubEnv('PROD', false);
    await import('../../src/main.tsx');
    expect(render).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });

  it('en producción registra /sw.js al cargar y tolera el rechazo', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const register = vi.fn(() => Promise.reject(new Error('sin sw')));
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    vi.stubEnv('PROD', true);
    await import('../../src/main.tsx');
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledWith('/sw.js');
    await Promise.resolve();
  });

  it('sin soporte de service worker solo monta', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const nav = { ...navigator } as Record<string, unknown>;
    delete nav.serviceWorker;
    vi.stubGlobal('navigator', nav);
    vi.stubEnv('PROD', true);
    await import('../../src/main.tsx');
    expect(render).toHaveBeenCalledTimes(1);
  });
});
