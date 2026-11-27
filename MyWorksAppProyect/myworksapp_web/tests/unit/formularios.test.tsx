import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/supabaseClient', () => ({ supabase: {} }));
const ctl = vi.hoisted(() => ({ canRender: false, submitSurvey: vi.fn() }));
vi.mock('../../src/components/turnstileSite', () => ({
  turnstileCanRender: () => ctl.canRender,
  TURNSTILE_SITE_KEY: '',
}));
vi.mock('../../src/components/TurnstileWidget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('captcha-ok')}>captcha</button>
  ),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  submitTestingSurvey: ctl.submitSurvey,
}));

import { GuestCheckoutForm } from '../../src/components/GuestCheckoutForm';
import { TestingSurveyModal } from '../../src/components/TestingSurveyModal';
import { openTestingSurvey } from '../../src/components/testingSurveyEvents';
import { AuthContext, type AuthContextValue } from '../../src/context/authContextValue';

beforeEach(() => {
  ctl.canRender = false;
  ctl.submitSurvey.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

function guest(props: Partial<Parameters<typeof GuestCheckoutForm>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onSubmit: vi.fn(async () => {}), onPreferLogin: vi.fn(), onPreviewAddress: vi.fn(async () => null) };
  render(<GuestCheckoutForm workerName="Pedro" profession="Electricista" payableTotalClp={32000} {...handlers} {...props} />);
  return handlers;
}
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const fill = (name: string, email: string, phone: string, address: string) => {
  fireEvent.change(field(/Nombre completo/), { target: { value: name } });
  fireEvent.change(field(/Correo/), { target: { value: email } });
  fireEvent.change(field(/Teléfono/), { target: { value: phone } });
  fireEvent.change(field(/Dirección del trabajo/), { target: { value: address } });
};
const pay = () => fireEvent.submit(field(/Nombre completo/).closest('form')!);

describe('pedido sin sesión', () => {
  it('muestra el total del servidor y valida cada dato', async () => {
    const h = guest();
    expect(screen.getByText('32.000 CLP')).toBeTruthy();
    expect(screen.getByText(/Traslado incluido en el total/)).toBeTruthy();
    pay();
    expect(screen.getByRole('alert').textContent).toContain('Completa tus datos');
    fill('Ana', 'ana@gmail.com', '123', 'Av. Siempre Viva 742, Puerto Montt');
    pay();
    expect(screen.getByRole('alert').textContent).toContain('+56 y 9 dígitos');
    fill('Ana', 'ana@example.com', '912345678', 'Av. Siempre Viva 742, Puerto Montt');
    pay();
    expect(screen.getByRole('alert').textContent).toContain('correo es de ejemplo');
    fill(' Ana ', 'ana@gmail.com', '912345678', ' Av. Siempre Viva 742 ');
    pay();
    await waitFor(() => expect(h.onSubmit).toHaveBeenCalledWith({ name: 'Ana', email: 'ana@gmail.com', phone: '+56912345678', address: 'Av. Siempre Viva 742', turnstileToken: undefined }));
    expect(screen.getByRole('button', { name: /Creando pedido/ })).toBeTruthy();
  });

  it('pide captcha si corresponde y muestra el error del pedido', async () => {
    ctl.canRender = true;
    const h = guest({ quoteError: 'Fuera de cobertura' });
    expect(screen.getAllByRole('alert')[0].textContent).toBe('Fuera de cobertura');
    fill('Ana', 'ana@gmail.com', '912345678', 'Calle 1, Osorno');
    pay();
    expect(screen.getByText('Confirma que no eres un robot')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'captcha' }));
    h.onSubmit.mockRejectedValueOnce(new Error('Webpay no responde')).mockRejectedValueOnce('raro');
    pay();
    expect(await screen.findByText('Webpay no responde')).toBeTruthy();
    pay();
    expect(await screen.findByText('No se pudo iniciar el pedido.')).toBeTruthy();
    expect(h.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ turnstileToken: 'captcha-ok' }));
  });

  it('sin total no deja pagar; busca la dirección tras escribir; cierra o pide login', async () => {
    vi.useFakeTimers();
    const h = guest({ payableTotalClp: null, locatingAddress: true });
    expect(screen.getByText(/Calculando tarifa y traslado… · buscando dirección…/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Calculando el total…' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field(/Dirección del trabajo/), { target: { value: 'ab' } });
    act(() => { vi.advanceTimersByTime(800); });
    expect(h.onPreviewAddress).not.toHaveBeenCalled();
    fireEvent.change(field(/Dirección del trabajo/), { target: { value: 'Calle 1' } });
    act(() => { vi.advanceTimersByTime(800); });
    expect(h.onPreviewAddress).toHaveBeenCalledWith('Calle 1');
    fireEvent.click(screen.getByRole('button', { name: /Ya tienes cuenta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(h.onPreferLogin).toHaveBeenCalled();
    expect(h.onClose).toHaveBeenCalled();
  });

  it('total cero cuenta como sin total', () => {
    guest({ payableTotalClp: 0 });
    expect(screen.getByText('Calculando tarifa y traslado…')).toBeTruthy();
  });
});

function survey(role?: string) {
  const value = { profile: role ? { role } : null } as unknown as AuthContextValue;
  return render(
    <AuthContext.Provider value={value}>
      <TestingSurveyModal />
    </AuthContext.Provider>,
  );
}

describe('encuesta de testing', () => {
  it('se abre con el evento, valida, envía y muestra el puntaje SUS', async () => {
    survey();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => openTestingSurvey());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Cliente') as HTMLInputElement).checked).toBe(true);
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('10 afirmaciones');
    for (let i = 0; i < 10; i++) {
      const group = screen.getByRole('radiogroup', { name: `Afirmación ${i + 1}` });
      fireEvent.click(group.querySelectorAll('input')[i % 2 === 0 ? 4 : 0]);
    }
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('satisfacción');
    fireEvent.click(screen.getByRole('radiogroup', { name: 'Satisfacción general' }).querySelectorAll('input')[4]);
    fireEvent.click(screen.getByLabelText('Administrador'));
    fireEvent.click(screen.getByLabelText('App Android'));
    fireEvent.click(screen.getByLabelText('En parte'));
    fireEvent.change(screen.getByLabelText('6. ¿Qué te resultó más claro o útil?'), { target: { value: 'El mapa' } });
    fireEvent.change(screen.getByLabelText('7. ¿Qué mejorarías?'), { target: { value: 'Nada' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect((await screen.findByRole('status')).textContent).toContain('100.0 de 100');
    expect(ctl.submitSurvey).toHaveBeenCalledWith({}, expect.objectContaining({ role: 'administrador', platform: 'app', taskCompleted: 'parcial', satisfaction: 5, worked: 'El mapa', improve: 'Nada', appVersion: 'web' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a MyWorksApp' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('desde /encuesta se abre sola, propone «Profesional» al trabajador y al cerrar limpia la URL', async () => {
    window.history.replaceState(null, '', '/encuesta');
    survey('trabajador');
    expect((screen.getByLabelText('Profesional') as HTMLInputElement).checked).toBe(true);
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('radiogroup', { name: `Afirmación ${i + 1}` }).querySelectorAll('input')[2]);
    }
    fireEvent.click(screen.getByRole('radiogroup', { name: 'Satisfacción general' }).querySelectorAll('input')[2]);
    ctl.submitSurvey.mockRejectedValueOnce(new Error('Ya respondiste')).mockRejectedValueOnce('raro');
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect(await screen.findByText('Ya respondiste')).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect(await screen.findByText('No pudimos guardar la encuesta.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar encuesta' }));
    expect(window.location.pathname).toBe('/');
  });

  it('comentarios demasiado largos no pasan la validación', () => {
    window.history.replaceState(null, '', '/?encuesta');
    survey();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('radiogroup', { name: `Afirmación ${i + 1}` }).querySelectorAll('input')[2]);
    }
    fireEvent.click(screen.getByRole('radiogroup', { name: 'Satisfacción general' }).querySelectorAll('input')[2]);
    fireEvent.change(screen.getByLabelText('6. ¿Qué te resultó más claro o útil?'), { target: { value: 'x'.repeat(2001) } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar encuesta' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain('caracteres');
  });
});
