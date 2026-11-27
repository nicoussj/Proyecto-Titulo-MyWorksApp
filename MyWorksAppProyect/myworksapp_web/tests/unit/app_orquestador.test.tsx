import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

type Props = Record<string, any>;
const h = vi.hoisted(() => {
  const reg: Record<string, Props> = {};
  const mk = (R: typeof import('react'), name: string) => (props: Props) => {
    reg[name] = props;
    return R.createElement('div', { 'data-testid': name }, props.clientActions ?? null, props.evidence ?? null);
  };
  return {
    reg,
    mk,
    fake: { current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> },
    auth: { current: {} as Props },
    live: { current: { fix: null, error: null } as Props },
    geo: vi.fn(),
    evento: vi.fn(),
    path: { current: '/' },
  };
});

vi.mock('../../src/supabaseClient', () => ({ get supabase() { return h.fake.current!.client; } }));
vi.mock('../../src/context/useAuth', () => ({ useAuth: () => h.auth.current }));
vi.mock('../../src/hooks/useLiveJobLocation', () => ({ useLiveJobLocation: () => h.live.current }));
vi.mock('../../src/geo/geocodeChile', () => ({ geocodeChileAddress: (q: string) => h.geo(q) }));
vi.mock('../../src/analytics/registrarEvento', () => ({ registrarEventoUso: (...a: unknown[]) => h.evento(...a) }));
const stubs: Array<[string, string[]]> = [
  ['../../src/views/LandingHome', ['LandingHome']],
  ['../../src/components/NotificationInbox', ['NotificationInbox']],
  ['../../src/pages/AccountPage', ['AccountPage']],
  ['../../src/pages/LegalPage', ['LegalPage']],
  ['../../src/pages/NotFoundPage', ['NotFoundPage']],
  ['../../src/pages/ProfessionalProfilePage', ['ProfessionalProfilePage']],
  ['../../src/pages/WorkWithUsPage', ['WorkWithUsPage']],
  ['../../src/components/ChangeOrderPanel', ['ChangeOrderPanel']],
  ['../../src/components/SiteFooter', ['SiteFooter']],
];
void stubs;
vi.mock('../../src/views/LandingHome', async () => ({ LandingHome: h.mk(await import('react'), 'LandingHome') }));
vi.mock('../../src/components/NotificationInbox', async () => ({ NotificationInbox: h.mk(await import('react'), 'NotificationInbox') }));
vi.mock('../../src/pages/AccountPage', async () => ({ AccountPage: h.mk(await import('react'), 'AccountPage') }));
vi.mock('../../src/pages/LegalPage', async () => ({ LegalPage: h.mk(await import('react'), 'LegalPage') }));
vi.mock('../../src/pages/NotFoundPage', async () => ({ NotFoundPage: h.mk(await import('react'), 'NotFoundPage') }));
vi.mock('../../src/pages/ProfessionalProfilePage', async () => ({ ProfessionalProfilePage: h.mk(await import('react'), 'ProfessionalProfilePage') }));
vi.mock('../../src/pages/WorkWithUsPage', async () => ({ WorkWithUsPage: h.mk(await import('react'), 'WorkWithUsPage') }));
vi.mock('../../src/components/ChangeOrderPanel', async () => ({ ChangeOrderPanel: h.mk(await import('react'), 'ChangeOrderPanel') }));
vi.mock('../../src/components/SiteFooter', async () => ({ SiteFooter: h.mk(await import('react'), 'SiteFooter') }));
vi.mock('../../src/components/PaymentCheckoutModal', async () => ({ PaymentCheckoutModal: h.mk(await import('react'), 'PaymentCheckoutModal') }));
vi.mock('../../src/components/PaidReturnView', async () => ({ PaidReturnView: h.mk(await import('react'), 'PaidReturnView') }));
vi.mock('../../src/components/GuestCheckoutForm', async () => ({ GuestCheckoutForm: h.mk(await import('react'), 'GuestCheckoutForm') }));
vi.mock('../../src/components/LiveChatWidget', async () => ({ LiveChatWidget: h.mk(await import('react'), 'LiveChatWidget') }));
vi.mock('../../src/components/AuthModal', async () => ({ AuthModal: h.mk(await import('react'), 'AuthModal') }));
vi.mock('../../src/components/SearchResultsView', async () => ({ SearchResultsView: h.mk(await import('react'), 'SearchResultsView') }));
vi.mock('../../src/components/QuickBookingBar', async () => ({ QuickBookingBar: h.mk(await import('react'), 'QuickBookingBar') }));
vi.mock('../../src/components/JobEvidencePanel', async () => ({ JobEvidencePanel: h.mk(await import('react'), 'JobEvidencePanel') }));
vi.mock('../../src/components/JobClientActions', async () => ({ JobClientActions: h.mk(await import('react'), 'JobClientActions') }));
vi.mock('../../src/components/TrackingDashboard', async () => ({ TrackingDashboard: h.mk(await import('react'), 'TrackingDashboard') }));
vi.mock('../../src/components/CategoriesCatalogView', async () => ({ CategoriesCatalogView: h.mk(await import('react'), 'CategoriesCatalogView') }));

const sh = vi.hoisted(() => ({
  fetchCategoriesWithPros: vi.fn(), fetchWorkerFreeSlots: vi.fn(), fetchJobTrackingSnapshot: vi.fn(), fetchClientStartPin: vi.fn(),
  clientShouldShowStartPin: vi.fn(), fetchJobEvidencePhotos: vi.fn(), syncJobEvidencePhotos: vi.fn(), closeJobOnClientApproval: vi.fn(),
  fetchWorkerPublicStats: vi.fn(), fetchUserJobs: vi.fn(), fetchMyNotifications: vi.fn(), fetchActiveServices: vi.fn(),
  parseCheckoutReturn: vi.fn(), fetchPaymentStatus: vi.fn(), openJobForWorker: vi.fn(), fetchServiceByCategory: vi.fn(),
  fetchWorkersCatalog: vi.fn(), toWebWorkerCard: vi.fn(), createPendingJob: vi.fn(), fetchJobChargePreview: vi.fn(),
  previewGuestCharge: vi.fn(), chargeSavedCard: vi.fn(), startCardEnrollment: vi.fn(), createWebpaySession: vi.fn(),
  createGuestWebpayCheckout: vi.fn(), getSavedCard: vi.fn(), removeSavedCard: vi.fn(), isOpenAt: vi.fn(),
}));
vi.mock('@myworksapp/shared', async (orig) => ({ ...(await orig<Record<string, unknown>>()), ...sh }));

import App from '../../src/App';
import { ALL_SERVICE_CATEGORIES } from '../../src/data/serviceCategories';

const cat = ALL_SERVICE_CATEGORIES[0];
const card = (id: string, over: Props = {}) => ({
  id, name: `Pro ${id}`, profession: 'Gasfíter', category: cat.id, rating: 4, jobsDone: 2, photoUrl: '/p.png', pricePerVisit: 20000,
  latitude: -41.47, longitude: -72.94, serviceRadiusKm: 8, ...over,
});
const raw = (id: string, over: Props = {}) => ({ userId: id, isAvailable: 1, card: card(id, over) });
const snap = (over: Props = {}) => ({
  id: 'j1', status: 'en_camino', paymentStatus: 'retenido', latitude: -41.47, longitude: -72.94, address: 'Calle 1',
  description: 'Fuga', workerId: 'w1', userId: 'u1', scheduledAt: '2026-11-28T10:00:00Z', ...over,
});

function Probe() {
  const loc = useLocation();
  h.path.current = loc.pathname;
  return null;
}
function mount(path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const call = async (name: string, prop: string, ...args: unknown[]) => {
  let out: unknown;
  await act(async () => {
    try { out = await h.reg[name][prop](...args); } catch (e) { out = e; }
  });
  return out;
};
const profile = { id: 'u1', name: 'Ana' };
let realtime: Array<() => void> = [];
const assign = vi.fn();

beforeEach(() => {
  h.fake.current = createFakeSupabase();
  realtime = [];
  h.fake.current.client.channel = vi.fn(() => {
    const ch: Props = {};
    ch.on = (_e: unknown, _f: unknown, cb: () => void) => { realtime.push(cb); return ch; };
    ch.subscribe = () => ch;
    return ch;
  }) as never;
  for (const k of Object.keys(h.reg)) delete h.reg[k];
  h.auth.current = { profile: null, loading: false, logout: vi.fn(), error: null, clearError: vi.fn() };
  h.live.current = { fix: null, error: null };
  h.geo.mockReset().mockResolvedValue({ latitude: -41.4, longitude: -72.9 });
  h.evento.mockReset();
  sessionStorage.clear();
  sh.fetchCategoriesWithPros.mockResolvedValue([cat.id]);
  sh.fetchWorkerFreeSlots.mockResolvedValue(['2026-11-28T10:00:00Z']);
  sh.fetchJobTrackingSnapshot.mockResolvedValue(snap());
  sh.fetchClientStartPin.mockResolvedValue('1234');
  sh.clientShouldShowStartPin.mockReturnValue(true);
  sh.fetchJobEvidencePhotos.mockResolvedValue([]);
  sh.syncJobEvidencePhotos.mockResolvedValue([]);
  sh.closeJobOnClientApproval.mockResolvedValue(undefined);
  sh.fetchWorkerPublicStats.mockResolvedValue({ rating: 4.9, completedJobs: 12 });
  sh.fetchUserJobs.mockResolvedValue([]);
  sh.fetchMyNotifications.mockResolvedValue([]);
  sh.fetchActiveServices.mockResolvedValue([]);
  sh.parseCheckoutReturn.mockReturnValue({ kind: 'none' });
  sh.fetchPaymentStatus.mockResolvedValue({ estado: 'retenido' });
  sh.openJobForWorker.mockResolvedValue(undefined);
  sh.fetchServiceByCategory.mockResolvedValue({ id: 's1' });
  sh.fetchWorkersCatalog.mockResolvedValue({ workers: [raw('w1'), raw('w2', { latitude: -41.5 })], nextCursor: 'c1' });
  sh.toWebWorkerCard.mockImplementation((w: Props) => w.card);
  sh.createPendingJob.mockResolvedValue({ id: 'j1' });
  sh.fetchJobChargePreview.mockResolvedValue({ totalClp: 25000 });
  sh.previewGuestCharge.mockResolvedValue({ totalClp: 26000 });
  sh.chargeSavedCard.mockResolvedValue({ charged: false, reason: 'sin_tarjeta' });
  sh.startCardEnrollment.mockResolvedValue({ handoffUrl: 'https://tbk.test/inscripcion' });
  sh.createWebpaySession.mockResolvedValue({ redirectUrl: 'https://tbk.test/pago' });
  sh.createGuestWebpayCheckout.mockResolvedValue({ jobId: 'jg', redirectUrl: 'https://tbk.test/invitado', nonce: 'n1' });
  sh.getSavedCard.mockResolvedValue(null);
  sh.removeSavedCard.mockResolvedValue(undefined);
  sh.isOpenAt.mockReturnValue(true);
  vi.stubGlobal('location', { ...window.location, assign, search: '', pathname: '/' });
  assign.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('App: rutas simples', () => {
  it.each([
    ['/cuenta', 'AccountPage'], ['/trabaja', 'WorkWithUsPage'], ['/aviso-legal', 'LegalPage'], ['/terminos', 'LegalPage'],
    ['/privacidad', 'LegalPage'], ['/no-existe', 'NotFoundPage'],
  ])('%s muestra %s', async (path, testid) => {
    mount(path);
    expect(await screen.findByTestId(testid)).toBeTruthy();
  });

  it('portada: modo oscuro, categorías con profesionales, acceso y pedidos sin sesión', async () => {
    sh.fetchCategoriesWithPros.mockResolvedValueOnce(null);
    const view = mount('/');
    await screen.findByTestId('LandingHome');
    expect(document.body.classList.contains('dark')).toBe(true);
    await call('LandingHome', 'setShowAuth', true);
    expect(h.reg.LandingHome.showAuth).toBe(true);
    await call('LandingHome', 'setShowAuth', false);
    await call('LandingHome', 'onShowOrders');
    expect(h.reg.LandingHome.showAuth).toBe(true);
    await call('LandingHome', 'logout');
    expect(h.auth.current.logout).toHaveBeenCalled();
    await call('LandingHome', 'setActiveNav', 'como-funciona');
    expect(h.reg.LandingHome.activeNav).toBe('como-funciona');
    await call('LandingHome', 'onCloseOrders');
    await call('LandingHome', 'clearCheckoutNotice');
    view.unmount();
  });

  it('portada con sesión: pedidos activos y completados, error al leerlos, abrir pedido', async () => {
    h.auth.current.profile = profile;
    sh.fetchUserJobs.mockResolvedValueOnce([
      { id: 'a', status: 'pendiente', address: 'X', description: 'Y' },
      { id: 'b', status: 'completado' },
      { id: 'c', status: 'cancelado' },
    ]);
    mount('/');
    await screen.findByTestId('LandingHome');
    await waitFor(() => expect(h.reg.LandingHome.availableCategoryIds).toEqual(new Set([cat.id])));
    await call('LandingHome', 'onShowOrders');
    expect(h.reg.LandingHome.orders.map((o: Props) => o.id)).toEqual(['a', 'b']);
    expect(h.reg.LandingHome.orders[1]).toEqual({ id: 'b', status: 'completado', address: null, description: null });
    sh.fetchUserJobs.mockRejectedValueOnce(new Error('x'));
    await call('LandingHome', 'onShowOrders');
    expect(h.reg.LandingHome.ordersError).toBe('No se pudieron leer tus pedidos.');
    await call('LandingHome', 'onOpenOrder', 'j1');
    await waitFor(() => expect(h.path.current).toBe('/pedido/j1'));
    expect(await screen.findByTestId('TrackingDashboard')).toBeTruthy();
  });
});

describe('App: catálogo y búsqueda', () => {
  it('categorías → búsqueda, cargar más, ubicación y vuelta', async () => {
    h.fake.current!.state.session = { user: { id: 'u1' } };
    h.fake.current!.state.responder = (q) => {
      if (q.table === 'trabajadores') return { data: [{ id_usuario: 'w1', usa_horario: true }, { id_usuario: '' }] };
      if (q.table === 'trabajador_horarios') {
        return { data: [
          { id_usuario: 'w1', dia_semana: 1, hora_inicio: '09:00', hora_fin: '18', activo: null },
          { id_usuario: 'w1', dia_semana: 2, hora_inicio: '09:00', hora_fin: '18:00', activo: false },
          { id_usuario: '', dia_semana: 1 },
        ] };
      }
      return { data: [] };
    };
    mount('/servicios');
    await screen.findByTestId('CategoriesCatalogView');
    await call('CategoriesCatalogView', 'onShowAuth');
    expect(h.reg.AuthModal.open).toBe(true);
    await call('AuthModal', 'onClose');
    await call('CategoriesCatalogView', 'onSelectCategory', cat);
    await waitFor(() => expect(h.path.current).toBe(`/servicios/${cat.id}`));
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    expect(h.reg.SearchResultsView.workers[0].availableNow).toBe(true);
    expect(h.reg.SearchResultsView.hasMore).toBe(true);

    sh.fetchWorkersCatalog.mockResolvedValueOnce({ workers: [raw('w2'), raw('w3')], nextCursor: null });
    await call('SearchResultsView', 'onLoadMore');
    await waitFor(() => expect(h.reg.SearchResultsView.workers.map((w: Props) => w.id)).toEqual(['w1', 'w2', 'w3']));
    await call('SearchResultsView', 'onLoadMore');

    await call('SearchResultsView', 'onPickClientLocation', { latitude: -41.47, longitude: -72.94 });
    expect(h.reg.SearchResultsView.clientLocation).toEqual({ latitude: -41.47, longitude: -72.94 });
    await call('SearchResultsView', 'onPickClientLocation', { latitude: 10, longitude: 10 });
    expect(h.reg.SearchResultsView.workers).toHaveLength(0);
    h.geo.mockResolvedValueOnce(null);
    await call('SearchResultsView', 'onSearchAddress', 'nada');
    expect(screen.getByRole('alert').textContent).toMatch(/No encontramos esa dirección/);
    h.geo.mockRejectedValueOnce(new Error('red'));
    await call('SearchResultsView', 'onSearchAddress', 'x');
    expect(screen.getByRole('alert').textContent).toMatch(/No se pudo buscar la dirección/);
    await call('SearchResultsView', 'onSearchAddress', 'Calle 1, Puerto Montt');
    expect(h.reg.SearchResultsView.clientLocation).toEqual({ latitude: -41.4, longitude: -72.9 });

    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined });
    await call('SearchResultsView', 'onUseMyLocation');
    expect(screen.getByRole('alert').textContent).toMatch(/no tiene GPS/);
    const geo = { getCurrentPosition: vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -41.47, longitude: -72.94 } })) };
    vi.stubGlobal('navigator', { ...navigator, geolocation: geo });
    await call('SearchResultsView', 'onUseMyLocation');
    geo.getCurrentPosition.mockImplementationOnce(((_ok: unknown, ko: () => void) => ko()) as never);
    await call('SearchResultsView', 'onUseMyLocation');
    expect(screen.getByRole('alert').textContent).toMatch(/No pudimos leer el GPS/);

    sh.fetchWorkersCatalog.mockRejectedValueOnce(new Error('x'));
    await call('SearchResultsView', 'onQueryChange', 'abc');
    await call('SearchResultsView', 'onSearch', cat.searchQuery);
    await waitFor(() => expect(screen.getAllByRole('alert').map((a) => a.textContent).join()).toMatch(/No se pudo cargar el catálogo/));
    await call('SearchResultsView', 'onSearch', '   ');
    await call('SearchResultsView', 'onSearch', 'zzzz qqq inexistente');
    await waitFor(() => expect(h.path.current).toBe('/servicios'));
  });

  it('categoría inexistente, más resultados con error y notificaciones con sesión', async () => {
    h.auth.current.profile = profile;
    sh.fetchMyNotifications.mockResolvedValue([
      { id: 'n1', read: false, relatedId: 'j1' }, { id: 'n2', read: true, relatedId: ' ' }, { id: 'n3', read: true, relatedId: null },
    ]);
    h.fake.current!.state.responder = (q) => q.table === 'trabajos'
      ? { data: [{ id: 'j1', descripcion: ' ', direccion: 'Calle 9' }, { id: '' }, { id: 'j2' }] }
      : { data: [] };
    const view = mount('/servicios/no-existe');
    await screen.findByTestId('SearchResultsView');
    expect(screen.getByRole('alert').textContent).toBe('Esa categoría no está en el catálogo.');
    await waitFor(() => expect(h.reg.SearchResultsView.unreadCount).toBe(1));
    sh.fetchMyNotifications.mockRejectedValueOnce(new Error('x'));
    await act(async () => { realtime[0](); });
    await act(async () => { realtime[0](); });
    view.unmount();
  });

  it('carga más falla y la vista de búsqueda muestra el aviso', async () => {
    mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    sh.fetchWorkersCatalog.mockRejectedValueOnce(new Error('x'));
    await call('SearchResultsView', 'onLoadMore');
    expect(screen.getByRole('alert').textContent).toMatch(/No se pudieron cargar más/);
    await call('SearchResultsView', 'onBack');
    await waitFor(() => expect(h.path.current).toBe('/servicios'));
  });
});

describe('App: reserva y pago', () => {
  async function toBooking(path = `/servicios/${cat.id}`) {
    mount(path);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    await call('SearchResultsView', 'onSelectWorker', h.reg.SearchResultsView.workers[0]);
    await waitFor(() => expect(h.reg.QuickBookingBar?.slots).toHaveLength(1));
  }

  it('con sesión: horario, cobro bloqueado sin sitio, pedido pendiente y Webpay', async () => {
    h.auth.current.profile = profile;
    await toBooking();
    expect(h.reg.QuickBookingBar.radarHint).toMatch(/traslado/);
    await call('QuickBookingBar', 'onContinue');
    expect(screen.getByRole('alert').textContent).toMatch(/Elige un horario/);
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    await screen.findByTestId('PaymentCheckoutModal');
    expect(h.reg.PaymentCheckoutModal.chargeError).toMatch(/Indica dónde es el trabajo/);
    expect(await call('PaymentCheckoutModal', 'onPayWithWebpay')).toBeInstanceOf(Error);
    await call('PaymentCheckoutModal', 'onUseAddress', 'Calle 1');
    await waitFor(() => expect(h.reg.PaymentCheckoutModal.payableTotalClp).toBe(25000));
    expect(sh.createPendingJob).toHaveBeenCalled();

    sh.fetchJobChargePreview.mockResolvedValueOnce({ totalClp: 27000 });
    await call('PaymentCheckoutModal', 'onPayWithWebpay');
    expect(assign).toHaveBeenLastCalledWith('https://tbk.test/pago');
    await call('PaymentCheckoutModal', 'onPayWithWebpay', { saveCard: true });
    expect(assign).toHaveBeenLastCalledWith('https://tbk.test/inscripcion');
    sh.chargeSavedCard.mockResolvedValueOnce({ charged: true });
    expect(await call('PaymentCheckoutModal', 'onPayWithWebpay')).toEqual({ charged: true });
    sh.fetchJobChargePreview.mockResolvedValueOnce(null);
    expect(await call('PaymentCheckoutModal', 'onPayWithWebpay')).toBeInstanceOf(Error);
    expect(h.reg.PaymentCheckoutModal.chargeError).toMatch(/No pudimos calcular/);

    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(snap({ latitude: 1 }));
    sh.fetchJobChargePreview.mockResolvedValueOnce(null);
    await call('PaymentCheckoutModal', 'onRetryCharge');
    await waitFor(() => expect(h.reg.PaymentCheckoutModal.chargeLocking).toBe(false));
    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(snap({ latitude: -41.4, longitude: -72.9 }));
    sh.fetchJobChargePreview.mockRejectedValueOnce(new Error('Pedido vencido'));
    await call('PaymentCheckoutModal', 'onRetryCharge');
    await waitFor(() => expect(h.reg.PaymentCheckoutModal.chargeError).toBe('Pedido vencido'));
    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(null);
    sh.fetchJobChargePreview.mockRejectedValueOnce('raro');
    await call('PaymentCheckoutModal', 'onRetryCharge');
    await waitFor(() => expect(h.reg.PaymentCheckoutModal.chargeError).toMatch(/No pudimos calcular/));

    await call('PaymentCheckoutModal', 'loadSavedCard');
    await call('PaymentCheckoutModal', 'onRemoveSavedCard');
    await call('PaymentCheckoutModal', 'onSuccess', { notice: 'Listo' });
    await waitFor(() => expect(h.path.current).toBe('/pedido/j1'));
    expect(h.evento).toHaveBeenCalled();
  });

  it('cerrar el cobro, sesión cargando y sin servicio activo', async () => {
    h.auth.current.profile = profile;
    sh.fetchWorkerFreeSlots.mockRejectedValueOnce(new Error('x'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    await call('SearchResultsView', 'onSelectWorker', h.reg.SearchResultsView.workers[0]);
    await waitFor(() => expect(h.reg.QuickBookingBar.loadingSlots).toBe(false));
    expect(h.reg.QuickBookingBar.slots).toEqual([]);
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    await call('PaymentCheckoutModal', 'onClose');
    await call('QuickBookingBar', 'onClose');
    expect(screen.queryByTestId('QuickBookingBar')).toBeNull();

    sh.fetchServiceByCategory.mockResolvedValueOnce(null);
    await call('SearchResultsView', 'onSearch', ALL_SERVICE_CATEGORIES[1].searchQuery);
    await waitFor(() => expect(h.reg.SearchResultsView.workers).toHaveLength(2));
    await call('SearchResultsView', 'onSelectWorker', h.reg.SearchResultsView.workers[0]);
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    expect(screen.getByRole('alert').textContent).toMatch(/No hay un servicio activo/);
  });

  it('sesión aún cargando no abre el cobro', async () => {
    h.auth.current.loading = true;
    await toBooking();
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    expect(screen.getByRole('alert').textContent).toMatch(/confirmando tu sesión/);
  });

  it('invitado: cotiza, falla, paga con dirección escrita y prefiere ingresar', async () => {
    await toBooking();
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    await screen.findByTestId('GuestCheckoutForm');
    const data = { name: 'Ana', email: ' ana@gmail.com ', phone: '+56911111111', address: '', turnstileToken: 't' };
    expect(await call('GuestCheckoutForm', 'onSubmit', data)).toBeInstanceOf(Error);
    await call('GuestCheckoutForm', 'onPreviewAddress', 'Calle 1');
    await waitFor(() => expect(h.reg.GuestCheckoutForm.payableTotalClp).toBe(26000));
    sh.previewGuestCharge.mockResolvedValueOnce({ totalClp: 27000 });
    await call('GuestCheckoutForm', 'onSubmit', { ...data, address: 'Calle 2' });
    expect(assign).toHaveBeenCalledWith('https://tbk.test/invitado');
    expect(sessionStorage.getItem('mwa-guest-email')).toBe('ana@gmail.com');
    sh.createGuestWebpayCheckout.mockResolvedValueOnce({ jobId: 'jg2', redirectUrl: 'https://tbk.test/2' });
    await call('SearchResultsView', 'onPickClientLocation', { latitude: -41.46, longitude: -72.93 });
    await call('GuestCheckoutForm', 'onSubmit', { ...data, address: 'Calle 3' });
    sh.previewGuestCharge.mockRejectedValueOnce(new Error('Fuera de zona'));
    await call('SearchResultsView', 'onPickClientLocation', { latitude: -41.45, longitude: -72.93 });
    await waitFor(() => expect(h.reg.GuestCheckoutForm.quoteError).toBe('Fuera de zona'));
    expect(await call('GuestCheckoutForm', 'onSubmit', data)).toBeInstanceOf(Error);
    sh.previewGuestCharge.mockRejectedValueOnce('raro');
    await call('SearchResultsView', 'onPickClientLocation', { latitude: -41.44, longitude: -72.93 });
    await waitFor(() => expect(h.reg.GuestCheckoutForm.quoteError).toMatch(/No pudimos calcular/));
    await call('GuestCheckoutForm', 'onClose');
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    await call('GuestCheckoutForm', 'onPreferLogin');
    expect(h.reg.AuthModal.open).toBe(true);
    await call('SearchResultsView', 'onShowAuth');
    await call('SearchResultsView', 'onOpenNotifications');
    await call('SearchResultsView', 'onLogout');
  });

  it('ficha del profesional: reservar con y sin categoría', async () => {
    mount('/profesional/w1');
    await screen.findByTestId('ProfessionalProfilePage');
    await call('ProfessionalProfilePage', 'onReserve', card('w1'));
    await waitFor(() => expect(sh.fetchServiceByCategory).toHaveBeenCalled());
    sh.fetchServiceByCategory.mockResolvedValueOnce(null);
    await call('ProfessionalProfilePage', 'onReserve', card('w1'));
    await call('ProfessionalProfilePage', 'onReserve', card('w2', { category: '' }));
    expect(screen.getByTestId('QuickBookingBar')).toBeTruthy();
  });
});

describe('App: seguimiento', () => {
  async function tracking(over: Props = {}) {
    h.auth.current.profile = profile;
    mount('/pedido/j1');
    await screen.findByTestId('TrackingDashboard');
    Object.assign(h.fake.current!.state, over);
  }

  it('abre el pedido, acciones del cliente, chat, disputas y acuerdos', async () => {
    let rpcErr: null | { message: string } = null;
    h.fake.current!.state.rpc = (fn) => {
      if (fn === 'acuerdo_pendiente') return { data: [{ id: 'a1', tipo: 'reprogramar' }] };
      return { error: rpcErr };
    };
    h.fake.current!.state.responder = (q) => {
      if (q.table === 'trabajadores') {
        return { data: { id_usuario: 'w1', profesion: 'Gasfíter', calificacion: 4, tarifa_visita: 20000, trabajos_completados: 3,
          trabajador_servicios: [{ categoria_servicio: 'z' }, { categoria_servicio: 'a' }], perfiles: [{ nombre: 'Pedro', ruta_foto_perfil: null }] } };
      }
      if (q.table === 'disputas') {
        const sel = String(q.ops[0]?.[1]?.[0] ?? '');
        if (sel === 'abierta_por') return { data: { abierta_por: 'u1' } };
        if (sel === 'id') return { data: { id: 'd1' } };
        return { data: [{ id: 'd1', estado: 'resuelta', origen: 'sistema' }] };
      }
      return { data: [] };
    };
    h.live.current = { fix: { latitude: 1, longitude: 2, etaMinutes: 5, distanceKm: 1 }, error: null };
    await tracking();
    await waitFor(() => expect(h.reg.TrackingDashboard.workerName).toBe('Pedro'));
    expect(h.reg.TrackingDashboard.workerRating).toBe(4.9);
    await waitFor(() => expect(h.reg.TrackingDashboard.startPin).toBe('1234'));
    await waitFor(() => expect(h.reg.TrackingDashboard.disputeOpen).toBe(true));
    await waitFor(() => expect(h.reg.TrackingDashboard.pendingAgreement).toEqual({ id: 'a1', tipo: 'reprogramar' }));
    expect(screen.getByTestId('JobClientActions')).toBeTruthy();
    expect(h.reg.JobEvidencePanel.readOnly).toBe(false);

    await call('JobClientActions', 'onChanged');
    sh.fetchJobTrackingSnapshot.mockRejectedValueOnce(new Error('x'));
    await call('JobClientActions', 'onChanged');
    await call('TrackingDashboard', 'onOpenChat');
    expect(screen.getByTestId('LiveChatWidget')).toBeTruthy();
    await call('LiveChatWidget', 'onClose');
    await call('TrackingDashboard', 'onOpenNotifications');
    await call('NotificationInbox', 'onClose');
    await call('TrackingDashboard', 'onOpenNotifications');
    await call('NotificationInbox', 'onOpen', { id: 'n1', read: false, relatedId: 'j1' });
    await call('TrackingDashboard', 'onOpenNotifications');
    await call('NotificationInbox', 'onOpen', { id: 'n2', read: true, relatedId: null });

    await call('TrackingDashboard', 'onOpenDispute', 'no_llego', 'detalle');
    await call('TrackingDashboard', 'onProposeAgreement', 'reprogramar');
    await call('TrackingDashboard', 'onRespondAgreement', true);
    expect(await call('TrackingDashboard', 'onAppealDispute', 'motivo')).toBeUndefined();
    expect(await call('TrackingDashboard', 'onAddDisputeComment', 'hola')).toBeUndefined();
    for (const [msg, expected] of [['trabajo cerrado', /ya está cerrado/], ['ya existe', /Ya hay una disputa/], ['otro', /No se pudo abrir/]] as const) {
      rpcErr = { message: msg };
      expect(String(await call('TrackingDashboard', 'onOpenDispute', 'x', 'y'))).toMatch(expected);
    }
    expect(await call('TrackingDashboard', 'onProposeAgreement', 'x')).toBeInstanceOf(Error);
    expect(await call('TrackingDashboard', 'onRespondAgreement', false)).toBeInstanceOf(Error);
    expect(String(await call('TrackingDashboard', 'onAppealDispute', 'm'))).toMatch(/No se pudo pedir la revisión/);
    expect(String(await call('TrackingDashboard', 'onAddDisputeComment', 'c'))).toMatch(/No se pudo agregar/);
  });

  it('errores al leer disputas y confirmar recepción', async () => {
    h.fake.current!.state.rpc = () => { throw new Error('rpc caida'); };
    h.fake.current!.state.responder = (q) => {
      if (q.table === 'disputas') {
        const sel = String(q.ops[0]?.[1]?.[0] ?? '');
        if (sel === 'abierta_por') return { data: { abierta_por: null } };
        if (sel === 'id') return { data: null };
        return { data: [{ id: 'd1', estado: 'abierta', origen: 'cliente' }] };
      }
      if (q.table === 'trabajadores') return { data: { id_usuario: 'w1', perfiles: null } };
      return { data: [] };
    };
    sh.fetchWorkerPublicStats.mockResolvedValueOnce(null);
    sh.clientShouldShowStartPin.mockReturnValue(false);
    await tracking();
    await waitFor(() => expect(h.reg.TrackingDashboard.disputeOpen).toBe(true));
    expect(h.reg.TrackingDashboard.workerName).toBe('Profesional');
    expect(String(await call('TrackingDashboard', 'onAppealDispute', 'm'))).toMatch(/Solo se puede apelar/);
    expect(String(await call('TrackingDashboard', 'onAddDisputeComment', 'c'))).toMatch(/No hay una disputa abierta/);
    h.fake.current!.state.responder = () => ({ error: { message: 'x' } });
    expect(String(await call('TrackingDashboard', 'onAppealDispute', 'm'))).toMatch(/No se pudo leer la disputa/);
    expect(String(await call('TrackingDashboard', 'onAddDisputeComment', 'c'))).toMatch(/No se pudo leer la disputa/);

    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(snap({ status: 'completado' }));
    await call('TrackingDashboard', 'onConfirmReceipt');
    expect(h.reg.TrackingDashboard.paymentNotice).toMatch(/Recibiste conforme/);
    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(null);
    await call('TrackingDashboard', 'onConfirmReceipt');
    expect(h.reg.TrackingDashboard.jobStatus).toBe('completado');
    sh.fetchJobTrackingSnapshot.mockRejectedValueOnce(new Error('x'));
    await call('TrackingDashboard', 'onConfirmReceipt');
    sh.closeJobOnClientApproval.mockRejectedValueOnce(new Error('No permitido'));
    await call('TrackingDashboard', 'onConfirmReceipt');
    expect(h.reg.TrackingDashboard.confirmError).toBe('No permitido');
    sh.closeJobOnClientApproval.mockRejectedValueOnce('raro');
    await call('TrackingDashboard', 'onConfirmReceipt');
    expect(h.reg.TrackingDashboard.confirmError).toBe('No se pudo recibir conforme.');
  });

  it('refresco periódico, visibilidad y volver según el estado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      sh.fetchJobEvidencePhotos.mockRejectedValueOnce(new Error('x'));
      await tracking({ rpc: () => ({ data: null, error: { message: 'no existe' } }) });
      sh.fetchJobTrackingSnapshot.mockRejectedValueOnce(new Error('x'));
      sh.syncJobEvidencePhotos.mockRejectedValueOnce(new Error('x'));
      await act(async () => { vi.advanceTimersByTime(8100); });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      await act(async () => { vi.advanceTimersByTime(8100); document.dispatchEvent(new Event('visibilitychange')); });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(sh.syncJobEvidencePhotos).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
    await call('TrackingDashboard', 'onBack');
    await waitFor(() => expect(h.path.current).toBe('/'));
  });

  it('volver con el pedido cerrado vuelve al inicio; ir al inicio limpia', async () => {
    sh.fetchJobTrackingSnapshot.mockResolvedValue(snap({ status: 'completado', userId: 'otro', workerId: null }));
    sh.fetchJobEvidencePhotos.mockRejectedValue(new Error('x'));
    await tracking();
    expect(screen.queryByTestId('JobClientActions')).toBeNull();
    await waitFor(() => expect(h.reg.JobEvidencePanel?.readOnly).toBe(true));
    await call('TrackingDashboard', 'onBack');
    await waitFor(() => expect(h.path.current).toBe('/'));
  });

  it('pedido no encontrado, error al abrir y restauración desde la sesión', async () => {
    sessionStorage.setItem('mwa-active-job', 'j9');
    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(null);
    h.auth.current.profile = profile;
    mount('/');
    await waitFor(() => expect(h.reg.LandingHome?.checkoutNotice).toBe('No encontramos ese pedido.'));
    sh.fetchJobTrackingSnapshot.mockRejectedValueOnce(new Error('x'));
    await call('LandingHome', 'onOpenOrder', 'j2');
    expect(h.reg.LandingHome.checkoutNotice).toMatch(/No se pudo abrir el seguimiento/);
  });
});

describe('App: regreso desde Transbank', () => {
  const pending = (extra: Props = {}) =>
    sessionStorage.setItem('mwa-pending-checkout', JSON.stringify({ worker: card('w1'), jobId: 'j1', amount: 25000, serviceTitle: 'Gasfitería', ...extra }));

  it('tarjeta inscrita solo limpia la URL', async () => {
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'card' });
    const replace = vi.spyOn(window.history, 'replaceState');
    mount('/');
    await screen.findByTestId('LandingHome');
    expect(replace).toHaveBeenCalled();
  });

  it('cobro seguido: confirma y abre el seguimiento', async () => {
    pending();
    h.auth.current.profile = profile;
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'tracked', jobId: 'j1', paymentId: 'p1', amount: 0, last4: '1234' });
    sh.openJobForWorker.mockRejectedValueOnce(new Error('x'));
    mount('/pago/retorno');
    await waitFor(() => expect(h.reg.TrackingDashboard?.paymentNotice).toBeTruthy());
    expect(sessionStorage.getItem('mwa-active-job')).toBe('j1');
  });

  it('cobro seguido sin referencia, no confirmado o con error', async () => {
    sessionStorage.setItem('mwa-pending-checkout', '{malo');
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'tracked', jobId: null, paymentId: null, amount: 0, last4: null });
    const a = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/Falta referencia/));
    a.unmount();
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'tracked', jobId: null, paymentId: 'p1', amount: 1000, last4: null });
    sh.fetchPaymentStatus.mockResolvedValueOnce({ estado: 'pendiente' });
    const b = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/Aún no confirmamos/));
    b.unmount();
    sh.fetchPaymentStatus.mockResolvedValueOnce({ estado: 'retenido' });
    const c = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifying).toBe(false));
    c.unmount();
    sh.fetchPaymentStatus.mockRejectedValueOnce(new Error('x'));
    mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/No se pudo verificar/));
  });

  it('verificación de invitado y de cliente, con y sin referencia', async () => {
    pending({ serviceTitle: undefined, amount: undefined });
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: 'j1', paymentId: 'p1', guest: true, passwordToken: 'tok' });
    const a = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.passwordToken).toBe('tok'));
    await waitFor(() => expect(h.reg.PaidReturnView.verifying).toBe(false));
    sessionStorage.setItem('mwa-guest-email', ' ana@gmail.com ');
    await call('PaidReturnView', 'onContinueTracking');
    await waitFor(() => expect(h.reg.LandingHome?.authInitialEmail).toBe('ana@gmail.com'));
    a.unmount();

    pending();
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: 'j1', paymentId: 'p1', guest: false, passwordToken: null });
    const b = mount('/pago/retorno');
    await screen.findByTestId('TrackingDashboard');
    b.unmount();

    for (const status of [null, { estado: 'rechazado' }]) {
      sh.fetchPaymentStatus.mockResolvedValueOnce(status);
      sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: null, paymentId: 'p1', guest: false, passwordToken: null });
      const c = mount('/pago/retorno');
      await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/Aún no confirmamos/));
      c.unmount();
    }
    sh.fetchPaymentStatus.mockRejectedValueOnce(new Error('x'));
    const d = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/No se pudo verificar/));
    d.unmount();
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: null, paymentId: null, guest: false, passwordToken: null });
    mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifyError).toMatch(/Falta referencia/));
    await call('PaidReturnView', 'onGoHome');
    await waitFor(() => expect(h.path.current).toBe('/'));
  });

  it('pago fallido muestra el aviso y continuar con sesión', async () => {
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'failed', message: 'Pago rechazado' });
    const a = mount('/');
    await waitFor(() => expect(h.reg.LandingHome?.checkoutNotice).toBe('Pago rechazado'));
    a.unmount();

    h.auth.current.profile = profile;
    sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: 'j1', paymentId: 'p1', guest: true, passwordToken: null });
    const b = mount('/pago/retorno');
    await waitFor(() => expect(h.reg.PaidReturnView?.verifying).toBe(false));
    await call('PaidReturnView', 'onContinueTracking');
    await waitFor(() => expect(h.path.current).toBe('/pedido/j1'));
    b.unmount();

    sh.parseCheckoutReturn.mockReturnValue({ kind: 'verify', jobId: null, paymentId: null, guest: true, passwordToken: null });
    pending({ jobId: undefined });
    const c = mount('/pago/retorno');
    await screen.findByTestId('PaidReturnView');
    await call('PaidReturnView', 'onContinueTracking');
    c.unmount();
    sessionStorage.clear();
    mount('/pago/retorno');
    await screen.findByTestId('PaidReturnView');
    await call('PaidReturnView', 'onContinueTracking');
    h.auth.current.profile = null;
  });
});

describe('App: casos de borde', () => {
  it('catálogo vacío, horarios con error y sesión que falla', async () => {
    h.fake.current!.state.session = { user: { id: 'u1' } };
    h.fake.current!.state.responder = (q) => (q.table === 'trabajadores' ? { error: { message: 'x' } } : { data: [] });
    const a = mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    expect(h.reg.SearchResultsView.workers[0].availableNow).toBe(false);
    sh.fetchWorkersCatalog.mockResolvedValueOnce({ workers: [], nextCursor: null });
    await call('SearchResultsView', 'onSearch', ALL_SERVICE_CATEGORIES[2].searchQuery);
    await waitFor(() => expect(h.reg.SearchResultsView.workers).toHaveLength(0));
    a.unmount();
    h.fake.current!.client.auth.getSession = vi.fn(async () => { throw new Error('x'); }) as never;
    mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    await call('SearchResultsView', 'onBack');
    await screen.findByTestId('CategoriesCatalogView');
    await call('CategoriesCatalogView', 'onBack');
    await waitFor(() => expect(h.path.current).toBe('/'));
    await call('LandingHome', 'goToCategories');
    await waitFor(() => expect(h.path.current).toBe('/servicios'));
  });

  it('bandeja en la búsqueda: marca leída, cierra y avisos que fallan', async () => {
    h.auth.current.profile = profile;
    sh.fetchMyNotifications.mockRejectedValueOnce(new Error('x'));
    const a = mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.unreadCount).toBe(0));
    a.unmount();
    sh.fetchMyNotifications.mockResolvedValue([{ id: 'n1', read: false, relatedId: null }, { id: 'n2', read: false, relatedId: null }]);
    let release: (v: unknown) => void = () => {};
    h.fake.current!.state.responder = (q) => (q.table === 'trabajos' ? new Promise((r) => { release = r; }) : { data: [] });
    const b = mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.unreadCount).toBe(2));
    await call('SearchResultsView', 'onOpenNotifications');
    await call('NotificationInbox', 'onClose');
    await call('SearchResultsView', 'onOpenNotifications');
    await call('NotificationInbox', 'onOpen', { id: 'n1', read: false, relatedId: null });
    expect(h.reg.SearchResultsView.unreadCount).toBe(1);
    await call('SearchResultsView', 'onShowAuth');
    await call('AuthModal', 'onClose');
    b.unmount();
    await act(async () => { release({ data: [] }); });
  });

  it('seguimiento: refresco sin pedido y disputa que no se lee', async () => {
    h.auth.current.profile = profile;
    sh.fetchJobTrackingSnapshot.mockResolvedValueOnce(snap()).mockResolvedValueOnce(null);
    h.fake.current!.state.responder = (q) => (q.table === 'disputas' ? { data: null } : { data: [] });
    const view = mount('/pedido/j1');
    await screen.findByTestId('TrackingDashboard');
    await waitFor(() => expect(h.reg.TrackingDashboard.disputeOpen).toBe(false));
    let late: (v: unknown) => void = () => {};
    h.fake.current!.state.responder = (q) => (q.table === 'disputas' ? new Promise((r) => { late = r; }) : { data: [] });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    view.unmount();
    await act(async () => { late({ data: null }); });
  });

  it('el cobro se cierra mientras se calcula el total', async () => {
    h.auth.current.profile = profile;
    mount(`/servicios/${cat.id}`);
    await waitFor(() => expect(h.reg.SearchResultsView?.workers).toHaveLength(2));
    await call('SearchResultsView', 'onPickClientLocation', { latitude: -41.47, longitude: -72.94 });
    await call('SearchResultsView', 'onSelectWorker', h.reg.SearchResultsView.workers[0]);
    let ok: (v: unknown) => void = () => {};
    sh.fetchJobChargePreview.mockReturnValueOnce(new Promise((r) => { ok = r; }));
    await call('QuickBookingBar', 'onContinue', '2026-11-28T10:00:00Z');
    await call('PaymentCheckoutModal', 'onClose');
    await act(async () => { ok({ totalClp: 1 }); });
    let ko: (e: unknown) => void = () => {};
    sh.fetchJobChargePreview.mockReturnValueOnce(new Promise((_r, j) => { ko = j; }));
    await call('QuickBookingBar', 'onContinue', '2026-11-28T11:00:00Z');
    await call('PaymentCheckoutModal', 'onClose');
    await act(async () => { ko(new Error('tarde')); });
    expect(screen.queryByTestId('PaymentCheckoutModal')).toBeNull();
  });
});
