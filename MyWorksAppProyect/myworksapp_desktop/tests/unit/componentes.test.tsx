import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar, perfil } from './harness';

/** Cola de reseñas, tabla paginada y diálogo del kit con un backend simulado. */
const h = vi.hoisted(() => ({
  filas: [] as unknown[],
  falla: false,
  moderar: [] as Array<{ data: unknown; error: unknown }>,
  args: [] as unknown[],
}));
vi.mock('../../src/supabaseClient', () => ({
  supabase: {
    rpc: (n: string, a: unknown) => {
      h.args.push([n, a]);
      if (n === 'consola_moderar_resena') return Promise.resolve(h.moderar.shift() ?? { data: null, error: null });
      return Promise.resolve(h.falla ? { data: null, error: { message: 'x' } } : { data: h.filas, error: null });
    },
  },
  supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true },
}));

import { ColaResenasDudosas } from '../../src/features/colaResenas';
import { PagedTable } from '../../src/features/table';
import { Dialog, IconButton } from '../../src/ui/kit';

const fila = (id: string, extra: Record<string, unknown> = {}) => ({
  id_calificacion: id,
  tipo_senal: 'texto_repetido',
  comentario: 'Excelente',
  estado_revision: 'pendiente',
  puntaje_resena: 5,
  nombre_trabajador: 'Pro',
  nombre_cliente: 'Cli',
  detalle: 'mismo texto en 3 reseñas',
  creado_en: '2026-11-27T03:00:00Z',
  ...extra,
});
const confirmar = async () => {
  const d = await screen.findByRole('dialog');
  fireEvent.change(within(d).getByRole('textbox'), { target: { value: 'motivo suficiente de prueba' } });
  await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Confirmar' })); });
};

beforeEach(() => {
  h.filas = [];
  h.falla = false;
  h.moderar = [];
  h.args = [];
});

describe('cola de reseñas dudosas', () => {
  it('no se muestra a roles sin moderación', () => {
    const { container } = montar(<ColaResenasDudosas />, auth({ profile: perfil('qa') }));
    expect(container.querySelector('section')).toBeNull();
  });

  it('vacía, con error y con reintento', async () => {
    montar(<ColaResenasDudosas />);
    expect(await screen.findByText('No hay reseñas marcadas.')).toBeTruthy();
    h.falla = true;
    montar(<ColaResenasDudosas />);
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });
    fireEvent.click(reintentar);
    expect(document.querySelector('.error-box')).toBeTruthy();
  });

  it('oculta una reseña, informa un error y cancela', async () => {
    h.filas = [fila('c1'), fila('c2', { comentario: ' ', detalle: null, puntaje_resena: null, estado_revision: 'excluida' })];
    montar(<ColaResenasDudosas />);
    expect(await screen.findByText('Sin comentario.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ocultar' }).length).toBe(1);
    h.moderar.push({ data: null, error: { message: 'permission denied' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    await confirmar();
    expect(await screen.findByText('No tienes permiso para esta acción.')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    await confirmar();
    expect(await screen.findByText('Reseña actualizada.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.args.some(([n]) => n === 'consola_moderar_resena')).toBe(true);
  });
});

describe('tabla paginada', () => {
  const columnas = [
    { key: 'n', header: 'Nombre', cell: (r: { id: string; n: string }) => r.n, csv: (r: { id: string; n: string }) => r.n },
    { key: 'x', header: 'Sin CSV', cell: () => '-' },
  ];

  it('filas con teclado, páginas, exportación y error al exportar', async () => {
    const filas = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, n: `Fila ${i}` }));
    const load = vi.fn(async (page: number) => ({ rows: filas.slice(page * 25, page * 25 + 25), total: filas.length }));
    const onRow = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    montar(<PagedTable queryKey={['prueba']} load={load} columns={columnas} empty="Nada" onRow={onRow} />);
    const primera = await screen.findByText('Fila 0');
    const tr = primera.closest('tr')!;
    fireEvent.keyDown(tr, { key: 'Enter' });
    fireEvent.keyDown(tr, { key: ' ' });
    fireEvent.keyDown(tr, { key: 'a' });
    expect(onRow).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Fila 29')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    load.mockRejectedValueOnce(new Error('red'));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('sin manejador de fila el teclado no hace nada y el error permite reintentar', async () => {
    const load = vi.fn(async () => ({ rows: [{ id: 'a', n: 'Única' }], total: 1 }));
    montar(<PagedTable queryKey={['sin-fila']} load={load} columns={columnas} empty="Nada" />);
    const celda = await screen.findByText('Única');
    fireEvent.keyDown(celda.closest('tr')!, { key: 'Enter' });
    fireEvent.click(celda);
    const falla = vi.fn(async () => { throw new Error('x'); });
    montar(<PagedTable queryKey={['falla']} load={falla} columns={columnas} empty="Nada" />);
    expect(await screen.findByText('No se pudo cargar esta lista.')).toBeTruthy();
  });

  it('modo captura local filtra las filas de muestra', async () => {
    window.history.pushState({}, '', '/pedidos?captura=local');
    const load = vi.fn();
    montar(<PagedTable queryKey={['pedidos']} load={load} columns={columnas} empty="Nada" />);
    await waitFor(() => expect(screen.getByText(/registros/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Buscar en la tabla'), { target: { value: 'zzzz-no-existe' } });
    expect(await screen.findByText('Nada', {}, { timeout: 2000 })).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
    window.history.pushState({}, '', '/');
  });
});

describe('kit', () => {
  it('botón con ícono y foco atrapado en el diálogo', () => {
    const cerrar = vi.fn();
    montar(
      <>
        <IconButton label="Cerrar panel">x</IconButton>
        <IconButton label="Enviar" type="submit">y</IconButton>
        <Dialog title="Diálogo" onClose={cerrar}>
          <button type="button">Primero</button>
          <button type="button">Último</button>
        </Dialog>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Enviar' }).getAttribute('type')).toBe('submit');
    const primero = screen.getByRole('button', { name: 'Primero' });
    const ultimo = screen.getByRole('button', { name: 'Último' });
    expect(document.activeElement).toBe(primero);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(primero);
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrar).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(cerrar).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.querySelector('.dialog-backdrop')!);
    expect(cerrar).toHaveBeenCalledTimes(2);
  });
});
