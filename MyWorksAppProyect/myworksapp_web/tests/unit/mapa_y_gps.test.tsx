import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

const gl = vi.hoisted(() => {
  class MaplibreGL {
    _update() {
      return 'actualizado';
    }
  }
  const added: unknown[] = [];
  return {
    MaplibreGL,
    added,
    workerUrls: [] as string[],
    maplibreGL: vi.fn((options: unknown) => ({ addTo: (map: unknown) => { added.push({ options, map }); return { options }; } })),
  };
});
vi.mock('maplibre-gl', () => ({ setWorkerUrl: (url: string) => gl.workerUrls.push(url) }));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/worker.js' }));
vi.mock('@maplibre/maplibre-gl-leaflet', () => ({ MaplibreGL: gl.MaplibreGL, maplibreGL: gl.maplibreGL }));

import L from 'leaflet';
import { addFastBasemap, fastMapOptions, isCoarseMap, OPENFREEMAP_STYLE } from '../../src/map/basemap';
import { JobLocationMap } from '../../src/components/JobLocationMap';
import { useLiveJobLocation } from '../../src/hooks/useLiveJobLocation';

type Proto = Record<string, (...args: unknown[]) => unknown>;

describe('capa base del mapa', () => {
  it('usa OpenFreeMap Positron sin interacción ni logo', () => {
    const map = {} as L.Map;
    addFastBasemap(map);
    expect(gl.workerUrls).toHaveLength(1);
    expect(gl.workerUrls[0]).toContain('worker');
    expect(gl.maplibreGL).toHaveBeenCalledWith(expect.objectContaining({ style: OPENFREEMAP_STYLE, interactive: false, maplibreLogo: false }));
    expect(gl.added.at(-1)).toMatchObject({ map });
  });

  it('en teléfono desactiva la animación de zoom', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(isCoarseMap()).toBe(true);
    expect(fastMapOptions()).toMatchObject({ zoomAnimation: false, zoomSnap: 1, inertia: false });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(fastMapOptions()).toMatchObject({ zoomAnimation: true, zoomSnap: 0.25, zoomDelta: 0.5 });
    vi.stubGlobal('matchMedia', undefined);
    expect(isCoarseMap()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('el plugin no trabaja sobre una capa ya desmontada', async () => {
    const proto = (gl.MaplibreGL as unknown as { prototype: Proto }).prototype;
    // El parche ya corrió al importar: cargarlo otra vez no lo duplica.
    expect(proto.__mwaGuarded).toBe(true);
    const dead = { _map: null, _glMap: null };
    expect(proto._update.call(dead)).toBeUndefined();
    expect(proto._update.call({ _map: {}, _glMap: {} })).toBe('actualizado');
    expect(proto._transitionEnd).toBeTypeOf('function');
    const raf = vi.spyOn(L.Util, 'requestAnimFrame').mockImplementation(((fn: () => void) => { fn(); return 0; }) as never);
    proto._transitionEnd.call(dead);
    const handlers: Record<string, () => void> = {};
    const glMap = { jumpTo: vi.fn(), once: (e: string, f: () => void) => { handlers[e] = f; }, _actualCanvas: document.createElement('canvas') };
    const live = {
      _map: {
        getZoom: () => 12,
        getCenter: () => ({ lat: 1, lng: 2 }),
        getBounds: () => ({ getNorthWest: () => ({ lat: 1, lng: 2 }) }),
        latLngToContainerPoint: () => L.point(0, 0),
      },
      _glMap: glMap,
      _resizeContainer: vi.fn(),
      _zoomEnd: vi.fn(),
    };
    proto._transitionEnd.call(live);
    expect(glMap.jumpTo).toHaveBeenCalledWith({ center: { lat: 1, lng: 2 }, zoom: 11 });
    handlers.moveend();
    expect(live._zoomEnd).toHaveBeenCalledTimes(1);
    live._map = null as never;
    handlers.moveend();
    expect(live._zoomEnd).toHaveBeenCalledTimes(1);
    raf.mockRestore();
  });
});

describe('mapa del domicilio', () => {
  it('pone el pin del domicilio y el del profesional, lo mueve y lo quita', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { fn(0); return 1; });
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds').mockImplementation(function (this: L.Map) { return this; });
    vi.spyOn(L.Map.prototype, 'invalidateSize').mockImplementation(function (this: L.Map) { return this; });
    const { container, rerender, unmount } = render(<JobLocationMap latitude={-41.47} longitude={-72.94} label="Casa" />);
    expect(container.querySelectorAll('.mwa-map-pin--active').length).toBe(1);
    rerender(<JobLocationMap latitude={-41.47} longitude={-72.94} label="Casa" worker={{ latitude: -41.46, longitude: -72.93, label: 'Pedro' }} />);
    expect(container.querySelectorAll('.mwa-map-pin--worker').length).toBe(1);
    rerender(<JobLocationMap latitude={-41.47} longitude={-72.94} label="Casa" worker={{ latitude: -41.465, longitude: -72.935, label: 'Pedro, llegando' }} />);
    expect(container.querySelectorAll('.mwa-map-pin--worker').length).toBe(1);
    expect(fit).toHaveBeenCalledTimes(2);
    rerender(<JobLocationMap latitude={-41.47} longitude={-72.94} label="Casa" worker={null} />);
    expect(container.querySelectorAll('.mwa-map-pin--worker').length).toBe(0);
    unmount();
  });
});

describe('GPS en vivo del pedido', () => {
  beforeEach(() => {
    fake.current = createFakeSupabase();
  });

  it('sin pedido no consulta', () => {
    const { result } = renderHook(() => useLiveJobLocation(null));
    expect(result.current.fix).toBeNull();
    expect(fake.current!.state.queries).toHaveLength(0);
  });

  it('lee la posición, calcula distancia y ETA, y sigue los cambios en vivo', async () => {
    let onChange: (p: unknown) => void = () => {};
    const ch: Record<string, unknown> = {};
    ch.on = (_e: string, _f: unknown, cb: (p: unknown) => void) => { onChange = cb; return ch; };
    ch.subscribe = () => ch;
    fake.current!.client.channel.mockReturnValue(ch as never);
    fake.current!.state.responder = () => ({ data: { latitud: -41.46, longitud: -72.93 } });
    const { result, unmount } = renderHook(() => useLiveJobLocation('j-1', -41.47, -72.94));
    await waitFor(() => expect(result.current.fix).not.toBeNull());
    expect(result.current.fix!.distanceKm).toBeGreaterThan(0);
    expect(result.current.fix!.etaMinutes).toBeGreaterThan(0);
    act(() => onChange({ eventType: 'UPDATE', new: { latitud: 'x', longitud: 1 } }));
    expect(result.current.fix).toBeNull();
    act(() => onChange({ eventType: 'INSERT', new: { latitud: -41.465, longitud: -72.935 } }));
    expect(result.current.fix?.latitude).toBe(-41.465);
    act(() => onChange({ eventType: 'DELETE' }));
    expect(result.current.fix).toBeNull();
    unmount();
    expect(fake.current!.client.removeChannel).toHaveBeenCalledWith(ch);
    act(() => onChange({ eventType: 'INSERT', new: { latitud: 1, longitud: 1 } }));
  });

  it('sin destino no calcula distancia; sin tabla avisa', async () => {
    fake.current!.state.responder = () => ({ data: { latitud: 1, longitud: 2 } });
    const first = renderHook(() => useLiveJobLocation('j-1'));
    await waitFor(() => expect(first.result.current.fix).toEqual({ latitude: 1, longitude: 2, distanceKm: null, etaMinutes: null }));
    first.unmount();
    fake.current!.state.responder = () => ({ data: null, error: { message: 'no existe' } });
    const second = renderHook(() => useLiveJobLocation('j-2'));
    await waitFor(() => expect(second.result.current.error).toContain('migración de GPS'));
    fake.current!.state.responder = () => ({ data: null });
    const third = renderHook(() => useLiveJobLocation('j-3'));
    await waitFor(() => expect(third.result.current.error).toBeNull());
    expect(third.result.current.fix).toBeNull();
  });
});
