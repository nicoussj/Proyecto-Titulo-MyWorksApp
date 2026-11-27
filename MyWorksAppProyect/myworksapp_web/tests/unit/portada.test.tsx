import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/AuthModal', () => ({
  AuthModal: ({ open, initialMode, initialEmail, onClose }: { open: boolean; initialMode: string; initialEmail: string; onClose: () => void }) =>
    open ? <div role="dialog" aria-label="acceso">{initialMode} {initialEmail}<button type="button" onClick={onClose}>cerrar acceso</button></div> : null,
}));

import { LandingHome } from '../../src/views/LandingHome';
import { OPEN_SURVEY_EVENT } from '../../src/components/testingSurveyEvents';
import { ALL_SERVICE_CATEGORIES } from '../../src/data/serviceCategories';

type Props = Parameters<typeof LandingHome>[0];

function landing(over: Partial<Props> = {}) {
  const h = {
    setActiveNav: vi.fn(), setShowAuth: vi.fn(), logout: vi.fn(), clearError: vi.fn(), goToCategories: vi.fn(), openCategory: vi.fn(),
    clearCheckoutNotice: vi.fn(), onShowOrders: vi.fn(), onOpenOrder: vi.fn(), onCloseOrders: vi.fn(),
  };
  const props: Props = { activeNav: 'servicios', profile: null, authError: null, showAuth: false, availableCategoryIds: null, ...h, ...over };
  const view = render(<LandingHome {...props} />);
  return { h, view };
}

describe('portada', () => {
  it('sin sesión: navegar, ingresar, registrarse, categorías y encuesta', () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SURVEY_EVENT, listener);
    const { h } = landing();
    fireEvent.click(screen.getAllByRole('link', { name: 'Servicios' })[0]);
    fireEvent.click(screen.getAllByRole('link', { name: 'Cómo funciona' })[0]);
    expect(h.setActiveNav.mock.calls).toEqual([['servicios'], ['como-funciona']]);
    for (const b of screen.getAllByRole('button', { name: 'Ingresar' })) fireEvent.click(b);
    fireEvent.click(screen.getByRole('button', { name: /Registrarse/ }));
    expect(h.setShowAuth).toHaveBeenCalledWith(true);
    for (const b of screen.getAllByRole('button', { name: /Encuesta|encuesta/ })) fireEvent.click(b);
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    window.removeEventListener(OPEN_SURVEY_EVENT, listener);
    const cards = screen.getAllByRole('button', { name: new RegExp(ALL_SERVICE_CATEGORIES[0].title) });
    fireEvent.click(cards[0]);
    expect(h.openCategory).toHaveBeenCalledWith(expect.objectContaining({ id: ALL_SERVICE_CATEGORIES[0].id }));
    for (const b of screen.getAllByRole('button', { name: /Ver todas|categorías|Explorar/i })) fireEvent.click(b);
    expect(h.goToCategories).toHaveBeenCalled();
  });

  it('abre el acceso en modo registro y lo cierra', () => {
    const { h, view } = landing();
    fireEvent.click(screen.getByRole('button', { name: /Registrarse/ }));
    view.rerender(<LandingHome activeNav="como-funciona" profile={null} authError={null} showAuth authInitialEmail="ana@gmail.com" availableCategoryIds={new Set(['pintura'])} {...h} />);
    return screen.findByRole('dialog', { name: 'acceso' }).then((d) => {
      expect(d.textContent).toContain('register ana@gmail.com');
      fireEvent.click(screen.getByText('cerrar acceso'));
      expect(h.setShowAuth).toHaveBeenCalledWith(false);
    });
  });

  it('con sesión: pedidos agrupados, abrir, cerrar, salir y avisos', () => {
    const { h } = landing({
      profile: { name: ' ana' },
      orders: [
        { id: 'j1', status: 'pendiente', address: 'Calle 1', description: 'Fuga' },
        { id: 'j2', status: 'completado', address: null, description: null },
      ],
      ordersError: 'Algunos pedidos no cargaron',
      checkoutNotice: 'Pedido confirmado',
      authError: 'Sesión vencida',
    });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain('Algunos pedidos no cargaron');
    fireEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }));
    const rows = document.querySelectorAll<HTMLButtonElement>('.orders-row');
    expect(rows).toHaveLength(2);
    rows.forEach((row) => fireEvent.click(row));
    expect(h.onOpenOrder.mock.calls).toEqual([['j1'], ['j2']]);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    for (const b of screen.getAllByRole('button', { name: 'Entendido' })) fireEvent.click(b);
    expect(h.onShowOrders).toHaveBeenCalled();
    expect(h.onCloseOrders).toHaveBeenCalled();
    expect(h.logout).toHaveBeenCalled();
    expect(h.clearCheckoutNotice).toHaveBeenCalled();
    expect(h.clearError).toHaveBeenCalled();
    expect(screen.getByText('Pedido confirmado')).toBeTruthy();
    expect(screen.getByText('Sesión vencida')).toBeTruthy();
  });

  it('sin pedidos y nombre vacío; callbacks opcionales ausentes', () => {
    render(<LandingHome activeNav="" profile={{ name: '  ' }} authError={null} showAuth={false} availableCategoryIds={new Set()} setActiveNav={vi.fn()} setShowAuth={vi.fn()} logout={vi.fn()} clearError={vi.fn()} goToCategories={vi.fn()} openCategory={vi.fn()} orders={[]} checkoutNotice="Listo" />);
    expect(screen.getByText('No tienes pedidos todavía.')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
  });
});
