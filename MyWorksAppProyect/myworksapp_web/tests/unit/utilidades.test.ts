import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileLabel } from '../../src/profileLabel';
import { chileE164 } from '../../src/chilePhone';
import { APP_COMMIT, PUBLIC_SITE_URL } from '../../src/site';
import { OPEN_SURVEY_EVENT, openTestingSurvey, surveyRequestedByUrl } from '../../src/components/testingSurveyEvents';
import { finiteMapSite, resolveCategory } from '../../src/data/resolveServiceQuery';
import { ALL_SERVICE_CATEGORIES, FEATURED_CATEGORIES } from '../../src/data/serviceCategories';
import { queryClient, queryKeys } from '../../src/queryClient';

describe('nombre visible del profesional', () => {
  it('deja nombre e inicial del apellido', () => {
    expect(profileLabel('  Ana  María Pérez ')).toBe('Ana P.');
    expect(profileLabel('Ana')).toBe('Ana');
    expect(profileLabel('   ')).toBe('');
  });
});

describe('teléfono chileno', () => {
  it('normaliza a +56 y 9 dígitos', () => {
    expect(chileE164('9 1234 5678')).toBe('+56912345678');
    expect(chileE164('56912345678')).toBe('+56912345678');
    expect(chileE164('+56 (9) 1234-5678')).toBe('+56912345678');
  });
  it('rechaza lo que no es un móvil chileno', () => {
    expect(chileE164('12345')).toBeNull();
    expect(chileE164('+54911112222')).toBeNull();
  });
});

describe('sitio', () => {
  it('usa el dominio canónico sin barra final y la versión del build', () => {
    expect(PUBLIC_SITE_URL).toMatch(/^https:\/\/[^/]+.*[^/]$/);
    expect(APP_COMMIT.length).toBeGreaterThan(0);
  });
});

describe('encuesta de testing', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));
  it('emite el evento que abre la encuesta', () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SURVEY_EVENT, listener);
    openTestingSurvey();
    window.removeEventListener(OPEN_SURVEY_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('se abre sola con /encuesta o ?encuesta', () => {
    expect(surveyRequestedByUrl()).toBe(false);
    window.history.replaceState(null, '', '/encuesta/');
    expect(surveyRequestedByUrl()).toBe(true);
    window.history.replaceState(null, '', '/servicios?encuesta');
    expect(surveyRequestedByUrl()).toBe(true);
  });
});

describe('texto libre → categoría', () => {
  const casos: Array<[string, string, 'Media' | 'Alta']> = [
    ['Tengo una FUGA en el baño', 'plomeria', 'Media'],
    ['revisar el gas del calefont', 'gasfiteria', 'Media'],
    ['armar un closet', 'ensamblaje', 'Media'],
    ['aseo profundo', 'limpieza', 'Media'],
    ['pintor para la pieza', 'pintura', 'Media'],
    ['poda de árboles', 'jardineria', 'Media'],
    ['cambiar la chapa', 'cerrajeria', 'Alta'],
    ['remodelar cocina', 'construccion', 'Media'],
    ['mi pc no prende', 'soporte_tecnico', 'Media'],
    ['traslado de cosas', 'mudanza', 'Media'],
    ['aire acondicionado', 'climatizacion', 'Media'],
    ['Eléctrico urgente', 'electricidad', 'Media'],
  ];
  it.each(casos)('«%s» → %s', (texto, categoria, urgencia) => {
    const result = resolveCategory(texto);
    expect(result?.category).toBe(categoria);
    expect(result?.urgency).toBe(urgencia);
    expect(result!.minPrice).toBeLessThan(result!.maxPrice);
  });
  it('devuelve null si no reconoce el oficio', () => {
    expect(resolveCategory('astronauta')).toBeNull();
  });
  it('solo acepta coordenadas finitas', () => {
    expect(finiteMapSite(-41.4, -72.9)).toEqual({ latitude: -41.4, longitude: -72.9 });
    expect(finiteMapSite(Number.NaN, 1)).toBeNull();
    expect(finiteMapSite(null, undefined)).toBeNull();
  });
});

describe('catálogo de oficios', () => {
  it('tiene ids únicos y destaca los cuatro primeros', () => {
    const ids = ALL_SERVICE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FEATURED_CATEGORIES).toEqual(ALL_SERVICE_CATEGORIES.slice(0, 4));
    for (const c of ALL_SERVICE_CATEGORIES) expect(c.photo).toMatch(/^\/categories\//);
  });
});

describe('caché de consultas', () => {
  it('no reintenta errores 4xx y reintenta una vez los demás', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, { status: 404 })).toBe(false);
    expect(retry(0, { status: 500 })).toBe(true);
    expect(retry(1, new Error('red'))).toBe(false);
    expect(retry(0, null)).toBe(true);
  });
  it('arma claves estables con y sin ubicación', () => {
    expect(queryKeys.activeServices).toEqual(['catalog', 'services']);
    expect(queryKeys.serviceByCategory('pintura')).toEqual(['catalog', 'services', 'byCategory', 'pintura']);
    expect(queryKeys.workersByCategory('pintura', { latitude: -41.47123, longitude: -72.94 })).toEqual([
      'catalog', 'workers', 'pintura', '-41.471,-72.940',
    ]);
    expect(queryKeys.workersByCategory('pintura')[3]).toBe('sin-ubicacion');
  });
});
