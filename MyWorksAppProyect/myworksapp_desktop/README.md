# Consola de escritorio MyWorksApp

Back office de la empresa: clientes, profesionales, pedidos, pagos en garantía, disputas, equipo y salud del sistema. Es una app Tauri 2 con interfaz React. La autorización de verdad está en Postgres (`is_admin()`, `rol_consola()`) y en las Edge Functions, no en la pantalla.

## Cómo correrla

Desde `MyWorksAppProyect/myworksapp_desktop`, con las dependencias de `shared/` instaladas:

```bash
npm run dev
```

Eso abre Vite en `http://127.0.0.1:3001`. La app instalada se arma con `npm run tauri:dev` o `npm run tauri:build`.

## Variables

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto. Sin ella la consola no entra. |
| `VITE_SUPABASE_ANON_KEY` | Clave publicable. Nunca la `service_role`. |
| `VITE_AUTH_REDIRECT_URL` | A dónde vuelve el correo de recuperación. En la app instalada, si no se define, se usa `myworksapp-admin://auth/callback`. |
| `INVITE_REDIRECT_URL` | Secreto de la función `invitar-colaborador`. La consola también puede pedir el deep link, que la función acepta junto con `http://127.0.0.1:3001` y `http://localhost:3001`. |

Transbank está en integración. Khipu y Fintoc no están conectados.

## Publicación

El actualizador consulta `https://github.com/nicoussj/Proyecto-Titulo-MyWorksApp/releases/latest/download/latest.json` al abrir la app instalada. La clave pública está en `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). La clave privada y su contraseña no están en el repositorio: van como secrets `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Comisión

`comision_servicio_clp` cobra 5 % con un mínimo de $1.000.

## Bitácora

La migración `20261120130000_auditoria_consola.sql` está aplicada. La tabla `auditoria_consola`, las RPC de la consola y el bloqueo que impide borrar o editar la bitácora fuera de esas funciones ya existen. Cada acción queda registrada ahí.

## Ajustes y disputas abiertas

La migración `20261120210000_consola_lectura_config_y_disputas.sql` agrega `consola_leer_config()` (solo quien pasa `is_admin()`) y amplía `consola_disputas_abiertas` con los estados `abierta` y `en_revision`. Hay que aplicarla en la base para que Ajustes deje de responder 403 y la cola muestre las disputas abiertas.

## Deep link

Esquema `myworksapp-admin`, ruta `auth/callback`. Sirve para definir la contraseña después de una invitación o de recuperar la clave, sin depender de que el servidor de desarrollo esté encendido. En Windows, si la app ya está abierta, `tauri-plugin-single-instance` reenvía esa URL a la ventana existente.

## Roles

Entran `administrador`, `soporte` y `qa`, con cuenta activa y segundo factor. Si `admin_requiere_aal2` es 1, `is_admin()` y `rol_consola()` rechazan una sesión `aal1`. Soporte no mueve dinero ni ve los KPI financieros. QA lee colas, pedidos y errores, sin evidencia de disputas.
