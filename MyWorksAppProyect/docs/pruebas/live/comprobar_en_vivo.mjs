/**
 * Lectura en vivo de la web publicada y del catálogo.
 * No escribe. Guarda tiempos y conteos, no la clave.
 *
 * Uso, desde MyWorksAppProyect:
 *   node docs/pruebas/live/comprobar_en_vivo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const example = readFileSync(resolve(root, 'myworksapp_web/.env.example'), 'utf8');
const pick = (name) => {
  const line = example.split('\n').find((row) => row.startsWith(`${name}=`));
  if (!line) throw new Error(`falta ${name}`);
  return line.slice(name.length + 1).trim();
};

const supabaseUrl = process.env.SUPABASE_URL || pick('VITE_SUPABASE_URL');
const anonKey = process.env.SUPABASE_ANON_KEY || pick('VITE_SUPABASE_ANON_KEY');
const web = process.env.LIVE_WEB_URL || 'https://myworksapp-cl.vercel.app';

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
};

async function timed(name, run) {
  const start = performance.now();
  const result = await run();
  return { name, ms: Math.round(performance.now() - start), ...result };
}

const home = await timed('portada', async () => {
  const response = await fetch(web);
  const html = await response.text();
  return {
    status: response.status,
    bytes: Buffer.byteLength(html),
    tieneRoot: html.includes('id="root"'),
    pideTarjeta: /cc-number|número de tarjeta/i.test(html),
    cache: response.headers.get('x-vercel-cache'),
  };
});

const categorias = await timed('oficios', async () => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/categorias_con_disponibles`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const data = await response.json();
  return {
    status: response.status,
    oficios: Array.isArray(data) ? data : [],
  };
});

const ids = new Set();
const porOficio = [];
for (const oficio of categorias.oficios) {
  let cursor = null;
  let filas = 0;
  let paginas = 0;
  for (let page = 0; page < 25; page += 1) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/listar_profesionales_catalogo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_categoria: oficio,
        p_limit: 40,
        p_cursor_calificacion: cursor?.calificacion ?? null,
        p_cursor_id: cursor?.id ?? null,
      }),
    });
    if (!response.ok) {
      porOficio.push({ oficio, error: response.status });
      break;
    }
    const rows = await response.json();
    paginas += 1;
    if (!Array.isArray(rows) || rows.length === 0) break;
    filas += rows.length;
    for (const row of rows) ids.add(row.id_usuario);
    const last = rows[rows.length - 1];
    cursor = { calificacion: last.calificacion, id: last.id_usuario };
    if (rows.length < 40) break;
  }
  porOficio.push({ oficio, filas, paginas });
}

const catalogo = await timed('catalogo_primer_oficio', async () => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/listar_profesionales_catalogo`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_categoria: categorias.oficios[0] ?? 'Gasfitería', p_limit: 20 }),
  });
  const rows = await response.json();
  return {
    status: response.status,
    filas: Array.isArray(rows) ? rows.length : 0,
  };
});

const informe = {
  cuando: new Date().toISOString(),
  web,
  proyecto: new URL(supabaseUrl).host,
  portada: home,
  oficios: { ms: categorias.ms, status: categorias.status, lista: categorias.oficios },
  profesionalesDistintosEnCatalogo: ids.size,
  porOficio,
  unaConsultaGasfiteria: catalogo,
  nota: 'Conteo de fichas visibles en el catálogo público. No es una prueba de carga ni el máximo que la base puede guardar.',
};

const outDir = resolve(here, 'resultados');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'live_20261116.json');
writeFileSync(out, `${JSON.stringify(informe, null, 2)}\n`);
console.log(JSON.stringify({
  portada_ms: home.ms,
  portada_status: home.status,
  cache: home.cache,
  oficios: categorias.oficios.length,
  profesionales: ids.size,
  gasfiteria_ms: catalogo.ms,
  gasfiteria_filas: catalogo.filas,
  archivo: out,
}, null, 2));
