import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactBlockedMessage, contactBlockedTitle, type JobMessage } from '@myworksapp/shared';
import { createFakeSupabase } from './fakeSupabase';

const fake = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./fakeSupabase').createFakeSupabase> }));
vi.mock('../../src/supabaseClient', () => ({
  get supabase() {
    return fake.current!.client;
  },
}));
const sh = vi.hoisted(() => ({
  fetchJobMessages: vi.fn(),
  sendJobMessage: vi.fn(),
  saveJobEvidence: vi.fn(),
  signedEvidenceUrl: vi.fn(),
}));
vi.mock('@myworksapp/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@myworksapp/shared')>()),
  ...sh,
}));

import { LiveChatWidget } from '../../src/components/LiveChatWidget';
import { JobEvidencePanel } from '../../src/components/JobEvidencePanel';

const msg = (id: string, senderId: string, content: string): JobMessage => ({
  id, jobId: 'j-1', senderId, receiverId: senderId === 'c' ? 'p' : 'c', content, createdAt: '2026-11-26 12:00:00',
});

let onInsert: (p: unknown) => void = () => {};

beforeEach(() => {
  fake.current = createFakeSupabase();
  const ch: Record<string, unknown> = {};
  ch.on = (_e: string, _f: unknown, cb: (p: unknown) => void) => { onInsert = cb; return ch; };
  ch.subscribe = () => ch;
  fake.current.client.channel.mockReturnValue(ch as never);
  for (const f of Object.values(sh)) f.mockReset();
});

describe('chat del pedido', () => {
  it('sin sesión invita a entrar y no deja escribir', () => {
    const onClose = vi.fn();
    render(<LiveChatWidget workerName="Pedro" workerPhoto="/p.png" jobId={null} senderId={null} receiverId={null} onClose={onClose} />);
    expect(screen.getByText('Inicia sesión para escribir')).toBeTruthy();
    expect(screen.getByText(/Entra con tu cuenta de cliente/)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar chat' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('carga mensajes, recibe en vivo sin duplicar y envía con Enter', async () => {
    sh.fetchJobMessages.mockResolvedValue([msg('1', 'p', 'Hola, voy en camino')]);
    sh.sendJobMessage.mockResolvedValue(msg('2', 'c', 'Gracias'));
    const { container, unmount } = render(<LiveChatWidget workerName="Pedro" workerPhoto="/p.png" jobId="j-1" senderId="c" receiverId="p" onClose={() => {}} />);
    expect(screen.getByText('Cargando mensajes…')).toBeTruthy();
    expect(await screen.findByText('Hola, voy en camino')).toBeTruthy();
    expect(container.querySelector('.chat-bubble--worker')).toBeTruthy();
    act(() => onInsert({ new: { id: '1', id_trabajo: 'j-1', id_remitente: 'p', contenido: 'Hola, voy en camino' } }));
    act(() => onInsert({ new: { id: '3', id_trabajo: 'j-1', id_remitente: 'p', contenido: 'Llegué' } }));
    act(() => onInsert({ new: null }));
    expect(screen.getAllByText(/Hola, voy en camino|Llegué/)).toHaveLength(2);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(sh.sendJobMessage).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  Gracias  ' } });
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Gracias')).toBeTruthy();
    expect(sh.sendJobMessage).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jobId: 'j-1', senderId: 'c', receiverId: 'p', content: 'Gracias' }));
    expect(container.querySelector('.chat-bubble--user')).toBeTruthy();
    unmount();
    expect(fake.current!.client.removeChannel).toHaveBeenCalled();
    act(() => onInsert({ new: { id: '9', id_trabajo: 'j-1', contenido: 'tarde' } }));
  });

  it('muestra el bloqueo de contacto y otros errores', async () => {
    sh.fetchJobMessages.mockResolvedValue([]);
    sh.sendJobMessage.mockRejectedValueOnce(new Error('mensaje bloqueado')).mockRejectedValueOnce(new Error('permission denied'));
    render(<LiveChatWidget workerName="Pedro" workerPhoto="/p.png" jobId="j-1" senderId="c" receiverId="p" onClose={() => {}} />);
    expect(await screen.findByText('Todavía no hay mensajes en este trabajo.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mi cel 912345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(contactBlockedTitle)).toBeTruthy();
    expect(screen.getByText(contactBlockedMessage)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('No se envió. Inicia sesión con la cuenta del pedido.')).toBeTruthy();
  });

  it('si la carga falla lo avisa; si se cierra antes, no actualiza', async () => {
    sh.fetchJobMessages.mockRejectedValueOnce(new Error('x'));
    const first = render(<LiveChatWidget workerName="P" workerPhoto="" jobId="j-1" senderId="c" receiverId="p" onClose={() => {}} />);
    expect(await screen.findByText('No se pudieron cargar los mensajes.')).toBeTruthy();
    first.unmount();
    let release: (v: unknown) => void = () => {};
    sh.fetchJobMessages.mockReturnValueOnce(new Promise((r) => { release = r; }));
    const second = render(<LiveChatWidget workerName="P" workerPhoto="" jobId="j-2" senderId="c" receiverId="p" onClose={() => {}} />);
    second.unmount();
    release([msg('1', 'p', 'tarde')]);
    let reject: (e: unknown) => void = () => {};
    sh.fetchJobMessages.mockReturnValueOnce(new Promise((_r, j) => { reject = j; }));
    const third = render(<LiveChatWidget workerName="P" workerPhoto="" jobId="j-3" senderId="c" receiverId="p" onClose={() => {}} />);
    third.unmount();
    reject(new Error('tarde'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('tarde')).toBeNull();
  });
});

describe('evidencia del trabajo', () => {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(72 * 4).fill(128) }),
  };
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4, height: 3, close: vi.fn() })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(new Blob(['webp'], { type: 'image/webp' })); });
    sh.signedEvidenceUrl.mockImplementation(async (_s: unknown, path: string) => (path.includes('sin-url') ? null : `https://example.test/${path}`));
    sh.saveJobEvidence.mockImplementation(async (_s: unknown, _i: unknown, onProgress: (n: number) => void) => onProgress(1));
  });
  afterEach(() => vi.unstubAllGlobals());

  const rows = [
    { id: 'f1', ruta_foto: 'trabajos/j-1/f1.webp', tipo_medio: 'imagen', confianza: 'confiable' },
    { id: 'f2', ruta_foto: 'trabajos/j-1/f2.mp4', tipo_medio: 'video', confianza: null },
    { id: 'f3', ruta_foto: 'trabajos/j-1/f3.webp', tipo_medio: 'imagen', confianza: 'no_confiable' },
    { id: 'f4', ruta_foto: 'https://otro.sitio/x.png', tipo_medio: 'imagen', confianza: null },
    { id: 'f5', ruta_foto: 'trabajos/j-1/sin-url.webp', tipo_medio: 'imagen', confianza: null },
    { id: 'f6', ruta_foto: null, tipo_medio: 'imagen', confianza: null },
  ];

  it('lista fotos y videos firmados y marca cuáles están verificadas', async () => {
    fake.current!.state.responder = () => ({ data: rows });
    const { container } = render(<JobEvidencePanel jobId="j-1" userId="c" />);
    expect(await screen.findByText('Verificada')).toBeTruthy();
    expect(screen.getByText('No verificada')).toBeTruthy();
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(screen.getAllByAltText('Evidencia del trabajo')).toHaveLength(2);
  });

  it('sube una foto: hash del original, WebP, luma y registro de procedencia', async () => {
    fake.current!.state.responder = () => ({ data: [] });
    render(<JobEvidencePanel jobId="j-1" userId="c" />);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    const photo = new File([new Uint8Array([1, 2, 3])], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [photo] } });
    await waitFor(() => expect(fake.current!.state.queries.some((q) => q.table === 'rpc:registrar_evidencia_web')).toBe(true));
    const call = fake.current!.state.queries.find((q) => q.table === 'rpc:registrar_evidencia_web')!;
    const args = call.ops[0][1][0] as Record<string, unknown>;
    expect(args).toMatchObject({ p_id_trabajo: 'j-1', p_tipo: 'detalle', p_metadata: expect.objectContaining({ nombre: 'foto.jpg', tipo: 'image/jpeg' }) });
    expect(args.p_hash_original).not.toBe(args.p_hash_sha256);
    expect(String(args.p_luma)).toMatch(/^\\x[0-9a-f]+$/);
    expect(sh.saveJobEvidence.mock.calls[0][1]).toMatchObject({ mime: 'image/webp' });
  });

  it('sube un video y una foto WebP sin convertir', async () => {
    fake.current!.state.responder = () => ({ data: [] });
    render(<JobEvidencePanel jobId="j-1" userId="c" />);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['v'], 'v.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(sh.saveJobEvidence).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Agregar evidencia')).toBeTruthy());
    const videoArgs = fake.current!.state.queries.find((q) => q.table === 'rpc:registrar_evidencia_web')!.ops[0][1][0] as Record<string, unknown>;
    expect(videoArgs).toMatchObject({ p_tipo: 'video', p_luma: null });
    expect(videoArgs.p_hash_original).toBe(videoArgs.p_hash_sha256);
    fireEvent.change(input, { target: { files: [new File(['w'], 'w.webp', { type: 'image/webp' })] } });
    await waitFor(() => expect(sh.saveJobEvidence).toHaveBeenCalledTimes(2));
    fireEvent.change(input, { target: { files: [new File(['w'], 'sin-tipo', { type: '' })] } });
    await waitFor(() => expect(sh.saveJobEvidence).toHaveBeenCalledTimes(3));
  });

  it('errores: lectura, procedencia, canvas y conversión', async () => {
    const { state } = fake.current!;
    state.responder = () => ({ data: null, error: { message: 'x' } });
    const view = render(<JobEvidencePanel jobId="j-1" userId="c" />);
    expect(await screen.findByText('No se pudo leer la evidencia')).toBeTruthy();
    state.responder = () => ({ data: [] });
    state.rpc = () => ({ error: { message: 'x' } });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['v'], 'v.mp4', { type: 'video/mp4' })] } });
    expect(await screen.findByText('La evidencia quedó guardada como no verificada.')).toBeTruthy();
    state.rpc = () => ({ data: null });
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(function (cb: BlobCallback) { cb(null); });
    fireEvent.change(input, { target: { files: [new File(['p'], 'p.png', { type: 'image/png' })] } });
    expect(await screen.findByText('No se pudo convertir la foto a WebP')).toBeTruthy();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    fireEvent.change(input, { target: { files: [new File(['p'], 'p.png', { type: 'image/png' })] } });
    expect(await screen.findByText('No se pudo leer la foto')).toBeTruthy();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(((kind: string, opts?: unknown) => (opts ? ctx : null)) as never);
    fireEvent.change(input, { target: { files: [new File(['p'], 'p.png', { type: 'image/png' })] } });
    expect(await screen.findByText('No se pudo preparar la foto')).toBeTruthy();
    sh.saveJobEvidence.mockRejectedValueOnce('raro');
    fireEvent.change(input, { target: { files: [new File(['v'], 'v.mp4', { type: 'video/mp4' })] } });
    expect(await screen.findByText('No se pudo subir la evidencia')).toBeTruthy();
    view.unmount();
  });

  it('cerrado sin evidencia lo dice y no permite subir', async () => {
    fake.current!.state.responder = () => ({ data: [] });
    render(<JobEvidencePanel jobId="j-1" userId="c" readOnly />);
    expect(await screen.findByText('Este trabajo se cerró sin evidencia.')).toBeTruthy();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('cerrado con evidencia solo la muestra', async () => {
    fake.current!.state.responder = () => ({ data: rows.slice(0, 1) });
    render(<JobEvidencePanel jobId="j-1" userId="c" readOnly />);
    expect(await screen.findByText('Verificada')).toBeTruthy();
    expect(screen.queryByText('Este trabajo se cerró sin evidencia.')).toBeNull();
  });
});
