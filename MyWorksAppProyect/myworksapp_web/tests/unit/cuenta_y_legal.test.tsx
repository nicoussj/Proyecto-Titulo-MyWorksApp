import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeQuery } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));

import { AccountPage } from '../../src/pages/AccountPage';
import { LegalPage } from '../../src/pages/LegalPage';
import { AuthContext, type AuthContextValue } from '../../src/context/authContextValue';
import { OPEN_SURVEY_EVENT } from '../../src/components/testingSurveyEvents';

const profile = { id: 'u-1', name: 'Ana Pérez', email: 'ana@example.test', role: 'cliente' };

function withAuth(ui: ReactNode, p: unknown = profile) {
  const value = { profile: p } as unknown as AuthContextValue;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}

const last = (table: string, op?: string): FakeQuery | undefined =>
  [...fake.current!.state.queries].reverse().find((q) => q.table === table && (!op || q.ops.some(([o]) => o === op)));

beforeEach(() => {
  fake.current = createFakeSupabase();
});

describe('mi cuenta', () => {
  it('sin sesión pide entrar', () => {
    withAuth(<AccountPage />, null);
    expect(screen.getByText('Entra para ver tu nombre, tus direcciones y tus datos.')).toBeTruthy();
  });

  it('carga direcciones, teléfono y tarjeta, y quita la tarjeta', async () => {
    const { state } = fake.current!;
    state.responder = (q) => {
      if (q.table === 'direcciones_cliente') return { data: [{ id: 'd1', etiqueta: 'Casa', direccion: 'Calle 1, Puerto Montt' }, { id: 'd2', etiqueta: '', direccion: 'Otra 2, Osorno' }] };
      if (q.table === 'perfiles') return { data: [{ telefono: '+56912345678' }] };
      return { data: [] };
    };
    state.invoke = (_fn, args) => {
      const action = (args as { body: { action: string } }).body.action;
      return action === 'status' ? { data: { enrolled: true, last4: '4242' } } : { data: {} };
    };
    withAuth(<AccountPage />);
    expect(await screen.findByText('Casa: Calle 1, Puerto Montt')).toBeTruthy();
    expect(screen.getByText('Otra 2, Osorno')).toBeTruthy();
    expect(await screen.findByText('Tarjeta •••• 4242')).toBeTruthy();
    expect((screen.getByPlaceholderText('+569…') as HTMLInputElement).value).toBe('+56912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar tarjeta' }));
    expect(await screen.findByText('No hay una tarjeta inscrita.')).toBeTruthy();
  });

  it('sin teléfono guardado ni tarjeta muestra los vacíos', async () => {
    fake.current!.state.invoke = () => ({ data: null, error: { message: 'caída' } });
    withAuth(<AccountPage />);
    expect(await screen.findByText('Todavía no guardas direcciones.')).toBeTruthy();
    expect(screen.getByText('No hay una tarjeta inscrita.')).toBeTruthy();
  });

  it('valida y guarda la ficha', async () => {
    const { state } = fake.current!;
    withAuth(<AccountPage />);
    fireEvent.change(screen.getByPlaceholderText('+569…'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('+56 y 9 dígitos');
    fireEvent.change(screen.getByPlaceholderText('+569…'), { target: { value: '9 1234 5678' } });
    fireEvent.change(screen.getByDisplayValue('Ana Pérez'), { target: { value: ' Ana Pérez ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('status')).textContent).toBe('Guardamos tu ficha.');
    expect(last('perfiles', 'update')!.ops[0]).toEqual(['update', [{ nombre: 'Ana Pérez', telefono: '+56912345678' }]]);
    state.responder = (q) => (q.ops.some(([o]) => o === 'update') ? { error: { message: 'x' } } : { data: [] });
    fireEvent.change(screen.getByPlaceholderText('+569…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo guardar la ficha.');
  });

  it('agrega direcciones y avisa errores', async () => {
    const { state } = fake.current!;
    withAuth(<AccountPage />);
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'corta' } });
    fireEvent.submit(screen.getByLabelText('Dirección').closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toBe('Escribe la calle y la ciudad.');
    let insertFails = true;
    state.responder = (q) => {
      if (q.ops.some(([o]) => o === 'insert')) return insertFails ? { error: { message: 'x' } } : {};
      if (q.table === 'direcciones_cliente') return insertFails ? { data: [] } : { data: [{ id: 'n', etiqueta: 'Pega', direccion: 'Av. Larga 123, Puerto Varas' }] };
      return { data: [] };
    };
    fireEvent.change(screen.getByLabelText('Etiqueta'), { target: { value: ' Pega ' } });
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Av. Larga 123, Puerto Varas' } });
    fireEvent.submit(screen.getByLabelText('Dirección').closest('form')!);
    expect(await screen.findByText('No se pudo guardar la dirección.')).toBeTruthy();
    insertFails = false;
    fireEvent.submit(screen.getByLabelText('Dirección').closest('form')!);
    expect(await screen.findByText('Pega: Av. Larga 123, Puerto Varas')).toBeTruthy();
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).value).toBe('');
  });

  it('cambia la contraseña según la política', async () => {
    const { client } = fake.current!;
    withAuth(<AccountPage />);
    const input = screen.getByLabelText('Nueva contraseña');
    fireEvent.change(input, { target: { value: 'corta' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('8 caracteres');
    fireEvent.change(input, { target: { value: 'segura123' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('Contraseña actualizada.')).toBeTruthy();
    client.auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'x' } } as never);
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('No se pudo cambiar la contraseña.')).toBeTruthy();
  });

  it('exporta los datos en JSON y pide la eliminación', async () => {
    const { state } = fake.current!;
    const createObjectURL = vi.fn(() => 'blob:datos');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    state.rpc = (fn) => (fn === 'exportar_mis_datos' ? { data: { perfil: { id: 'u-1' } } } : { error: { message: 'pedido abierto' } });
    withAuth(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar en JSON' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:datos');
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar eliminación' }));
    expect((await screen.findByRole('alert')).textContent).toContain('pedido abierto, ciérralo');
    state.rpc = () => ({ data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar en JSON' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo exportar');
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar eliminación' }));
    expect((await screen.findByRole('status')).textContent).toContain('marcada como eliminada');
  });

  it('una cuenta sin correo lo indica', () => {
    withAuth(<AccountPage />, { ...profile, email: '', name: undefined });
    expect(screen.getByText('Correo: Sin dato')).toBeTruthy();
  });
});

describe('páginas legales', () => {
  it.each([
    ['aviso', 'Aviso legal'],
    ['terminos', 'Términos y condiciones'],
    ['privacidad', 'Política de privacidad'],
  ] as const)('%s muestra su título', (kind, title) => {
    withAuth(<LegalPage kind={kind} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(document.title).toBe(`${title} — MyWorksApp`);
  });
  it('aviso y privacidad tienen el botón que abre la encuesta', () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SURVEY_EVENT, listener);
    for (const kind of ['aviso', 'privacidad'] as const) {
      const { unmount } = withAuth(<LegalPage kind={kind} />);
      for (const b of screen.queryAllByRole('button')) fireEvent.click(b);
      unmount();
    }
    window.removeEventListener(OPEN_SURVEY_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
