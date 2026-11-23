-- Índices de las claves foráneas que el asesor de Supabase marcó sin cobertura
-- (medición del 22-nov-2026, 23:00 America/Santiago).
--
-- Cada índice empieza por la columna de la clave foránea. Las tablas tienen
-- pocas filas. No se usa CONCURRENTLY: esta migración corre dentro de una
-- transacción.
-- En la base viva quedó registrada como version 20261123021159,
-- name indices_fk_sin_cobertura. El archivo usa un timestamp posterior
-- a 20261123233000 para no intercalarse antes de migraciones ya presentes.

CREATE INDEX IF NOT EXISTS idx_cola_moderacion_id_mensaje
  ON public.cola_moderacion (id_mensaje);

CREATE INDEX IF NOT EXISTS idx_direcciones_cliente_id_usuario
  ON public.direcciones_cliente (id_usuario);

CREATE INDEX IF NOT EXISTS idx_disputas_asignado_a
  ON public.disputas (asignado_a);

CREATE INDEX IF NOT EXISTS idx_ia_cambios_banco_user_id
  ON public.ia_cambios_banco (user_id);

CREATE INDEX IF NOT EXISTS idx_ia_huellas_user_id
  ON public.ia_huellas (user_id);
