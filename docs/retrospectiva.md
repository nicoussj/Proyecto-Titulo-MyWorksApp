# Retrospectiva — cierre antes de la evaluación

Fecha: 19 de noviembre de 2026. Equipo: Mathias Jara Alvarado, Gabriel Valderas y Nicolas Chiguay.

## Qué se sostiene

- La base tiene RLS en perfiles, trabajos, mensajes, pagos, disputas y horarios. El cliente no escribe pagos ni cambia el estado del trabajo por un update directo.
- El pago en garantía ya tenía un índice único de un solo cobro principal activo.
- El chat ya bloqueaba teléfono, correo y enlaces en la app y en un trigger de Postgres.
- La evidencia ya era obligatoria en el servidor al pasar a `esperando_aprobacion_cliente`.

## Qué apareció en la auditoría

- Facebook y TikTok no entraban en el filtro, y la descripción del trabajo no se revisaba al crear el pago.
- La app podía mostrar la excepción cruda de Postgres si fallaba un cambio de estado, y el cierre sin foto dependía solo del diálogo de la pantalla.
- Los artefactos Scrum pedidos para la evaluación no estaban como archivos sueltos en `docs/`, aunque la metodología sí estaba en `docs/metodologia.md`.

## Qué queda

Las migraciones `20261119163000_resumen_cobro_trabajo` y `20261119170000_contacto_antes_de_garantia` quedaron aplicadas en `wxqrfcqifkfgawrnqmnj` el 19 de noviembre de 2026 (20:45, hora de Santiago).

Sigue fuera de esta entrega: payout automático al banco, Transbank en producción y MFA para clientes y profesionales.
