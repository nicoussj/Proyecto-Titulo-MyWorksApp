import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar, perfil } from './harness';

const cli = vi.hoisted(() => ({ falla: false, vacio: false, canal: 'SUBSCRIBED' }));
vi.mock('../../src/supabaseClient', async () => {
  const { clienteCaptura } = await import('../../src/captura/cliente');
  const base = clienteCaptura() as Record<string, any>;
  return {
    supabase: {
      ...base,
      rpc: (n: string, a?: unknown) => (cli.falla ? Promise.resolve({ data: null, error: { message: 'x' } })
        : cli.vacio ? Promise.resolve({ data: n === 'consola_buscar' ? [] : null, error: null }) : base.rpc(n, a)),
      from: (t: string) => (cli.falla ? { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: null, error: { message: 'x' } }) }) }) } : base.from(t)),
      channel: () => ({ subscribe: (cb: (s: string) => void) => { cb(cli.canal); return {}; } }),
    },
    supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true },
  };
});

import { Shell } from '../../src/shell/Shell';

let ruta = '';
function Ruta() {
  const { pathname } = useLocation();
  useEffect(() => { ruta = pathname; }, [pathname]);
  return <input aria-label="Buscar en la tabla" />;
}
const marco = (value = auth(), conTabla = true) => montar(
  <MemoryRouter initialEntries={['/resumen']}>
    <Shell>
      <Routes><Route path="*" element={conTabla ? <Ruta /> : <RutaSola />} /></Routes>
    </Shell>
  </MemoryRouter>,
  value,
);
function RutaSola() {
  const { pathname } = useLocation();
  useEffect(() => { ruta = pathname; }, [pathname]);
  return <p>contenido</p>;
}
const tecla = (key: string, extra: KeyboardEventInit = {}, target: EventTarget = window) =>
  act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra })); });

beforeEach(() => {
  localStorage.clear();
  cli.falla = false;
  cli.vacio = false;
  cli.canal = 'SUBSCRIBED';
});

describe('marco de la consola', () => {
  it('menú lateral, rango, perfil, tema, densidad, cuenta y salir', async () => {
    const value = auth();
    marco(value);
    await waitFor(() => expect(document.querySelector('.nav-badge')).toBeTruthy());
    expect(document.querySelector('.live-dot')!.getAttribute('data-vivo')).toBe('si');
    fireEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(localStorage.getItem('mwa-nav')).toBe('cerrada');
    fireEvent.click(screen.getByRole('button', { name: '»' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getByText('Pedidos'));
    expect(ruta).toBe('/pedidos');
    fireEvent.click(screen.getByRole('button', { name: '30 d' }));
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones, \d+ sin leer/ }));
    expect(ruta).toBe('/notificaciones');
    const perfilBtn = screen.getByRole('button', { name: /Admin de prueba/ });
    fireEvent.click(perfilBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Tema claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(perfilBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));
    fireEvent.click(perfilBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Densidad compacta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Densidad cómoda' }));
    await tecla('Escape');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(perfilBtn);
    act(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(perfilBtn);
    fireEvent.pointerDown(screen.getByRole('menu'));
    fireEvent.click(screen.getByRole('button', { name: 'Mi cuenta' }));
    expect(ruta).toBe('/cuenta');
    fireEvent.click(perfilBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(value.logout).toHaveBeenCalled();
  });

  it('atajos: Ctrl K, barra, Escape, g p y g d; búsqueda con resultados', async () => {
    marco();
    await tecla('k', { ctrlKey: true });
    const input = screen.getByRole('dialog').querySelector('input')!;
    await tecla('/', {}, input);
    fireEvent.change(input, { target: { value: 'pe' } });
    fireEvent.click(await screen.findByRole('button', { name: /Pedido de prueba/ }));
    expect(ruta).toBe('/pedidos/job-1');
    await tecla('/');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Buscar en la tabla');
    (document.activeElement as HTMLElement).blur();
    await tecla('g'); await tecla('p');
    expect(ruta).toBe('/pedidos');
    await tecla('g'); await tecla('d');
    expect(ruta).toBe('/disputas');
    await tecla('x');
    fireEvent.click(screen.getByRole('button', { name: /Buscar clientes/ }));
    await tecla('Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('sin tabla la barra abre la búsqueda; sin resultados y con error', async () => {
    cli.vacio = true;
    cli.canal = 'CLOSED';
    const v = marco(auth({ profile: perfil('qa') }), false);
    await tecla('/');
    const input = screen.getByRole('dialog').querySelector('input')!;
    fireEvent.change(input, { target: { value: 'zz' } });
    expect(await screen.findByText(/Sin resultados/)).toBeTruthy();
    v.unmount();
    cli.falla = true;
    marco(auth({ profile: { ...perfil(), id: undefined } as never }), false);
    await tecla('k', { metaKey: true });
    fireEvent.change(screen.getByRole('dialog').querySelector('input')!, { target: { value: 'zz' } });
    expect(await screen.findByText(/No se pudo buscar/)).toBeTruthy();
  });

  it('inactividad avisa, cierra la sesión y en equipo compartido sale al ocultar la página', async () => {
    localStorage.setItem('mwa-equipo-compartido', '1');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const value = auth();
      marco(value);
      await act(async () => { vi.advanceTimersByTime(13 * 60 * 1000 + 15000); });
      expect(screen.getByText(/se cerrará por inactividad/)).toBeTruthy();
      await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })); vi.advanceTimersByTime(15000); });
      expect(screen.queryByText(/se cerrará por inactividad/)).toBeNull();
      await act(async () => { vi.advanceTimersByTime(16 * 60 * 1000); });
      expect(value.logout).toHaveBeenCalled();
      (value.logout as ReturnType<typeof vi.fn>).mockClear();
      act(() => { window.dispatchEvent(new Event('pagehide')); });
      expect(value.logout).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
