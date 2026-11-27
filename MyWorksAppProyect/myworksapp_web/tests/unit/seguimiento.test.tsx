import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/JobLocationMap', () => ({
  JobLocationMap: ({ label, worker }: { label: string; worker: { label: string } | null }) => (
    <div data-testid="mapa">{label}{worker ? ` + ${worker.label}` : ''}</div>
  ),
}));

import { TrackingDashboard } from '../../src/components/TrackingDashboard';

type Props = Parameters<typeof TrackingDashboard>[0];

function dash(over: Partial<Props> = {}) {
  const h = {
    onBack: vi.fn(), onGoHome: vi.fn(), onOpenChat: vi.fn(), onOpenNotifications: vi.fn(), onLogout: vi.fn(), onConfirmReceipt: vi.fn(),
  };
  const props: Props = {
    workerName: 'Pedro', workerProfession: 'Electricista', workerPhoto: '/p.png', workerRating: 4.7, workerJobs: 1,
    serviceTitle: 'Cambio de enchufe', serviceLocation: 'Calle 1, Puerto Montt', orderId: 'job-1234', jobStatus: 'en_camino',
    ...h, ...over,
  };
  const view = render(<TrackingDashboard {...props} />);
  return { h, view };
}

describe('seguimiento del pedido', () => {
  it('en camino con GPS: ETA, mapa con ambos pines, PIN, chat y pago', () => {
    const { h } = dash({ latitude: -41.47, longitude: -72.94, workerLatitude: -41.46, workerLongitude: -72.93, etaMinutes: 6, distanceKm: 2.3, startPin: '4821', profileName: 'ana pérez', unreadCount: 2, paymentStatus: 'retenido', paymentNotice: 'Pago confirmado' });
    expect(screen.getByText('6 min')).toBeTruthy();
    expect(screen.getByText(/A 2\.3 km/)).toBeTruthy();
    expect(screen.getByTestId('mapa').textContent).toBe('Calle 1, Puerto Montt + Pedro');
    expect(screen.getByText('4821')).toBeTruthy();
    expect(screen.getByText('ana P.')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Pago confirmado')).toBeTruthy();
    expect(screen.getByText(/1 trabajo\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles del pago' }));
    expect(screen.getByText(/Pedido job-1234\. Estado del trabajo:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalles del pago' }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir chat/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    fireEvent.click(screen.getByRole('button', { name: /^Volver$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Inicio/ }));
    expect(h.onOpenChat).toHaveBeenCalled();
    expect(h.onOpenNotifications).toHaveBeenCalled();
    expect(h.onLogout).toHaveBeenCalled();
    expect(h.onBack).toHaveBeenCalled();
    expect(h.onGoHome).toHaveBeenCalled();
  });

  it('textos de llegada sin ETA: profesional sin coordenadas del pedido, sin GPS y error', () => {
    const a = dash({ workerLatitude: -41.46, workerLongitude: -72.93, distanceKm: null });
    expect(screen.getByText('En vivo')).toBeTruthy();
    expect(screen.getByText(/no tiene coordenadas para estimar/)).toBeTruthy();
    expect(screen.getByTestId('mapa').textContent).toBe('Pedro');
    a.view.unmount();
    const b = dash({ workerRating: 0, workerJobs: 3 });
    expect(screen.getByText('Sin GPS')).toBeTruthy();
    expect(screen.getByText(/La llegada aparece cuando/)).toBeTruthy();
    expect(screen.getByText('Este pedido no tiene coordenadas.')).toBeTruthy();
    expect(screen.getByText(/Nuevo \(3 trabajos\)/)).toBeTruthy();
    expect(screen.getByText('Invitado')).toBeTruthy();
    b.view.unmount();
    dash({ gpsError: 'No hay canal de ubicación', etaMinutes: 3 });
    expect(screen.getByText('No hay canal de ubicación')).toBeTruthy();
  });

  it('ETA sin distancia muestra guion', () => {
    dash({ etaMinutes: 4 });
    expect(screen.getByText(/A — km\./)).toBeTruthy();
  });

  it('esperando aprobación: evidencia, ampliar, recibo conforme y error', () => {
    const { h } = dash({
      jobStatus: 'esperando_aprobacion_cliente',
      evidencePhotos: [{ id: '1', src: '/f1.webp' }, { id: '2', src: null }] as never,
      confirmError: 'No se pudo liberar',
      evidence: <p>panel de evidencia</p>,
      clientActions: <p>acciones del cliente</p>,
    });
    expect(screen.getByText('Video')).toBeTruthy();
    expect(screen.getByText('panel de evidencia')).toBeTruthy();
    expect(screen.getByText('acciones del cliente')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Evidencia del trabajo' }));
    expect(screen.getByAltText('Evidencia ampliada')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByAltText('Evidencia ampliada')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Evidencia del trabajo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar evidencia' }));
    expect(screen.queryByAltText('Evidencia ampliada')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recibo conforme' }));
    expect(h.onConfirmReceipt).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('No se pudo liberar');
  });

  it('esperando aprobación sin fotos lo dice; liberando el pago', () => {
    dash({ jobStatus: 'esperando_aprobacion_cliente', confirmBusy: true });
    expect(screen.getByText('Aún no hay fotos del especialista.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Liberando el pago…' })).toBeTruthy();
  });

  it('abrir disputa con motivo y detalle; éxito y errores', async () => {
    const onOpenDispute = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Ya existe')).mockRejectedValueOnce('raro');
    dash({ jobStatus: 'en_curso', onOpenDispute });
    fireEvent.click(screen.getByRole('button', { name: 'Motivo de la disputa' }));
    fireEvent.click(screen.getByRole('option', { name: 'Conducta' }));
    fireEvent.change(screen.getByPlaceholderText('Qué pasó'), { target: { value: 'Llegó tarde' } });
    const form = screen.getByPlaceholderText('Qué pasó').closest('form')!;
    fireEvent.submit(form);
    expect(await screen.findByText('Disputa abierta. El pago sigue retenido.')).toBeTruthy();
    expect(onOpenDispute).toHaveBeenCalledWith('conducta', 'Llegó tarde');
    fireEvent.submit(form);
    expect(await screen.findByText('Ya existe')).toBeTruthy();
    fireEvent.submit(form);
    expect(await screen.findByText('No se pudo abrir la disputa.')).toBeTruthy();
  });

  it('con disputa abierta: acuerdos, respuesta y comentarios', async () => {
    const onProposeAgreement = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('No permitido')).mockRejectedValueOnce('raro');
    const onRespondAgreement = vi.fn(async () => {});
    const onAddDisputeComment = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Muy largo')).mockRejectedValueOnce('raro');
    dash({ jobStatus: 'en_curso', disputeOpen: true, onProposeAgreement, onRespondAgreement, onAddDisputeComment, onOpenDispute: vi.fn(), pendingAgreement: { id: 'a', tipo: 'rehacer' } });
    expect(screen.queryByText('Abrir disputa')).toBeNull();
    expect(screen.getByText('Hay un acuerdo pendiente: rehacer el trabajo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar la entrega' }));
    expect(await screen.findByText('Acuerdo enviado. Falta que la otra parte lo confirme.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir que lo rehaga' }));
    expect(await screen.findByText('No permitido')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anular y devolver el pago' }));
    expect(await screen.findByText('No se pudo proponer el acuerdo.')).toBeTruthy();
    expect(onProposeAgreement.mock.calls.map((c) => c[0])).toEqual(['aceptar', 'rehacer', 'anular']);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar acuerdo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar acuerdo' }));
    expect(onRespondAgreement.mock.calls).toEqual([[true], [false]]);
    const box = screen.getByPlaceholderText('Agrega un detalle');
    fireEvent.change(box, { target: { value: 'Adjunto fotos' } });
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('Comentario agregado a la disputa.')).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe('');
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('Muy largo')).toBeTruthy();
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('No se pudo agregar el comentario.')).toBeTruthy();
  });

  it('etiquetas de acuerdos aceptar, anular y otros', () => {
    const { view } = dash({ jobStatus: 'en_curso', disputeOpen: true, onProposeAgreement: vi.fn(), pendingAgreement: { id: 'a', tipo: 'aceptar' } });
    expect(screen.getByText(/aceptar la entrega\./)).toBeTruthy();
    view.rerender(<TrackingDashboard workerName="P" workerProfession="x" workerPhoto="" workerRating={0} workerJobs={0} serviceTitle="s" serviceLocation="l" orderId="o" jobStatus="en_curso" disputeOpen onProposeAgreement={vi.fn()} pendingAgreement={{ id: 'a', tipo: 'anular' }} onBack={vi.fn()} onGoHome={vi.fn()} onOpenChat={vi.fn()} />);
    expect(screen.getByText(/anular y devolver el pago\./)).toBeTruthy();
    view.rerender(<TrackingDashboard workerName="P" workerProfession="x" workerPhoto="" workerRating={0} workerJobs={0} serviceTitle="s" serviceLocation="l" orderId="o" jobStatus="en_curso" disputeOpen onProposeAgreement={vi.fn()} pendingAgreement={{ id: 'a', tipo: 'mixto' }} onBack={vi.fn()} onGoHome={vi.fn()} onOpenChat={vi.fn()} />);
    expect(screen.getByText(/acuerdo pendiente: mixto\./)).toBeTruthy();
  });

  it('cerrado: completado, cancelado y revisión humana', async () => {
    const onAppealDispute = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Ya pedida')).mockRejectedValueOnce('raro');
    const { h, view } = dash({ jobStatus: 'completado', onAppealDispute });
    expect(screen.getByText('Pago liberado')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(/Diste tu conformidad/)).toBeTruthy();
    for (const b of screen.getAllByRole('button', { name: /Volver al inicio/ })) fireEvent.click(b);
    expect(h.onGoHome).toHaveBeenCalled();
    const box = screen.getByPlaceholderText('Por qué pides la revisión');
    fireEvent.change(box, { target: { value: 'El sistema se equivocó al cerrar' } });
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('Revisión pedida. El dinero no se movió otra vez.')).toBeTruthy();
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('Ya pedida')).toBeTruthy();
    fireEvent.submit(box.closest('form')!);
    expect(await screen.findByText('No se pudo pedir la revisión.')).toBeTruthy();
    view.unmount();
    dash({ jobStatus: 'cancelado', paymentNotice: 'Devolvimos el pago' });
    expect(screen.getByText('Trabajo cerrado sin cobro al profesional')).toBeTruthy();
    expect(screen.getAllByText('Devolvimos el pago').length).toBeGreaterThan(0);
    expect(screen.getByText(/se cerró sin entregar el cobro/)).toBeTruthy();
  });

  it('cancelado sin aviso y esperando pago', () => {
    const a = dash({ jobStatus: 'no_asistio' });
    expect(screen.getByText('El trabajo se anuló y el cobro retenido no se entregó al profesional.')).toBeTruthy();
    a.view.unmount();
    dash({ jobStatus: 'esperando_pago' });
    expect(screen.getByText('Todavía no hay un cobro retenido: el pedido espera el pago.')).toBeTruthy();
  });
});
