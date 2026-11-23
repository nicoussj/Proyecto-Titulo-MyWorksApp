/**
 * MyWorksApp — lectura acotada del 23 de noviembre de 2026.
 *
 * Solo lecturas contra el sitio público y el catálogo anónimo.
 * No crea usuarios, pedidos ni pagos. No llama a Transbank.
 * La clave se recibe por SUPABASE_ANON_KEY y no se escribe en el informe.
 *
 * Perfiles (techo de producción, sin réplica local):
 *   humo   1 usuario, 30 s
 *   carga  hasta 50 usuarios, cerca de dos minutos
 *   estres hasta 100 usuarios, cerca de un minuto y medio
 *
 *   k6 run -e PROFILE=humo|carga|estres \
 *     -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... -e WEB_URL=https://myworksapp.cl \
 *     --summary-export=resultados/<perfil>.json k6_lectura_23nov.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const WEB = (__ENV.WEB_URL || 'https://myworksapp.cl').replace(/\/$/, '');
const SB = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = __ENV.SUPABASE_ANON_KEY || '';
const PROFILE = (__ENV.PROFILE || 'humo').toLowerCase();

if (!SB || !KEY) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY');
}

const CATEGORIAS = ['gasfiteria', 'electricidad', 'plomeria', 'limpieza', 'pintura', 'cerrajeria'];
const IMAGEN = '/categories/gasfiteria.webp';

const http5xx = new Counter('mwa_http_5xx');
const http429 = new Counter('mwa_http_429');
const timeouts = new Counter('mwa_timeouts');

const perfiles = {
  humo: { executor: 'constant-vus', vus: 1, duration: '30s' },
  carga: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '20s', target: 50 },
      { duration: '90s', target: 50 },
      { duration: '15s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  estres: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '20s', target: 100 },
      { duration: '60s', target: 100 },
      { duration: '15s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
};

export const options = {
  scenarios: {
    lectura: { ...(perfiles[PROFILE] || perfiles.humo), exec: 'lectura' },
  },
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '15s' },
    ],
    // Umbrales holgados: sirven para que el resumen traiga p50 y p95 por recurso.
    // El corte de seguridad sigue siendo solo la tasa de error.
    'http_req_duration{name:portada}': ['p(95)<30000'],
    'http_req_duration{name:imagen_categoria}': ['p(95)<30000'],
    'http_req_duration{name:rpc_catalogo_web}': ['p(95)<30000'],
    'http_req_duration{name:rpc_catalogo_app}': ['p(95)<30000'],
    'http_reqs{name:portada}': ['count>0'],
    'http_reqs{name:imagen_categoria}': ['count>0'],
    'http_reqs{name:rpc_catalogo_web}': ['count>0'],
    'http_reqs{name:rpc_catalogo_app}': ['count>0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

const sbHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Origin: WEB,
};

function marcar(res) {
  if (res.status >= 500) http5xx.add(1);
  if (res.status === 429) http429.add(1);
  if (res.status === 0) timeouts.add(1);
}

function rpc(nombre, body, etiqueta) {
  const res = http.post(`${SB}/rest/v1/rpc/${nombre}`, JSON.stringify(body), {
    headers: sbHeaders,
    tags: { name: etiqueta },
    timeout: '20s',
  });
  marcar(res);
  return res;
}

function comoJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

export function setup() {
  const demo = rpc('demo_modo_activo', {}, 'control_demo_modo');
  const consola = http.post(`${SB}/rest/v1/rpc/consola_leer_config`, '{}', {
    headers: sbHeaders,
    tags: { name: 'control_consola_anon' },
    timeout: '20s',
    responseCallback: http.expectedStatuses(401, 403),
  });
  marcar(consola);
  console.log(`control_demo_modo_antes=${String(demo.body).trim()} status=${demo.status}`);
  console.log(`control_consola_leer_config_anon status=${consola.status}`);
  if (demo.status !== 200 || String(demo.body).trim() !== 'true') {
    throw new Error('demo_modo no está activo; se cancela la prueba para no tocar producción en otro estado');
  }
  return { demoAntes: String(demo.body).trim(), consolaStatus: consola.status };
}

export function lectura() {
  const categoria = CATEGORIAS[(__VU + __ITER) % CATEGORIAS.length];

  const portada = http.get(`${WEB}/`, {
    headers: { Accept: 'text/html', 'Accept-Encoding': 'gzip, deflate, br' },
    tags: { name: 'portada' },
    timeout: '20s',
  });
  marcar(portada);
  check(portada, {
    'portada 200': (r) => r.status === 200,
    'portada html': (r) => String(r.headers['Content-Type'] || '').includes('text/html'),
    'portada tiene raiz': (r) => (r.body || '').includes('id="root"'),
  });

  const imagen = http.get(`${WEB}${IMAGEN}`, {
    headers: { Accept: 'image/webp', 'Accept-Encoding': 'gzip, deflate, br' },
    tags: { name: 'imagen_categoria' },
    responseType: 'none',
    timeout: '20s',
  });
  marcar(imagen);
  check(imagen, {
    'imagen 200': (r) => r.status === 200,
    'imagen webp': (r) => String(r.headers['Content-Type'] || '').includes('image/webp'),
  });

  // La web pide una página de 20 (CATALOG_PAGE_SIZE).
  const web = rpc(
    'listar_profesionales_catalogo',
    {
      p_categoria: categoria,
      p_zona: null,
      p_latitud: null,
      p_longitud: null,
      p_limit: 20,
      p_offset: 0,
    },
    'rpc_catalogo_web',
  );
  const webJson = comoJson(web);
  check(web, {
    'catalogo web 200': (r) => r.status === 200,
    'catalogo web es lista': () => Array.isArray(webJson),
    'catalogo web sin correo': () =>
      Array.isArray(webJson) && webJson.every((fila) => !('correo' in fila) && !('email' in fila)),
  });

  // Camino de la app: worker_repository._fetchCatalog pide p_limit 40.
  const app = rpc(
    'listar_profesionales_catalogo',
    {
      p_categoria: categoria,
      p_latitud: null,
      p_longitud: null,
      p_limit: 40,
    },
    'rpc_catalogo_app',
  );
  const appJson = comoJson(app);
  check(app, {
    'catalogo app 200': (r) => r.status === 200,
    'catalogo app es lista': () => Array.isArray(appJson),
    'catalogo app sin correo': () =>
      Array.isArray(appJson) && appJson.every((fila) => !('correo' in fila) && !('email' in fila)),
  });

  sleep(0.8 + Math.random() * 0.4);
}

export function teardown() {
  const demo = rpc('demo_modo_activo', {}, 'control_demo_modo_despues');
  console.log(`control_demo_modo_despues=${String(demo.body).trim()} status=${demo.status}`);
  if (demo.status !== 200 || String(demo.body).trim() !== 'true') {
    throw new Error('demo_modo dejó de estar activo después de la prueba');
  }
}
