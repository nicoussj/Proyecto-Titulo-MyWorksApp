# Sprint backlog — Fase 3

La ventana del Sprint 10 (cierre de la Fase 2) terminó el 22 de noviembre de 2026. La fase vigente es la Fase 3, Sprint 11: pruebas, informe final y demostración. El guion de [`MyWorksAppProyect/DEMO.md`](../MyWorksAppProyect/DEMO.md) se recorre con un solo paso de cobro y con evidencia antes de cerrar.

## En este sprint

| Ítem | Hecho de aceptación |
|------|---------------------|
| Cobro con tarjeta | El total que se muestra es el que acepta el servidor. Un solo toque abre Transbank. |
| Datos de contacto | El chat y la creación del pago rechazan teléfono, correo, enlace y un usuario de red social. Un RUT, una medida o un monto siguen siendo texto del oficio. |
| Cierre del trabajo | Sin al menos una evidencia no se pasa a conformidad ni a completado. |
| Segundo cobro | Un pago principal activo por trabajo. El aviso al usuario está en español. |
| Consola de escritorio | Back office con permisos por rol, segundo factor, motivo obligatorio y bitácora `auditoria_consola`. Las funciones de dinero e invitación exigen `is_admin()`. Hecho (PR #77, #79). |
| Web pública | Dominio `myworksapp.cl`, rutas compartibles, perfil público del profesional, cuenta del cliente y aprobación de cobros adicionales. Hecho (PR #78, #81). |
| Seguridad | Turnstile obligatorio en la compra como invitado, límite de tasa global y checkout sin enumerar correos. Hecho (PR #78). |
| Correo | Correos transaccionales con Resend y enlaces de recuperación e invitación para la app y la consola. Hecho (PR #82); `soporte-automatico` desplegada. |
| Documentación | Al 23-11-2026, 01:29 hora de Chile, el estado vigente está en `MyWorksAppProyect/ESTADO_DEL_PROYECTO.md`. |

## Pendiente que pasa a la Fase 3

- Recompilar el instalador Tauri. El arreglo de la consola ya está en `main` (`4c033b3`) y `consola_leer_config` está en la base desde las 00:20.
- La web https://myworksapp.cl ya publica `/assets/index-UPaWWnOt.js` (01:11), con el aviso académico.
- Activar la invitación por Resend (`INVITE_PROVIDER=resend`) y probar de punta a punta `soporte@myworksapp.cl`.
- Desplegar `send-push` y programar la llamada a `soporte-automatico`.
- Piloto de tiempos. No hay p95 nueva (última: 15-nov, 283 ms, 200 usuarios, 0 fallas en 55.537 peticiones). Alta H1 migrada y no remedida.

## Guion de la demostración

1. El cliente busca plomería en Puerto Montt y elige un profesional.
2. Agenda una hora publicada.
3. Paga en garantía con la tarjeta de integración de Transbank.
4. El profesional acepta, inicia con el PIN, sube evidencia y finaliza.
5. El cliente da conformidad y califica.

Cuentas y tarjetas de prueba: secciones 2 y 3 de `DEMO.md`.
