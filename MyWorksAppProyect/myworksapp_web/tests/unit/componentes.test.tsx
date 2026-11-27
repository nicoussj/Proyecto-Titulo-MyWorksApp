import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StarScore } from '../../src/components/StarScore';
import { BrandLogo } from '../../src/components/BrandLogo';
import { CategoryCard } from '../../src/components/CategoryCard';
import { SiteFooter } from '../../src/components/SiteFooter';
import { NotFoundPage } from '../../src/pages/NotFoundPage';
import { WorkWithUsPage } from '../../src/pages/WorkWithUsPage';
import { AcademicInlineNote } from '../../src/components/AcademicInlineNote';
import { AcademicNoticeBanner } from '../../src/components/AcademicNoticeBanner';
import { DarkSelect } from '../../src/components/DarkSelect';
import { usePageMeta } from '../../src/hooks/usePageMeta';
import { useDialogA11y } from '../../src/hooks/useDialogA11y';
import { useAuth } from '../../src/context/useAuth';
import { AuthContext, type AuthContextValue } from '../../src/context/authContextValue';
import { ACADEMIC_ACTION_NOTE, ACADEMIC_BANNER_TEXT, ACADEMIC_INDICATOR } from '../../src/legal/academicCopy';

const inRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  constructor(public cb: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('estrellas', () => {
  it('redondea y limita la nota entre 0 y 5', () => {
    const { rerender } = render(<StarScore rating={4.4} />);
    expect(screen.getByLabelText('4.4 de 5').textContent).toBe('★★★★★');
    rerender(<StarScore rating={9} />);
    expect(screen.getByLabelText('5.0 de 5')).toBeTruthy();
    rerender(<StarScore rating={Number.NaN} />);
    expect(screen.getByLabelText('0.0 de 5')).toBeTruthy();
  });
});

describe('logo', () => {
  it('como botón vuelve al inicio y muestra el lema', () => {
    const onClick = vi.fn();
    render(<BrandLogo onClick={onClick} tagline="Oficios" size={20} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText('Oficios')).toBeTruthy();
  });
  it('sin texto ni clic es solo la marca', () => {
    const { container } = render(<BrandLogo showText={false} />);
    expect(screen.queryByText('My Works App')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('width')).toBe('36');
  });
});

describe('tarjeta de categoría', () => {
  it('abre la categoría y si la foto falla muestra el respaldo', () => {
    const onClick = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <CategoryCard title="Pintura" subtitle="Interiores" photo="/x.webp" onClick={onClick} variant="grid" />,
    );
    expect(screen.getByText('EXPLORAR')).toBeTruthy();
    fireEvent.error(screen.getByAltText('Pintura - Interiores'));
    expect(container.querySelector('.category-media--fallback')).toBeTruthy();
    expect(err).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
  it('en la portada no dice EXPLORAR', () => {
    render(<CategoryCard title="Aseo" subtitle="Casa" photo="/a.webp" onClick={() => {}} />);
    expect(screen.queryByText('EXPLORAR')).toBeNull();
  });
});

describe('páginas simples y avisos', () => {
  it('el pie enlaza lo legal y muestra la versión', () => {
    inRouter(<SiteFooter />);
    expect(screen.getByText(ACADEMIC_BANNER_TEXT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Términos y condiciones' }).getAttribute('href')).toBe('/terminos');
    expect(screen.getByText(/^Versión /)).toBeTruthy();
  });
  it('404 marca noindex y Trabaja con nosotros fija su título', () => {
    const { unmount } = inRouter(<NotFoundPage />);
    expect(document.title).toBe('Página no encontrada — MyWorksApp');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    unmount();
    inRouter(<WorkWithUsPage />);
    expect(document.title).toBe('Trabaja con nosotros — MyWorksApp');
    expect(screen.getByRole('heading', { name: 'Trabaja con nosotros' })).toBeTruthy();
  });
  it('la nota académica avisa que no se cobra dinero real', () => {
    render(<AcademicInlineNote />);
    expect(screen.getByTestId('academic-demo-note').textContent).toBe(ACADEMIC_ACTION_NOTE);
  });
});

describe('banner académico', () => {
  it('se oculta, recuerda la elección y publica su alto', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { unmount } = render(<AcademicNoticeBanner />);
    expect(document.documentElement.style.getPropertyValue('--academic-banner-h')).toBe('0px');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar aviso' }));
    expect(screen.getByText(ACADEMIC_INDICATOR)).toBeTruthy();
    expect(localStorage.getItem('mwa-academic-notice')).toBe('closed');
    FakeResizeObserver.instances.at(-1)!.cb();
    unmount();
    expect(document.documentElement.style.getPropertyValue('--academic-banner-h')).toBe('');
    render(<AcademicNoticeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver aviso' }));
    expect(localStorage.getItem('mwa-academic-notice')).toBe('open');
  });
  it('sin localStorage el aviso sigue visible y no falla', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const broken = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    vi.stubGlobal('localStorage', broken);
    render(<AcademicNoticeBanner />);
    expect(screen.getByText(ACADEMIC_BANNER_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar aviso' }));
    expect(screen.getByText(ACADEMIC_INDICATOR)).toBeTruthy();
  });
});

describe('menú oscuro', () => {
  const options = [
    { value: 'recommended', label: 'Recomendados' },
    { value: 'price', label: 'Precio' },
  ];
  it('abre, elige y se cierra', () => {
    const onChange = vi.fn();
    render(<DarkSelect id="orden" label="Ordenar" value="recommended" options={options} onChange={onChange} block align="end" />);
    const trigger = screen.getByRole('button', { name: 'Ordenar' });
    expect(trigger.textContent).toContain('Recomendados');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox').className).toContain('align-end');
    fireEvent.pointerDown(screen.getByRole('listbox'));
    fireEvent.click(screen.getByRole('option', { name: 'Precio' }));
    expect(onChange).toHaveBeenCalledWith('price');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('se cierra con Escape o al tocar fuera y avisa si no hay selección', () => {
    render(<DarkSelect label="Ordenar" value="otro" options={options} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Ordenar' });
    expect(trigger.textContent).toContain('Elige una opción');
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('metadatos de la página', () => {
  it('restaura título, descripción y og al desmontar', () => {
    document.title = 'Antes';
    const og = document.createElement('meta');
    og.setAttribute('property', 'og:description');
    og.setAttribute('content', 'og previo');
    document.head.appendChild(og);
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    document.head.appendChild(robots);

    const { unmount } = renderHook(() => usePageMeta('Inicio MyWorksApp', 'Descripción nueva'));
    expect(document.title).toBe('Inicio MyWorksApp');
    expect(og.getAttribute('content')).toBe('Descripción nueva');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    unmount();
    expect(document.title).toBe('Antes');
    expect(og.getAttribute('content')).toBe('og previo');
    expect(document.querySelector('meta[name="description"]')).toBeNull();

    const desc = document.createElement('meta');
    desc.setAttribute('name', 'description');
    desc.setAttribute('content', 'previa');
    document.head.appendChild(desc);
    og.removeAttribute('content');
    const second = renderHook(() => usePageMeta('X', 'Y', true));
    second.unmount();
    expect(desc.getAttribute('content')).toBe('previa');
    expect(og.hasAttribute('content')).toBe(false);
    og.remove();
    desc.remove();
    document.querySelector('meta[name="robots"]')?.remove();
  });
  it('reusa la etiqueta robots existente', () => {
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    document.head.appendChild(robots);
    const { unmount } = renderHook(() => usePageMeta('Z', 'z', true));
    expect(document.querySelectorAll('meta[name="robots"]').length).toBe(1);
    expect(robots.getAttribute('content')).toBe('noindex');
    unmount();
    robots.remove();
  });
});

function Dialog({ open, onClose, empty = false }: { open: boolean; onClose: () => void; empty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, ref);
  return (
    <div ref={ref}>
      {empty ? <span>vacío</span> : (
        <>
          <button type="button">primero</button>
          <button type="button" disabled>apagado</button>
          <button type="button">último</button>
        </>
      )}
    </div>
  );
}

describe('accesibilidad de diálogos', () => {
  it('enfoca, atrapa el tabulador, cierra con Escape y devuelve el foco', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open onClose={onClose} />);
    const first = screen.getByText('primero');
    const last = screen.getByText('último');
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Dialog open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
  it('sin elementos enfocables el tabulador no hace nada', () => {
    render(<Dialog open onClose={() => {}} empty />);
    act(() => {
      fireEvent.keyDown(document, { key: 'Tab' });
    });
    expect(screen.getByText('vacío')).toBeTruthy();
  });
});

describe('useAuth', () => {
  it('exige AuthProvider y devuelve el contexto', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow('useAuth debe usarse dentro de AuthProvider');
    const value = { profile: null, loading: false } as unknown as AuthContextValue;
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>,
    });
    expect(result.current).toBe(value);
  });
});
