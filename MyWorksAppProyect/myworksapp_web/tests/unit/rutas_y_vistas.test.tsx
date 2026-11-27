import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '@myworksapp/shared';
import { categoryFromPath, pathForView, recordIdFromPath, viewFromPath, type AppView } from '../../src/routing/paths';
import { isTurnstileTestSiteKey, shouldRenderTurnstile } from '../../src/components/turnstileSitePolicy';
import { NotificationInbox } from '../../src/components/NotificationInbox';
import { CategoriesCatalogView } from '../../src/components/CategoriesCatalogView';
import { ALL_SERVICE_CATEGORIES } from '../../src/data/serviceCategories';

describe('rutas', () => {
  it('cada vista vuelve a su ruta', () => {
    const vistas: AppView[] = ['landing', 'categories', 'paid', 'account', 'trabaja', 'aviso', 'terminos', 'privacidad'];
    for (const v of vistas) expect(viewFromPath(pathForView(v) + '/')).toBe(v);
    expect(pathForView('notfound')).toBe('/no-existe');
    expect(viewFromPath('/no-existe')).toBe('notfound');
    expect(viewFromPath('')).toBe('landing');
  });
  it('búsqueda, ficha y pedido con y sin id', () => {
    expect(pathForView('search', { category: 'aire acondicionado' })).toBe('/servicios/aire%20acondicionado');
    expect(pathForView('search')).toBe('/servicios');
    expect(pathForView('tracking', { jobId: 'j 1' })).toBe('/pedido/j%201');
    expect(pathForView('tracking')).toBe('/');
    expect(categoryFromPath('/servicios/aire%20acondicionado/')).toBe('aire acondicionado');
    expect(categoryFromPath('/servicios')).toBeNull();
    expect(recordIdFromPath('/profesional/p-1', 'profesional')).toBe('p-1');
    expect(recordIdFromPath('/pedido/p-1/x', 'pedido')).toBeNull();
    expect(viewFromPath('/profesional/p-1')).toBe('profile');
    expect(viewFromPath('/pedido/j')).toBe('tracking');
    expect(viewFromPath('/encuesta')).toBe('landing');
  });
});

describe('política de Turnstile', () => {
  it('no muestra claves de prueba en producción ni claves vacías', () => {
    expect(isTurnstileTestSiteKey(' 1x00000000000000000000AA ')).toBe(true);
    expect(shouldRenderTurnstile('', false)).toBe(false);
    expect(shouldRenderTurnstile('1x00000000000000000000AA', true)).toBe(false);
    expect(shouldRenderTurnstile('1x00000000000000000000AA', false)).toBe(true);
    expect(shouldRenderTurnstile('0x4AAAA-real', true)).toBe(true);
  });
});

describe('clave de Turnstile según el build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('sin clave no se muestra', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const mod = await import('../../src/components/turnstileSite');
    expect(mod.turnstileSiteKey()).toBe('');
    expect(mod.turnstileCanRender()).toBe(false);
  });
  it('en producción con clave de prueba avisa por consola y no se muestra', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', ' 1x00000000000000000000AA ');
    vi.stubEnv('PROD', true);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('../../src/components/turnstileSite');
    expect(mod.turnstileSiteKey()).toBe('1x00000000000000000000AA');
    expect(mod.turnstileCanRender()).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('VITE_TURNSTILE_SITE_KEY'));
  });
  it('con clave real se muestra', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAAA-real');
    vi.stubEnv('PROD', true);
    const mod = await import('../../src/components/turnstileSite');
    expect(mod.turnstileCanRender()).toBe(true);
  });
});

describe('sitio según el build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('quita la barra final del dominio y usa el commit', async () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://demo.example/');
    vi.stubEnv('VITE_APP_COMMIT', 'abc1234');
    const mod = await import('../../src/site');
    expect(mod.PUBLIC_SITE_URL).toBe('https://demo.example');
    expect(mod.APP_COMMIT).toBe('abc1234');
  });
  it('sin variables usa myworksapp.cl y «dev»', async () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '');
    vi.stubEnv('VITE_APP_COMMIT', '');
    const mod = await import('../../src/site');
    expect(mod.PUBLIC_SITE_URL).toBe('https://myworksapp.cl');
    expect(mod.APP_COMMIT).toBe('dev');
  });
  it('el cliente de Supabase usa las variables o un origen inerte', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', ' https://proyecto.supabase.co ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ' clave-publica ');
    let mod = await import('../../src/supabaseClient');
    expect(mod.SUPABASE_URL).toBe('https://proyecto.supabase.co');
    expect(mod.SUPABASE_ANON_KEY).toBe('clave-publica');
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    mod = await import('../../src/supabaseClient');
    expect(mod.SUPABASE_URL).toBe('https://example.supabase.co');
    expect(mod.SUPABASE_ANON_KEY).toBe('public-anon-placeholder');
    expect(typeof mod.supabase.from).toBe('function');
  });
});

const notice = (id: string, relatedId: string | null, read: boolean): AppNotification => ({
  id, title: `Aviso ${id}`, body: `Cuerpo ${id}`, type: 'x', read, createdAt: '2026-11-26T12:00:00Z', relatedId,
});

describe('bandeja de notificaciones', () => {
  it('agrupa por pedido, abre carpetas y avisos', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <NotificationInbox
        notices={[notice('1', 'job-1', false), notice('2', 'job-1', true), notice('3', null, true)]}
        jobTitles={{ 'job-1': 'Pintura living' }}
        onClose={onClose}
        onOpen={onOpen}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Notificaciones' });
    expect(within(dialog).getByText('1 sin leer · 2')).toBeTruthy();
    expect(within(dialog).getByText('1 avisos')).toBeTruthy();
    fireEvent.click(screen.getByText('Aviso 1'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(screen.getByText('Aviso 1').closest('button')?.className).toBe('notice-unread');
    expect(screen.getByText('Aviso 2').closest('button')?.className).toBe('notice-read');
    const toggles = screen.getAllByRole('button', { expanded: true });
    fireEvent.click(toggles[0]);
    expect(screen.queryByText('Aviso 1')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[1]);
    expect(screen.getByText('Aviso 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('sin avisos lo dice', () => {
    render(<NotificationInbox notices={[]} onClose={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('No tienes notificaciones.')).toBeTruthy();
  });
});

describe('catálogo de categorías', () => {
  it('con sesión saluda, elige categoría y vuelve', () => {
    const onBack = vi.fn();
    const onSelect = vi.fn();
    render(
      <CategoriesCatalogView
        categories={ALL_SERVICE_CATEGORIES.slice(0, 2)}
        profileName="Ana Pérez"
        onBack={onBack}
        onSelectCategory={onSelect}
        onShowAuth={() => {}}
      />,
    );
    expect(screen.getByText('Ana')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Armado/ }));
    expect(onSelect).toHaveBeenCalledWith(ALL_SERVICE_CATEGORIES[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Volver al inicio' })[0]);
    expect(onBack).toHaveBeenCalled();
  });
  it('sin sesión ni categorías ofrece ingresar', () => {
    const onShowAuth = vi.fn();
    render(<CategoriesCatalogView categories={[]} onBack={() => {}} onSelectCategory={() => {}} onShowAuth={onShowAuth} />);
    expect(screen.getByRole('status').textContent).toContain('no hay profesionales');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(onShowAuth).toHaveBeenCalled();
  });
});
