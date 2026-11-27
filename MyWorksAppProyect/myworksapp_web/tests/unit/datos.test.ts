import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  getSessionFails: false,
}));

vi.mock('../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (db.getSessionFails) throw new Error('sin red');
        return { data: { session: db.session } };
      },
    },
    from: (table: string) => ({
      insert: (row: unknown) => db.insert(table, row),
      select: () => ({ eq: () => ({ maybeSingle: () => db.maybeSingle(table) }) }),
    }),
    rpc: (fn: string, args: unknown) => db.rpc(fn, args),
  },
}));

import { registrarEventoUso } from '../../src/analytics/registrarEvento';
import { leerProfesionalesParecidos, leerResumenResenas } from '../../src/data/fichaPublica';
import { sortSearchWorkers } from '../../src/catalogSort';
import type { SearchWorker } from '../../src/components/SearchResultsView';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  db.session = null;
  db.getSessionFails = false;
  db.insert.mockReset().mockResolvedValue({ error: null });
  db.maybeSingle.mockReset();
  db.rpc.mockReset();
});

describe('analítica de uso', () => {
  it('guarda el evento con el usuario de la sesión', async () => {
    db.session = { user: { id: 'u-1' } };
    registrarEventoUso('vio_ficha_profesional', { id: 'p-1' });
    await flush();
    expect(db.insert).toHaveBeenCalledTimes(1);
    const [table, row] = db.insert.mock.calls[0];
    expect(table).toBe('eventos_analitica');
    expect(row).toMatchObject({ nombre_evento: 'vio_ficha_profesional', id_usuario: 'u-1', metadatos: '{"id":"p-1"}' });
  });
  it('sin sesión guarda el evento anónimo y sin metadatos', async () => {
    registrarEventoUso('confirmo_pedido');
    await flush();
    expect(db.insert.mock.calls[0][1]).toMatchObject({ id_usuario: null, metadatos: '{}' });
  });
  it('un fallo de red no rompe la página', async () => {
    db.getSessionFails = true;
    expect(() => registrarEventoUso('eligio_hora_reserva')).not.toThrow();
    await flush();
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('ficha pública', () => {
  it('lee el resumen de reseñas', async () => {
    db.maybeSingle.mockResolvedValue({ data: { resumen: '  Muy puntual. ' }, error: null });
    await expect(leerResumenResenas('p-1')).resolves.toBe('Muy puntual.');
  });
  it('devuelve null si la consulta falla o lanza', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    await expect(leerResumenResenas('p-1')).resolves.toBeNull();
    db.maybeSingle.mockRejectedValueOnce(new Error('red'));
    await expect(leerResumenResenas('p-1')).resolves.toBeNull();
  });
  it('lista hasta cuatro profesionales parecidos', async () => {
    db.rpc.mockResolvedValue({
      data: [{ id_usuario: 'a', nombre: 'Ana', profesion: 'Pintora', calificacion: '4.5' }],
      error: null,
    });
    await expect(leerProfesionalesParecidos('p-1')).resolves.toEqual([
      { id: 'a', nombre: 'Ana', profesion: 'Pintora', calificacion: 4.5 },
    ]);
    expect(db.rpc).toHaveBeenCalledWith('profesionales_parecidos', { p_id: 'p-1', p_limite: 4 });
  });
  it('devuelve lista vacía si la RPC falla o lanza', async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    await expect(leerProfesionalesParecidos('p-1')).resolves.toEqual([]);
    db.rpc.mockRejectedValueOnce(new Error('red'));
    await expect(leerProfesionalesParecidos('p-1')).resolves.toEqual([]);
  });
});

describe('orden del catálogo', () => {
  const w = (id: string, rating: number, price: number, lat?: number): SearchWorker => ({
    id, name: id, profession: 'x', category: 'x', rating, jobsDone: 1, photoUrl: '', pricePerVisit: price,
    latitude: lat ?? null, longitude: lat == null ? null : -72.9,
  });
  const lista = [w('caro', 5, 50000, -41.5), w('barato', 3, 10000, -40), w('medio', 4, 30000)];
  it('por precio y por nota', () => {
    expect(sortSearchWorkers(lista, 'price', null).map((x) => x.id)).toEqual(['barato', 'medio', 'caro']);
    expect(sortSearchWorkers(lista, 'rating', null).map((x) => x.id)).toEqual(['caro', 'medio', 'barato']);
  });
  it('recomendado usa el orden único (cercanía primero) sin mutar la lista', () => {
    const copia = [...lista];
    const orden = sortSearchWorkers(lista, 'recommended', { latitude: -41.47, longitude: -72.94 });
    expect(orden[0].id).toBe('caro');
    expect(lista).toEqual(copia);
  });
});
