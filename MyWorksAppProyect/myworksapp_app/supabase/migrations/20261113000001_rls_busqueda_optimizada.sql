-- Optimización RLS para la búsqueda de profesionales (PROPUESTA, no aplicada).
--
-- Contexto (medido el 2026-11-12 en "MyWorksApp Proyect"):
--   * Las consultas de la búsqueda ya son rápidas (catálogo ~10 ms, perfiles ~12 ms
--     con EXPLAIN ANALYZE). El bloqueo venía de la app (N+1 en serie), no de la BD.
--   * Esta migración solo limpia lo que marca el Performance Advisor y deja la BD
--     lista para crecer. La semántica de acceso es la MISMA que hoy.
--
-- Cambios:
--   1. trabajos_select / trabajos_update: se quitan los casts ::text (impiden usar
--      los índices idx_trabajos_id_usuario / idx_trabajos_id_trabajador) y is_admin()
--      se evalúa una vez por consulta con (select ...), no por fila.
--   2. trabajadores: se unen las dos políticas SELECT permisivas
--      (advisor "multiple_permissive_policies") en una sola.
--   3. perfiles_select: is_admin() envuelto en (select ...).

BEGIN;

-- 1. trabajos -----------------------------------------------------------------
DROP POLICY IF EXISTS trabajos_select ON public.trabajos;
CREATE POLICY trabajos_select ON public.trabajos
  FOR SELECT TO authenticated
  USING (
    id_usuario = (SELECT auth.uid())
    OR id_trabajador = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS trabajos_update ON public.trabajos;
CREATE POLICY trabajos_update ON public.trabajos
  FOR UPDATE TO authenticated
  USING (
    id_usuario = (SELECT auth.uid())
    OR id_trabajador = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    id_usuario = (SELECT auth.uid())
    OR id_trabajador = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- 2. trabajadores -------------------------------------------------------------
DROP POLICY IF EXISTS trabajadores_select_authenticated ON public.trabajadores;
DROP POLICY IF EXISTS trabajadores_select_contraparte ON public.trabajadores;
CREATE POLICY trabajadores_select_authenticated ON public.trabajadores
  FOR SELECT TO authenticated
  USING (
    (COALESCE(disponible, 0) = 1 AND COALESCE(precios_configurados, 0) = 1)
    OR id_usuario = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.trabajos t
      WHERE t.id_trabajador = trabajadores.id_usuario
        AND t.id_usuario = (SELECT auth.uid())
    )
  );

-- 3. perfiles -----------------------------------------------------------------
DROP POLICY IF EXISTS perfiles_select ON public.perfiles;
CREATE POLICY perfiles_select ON public.perfiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.trabajos t
      WHERE (t.id_usuario = (SELECT auth.uid()) AND t.id_trabajador = perfiles.id)
         OR (t.id_trabajador = (SELECT auth.uid()) AND t.id_usuario = perfiles.id)
    )
  );

COMMIT;

-- Verificación sugerida después de aplicar (solo lectura):
--   select tablename, policyname, cmd, qual from pg_policies
--   where schemaname = 'public' and tablename in ('trabajos','trabajadores','perfiles');
-- y volver a correr el Performance Advisor: deben desaparecer los avisos
-- multiple_permissive_policies de public.trabajadores.
