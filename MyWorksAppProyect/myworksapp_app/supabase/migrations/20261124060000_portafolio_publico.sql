-- Fotos de trabajos anteriores visibles en la ficha pública.
-- Solo profesionales que ya pasan el filtro del catálogo.

BEGIN;

CREATE OR REPLACE FUNCTION public.portafolio_publico_profesional(p_id uuid)
RETURNS TABLE (
  ruta_foto text,
  descripcion text,
  tipo_medio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.ruta_foto, f.descripcion, f.tipo_medio
  FROM public.portafolio_trabajador f
  WHERE f.id_trabajador = p_id
    AND f.tipo_medio IS DISTINCT FROM 'video'
    AND f.ruta_foto LIKE 'http%'
    AND EXISTS (
      SELECT 1
      FROM public.perfil_publico_profesional(p_id) perfil
      WHERE perfil.id_usuario = p_id
    )
  ORDER BY f.creado_en DESC
  LIMIT 12;
$$;

REVOKE ALL ON FUNCTION public.portafolio_publico_profesional(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portafolio_publico_profesional(uuid) TO anon, authenticated;

COMMIT;
