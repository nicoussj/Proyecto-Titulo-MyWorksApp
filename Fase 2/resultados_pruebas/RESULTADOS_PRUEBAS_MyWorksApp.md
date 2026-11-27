# Resultados de pruebas – MyWorksApp

Fecha: 27 de noviembre de 2026 (hora de Chile). Rama: `fix/cero-errores-presentacion`, SHA b0061c0.
Alcance: aplicación móvil (Flutter), sitio web, consola de escritorio y Edge Functions de Supabase.
Todas las pruebas usan backends simulados o locales; ninguna escribe en la base de datos de producción.

## 1. Resumen

| Parte | Herramienta | Pruebas | Cobertura de líneas antes | Cobertura de líneas después | Estado |
|---|---|---|---|---|---|
| App móvil | flutter test | 2190 aprobadas, 6 omitidas, 0 fallidas | 92,21 % | 92,90 % (23.927 de 25.755 líneas) | analyze sin errores ni warnings |
| Sitio web | vitest + Playwright | 229 unitarias + 28 e2e | 3 de 56 archivos con pruebas | 99,83 % | lint, build y e2e OK |
| Consola | vitest + node:test + Playwright | 319 unitarias (47 de lógica con node:test) + 3 e2e | pantallas 0 % (solo lógica medida) | 93,06 % | lint, tsc, build y e2e OK |
| Edge Functions | deno test | 72 (147 pasos) | 15,2 % (módulos `_shared` 37,3 %; handlers 0 %) | 74,8 % (`_shared` 99,9 %) | deno check OK |

Todas las suites terminan con código de salida 0.

## 2. App móvil (Flutter)

**Qué se prueba.** Pantallas de cliente, trabajador y administración montadas con un Supabase simulado (`test/support/fake_supabase.dart`), flujos de registro, pedidos, pagos con Transbank simulado, cámara de evidencia, notificaciones push, geolocalización y la versión web.

**Resultado.** `flutter analyze`: 0 errores y 0 warnings. Quedan avisos informativos: casi todos son `deprecated_member_use` de Material en el SDK 3.50 y no afectan el funcionamiento. `flutter test --coverage`: 2190 aprobadas, 6 omitidas, 0 fallidas.

**Cobertura.** Subió de 92,21 % (23.749 de 25.755 líneas) a 92,90 % (23.927 de 25.755 líneas). La medición une dos corridas: la normal y una con las variables de push habilitadas, porque ese código solo se ejecuta con esas variables.

**Qué no queda cubierto y por qué.** Las líneas sin cubrir están en pantallas grandes como `worker_list_page`, `job_detail_workflows`, `service_request_page` y `job_detail_status`. Son ramas que dependen de:

- permisos nativos del dispositivo;
- mapas y cámara reales;
- respuestas de red poco comunes.

Simularlas exigiría cambiar código de la app, y la regla del proyecto es no cambiar funcionalidades.

**Errores encontrados y corregidos.**

- B11: la cámara de evidencia no soltaba el video al levantar el dedo.
- B12: el aviso de permisos mostraba el texto técnico "Bad state:".
- B13: la animación del disparador fallaba con una aserción de BoxDecoration.

Para B11 y B13 se guarda la falla anterior al arreglo en `app/camara_regresion_antes_del_arreglo.txt`.

## 3. Sitio web

**Qué se prueba.** Componentes, páginas, formularios, mapa (OpenFreeMap) y utilidades, con vitest y Testing Library. También recorridos e2e en escritorio y móvil con Playwright.

**Resultado.**

- 229 pruebas unitarias aprobadas, con 99,83 % de líneas, 94,16 % de ramas y 99,38 % de funciones.
- 28 pruebas e2e aprobadas y 1 omitida.
- Lint sin warnings y build correcto.

**Qué no queda cubierto.** Unas pocas líneas defensivas: errores del navegador que no se pueden provocar en jsdom.

## 4. Consola de escritorio

**Qué se prueba.**

- La lógica de permisos, formato, CSV, sesión, enlaces de autenticación, seguridad y modelo premium.
- Las pantallas: listas, filtros, diálogos de confirmación, enmascarado de datos, segundo factor (QR TOTP) y captura.

Las pruebas de lógica escritas con `node:test` se miden con la misma herramienta (vitest) mediante un puente, así que la cifra cubre todo el código.

**Resultado.**

- 319 pruebas aprobadas, con 93,06 % de líneas, 91,02 % de sentencias, 82,48 % de ramas y 88,19 % de funciones.
- E2E: 3 aprobadas, que recorren cada sección en tema claro y oscuro, con capturas.
- 2 e2e omitidas por diseño, porque necesitan un Supabase local (`E2E_SUPABASE_LOCAL=1`).
- Lint sin warnings, `tsc` y build correctos.

**Antes.** Solo se ejecutaban las pruebas de lógica (`node:test`); las pantallas tenían 0 % de cobertura.

**Qué no queda cubierto y por qué.** `screens.tsx` queda en 83 %. Faltan los diálogos de:

- suspender cuenta;
- liquidaciones con cuenta bancaria;
- acciones de equipo;
- ajustes.

Dependen de combinaciones de datos de producción que no se pueden reproducir sin escribir en la base real.

**Error encontrado y corregido.** B14: el botón "Secretos del cliente" fallaba con TypeError por las banderas booleanas de Vite. La falla anterior al arreglo está en `consola/secretos_regresion_antes_del_arreglo.txt`.

## 5. Edge Functions (Supabase)

**Qué se prueba.**

- Los 33 módulos compartidos (`_shared`): CORS, límites de tasa, tickets firmados, Transbank, reembolsos, pagos y notificaciones.
- Los 19 handlers, con una prueba de humo que levanta cada `index.ts` sobre un backend simulado. Simula Supabase, Transbank, Resend y Google en tres modos: anónimo, usuario autenticado y backend con falla.

**Resultado.**

- 72 pruebas y 147 pasos aprobados.
- `deno check` sin errores.
- `deno lint` de las pruebas nuevas sin errores.

**Cobertura.**

- Total: de 15,2 % a 74,8 % de líneas sobre los 52 archivos.
- `_shared`: de 37,3 % a 99,9 %.
- Handlers: de 0 % a entre 39 % y 87 % cada uno.

**Qué no queda cubierto y por qué.**

- En `_shared` quedan 3 líneas defensivas que no se pueden alcanzar: un puerto mayor a 65535, que el parser de URL ya rechaza, y una rama de `refund_once`.
- En los handlers faltan sobre todo `guest-checkout`, `oneclick-charge` e `invitar-colaborador`. Sus caminos completos requieren respuestas reales de Transbank y de la base de datos. Se cubren con pruebas de los módulos `_shared` que esos handlers usan.

## 6. Integración continua (CI)

- En `main`, Flutter CI, Web & Desktop CI y Gitleaks terminaron en verde el 26-11-2026.
- Los flujos solo se disparan en `main`, `master`, `develop` o en pull requests, así que la rama no tiene ejecuciones propias.
- Se reprodujeron localmente los mismos pasos de Web & Desktop CI con Node 22, y todos terminaron con código 0.
- Se dejó preparado un parche de flujos que agrega la rama y un flujo para Edge Functions: `propuesta_parches/ci_workflows_rama_fix.patch`.

## 7. Evidencias

Todas están en `evidencias_tests/`:

- `app/`: `flutter_analyze.txt`, `flutter_test_completo.txt`, `lcov.info`, `cobertura_html/` y las regresiones.
- `web/`: `vitest_cobertura.txt`, `lint.txt`, `build.txt`, `cobertura_html/` y `e2e/`.
- `consola/`: `vitest_cobertura.txt`, `npm_test_node_y_vitest.txt`, `lint.txt`, `build.txt`, `e2e_playwright.txt`, `e2e_capturas/` y `cobertura_html/`.
- `funciones/`: `deno_test_despues.txt`, `cobertura_antes.txt`, `cobertura_antes_todos_los_archivos.txt`, `cobertura_despues.txt`, `lcov_despues.info`, `cobertura_html/`, `deno_check.txt` y `deno_lint_pruebas_nuevas.txt`.
- `ci/`: ejecuciones de GitHub Actions y la reproducción local.
