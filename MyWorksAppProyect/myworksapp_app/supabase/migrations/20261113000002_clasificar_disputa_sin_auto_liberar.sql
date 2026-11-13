-- Una disputa de calidad no puede pagar sola al profesional.
-- El silencio de 48 h sin disputa (resolver_soporte_automatico) sigue
-- liberando el escrow. Mantener alineado con
-- shared/src/support/classifyDispute.ts.

BEGIN;

CREATE OR REPLACE FUNCTION public.clasificar_disputa(
  p_trabajo_id text,
  p_motivo text
)
RETURNS TABLE (decision text, regla text, estado text, vence timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_motivo text := lower(btrim(COALESCE(p_motivo, '')));
  v_monto numeric := 0;
  v_prev integer := 0;
  v_max numeric := public.soporte_numero('soporte_monto_max_auto', 80000);
  v_reinc integer := public.soporte_numero('soporte_reincidencia_max', 1)::integer;
  v_horas integer := GREATEST(public.soporte_numero('soporte_plazo_disputa_horas', 24)::integer, 1);
  v_worker uuid;
  v_evidencia boolean := false;
  v_llego boolean := false;
BEGIN
  SELECT t.id_trabajador INTO v_worker
  FROM public.trabajos t
  WHERE t.id::text = p_trabajo_id;

  SELECT COALESCE(p.monto, 0) INTO v_monto
  FROM public.pagos p
  WHERE p.id_trabajo::text = p_trabajo_id
    AND p.tipo_pago = 'principal'
  ORDER BY p.creado_en DESC
  LIMIT 1;

  IF v_worker IS NOT NULL THEN
    SELECT COUNT(*) INTO v_prev
    FROM public.disputas d
    JOIN public.trabajos t ON t.id::text = d.id_trabajo::text
    WHERE t.id_trabajador = v_worker
      AND d.estado = 'resuelta';
  END IF;

  v_evidencia := public.trabajo_tiene_evidencia(p_trabajo_id);
  v_llego := EXISTS (
    SELECT 1
    FROM public.ubicacion_en_vivo u
    WHERE u.id_trabajo::text = p_trabajo_id
  );

  IF v_motivo = 'conducta' THEN
    decision := 'humano';
    regla := 'conducta';
    estado := 'requiere_humano';
    vence := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_prev >= v_reinc THEN
    decision := 'humano';
    regla := 'reincidencia';
    estado := 'requiere_humano';
    vence := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_monto > v_max THEN
    decision := 'humano';
    regla := 'monto_alto';
    estado := 'requiere_humano';
    vence := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT v_evidencia AND NOT v_llego THEN
    decision := 'reembolsar';
    regla := 'sin_llegada_ni_evidencia';
    estado := 'abierta';
    vence := now() + make_interval(hours => v_horas);
    RETURN NEXT;
    RETURN;
  END IF;

  decision := 'humano';
  regla := 'revision_manual';
  estado := 'requiere_humano';
  vence := NULL;
  RETURN NEXT;
END;
$$;

-- Disputas ya abiertas que iban a pagarse solas al vencer el plazo.
UPDATE public.disputas
SET
  estado = 'requiere_humano',
  decision_sugerida = 'humano',
  motivo_regla = 'revision_manual',
  origen = 'admin',
  vence_en = NULL,
  actualizado_en = now()
WHERE estado = 'abierta'
  AND decision_sugerida = 'liberar';

COMMIT;
