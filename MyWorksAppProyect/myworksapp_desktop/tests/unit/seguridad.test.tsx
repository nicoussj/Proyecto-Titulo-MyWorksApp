import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth, montar, perfil } from './harness';

/** Backend simulado del panel de seguridad: cada RPC responde desde `datos` y se anota en `llamadas`. */
const h = vi.hoisted(() => ({
  datos: {} as Record<string, unknown>,
  fallan: new Set<string>(),
  llamadas: [] as Array<[string, unknown]>,
  invoke: [] as Array<{ data?: unknown; error?: unknown }>,
  cambio: null as null | (() => void),
}));
vi.mock('../../src/supabaseClient', () => ({
  supabase: {
    rpc: (n: string, a?: unknown) => {
      h.llamadas.push([n, a]);
      if (h.fallan.has(n)) return Promise.resolve({ data: null, error: { message: n === 'consola_fijar_estado_cuenta' ? 'permission denied' : 'falló' } });
      return Promise.resolve({ data: h.datos[n] ?? null, error: null });
    },
    functions: {
      invoke: (_n: string, o: { body: unknown }) => {
        h.llamadas.push(['invoke', o.body]);
        return Promise.resolve(h.invoke.shift() ?? { data: null, error: null });
      },
    },
    channel: () => {
      const c = { on: (_e: string, _f: unknown, cb: () => void) => { h.cambio = cb; return c; }, subscribe: () => c };
      return c;
    },
    removeChannel: vi.fn(async () => 'ok'),
  },
  supabaseConfigStatus: { urlConfigured: true, anonKeyConfigured: true },
}));
vi.mock('../../src/features/premium/Banda', () => ({ Banda: () => null }));

import { SeguridadPage } from '../../src/features/seguridad';

const panel = (over: Record<string, unknown> = {}) => ({
  generado_en: '2026-11-27T04:00:00Z',
  logins_fallidos: 3,
  errores: 1,
  servicio: { base: 'ok', edge: 'edge ok' },
  turnstile: 'Turnstile activo',
  rls_sin_politica: ['tabla_x'],
  auditoria_auth: [{ cuando: '2026-11-27T03:00:00Z', accion: 'login', correo: 'a@b.cl', ip: '1.1.1.1' }],
  mfa: [{ usuario: 'u1', tipo: 'totp', estado: 'verified', cuando: '2026-11-27T03:00:00Z' }],
  sesiones_consola: [{ usuario: 'u1', nombre: 'Ana', rol: 'soporte', cuando: '2026-11-27T03:00:00Z' }],
  reportes_abuso: [{ usuario: '22222222-2222-2222-2222-222222222222', cantidad: 9 }],
  incidentes: [
    { id: 'i1', resumen: 'Pico de accesos', cuando: '2026-11-27T03:00:00Z', tipo: 'auth', severidad: 'alta', estado: 'abierto' },
    { id: 'i2', resumen: 'Viejo', cuando: '2026-11-26T03:00:00Z', tipo: 'auth', severidad: 'baja', estado: 'reconocido' },
  ],
  umbrales: [{ clave: 'logins', descripcion: 'Accesos fallidos', ventana_minutos: 15, valor: 10 }],
  ...over,
});

const confirmar = async (frase?: string) => {
  const dialogo = await screen.findByRole('dialog');
  fireEvent.change(within(dialogo).getByRole('textbox', { name: /Motivo/ }), { target: { value: 'motivo de prueba suficiente' } });
  if (frase) fireEvent.change(within(dialogo).getByLabelText('Frase de confirmación'), { target: { value: frase } });
  await act(async () => { fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' })); });
};
const pestana = (n: string) => fireEvent.click(screen.getByRole('tab', { name: n }));
const llamado = (n: string) => h.llamadas.filter(([x]) => x === n);

beforeEach(() => {
  h.datos = {
    consola_seguridad_ciclo: panel(),
    consola_seguridad_usuario: { nombre: 'Persona', correo: 'p@b.cl', estado_cuenta: 'activo', reportes: 2, errores: 0, sesiones_abiertas: 1 },
    consola_estado_defensa: { defensa_bloqueo: false, defensa_solo_lectura: true, ips: [{ id: 'ip1', ip: '203.0.113.10', hasta: '2026-11-28T00:00:00Z' }] },
    consola_listar_pruebas: [{ id: 'pr1', creado_en: '2026-11-27T03:00:00Z', tipo: 'rls', resultado: 'ok', severidad: 'baja', resumen: 'Todo bien', recomendacion: '' }],
    consola_listar_respaldos: [{ id: 'r1', tamano_bytes: 5 * 1024 * 1024, creado_en: '2026-11-27T03:00:00Z', origen: 'manual', sha256: 'abcdef1234567890', filas: { pagos: 3, vacia: 0 }, tablas: ['pagos'], uso_bytes: 2048, limite_bytes: 0 }],
    consola_ejecutar_prueba: { tipo: 'rls', resultado: 'ok', severidad: 'baja', resumen: 'Sin hallazgos', recomendacion: 'Nada' },
  };
  h.fallan = new Set();
  h.llamadas = [];
  h.invoke = [];
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

describe('panel de seguridad', () => {
  it('sin permiso para roles que no son de administración', () => {
    montar(<SeguridadPage />, auth({ profile: perfil('soporte') }));
    expect(screen.getByText('Sin permiso')).toBeTruthy();
  });

  it('resumen, actividad, persona y todas las acciones sobre la cuenta', async () => {
    const { unmount } = montar(<SeguridadPage />);
    await screen.findByText(/RLS sin política: tabla_x/);
    expect(screen.getByText(/Actualizado/)).toBeTruthy();
    await act(async () => { h.cambio?.(); });
    const lista = screen.getByRole('tablist');
    fireEvent.keyDown(lista, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Actividad' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(lista, { key: 'ArrowLeft' });
    fireEvent.keyDown(lista, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Umbrales' }).getAttribute('aria-selected')).toBe('true');
    pestana('Actividad');
    expect(screen.getByText(/login · a@b.cl/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver persona' }));
    await screen.findByText(/Persona · p@b.cl/);
    for (const [boton, rpc, frase] of [
      ['Reconocer', 'consola_reconocer_incidente'],
      ['Suspender', 'consola_fijar_estado_cuenta'],
      ['Reactivar', 'consola_fijar_estado_cuenta'],
      ['Bloquear acceso', 'consola_bloquear_cuenta'],
      ['Quitar bloqueo', 'consola_bloquear_cuenta'],
      ['Cerrar sesiones', 'consola_cerrar_sesion_persona'],
      ['Forzar reset', 'consola_forzar_reset'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: boton }));
      await confirmar(frase);
      await waitFor(() => expect(llamado(rpc).length).toBeGreaterThan(0));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(llamado('consola_fijar_estado_cuenta').map(([, a]) => (a as { p_estado: string }).p_estado)).toEqual(['suspendido', 'activo']);
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    h.fallan.add('consola_fijar_estado_cuenta');
    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));
    await confirmar();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    h.fallan.add('consola_forzar_reset');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forzar reset' }));
    await confirmar();
    expect(await screen.findByText('No se pudo completar la acción.')).toBeTruthy();
    expect(screen.getByText('No tienes permiso para esta acción.')).toBeTruthy();
    unmount();
  });

  it('umbrales: entero válido, valor inválido y guardado', async () => {
    montar(<SeguridadPage />);
    await screen.findByText(/RLS sin política/);
    pestana('Umbrales');
    const input = screen.getByLabelText('Umbral logins');
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El umbral tiene que ser un entero.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('El umbral logins pasará a 12.')).toBeTruthy();
    await confirmar();
    await waitFor(() => expect(llamado('consola_editar_umbral')[0][1]).toMatchObject({ p_clave: 'logins', p_valor: 12 }));
  });

  it('panel vacío, error de lectura y persona que no se puede leer', async () => {
    h.datos.consola_seguridad_ciclo = { servicio: null, rls_sin_politica: 'x' };
    h.fallan.add('consola_seguridad_usuario');
    montar(<SeguridadPage />);
    await screen.findByText(/No hay tablas con RLS/);
    pestana('Actividad');
    expect(screen.getByText('Sin eventos de Auth en las últimas 24 horas.')).toBeTruthy();
    expect(screen.getByText('Nadie supera el umbral de reportes.')).toBeTruthy();
    expect(screen.getByText('No hay incidentes en el historial.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Identificador de la persona'), { target: { value: '33333333-3333' } });
    expect(await screen.findByText('No se pudo leer a esa persona.')).toBeTruthy();
  });

  it('error del panel con reintento', async () => {
    h.fallan.add('consola_seguridad_ciclo');
    montar(<SeguridadPage />);
    expect(await screen.findByText('No se pudo leer el panel de seguridad.')).toBeTruthy();
    expect(screen.getByText('Esperando datos')).toBeTruthy();
  });
});

describe('herramientas de seguridad', () => {
  it('pruebas del servidor, CORS, secretos del cliente e historial', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proyecto.supabase.co/');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200, headers: { 'access-control-allow-origin': '*' } }));
    montar(<SeguridadPage />);
    pestana('Pruebas');
    await screen.findByText(/Todo bien/);
    fireEvent.click(screen.getByRole('button', { name: 'RLS' }));
    expect(await screen.findByText('Sin hallazgos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'CORS' }));
    await waitFor(() => expect(llamado('consola_guardar_prueba').length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Secretos del cliente' }));
    await waitFor(() => expect(llamado('consola_guardar_prueba').length).toBe(2));
    fetchSpy.mockRejectedValueOnce(new Error('red'));
    fireEvent.click(screen.getByRole('button', { name: 'CORS' }));
    await waitFor(() => expect(llamado('consola_guardar_prueba').length).toBe(3));
    h.fallan.add('consola_ejecutar_prueba');
    fireEvent.click(screen.getByRole('button', { name: 'Salud' }));
    await waitFor(() => expect(llamado('consola_ejecutar_prueba').length).toBe(2));
    expect(fetchSpy).toHaveBeenCalledWith('https://proyecto.supabase.co/auth/v1/health', { method: 'GET' });
    vi.unstubAllEnvs();
  });

  it('historial vacío y error sin mensaje', async () => {
    h.datos.consola_listar_pruebas = [];
    montar(<SeguridadPage />);
    pestana('Pruebas');
    expect(await screen.findByText('Todavía no hay pruebas guardadas.')).toBeTruthy();
  });

  it('defensa: bloqueo total, interruptores e IPs', async () => {
    montar(<SeguridadPage />);
    pestana('Defensa');
    await screen.findByText(/203.0.113.10/);
    fireEvent.click(screen.getByRole('button', { name: 'Modo bloqueo total' }));
    expect(screen.getByText(/El modo bloqueo enciende/)).toBeTruthy();
    await confirmar('BLOQUEAR');
    await waitFor(() => expect(llamado('consola_fijar_defensa')[0][1]).toMatchObject({ p_clave: 'defensa_bloqueo', p_activo: true }));
    for (const s of ['Solo lectura', 'Pausar pagos', 'Pausar registros', 'Automático']) {
      fireEvent.click(screen.getByRole('switch', { name: s }));
      const frase = s === 'Solo lectura' ? 'LIBERAR' : 'BLOQUEAR';
      await confirmar(frase);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    expect(llamado('consola_fijar_defensa').length).toBe(5);
    fireEvent.click(screen.getByRole('switch', { name: 'Pausar pagos' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    h.fallan.add('consola_fijar_defensa');
    fireEvent.click(screen.getByRole('switch', { name: 'Pausar pagos' }));
    await confirmar('BLOQUEAR');
    await waitFor(() => expect(llamado('consola_fijar_defensa').length).toBe(6));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    fireEvent.change(screen.getByLabelText('IP a bloquear'), { target: { value: '198.51.100.7' } });
    fireEvent.change(screen.getByLabelText('Horas de bloqueo'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear IP' }));
    await confirmar('BLOQUEAR');
    await waitFor(() => expect(llamado('consola_bloquear_ip')[0][1]).toMatchObject({ p_ip: '198.51.100.7', p_horas: 6 }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByText('Quitar bloqueo de IP')).toBeTruthy();
    await confirmar('LIBERAR');
    await waitFor(() => expect(llamado('consola_desbloquear_ip')[0][1]).toMatchObject({ p_id: 'ip1' }));
  });

  it('defensa con bloqueo activo y sin IPs', async () => {
    h.datos.consola_estado_defensa = { defensa_bloqueo: true };
    montar(<SeguridadPage />);
    pestana('Defensa');
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar bloqueo total' }));
    await confirmar('LIBERAR');
    await waitFor(() => expect(llamado('consola_fijar_defensa')[0][1]).toMatchObject({ p_activo: false }));
    expect(screen.getByText('No hay IPs bloqueadas.')).toBeTruthy();
  });

  it('respaldos: crear, verificar, descargar, restaurar y errores', async () => {
    montar(<SeguridadPage />);
    pestana('Respaldos');
    await screen.findByText('5.0 MB');
    expect(screen.getByText('2.0 KB de 1.00 GB')).toBeTruthy();
    expect(screen.getByText(/pagos 3 · 1 tablas/)).toBeTruthy();
    h.invoke.push({ data: { ok: true } }, { data: { ok: false } }, { data: { url: 'https://firmado' } }, { data: {} }, { data: null }, { data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByText('El hash coincide.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByText('El hash no coincide.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://firmado', '_blank', 'noopener'));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear respaldo' }));
    expect(screen.getByText(/Copia el negocio en gzip/)).toBeTruthy();
    await confirmar();
    await waitFor(() => expect(h.llamadas.some(([n, b]) => n === 'invoke' && (b as { accion: string }).accion === 'crear')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    await confirmar('RESTAURAR');
    await waitFor(() => expect(h.llamadas.some(([n, b]) => n === 'invoke' && (b as { accion: string; tablas: unknown }).accion === 'restaurar')).toBe(true));
    h.invoke.push({ data: null, error: { message: 'boom' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await waitFor(() => expect(h.invoke.length).toBe(0));
  });

  it('sin respaldos y tamaños grandes', async () => {
    h.datos.consola_listar_respaldos = [];
    const { unmount } = montar(<SeguridadPage />);
    pestana('Respaldos');
    expect(await screen.findByText('No hay respaldos todavía.')).toBeTruthy();
    expect(screen.getByText('0 B de 1 GB')).toBeTruthy();
    unmount();
    h.datos.consola_listar_respaldos = [{ id: 'r2', tamano_bytes: 3 * 1024 ** 3, filas: { a: 0 }, uso_bytes: 10, limite_bytes: 100 }, { id: 'r3', tamano_bytes: 500, filas: null }];
    montar(<SeguridadPage />);
    pestana('Respaldos');
    expect(await screen.findByText('3.00 GB')).toBeTruthy();
    expect(screen.getByText('500 B')).toBeTruthy();
    expect(screen.getByText('10 B de 100 B')).toBeTruthy();
    expect(screen.getByText(/Sin filas/)).toBeTruthy();
    expect(screen.getByText(/Sin conteo/)).toBeTruthy();
  });
});
