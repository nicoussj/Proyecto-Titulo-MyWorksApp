import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RescheduleProposal } from '@myworksapp/shared';

vi.mock('../../src/supabaseClient', () => ({ supabase: {} }));
const sh = vi.hoisted(() => ({
  cancelJobAsClient: vi.fn(),
  fetchClientRatingForJob: vi.fn(),
  fetchRescheduleHistory: vi.fn(),
  fetchWorkerFreeSlots: vi.fn(),
  proposeReschedule: vi.fn(),
  rateJobAsClient: vi.fn(),
  respondReschedule: vi.fn(),
  withdrawReschedule: vi.fn(),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  ...sh,
}));

import { JobClientActions } from '../../src/components/JobClientActions';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const proposal = (over: Partial<RescheduleProposal> = {}): RescheduleProposal => ({
  id: 'r-1', jobId: 'j-1', proposedBy: 'w', proposerRole: 'profesional', previousAt: inDays(2), proposedAt: inDays(3),
  reason: 'Se me cruzó otra visita', status: 'pendiente', respondedBy: null, respondedAt: null, createdAt: inDays(0), ...over,
});

function actions(props: Partial<Parameters<typeof JobClientActions>[0]> = {}) {
  const onChanged = vi.fn();
  const view = render(
    <JobClientActions jobId="j-1" status="aceptado" scheduledAt={inDays(2)} workerId="w" workerName="Pedro" userId="c" onChanged={onChanged} {...props} />,
  );
  return { onChanged, view };
}

beforeEach(() => {
  for (const f of Object.values(sh)) f.mockReset();
  sh.fetchRescheduleHistory.mockResolvedValue([]);
  sh.fetchWorkerFreeSlots.mockResolvedValue([inDays(4), inDays(5)]);
  sh.fetchClientRatingForJob.mockResolvedValue(null);
});

describe('acciones del cliente en el seguimiento', () => {
  it('propone una nueva hora', async () => {
    sh.proposeReschedule.mockResolvedValue(undefined);
    const { onChanged } = actions();
    expect(await screen.findByText(/Hora actual:/)).toBeTruthy();
    fireEvent.submit(screen.getByLabelText('Motivo (opcional)').closest('form')!);
    expect(sh.proposeReschedule).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva hora' }));
    fireEvent.click(screen.getAllByRole('option')[1]);
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Viajo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Proponer nueva hora' }));
    expect(await screen.findByText(/Propuesta enviada\. Pedro debe aceptarla/)).toBeTruthy();
    expect(sh.proposeReschedule).toHaveBeenCalledWith({}, 'j-1', expect.any(String), 'Viajo');
    expect(onChanged).toHaveBeenCalled();
  });

  it('sin horas libres lo dice; si fallan las consultas no rompe', async () => {
    sh.fetchWorkerFreeSlots.mockRejectedValue(new Error('x'));
    sh.fetchRescheduleHistory.mockRejectedValue(new Error('x'));
    actions();
    expect(await screen.findByText('No hay otras horas libres en las próximas tres semanas.')).toBeTruthy();
  });

  it('acepta o rechaza la propuesta del profesional y ve el historial', async () => {
    sh.fetchRescheduleHistory.mockResolvedValue([proposal(), proposal({ id: 'r-0', status: 'rechazada', proposerRole: 'cliente' }), proposal({ id: 'r-00', status: 'aceptada' })]);
    sh.respondReschedule.mockResolvedValueOnce({ status: 'aceptada' }).mockResolvedValueOnce({ status: 'vencida' }).mockResolvedValueOnce({ status: 'rechazada' });
    actions();
    expect(await screen.findByText(/Pedro propone mover la visita/)).toBeTruthy();
    expect(screen.getByText(/Motivo: Se me cruzó otra visita\./)).toBeTruthy();
    expect(screen.getByText(/propuesta tuya · Rechazada/)).toBeTruthy();
    expect(screen.getByText(/propuesta del profesional · Aceptada/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar nueva hora' }));
    expect(await screen.findByText('Listo: la visita quedó en la nueva hora.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar nueva hora' }));
    expect(await screen.findByText('La propuesta venció porque el trabajo cambió.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Rechazaste el cambio. Se mantiene la hora original.')).toBeTruthy();
  });

  it('retira su propia propuesta y muestra errores', async () => {
    sh.fetchRescheduleHistory.mockResolvedValueOnce([proposal({ proposedBy: 'c', proposerRole: 'cliente', reason: null })]);
    sh.withdrawReschedule.mockRejectedValueOnce(new Error('Ya fue respondida')).mockRejectedValueOnce('raro').mockResolvedValue(undefined);
    actions();
    expect(await screen.findByText(/Propusiste mover la visita/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirar mi propuesta' }));
    expect(await screen.findByText('Ya fue respondida')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirar mi propuesta' }));
    expect(await screen.findByText('No se pudo completar la acción.')).toBeTruthy();
    sh.fetchRescheduleHistory.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(screen.getByRole('button', { name: 'Retirar mi propuesta' }));
    expect(await screen.findByText('Retiraste tu propuesta.')).toBeTruthy();
  });

  it('cancela con motivo o vuelve atrás', async () => {
    sh.cancelJobAsClient.mockResolvedValue(undefined);
    actions({ status: 'pendiente', scheduledAt: null });
    expect(screen.getByText(/Puedes cancelar mientras el profesional no la acepte/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    fireEvent.click(screen.getByRole('button', { name: 'No, volver' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    fireEvent.change(screen.getByLabelText('¿Por qué cancelas?'), { target: { value: 'Ya lo arreglé' } });
    fireEvent.submit(screen.getByLabelText('¿Por qué cancelas?').closest('form')!);
    expect(await screen.findByText(/Solicitud cancelada/)).toBeTruthy();
    expect(sh.cancelJobAsClient).toHaveBeenCalledWith({}, { jobId: 'j-1', userId: 'c', workerId: 'w', reason: 'Ya lo arreglé' });
  });

  it('textos de cancelar según disputa o aprobación', () => {
    const first = actions({ status: 'en_progreso', disputeOpen: true, disputeOpenedBy: 'c', scheduledAt: null, workerId: null });
    expect(screen.getByText(/Abriste esta disputa/)).toBeTruthy();
    first.view.unmount();
    actions({ status: 'esperando_aprobacion_cliente', scheduledAt: null });
    expect(screen.getByText(/Si no estás conforme, puedes cancelar/)).toBeTruthy();
  });

  it('califica un trabajo completado', async () => {
    sh.rateJobAsClient.mockResolvedValue(undefined);
    actions({ status: 'completado' });
    expect(await screen.findByText('Califica a Pedro')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '1 estrella' }));
    fireEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    fireEvent.change(screen.getByLabelText('Comentario (opcional)'), { target: { value: ' Muy bien ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));
    expect(await screen.findByText(/Calificaste este trabajo con 4 estrellas\. «Muy bien»/)).toBeTruthy();
  });

  it('ya calificado con 1 estrella; error al cargar con reintento', async () => {
    sh.fetchClientRatingForJob.mockResolvedValueOnce({ score: 1, comment: null });
    const first = actions({ status: 'completado', workerId: null });
    expect(await screen.findByText('Calificaste este trabajo con 1 estrella.')).toBeTruthy();
    first.view.unmount();
    sh.fetchClientRatingForJob.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(null);
    actions({ status: 'completado' });
    expect(await screen.findByText('No se pudo cargar la valoración.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByText('No se pudo cargar la valoración.')).toBeNull());
    expect(screen.getByRole('button', { name: 'Enviar calificación' })).toBeTruthy();
  });

  it('sin acciones posibles no muestra nada; al desmontar ignora respuestas tardías', async () => {
    let release: (v: unknown) => void = () => {};
    sh.fetchRescheduleHistory.mockReturnValue(new Promise((r) => { release = r; }));
    let releaseSlots: (v: unknown) => void = () => {};
    sh.fetchWorkerFreeSlots.mockReturnValue(new Promise((r) => { releaseSlots = r; }));
    const { view } = actions({ status: 'en_progreso', scheduledAt: null });
    expect(view.container.innerHTML).toBe('');
    view.unmount();
    release([]);
    releaseSlots([]);
    let rejectRating: (e: unknown) => void = () => {};
    sh.fetchClientRatingForJob.mockReturnValue(new Promise((_r, j) => { rejectRating = j; }));
    sh.fetchRescheduleHistory.mockRejectedValue(new Error('x'));
    sh.fetchWorkerFreeSlots.mockRejectedValue(new Error('x'));
    const second = actions({ status: 'completado' });
    second.view.unmount();
    rejectRating(new Error('tarde'));
    const third = actions({ status: 'completado' });
    let resolveRating: (v: unknown) => void = () => {};
    sh.fetchClientRatingForJob.mockReturnValue(new Promise((r) => { resolveRating = r; }));
    third.view.unmount();
    resolveRating(null);
    await new Promise((r) => setTimeout(r, 0));
  });
});
