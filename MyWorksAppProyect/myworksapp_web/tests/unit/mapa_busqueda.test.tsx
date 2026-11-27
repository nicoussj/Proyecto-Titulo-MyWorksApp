import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const base = vi.hoisted(() => ({ coarse: false, added: [] as unknown[] }));
vi.mock('../../src/map/basemap', () => ({
  addFastBasemap: (map: unknown) => base.added.push(map),
  fastMapOptions: () => ({}),
  isCoarseMap: () => base.coarse,
}));

import L from 'leaflet';
import { PremiumSearchMap } from '../../src/components/PremiumSearchMap';
import type { SearchWorker } from '../../src/components/SearchResultsView';

const w = (id: string, over: Partial<SearchWorker> = {}): SearchWorker => ({
  id, name: `Pro ${id}`, profession: 'Gasfíter', category: 'gasfiteria', rating: 4.5, jobsDone: 3,
  photoUrl: `/${id}.png`, pricePerVisit: 15000.4, latitude: -41.47, longitude: -72.93, serviceRadiusKm: 8, ...over,
});

let maps: L.Map[] = [];
let observers: Array<() => void> = [];
const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

beforeEach(() => {
  maps = [];
  observers = [];
  base.coarse = false;
  base.added.length = 0;
  vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { observers.push(cb); } observe() {} disconnect() {} });
  const realSetView = L.Map.prototype.setView;
  vi.spyOn(L.Map.prototype, 'setView').mockImplementation(function (this: L.Map, ...args: Parameters<L.Map['setView']>) {
    if (!maps.includes(this)) maps.push(this);
    return realSetView.apply(this, args);
  });
  vi.spyOn(L.Map.prototype, 'fitBounds').mockImplementation(function (this: L.Map) { return this; });
  vi.spyOn(L.Map.prototype, 'invalidateSize').mockImplementation(function (this: L.Map) { return this; });
});
afterEach(() => vi.unstubAllGlobals());

function markers(map: L.Map) {
  const out: L.Marker[] = [];
  map.eachLayer((layer) => { if (layer instanceof L.Marker) out.push(layer); });
  return out;
}

describe('mapa de búsqueda', () => {
  it('sin profesionales con ubicación: centro demo, aviso y sin tarjeta', async () => {
    const { container } = render(<PremiumSearchMap workers={[]} selectedWorkerId={null} onSelectWorker={vi.fn()} />);
    expect(screen.getByText('Ningún profesional tiene ubicación base todavía')).toBeTruthy();
    expect(container.querySelector('.premium-search-map-card')).toBeNull();
    await flush();
    expect(base.added).toHaveLength(1);
    const map = maps[0];
    map.fire('click', { latlng: L.latLng(-41, -72), originalEvent: { target: document.body } });
  });

  it('un profesional: marcador, popup, tarjeta, clic en el mapa y redimensión', async () => {
    const onSelect = vi.fn();
    const onPick = vi.fn();
    const one = w('a', { isElite: true, rating: 0 });
    const bad = w('b', { latitude: Number.NaN });
    const none = w('c', { latitude: null, longitude: null });
    render(<PremiumSearchMap workers={[one, bad, none]} selectedWorkerId={null} onSelectWorker={onSelect} categoryLabel="Gasfitería" onPickClientLocation={onPick} />);
    expect(screen.getByText('1 en el mapa · Gasfitería')).toBeTruthy();
    const map = maps[0];
    const [marker] = markers(map);
    expect(marker.getElement()?.getAttribute('aria-label')).toBe('Pro a, Gasfíter. Ver en el mapa');
    const popup = marker.getPopup()!.getContent() as HTMLElement;
    expect(popup.textContent).toContain('Gasfíter · Élite');
    expect(popup.textContent).toContain('Nuevo · desde $15.000');
    marker.fire('click');
    expect(onSelect).toHaveBeenCalledWith(one);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.premium-search-map-card')!);
    expect(onSelect).toHaveBeenCalledTimes(2);
    const pin = document.createElement('div');
    pin.className = 'mwa-map-pin';
    map.fire('click', { latlng: L.latLng(-41, -72), originalEvent: { target: pin } });
    expect(onPick).not.toHaveBeenCalled();
    map.fire('click', { latlng: L.latLng(-41.1, -72.2), originalEvent: { target: document.body } });
    map.fire('click', { latlng: L.latLng(-41.2, -72.3), originalEvent: { target: 'texto' } });
    expect(onPick.mock.calls).toEqual([[{ latitude: -41.1, longitude: -72.2 }], [{ latitude: -41.2, longitude: -72.3 }]]);
    window.dispatchEvent(new Event('resize'));
    observers[0]();
    await act(() => new Promise<void>((r) => setTimeout(r, 250)));
    expect(L.Map.prototype.invalidateSize).toHaveBeenCalledWith({ animate: false, pan: false });
  });

  it('varios profesionales: encuadre, selección con radar, popup y ubicación del cliente', async () => {
    const onPick = vi.fn();
    const a = w('a', { rating: 4.25 });
    const b = w('b', { latitude: -41.5, longitude: -72.9, isElite: true, serviceRadiusKm: null });
    const props = { workers: [a, b], onSelectWorker: vi.fn(), onPickClientLocation: onPick };
    const view = render(<PremiumSearchMap {...props} selectedWorkerId={null} />);
    expect(screen.getByText('2 en el mapa')).toBeTruthy();
    expect(L.Map.prototype.fitBounds).toHaveBeenCalledTimes(1);
    const map = maps[0];
    expect((markers(map)[0].getPopup()!.getContent() as HTMLElement).textContent).toContain('★ 4.3');

    view.rerender(<PremiumSearchMap {...props} selectedWorkerId="b" />);
    let circles = 0;
    map.eachLayer((layer) => { if (layer instanceof L.Circle) circles += 1; });
    expect(circles).toBe(1);
    expect(document.querySelector<HTMLButtonElement>('.premium-search-map-card')!.textContent).toMatch(/km sin extra/);
    expect(map.hasLayer(markers(map).find((m) => m.getPopup()?.isOpen())!)).toBe(true);

    const pan = vi.spyOn(L.Map.prototype, 'panTo');
    view.rerender(<PremiumSearchMap {...props} selectedWorkerId="b" clientLocation={{ latitude: 10, longitude: 20 }} />);
    expect(pan).toHaveBeenCalled();
    const client = markers(map).find((m) => m.options.draggable)!;
    expect(client.getElement()?.getAttribute('aria-label')).toBe('Ubicación de tu trabajo (se puede arrastrar)');
    client.setLatLng([11, 21]);
    client.fire('dragend');
    expect(onPick).toHaveBeenCalledWith({ latitude: 11, longitude: 21 });

    pan.mockClear();
    vi.spyOn(L.Map.prototype, 'getBounds').mockReturnValue(L.latLngBounds([0, 0], [50, 50]));
    view.rerender(<PremiumSearchMap {...props} selectedWorkerId={null} clientLocation={{ latitude: 12, longitude: 22 }} />);
    expect(pan).not.toHaveBeenCalled();

    view.rerender(<PremiumSearchMap workers={[a, b]} onSelectWorker={vi.fn()} selectedWorkerId="a" clientLocation={null} />);
    expect(markers(map).some((m) => m.options.draggable)).toBe(false);
    view.rerender(<PremiumSearchMap workers={[a]} onSelectWorker={vi.fn()} selectedWorkerId="a" />);
    client.fire('dragend');
  });

  it('en pantalla táctil no abre el globo; seleccionado sin ubicación usa el temporizador', async () => {
    base.coarse = true;
    const a = w('a');
    const lost = w('z', { latitude: undefined });
    const view = render(<PremiumSearchMap workers={[a, lost]} selectedWorkerId="a" onSelectWorker={vi.fn()} />);
    const map = maps[0];
    expect(markers(map)[0].getPopup()!.isOpen()).toBe(false);
    view.rerender(<PremiumSearchMap workers={[a, lost]} selectedWorkerId="z" onSelectWorker={vi.fn()} />);
    expect(document.querySelector<HTMLButtonElement>('.premium-search-map-card')!.textContent).toMatch(/km sin extra/);
    await act(() => new Promise<void>((r) => setTimeout(r, 80)));
    view.unmount();
  });

  it('desmontar antes de pedir baldosas y limpiar aunque Leaflet falle', async () => {
    const view = render(<PremiumSearchMap workers={[w('a')]} selectedWorkerId={null} onSelectWorker={vi.fn()} />);
    vi.spyOn(L.Map.prototype, 'remove').mockImplementationOnce(() => { throw new Error('ya removido'); });
    view.unmount();
    await flush();
    expect(base.added).toHaveLength(0);
  });

  it('en modo estricto reutiliza el contenedor ya marcado por Leaflet', async () => {
    const remove = vi.spyOn(L.Map.prototype, 'remove');
    remove.mockImplementationOnce(function (this: L.Map) { return this; });
    remove.mockImplementationOnce(function (this: L.Map) { delete (this.getContainer() as HTMLElement & { _leaflet_id?: number })._leaflet_id; throw new Error('x'); });
    const view = render(<StrictMode><PremiumSearchMap workers={[w('a')]} selectedWorkerId={null} onSelectWorker={vi.fn()} /></StrictMode>);
    expect(maps.length).toBeGreaterThanOrEqual(2);
    view.unmount();
    await flush();
  });
});
