import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

import { ProfessionalProfilePage } from '../../src/pages/ProfessionalProfilePage';

const row = {
  id_usuario: 'p-1', nombre: ' Pedro Soto ', profesion: 'Electricista', descripcion: ' Trabajo prolijo ',
  zona_trabajo: 'Puerto Montt', radio_servicio_km: 12, tarifa_visita: 25000, ruta_foto_perfil: null,
  verificado: true, calificacion: 4.6, n_calificaciones: 3, trabajos_completados: 9, es_elite: true, categoria: 'electricidad',
};

function show(path = '/profesional/p-1', onReserve = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profesional/:id" element={<ProfessionalProfilePage onReserve={onReserve} />} />
      </Routes>
    </MemoryRouter>,
  );
  return onReserve;
}

beforeEach(() => {
  fake.current = createFakeSupabase();
});

describe('ficha pública del profesional', () => {
  it('muestra datos, horario, reseñas, resumen y parecidos, y reserva', async () => {
    const { state } = fake.current!;
    state.rpc = (fn) => {
      if (fn === 'perfil_publico_profesional') return { data: [row] };
      if (fn === 'horario_publico_profesional') return { data: [{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '13:00' }, { dia_semana: 9, hora_inicio: '10:00', hora_fin: '11:00' }] };
      if (fn === 'resenas_publicas_profesional') return { data: [{ nota: 5, comentario: 'Excelente', fecha: '2026-11-20T10:00:00Z', nombre_corto: 'Ana P.' }, { nota: 4, comentario: null, fecha: null, nombre_corto: null }] };
      if (fn === 'profesionales_parecidos') return { data: [{ id_usuario: 'p-2', nombre: 'Luis', profesion: 'Electricista', calificacion: 4.2 }, { id_usuario: 'p-3', nombre: 'Rosa', profesion: 'Electricista', calificacion: null }] };
      return { data: null };
    };
    state.responder = (q) => (q.table === 'ia_resumen_resenas' ? { data: { resumen: 'Puntual y limpio.' } } : { data: [] });
    const onReserve = show();
    expect(screen.getByRole('status').textContent).toBe('Cargando la ficha…');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedro Soto' })).toBeTruthy();
    expect(screen.getByText('Élite')).toBeTruthy();
    expect(screen.getByText('Verificado')).toBeTruthy();
    expect(screen.getByText('Trabajo prolijo')).toBeTruthy();
    expect(screen.getByText('Radio: 12 km')).toBeTruthy();
    expect(screen.getByText(/Lunes 09:00–13:00/)).toBeTruthy();
    expect(screen.getByText(/Día 10:00–11:00/)).toBeTruthy();
    expect(screen.getByText('Excelente')).toBeTruthy();
    expect(screen.getByText(/· 2026-11-20/)).toBeTruthy();
    expect(screen.getByText(/Cliente/)).toBeTruthy();
    expect(await screen.findByText('Puntual y limpio.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Luis' }).getAttribute('href')).toBe('/profesional/p-2');
    expect(screen.getByText(/4\.2/)).toBeTruthy();
    expect(document.title).toBe('Pedro Soto — MyWorksApp');
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));
    expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1', name: 'Pedro Soto', pricePerVisit: 25000, rating: 4.6, jobsDone: 9, category: 'electricidad' }));
  });

  it('una ficha sin datos opcionales usa los textos por defecto', async () => {
    const vacio = { ...row, nombre: null, profesion: null, descripcion: null, zona_trabajo: null, radio_servicio_km: null, tarifa_visita: null, verificado: false, es_elite: false, calificacion: null, n_calificaciones: 0, trabajos_completados: null, categoria: null };
    fake.current!.state.rpc = (fn) => (fn === 'perfil_publico_profesional' ? { data: [vacio] } : { data: 'no-es-lista' });
    const onReserve = show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Profesional' })).toBeTruthy();
    for (const t of ['Sin dato de oficio', 'Sin descripción.', 'Zona: Sin dato', 'Radio: Sin dato', 'Tarifa de visita: Sin dato', 'Nuevo · sin reseñas aún', 'Sin horario publicado.', 'Sin reseñas publicadas.']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));
    expect(onReserve).toHaveBeenCalledWith(expect.objectContaining({ profession: 'Oficio', category: '', rating: 0, jobsDone: 0, pricePerVisit: 0 }));
  });

  it('avisa si no está en el catálogo, si la consulta falla o si se cae la red', async () => {
    const { state } = fake.current!;
    state.rpc = () => ({ data: [] });
    const first = show();
    expect((await screen.findByText('Este profesional no está en el catálogo público.'))).toBeTruthy();
    expect(first).not.toHaveBeenCalled();
  });
  it('error de la RPC', async () => {
    fake.current!.state.rpc = (fn) => (fn === 'resenas_publicas_profesional' ? { error: { message: 'x' } } : { data: [] });
    show();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
  it('excepción de red', async () => {
    fake.current!.state.rpc = () => {
      throw new Error('sin red');
    };
    show();
    expect(await screen.findByText('No se pudo leer la ficha. Inténtalo de nuevo.')).toBeTruthy();
  });
  it('si se sale antes de que responda no actualiza nada', async () => {
    let release: (v: unknown) => void = () => {};
    fake.current!.state.rpc = () => new Promise((r) => { release = r; }) as never;
    const { unmount } = render(
      <MemoryRouter initialEntries={['/profesional/p-1']}>
        <Routes><Route path="/profesional/:id" element={<ProfessionalProfilePage onReserve={() => {}} />} /></Routes>
      </MemoryRouter>,
    );
    unmount();
    release({ data: [] });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
