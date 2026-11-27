import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));
vi.mock('../../src/components/PremiumSearchMap', () => ({
  PremiumSearchMap: ({ workers }: { workers: unknown[] }) => <div data-testid="mapa">{workers.length} en el mapa</div>,
}));

import { SearchResultsView, type SearchWorker } from '../../src/components/SearchResultsView';

const w = (over: Partial<SearchWorker>): SearchWorker => ({
  id: 'a', name: 'Ana', profession: 'Pintora', category: 'pintura', rating: 4.8, jobsDone: 12, photoUrl: '/a.png',
  pricePerVisit: 25000, availableNow: true, serviceRadiusKm: 10, ...over,
});
const workers = [
  w({ id: 'a', isElite: true }),
  w({ id: 'b', name: 'Bruno', rating: 3.8, jobsDone: 1, pricePerVisit: 15000, availableNow: false }),
  w({ id: 'c', name: 'Carla', rating: 0, jobsDone: 2, pricePerVisit: 30000 }),
  w({ id: 'd', name: 'Diego', rating: 0, jobsDone: 0, pricePerVisit: 20000 }),
];

function view(props: Partial<Parameters<typeof SearchResultsView>[0]> = {}) {
  const h = {
    onQueryChange: vi.fn(), onSearch: vi.fn(), onSelectWorker: vi.fn(), onBack: vi.fn(), onShowAuth: vi.fn(),
    onOpenNotifications: vi.fn(), onLogout: vi.fn(), onLoadMore: vi.fn(), onUseMyLocation: vi.fn(),
    onSearchAddress: vi.fn(async () => null), onPickClientLocation: vi.fn(),
  };
  const r = render(
    <MemoryRouter>
      <SearchResultsView query="pintura" workers={workers} isLoading={false} selectedWorkerId="a" {...h} {...props} />
    </MemoryRouter>,
  );
  return { h, r };
}

beforeEach(() => {
  fake.current = createFakeSupabase();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { fn(0); return 1; });
});

describe('resultados de búsqueda', () => {
  it('lista, filtra, ordena y selecciona', async () => {
    fake.current!.state.rpc = () => ({ data: true });
    const { h } = view({ profileName: 'ana pérez', unreadCount: 3, hasMore: true, clientLocation: { latitude: -41.4, longitude: -72.9 } });
    expect(screen.getByRole('heading', { name: /Resultados para “pintura”/ })).toBeTruthy();
    expect(screen.getByText('Mostrando 4 profesionales (hay más)')).toBeTruthy();
    expect(await screen.findByText('Datos de demostración')).toBeTruthy();
    expect(await screen.findByTestId('mapa')).toBeTruthy();
    expect(screen.getByText('Élite')).toBeTruthy();
    expect(screen.getAllByText('Nuevo · sin reseñas aún')).toHaveLength(2);
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('4.5 y más'));
    expect(screen.getByText('Mostrando 1 profesional (hay más)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cualquiera'));
    fireEvent.click(screen.getByLabelText(/Disponible ahora/, { selector: 'input' }));
    expect(screen.getByText(/Mostrando 3 profesionales/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por' }));
    fireEvent.click(screen.getByRole('option', { name: 'Precio' }));
    const names = screen.getAllByRole('article').map((a) => a.querySelector('strong')?.textContent);
    expect(names).toEqual(['Diego', 'Ana', 'Carla']);
    fireEvent.click(screen.getByText('Limpiar todo'));
    fireEvent.click(screen.getByLabelText('3.5 y más'));
    fireEvent.click(screen.getByLabelText('4.0 y más'));
    expect(screen.getByText(/Mostrando 1 profesional/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cualquiera'));
    fireEvent.click(screen.getByRole('button', { name: /Bruno/ }));
    expect(h.onSelectWorker).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    expect(screen.getAllByRole('link', { name: 'Ver ficha' })[0].getAttribute('href')).toMatch(/^\/profesional\//);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    fireEvent.click(screen.getByRole('button', { name: /Salir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(h.onOpenNotifications).toHaveBeenCalled();
    expect(h.onLogout).toHaveBeenCalled();
    expect(h.onLoadMore).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Ubicación lista/ })).toBeTruthy();
  });

  it('busca con Enter, limpia, vuelve y usa dirección o GPS', () => {
    const { h } = view();
    const input = screen.getByLabelText('Buscar profesionales');
    fireEvent.change(input, { target: { value: 'gasfiter' } });
    expect(h.onQueryChange).toHaveBeenCalledWith('gasfiter');
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onSearch).toHaveBeenCalledWith('pintura');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(h.onQueryChange).toHaveBeenCalledWith('');
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(h.onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(h.onShowAuth).toHaveBeenCalled();
    const address = screen.getByLabelText('Dirección del trabajo');
    fireEvent.submit(address.closest('form')!);
    expect(h.onSearchAddress).not.toHaveBeenCalled();
    fireEvent.change(address, { target: { value: ' Calle 1, Osorno ' } });
    fireEvent.submit(address.closest('form')!);
    expect(h.onSearchAddress).toHaveBeenCalledWith('Calle 1, Osorno');
    fireEvent.click(screen.getByRole('button', { name: /Usar GPS/ }));
    expect(h.onUseMyLocation).toHaveBeenCalled();
  });

  it('cargando, sin profesionales y sin coincidencias', () => {
    const first = view({ isLoading: true, query: '  ', locating: true, locatingAddress: true, isLoadingMore: true, hasMore: true });
    expect(screen.getByRole('heading', { name: /Resultados para “profesionales”/ })).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Leyendo GPS/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Buscando…/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cargando…' })).toBeTruthy();
    first.r.unmount();
    const second = view({ workers: [] });
    expect(screen.getByText('Todavía no hay profesionales en esta categoría')).toBeTruthy();
    expect(screen.getByText('Sin profesionales en esta página')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver otras categorías' }));
    expect(second.h.onBack).toHaveBeenCalled();
    second.r.unmount();
    view({ workers: [workers[1]], onSearchAddress: undefined });
    fireEvent.click(screen.getByLabelText('4.5 y más'));
    expect(screen.getByText('Ningún profesional cumple esos filtros')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    fireEvent.submit(screen.getByLabelText('Dirección del trabajo').closest('form')!);
  });

  it('modo demo apagado, con error o si se desmonta antes', async () => {
    fake.current!.state.rpc = () => ({ data: true, error: { message: 'x' } });
    const first = view();
    await act(async () => {});
    expect(screen.queryByText('Datos de demostración')).toBeNull();
    first.r.unmount();
    fake.current!.state.rpc = () => { throw new Error('red'); };
    const second = view();
    await act(async () => {});
    second.r.unmount();
    let release: (v: unknown) => void = () => {};
    fake.current!.state.rpc = () => new Promise((r) => { release = r; }) as never;
    const third = view();
    third.r.unmount();
    release({ data: true });
    await waitFor(() => expect(screen.queryByText('Datos de demostración')).toBeNull());
  });
});
