import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickBookingBar, type BookingSlotOption } from '../../src/components/QuickBookingBar';

const slots: BookingSlotOption[] = [
  { iso: '2026-11-27T09:00', label: 'Vie 27 · 09:00' },
  { iso: '2026-11-27T10:00', label: 'Vie 27 · 10:00' },
  { iso: '2026-11-27T11:00', label: 'Vie 27 · 11:00' },
];

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { fn(0); return 1; });
});

function bar(props: Partial<Parameters<typeof QuickBookingBar>[0]> = {}) {
  const h = { onContinue: vi.fn(), onClose: vi.fn() };
  const view = render(<QuickBookingBar workerName="Pedro" profession="Electricista" pricePerHour={25000} slots={slots} radarHint="A 2 km" {...h} {...props} />);
  return { ...h, view };
}
const trigger = () => screen.getByRole('button', { name: 'Fecha y hora' });

describe('reserva rápida', () => {
  it('elige con el mouse y continúa con la hora elegida', () => {
    const h = bar();
    expect(trigger().textContent).toContain('09:00');
    expect(screen.getByText('A 2 km')).toBeTruthy();
    expect(screen.getByText('$25.000 / visita')).toBeTruthy();
    fireEvent.click(trigger());
    const option = screen.getByRole('option', { name: 'Vie 27 · 11:00' });
    fireEvent.mouseEnter(option);
    expect(option.className).toContain('is-active');
    fireEvent.click(option);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Continuar con la reserva/ }));
    expect(h.onContinue).toHaveBeenCalledWith('2026-11-27T11:00');
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('se maneja con el teclado', () => {
    const h = bar();
    fireEvent.keyDown(trigger(), { key: 'a' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Vie 27 · 11:00' }).className).toContain('is-active');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'Home' });
    expect(screen.getByRole('option', { name: 'Vie 27 · 09:00' }).className).toContain('is-active');
    fireEvent.keyDown(list, { key: 'End' });
    fireEvent.keyDown(list, { key: 'x' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(trigger().textContent).toContain('11:00');
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: ' ' });
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(h.onContinue).toHaveBeenCalledWith('2026-11-27T11:00');
  });

  it('se cierra con Escape global o al tocar fuera', () => {
    bar();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('listbox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger());
    act(() => {
      document.dispatchEvent(new Event('pointerdown'));
    });
  });

  it('desplaza la lista para mostrar la opción activa', () => {
    bar();
    fireEvent.click(trigger());
    const list = screen.getByRole('listbox') as HTMLUListElement;
    const options = screen.getAllByRole('option');
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 40 });
    options.forEach((o, i) => {
      Object.defineProperty(o, 'offsetTop', { configurable: true, value: i * 40 });
      Object.defineProperty(o, 'offsetHeight', { configurable: true, value: 40 });
    });
    fireEvent.keyDown(list, { key: 'End' });
    expect(list.scrollTop).toBe(80);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.scrollTop).toBe(0);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.scrollTop).toBe(40);
  });

  it('cargando o sin horarios no deja continuar; si cambian los horarios se cierra el menú', () => {
    const h = bar({ loadingSlots: true, radarHint: undefined });
    expect(trigger().textContent).toContain('09:00');
    expect(screen.getByText('Cargando horarios del profesional…')).toBeTruthy();
    expect((trigger() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    h.view.rerender(<QuickBookingBar workerName="P" profession="x" pricePerHour={1} slots={[]} loadingSlots onContinue={h.onContinue} onClose={h.onClose} />);
    expect(trigger().textContent).toContain('Cargando horarios…');
    h.view.rerender(<QuickBookingBar workerName="P" profession="x" pricePerHour={1} slots={[]} onContinue={h.onContinue} onClose={h.onClose} />);
    expect(trigger().textContent).toContain('Sin horarios disponibles');
    expect(screen.getByText('Este profesional aún no publica horarios de atención.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(h.onContinue).not.toHaveBeenCalled();
    h.view.rerender(<QuickBookingBar workerName="P" profession="x" pricePerHour={1} slots={slots} onContinue={h.onContinue} onClose={h.onClose} />);
    fireEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeTruthy();
    h.view.rerender(<QuickBookingBar workerName="P" profession="x" pricePerHour={1} slots={slots.slice(1)} onContinue={h.onContinue} onClose={h.onClose} />);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().textContent).toContain('10:00');
  });
});
