import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(key: string, prod = false) {
  vi.resetModules();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', key);
  vi.stubEnv('PROD', prod);
  return (await import('../../src/components/TurnstileWidget')).TurnstileWidget;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('script[src*="turnstile"]').forEach((s) => s.remove());
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe('widget de Turnstile', () => {
  it('sin clave no monta nada', async () => {
    const Widget = await load('');
    const { container } = render(<Widget onToken={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('con la API ya cargada renderiza, entrega el token y se limpia', async () => {
    const api = { render: vi.fn((_n: HTMLElement, o: { callback: (t: string) => void }) => { o.callback('tok-1'); return 'w-1'; }), remove: vi.fn() };
    (window as unknown as { turnstile: unknown }).turnstile = api;
    const Widget = await load('0x4AAAA-real');
    const onToken = vi.fn();
    const { container, unmount } = render(<Widget onToken={onToken} />);
    expect(container.querySelector('.turnstile-slot')).toBeTruthy();
    expect(api.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: '0x4AAAA-real' }));
    expect(onToken).toHaveBeenCalledWith('tok-1');
    unmount();
    expect(api.remove).toHaveBeenCalledWith('w-1');
  });

  it('sin API carga el script y renderiza al terminar; si se desmonta antes no renderiza', async () => {
    const Widget = await load('0x4AAAA-real');
    const first = render(<Widget onToken={() => {}} />);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="turnstile"]')!;
    expect(script.src).toContain('render=explicit');
    const api = { render: vi.fn(() => 'w-2'), remove: vi.fn() };
    (window as unknown as { turnstile: unknown }).turnstile = api;
    script.onload?.(new Event('load'));
    expect(api.render).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = render(<Widget onToken={() => {}} />);
    second.unmount();
    expect(api.remove).toHaveBeenCalledTimes(2);
  });

  it('si el script carga sin API o tras desmontar, no hace nada', async () => {
    const Widget = await load('0x4AAAA-real');
    const view = render(<Widget onToken={() => {}} />);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="turnstile"]')!;
    script.onload?.(new Event('load'));
    view.unmount();
    const api = { render: vi.fn(() => 'w'), remove: vi.fn() };
    (window as unknown as { turnstile: unknown }).turnstile = api;
    script.onload?.(new Event('load'));
    expect(api.render).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('en producción con clave de prueba no se monta', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Widget = await load('1x00000000000000000000AA', true);
    const { container } = render(<Widget onToken={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
