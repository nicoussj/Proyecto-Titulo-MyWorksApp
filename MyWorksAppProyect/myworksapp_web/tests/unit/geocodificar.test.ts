import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeChileAddress } from '../../src/geo/geocodeChile';

function respond(...bodies: Array<unknown | Error | number>) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    if (body instanceof Error) fetchMock.mockRejectedValueOnce(body);
    else if (typeof body === 'number') fetchMock.mockResolvedValueOnce({ ok: false, status: body });
    else fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('dirección en Chile → GPS', () => {
  it('ignora textos de menos de 3 letras', async () => {
    const f = respond();
    await expect(geocodeChileAddress(' ab ')).resolves.toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('prefiere el resultado de Photon que está en Chile', async () => {
    const f = respond({
      features: [
        { geometry: { coordinates: [-58, -34] }, properties: { name: 'Otro', country: 'Argentina' } },
        {
          geometry: { coordinates: [-72.94, -41.47] },
          properties: { name: 'Mall', street: 'Av. Ejemplo', housenumber: '12', city: 'Puerto Montt', state: 'Puerto Montt', countrycode: 'CL' },
        },
      ],
    });
    const site = await geocodeChileAddress('Mall Puerto Montt');
    expect(site).toEqual({ latitude: -41.47, longitude: -72.94, label: 'Mall, Av. Ejemplo 12, Puerto Montt' });
    expect(f.mock.calls[0][0]).toContain(encodeURIComponent('Mall Puerto Montt, Chile'));
  });

  it('no agrega «Chile» si ya viene y usa el texto si no hay etiqueta', async () => {
    const f = respond({ features: [{ geometry: { coordinates: [-70.6, -33.4] }, properties: {} }] });
    const site = await geocodeChileAddress('Providencia, Chile');
    expect(site?.label).toBe('Providencia, Chile');
    expect(f.mock.calls[0][0]).not.toContain(encodeURIComponent(', Chile, Chile'));
  });

  it('si Photon no sirve usa Nominatim', async () => {
    respond({ features: [{ geometry: { coordinates: [1] } }] }, [{ lat: '-33.45', lon: '-70.66', display_name: ' Santiago ' }]);
    await expect(geocodeChileAddress('Santiago centro')).resolves.toEqual({ latitude: -33.45, longitude: -70.66, label: 'Santiago' });
  });

  it('Nominatim sin nombre usa el texto buscado', async () => {
    respond(500, [{ lat: '-33.45', lon: '-70.66' }]);
    await expect(geocodeChileAddress('Santiago')).resolves.toMatchObject({ label: 'Santiago, Chile' });
  });

  it('devuelve null con coordenadas inválidas, sin resultados o sin red', async () => {
    respond({ features: [{ geometry: { coordinates: ['x', 'y'] } }] }, []);
    await expect(geocodeChileAddress('Lugar raro')).resolves.toBeNull();
    respond(new Error('sin red'), new Error('sin red'));
    await expect(geocodeChileAddress('Lugar raro')).resolves.toBeNull();
    respond(null, null);
    await expect(geocodeChileAddress('Lugar raro')).resolves.toBeNull();
  });
});
