# Retrospectiva — cierre antes de la evaluación

Fecha del cuerpo: 20 de noviembre de 2026. Equipo: Mathias Jara Alvarado, Gabriel Valderas y Nicolas Chiguay.

> Estado vigente al 23 de noviembre de 2026, 01:29 hora de Chile: `MyWorksAppProyect/ESTADO_DEL_PROYECTO.md`. El arreglo de la consola ya es ancestro de `main` (`4c033b3`). La web publicada carga `/assets/index-UPaWWnOt.js`. Lo que esta retrospectiva deja abierto corresponde al 20-nov, salvo la frase anterior.

## Cómo está el producto

- Hay RLS en perfiles, trabajos, mensajes, pagos, disputas y horarios. El cliente lee los pagos de su trabajo y no los inserta ni los edita.
- Hay un solo pago principal activo por trabajo. Si se intenta otro, la app explica en español que ya hay un cobro en curso.
- El chat y la descripción del pedido rechazan teléfono chileno (móvil y fijo), correo, enlaces y un usuario o enlace de red social. Nombrar la red, un RUT, una medida o un monto no bloquea el texto.
- Al crear o reutilizar el pago principal, el servidor revisa la descripción, la dirección y los mensajes del cliente en ese trabajo. Un administrador puede registrar el pago si el caso es legítimo.
- Cerrar el trabajo exige al menos una evidencia, en la app y en el servidor. El pago sigue retenido hasta la conformidad.
- Los errores de negocio se muestran en español, sin el texto crudo de Postgres.
- La web quedó en el dominio propio `myworksapp.cl`, con Turnstile en el registro y en la compra como invitado. Los correos de Auth salen por Resend.
- La consola guarda cada acción en una bitácora que no se puede editar ni borrar, y las funciones de dinero rechazan con 403 a quien no es administrador.

## Lo que queda abierto

- La prueba de la consola del 20-nov encontró 24 errores. Al 23-11 el arreglo ya es ancestro de `main` (`4c033b3`); el instalador Tauri hay que recompilarlo.
- La comisión del código es 5 % con mínimo de $1.000; documentos anteriores decían 15 %. Falta decidir la tasa.
- El captcha de Supabase Auth no está activado.
- Los correos de pago, alta, reembolso y liberación ya salen por Resend (PR #82). Falta activar la invitación por Resend (`INVITE_PROVIDER=resend`), probar de punta a punta `soporte@myworksapp.cl` y programar la llamada a `soporte-automatico`.
