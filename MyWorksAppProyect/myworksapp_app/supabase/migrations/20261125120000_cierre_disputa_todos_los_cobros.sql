-- Restaura el cierre de disputa sobre principal, orden_cambio y horas_extra.
-- 20261124140000 reescribió aplicar_cierre_disputa desde una copia vieja
-- y solo movía el cobro principal. Conserva el atajo de apelación, pero
-- mira los tres tipos. El cron encola cualquier cobro retenido.

BEGIN;

ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_tipo_pago_chk;
ALTER TABLE public.pagos
  ADD CONSTRAINT pagos_tipo_pago_chk
  CHECK (tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')) NOT VALID;

CREATE OR REPLACE FUNCTION public.aplicar_cierre_disputa(
  p_disputa_id text,
  p_operador text,
  p_decision text,
  p_resolucion text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_disputa public.disputas%ROWTYPE;
  v_job public.trabajos%ROWTYPE;
  v_resolucion text;
  v_origen text := CASE
    WHEN p_operador IN ('sistema', 'acuerdo') THEN p_operador
    ELSE 'admin'
  END;
  v_resuelta uuid := CASE
    WHEN p_operador IS NULL OR p_operador IN ('sistema', 'acuerdo') THEN NULL
    ELSE p_operador::uuid
  END;
  v_hay_pago boolean;
BEGIN
  IF p_decision NOT IN ('liberar', 'reembolsar') THEN
    RAISE EXCEPTION 'decision invalida';
  END IF;

  SELECT * INTO v_disputa
  FROM public.disputas
  WHERE id::text = p_disputa_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'disputa no encontrada';
  END IF;
  IF v_disputa.estado = 'resuelta' THEN
    RETURN jsonb_build_object('already', true, 'decision', p_decision);
  END IF;
  IF NOT public.disputa_esta_activa(v_disputa.estado) THEN
    RAISE EXCEPTION 'la disputa no esta abierta';
  END IF;

  SELECT * INTO v_job
  FROM public.trabajos
  WHERE id::text = v_disputa.id_trabajo::text
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trabajo no encontrado';
  END IF;

  v_resolucion := NULLIF(trim(COALESCE(p_resolucion, '')), '');
  IF v_resolucion IS NULL THEN
    RAISE EXCEPTION 'resolucion requerida';
  END IF;

  -- Una apelación no vuelve a mover el dinero si algún cobro ya salió.
  IF v_disputa.apelada_en IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.pagos p
       WHERE p.id_trabajo::text = v_job.id::text
         AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
         AND p.estado IN ('liberado', 'reembolsado')
     ) THEN
    IF p_decision = 'reembolsar' AND EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado = 'liberado'
    ) THEN
      RAISE EXCEPTION 'el dinero ya se movió en el cierre automático';
    END IF;
    IF p_decision = 'liberar' AND EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado = 'reembolsado'
    ) THEN
      RAISE EXCEPTION 'el dinero ya se movió en el cierre automático';
    END IF;
    UPDATE public.disputas SET
      estado = 'resuelta',
      resolucion = v_resolucion,
      motivo_regla = 'apelacion_revisada',
      resuelta_por = COALESCE(v_resuelta, resuelta_por),
      resuelta_en = COALESCE(resuelta_en, now()),
      actualizado_en = now()
    WHERE id = v_disputa.id;
    RETURN jsonb_build_object(
      'dispute_id', v_disputa.id,
      'decision', p_decision,
      'estado', 'resuelta',
      'apelacion_revisada', true,
      'dinero', 'sin_cambio'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pagos p
    WHERE p.id_trabajo::text = v_job.id::text
      AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
  ) INTO v_hay_pago;

  IF p_decision = 'liberar' THEN
    IF v_job.estado = 'cancelado' THEN
      RAISE EXCEPTION 'el trabajo esta cancelado; no se liberan fondos';
    END IF;
    IF NOT v_hay_pago THEN
      RAISE EXCEPTION 'no hay pago para liberar';
    END IF;
    PERFORM public.liberar_cobros_retenidos(v_job.id::text, COALESCE(p_operador, 'sistema'), v_resolucion);
    IF NOT EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado = 'liberado'
    ) THEN
      RAISE EXCEPTION 'no hay pago para liberar';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado IN ('retenido', 'autorizado', 'pendiente')
    ) THEN
      RAISE EXCEPTION 'quedo un cobro sin liberar';
    END IF;
    IF v_job.estado <> 'completado' THEN
      UPDATE public.trabajos
      SET
        estado = 'completado',
        actualizado_en = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
      WHERE id = v_job.id;
    END IF;
  ELSE
    IF NOT v_hay_pago THEN
      RAISE EXCEPTION 'no hay pago para reembolsar';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado = 'liberado'
    ) THEN
      RAISE EXCEPTION 'el pago ya fue liberado al profesional';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id_trabajo::text = v_job.id::text
        AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND p.estado IN ('retenido', 'autorizado', 'pendiente')
    ) THEN
      RAISE EXCEPTION 'devuelve todos los cobros a la tarjeta antes de cerrar';
    END IF;

    UPDATE public.trabajos SET
      estado = 'cancelado',
      estado_pago = 'reembolsado',
      actualizado_en = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
    WHERE id = v_job.id;
  END IF;

  UPDATE public.acuerdos_trabajo
  SET estado = 'rechazado'
  WHERE id_trabajo::text = v_job.id::text
    AND estado IN ('pendiente', 'confirmado');

  UPDATE public.disputas SET
    estado = 'resuelta',
    origen = v_origen,
    resolucion = v_resolucion,
    resuelta_por = v_resuelta,
    resuelta_en = now(),
    actualizado_en = now()
  WHERE id = v_disputa.id;

  RETURN jsonb_build_object(
    'dispute_id', v_disputa.id,
    'decision', p_decision,
    'estado', 'resuelta',
    'origen', v_origen
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_soporte_automatico()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_horas integer := GREATEST(public.soporte_numero('soporte_plazo_silencio_horas', 48)::integer, 1);
  v_job record;
  v_acuerdo public.acuerdos_trabajo%ROWTYPE;
  v_disputa public.disputas%ROWTYPE;
  v_liberados integer := 0;
  v_acuerdos integer := 0;
  v_reembolsos jsonb := '[]'::jsonb;
BEGIN
  FOR v_job IN
    SELECT t.id::text AS id
    FROM public.trabajos t
    WHERE t.estado = 'esperando_aprobacion_cliente'
      AND public.trabajo_tiene_evidencia_confiable(t.id::text)
      AND NOT EXISTS (
        SELECT 1 FROM public.disputas d
        WHERE d.id_trabajo::text = t.id::text
          AND public.disputa_esta_activa(d.estado)
      )
      AND NULLIF(t.actualizado_en, '')::timestamptz
        < now() - make_interval(hours => v_horas)
  LOOP
    BEGIN
      PERFORM public.liberar_trabajo_sistema(
        v_job.id,
        'El cliente no respondió dentro del plazo. El pago queda liberado.'
      );
      v_liberados := v_liberados + 1;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'silencio %: %', v_job.id, SQLERRM;
    END;
  END LOOP;

  FOR v_acuerdo IN
    SELECT *
    FROM public.acuerdos_trabajo
    WHERE estado = 'confirmado'
    FOR UPDATE
  LOOP
    BEGIN
      IF v_acuerdo.tipo = 'aceptar' THEN
        IF EXISTS (
          SELECT 1 FROM public.disputas d
          WHERE d.id_trabajo::text = v_acuerdo.id_trabajo::text
            AND public.disputa_esta_activa(d.estado)
        ) THEN
          PERFORM public.aplicar_cierre_disputa(
            (
              SELECT d.id::text FROM public.disputas d
              WHERE d.id_trabajo::text = v_acuerdo.id_trabajo::text
                AND public.disputa_esta_activa(d.estado)
              ORDER BY d.creado_en DESC
              LIMIT 1
            ),
            'acuerdo',
            'liberar',
            'Las dos partes aceptaron la entrega.'
          );
        ELSE
          PERFORM public.liberar_trabajo_sistema(
            v_acuerdo.id_trabajo::text,
            'Las dos partes aceptaron la entrega.'
          );
        END IF;
      ELSIF v_acuerdo.tipo = 'rehacer' THEN
        PERFORM set_config('mwa.pin_inicio_ok', '1', true);
        UPDATE public.trabajos
        SET
          estado = 'en_curso',
          actualizado_en = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        WHERE id::text = v_acuerdo.id_trabajo::text
          AND estado <> 'cancelado';
        UPDATE public.disputas
        SET
          estado = 'resuelta',
          origen = 'acuerdo',
          resolucion = 'Acordaron rehacer el trabajo. El pago sigue retenido.',
          resuelta_en = now(),
          actualizado_en = now()
        WHERE id_trabajo::text = v_acuerdo.id_trabajo::text
          AND public.disputa_esta_activa(estado);
      ELSIF v_acuerdo.tipo = 'anular' THEN
        IF EXISTS (
          SELECT 1
          FROM public.pagos p
          WHERE p.id_trabajo::text = v_acuerdo.id_trabajo::text
            AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
            AND p.estado IN ('retenido', 'autorizado', 'pendiente')
        ) THEN
          INSERT INTO public.disputas (
            id, id_trabajo, abierta_por, motivo, descripcion, estado,
            origen, decision_sugerida, motivo_regla, creado_en, actualizado_en
          )
          SELECT
            'acuerdo-' || v_acuerdo.id,
            v_acuerdo.id_trabajo,
            v_acuerdo.propuesto_por,
            'acuerdo',
            'Las dos partes anularon el trabajo.',
            'reembolso_pendiente',
            'acuerdo',
            'reembolsar',
            'acuerdo_anular',
            now(),
            now()
          WHERE NOT EXISTS (
            SELECT 1 FROM public.disputas d
            WHERE d.id_trabajo::text = v_acuerdo.id_trabajo::text
              AND public.disputa_esta_activa(d.estado)
          );
          UPDATE public.disputas
          SET estado = 'reembolso_pendiente',
              decision_sugerida = 'reembolsar',
              motivo_regla = 'acuerdo_anular',
              origen = 'acuerdo',
              actualizado_en = now()
          WHERE id_trabajo::text = v_acuerdo.id_trabajo::text
            AND public.disputa_esta_activa(estado)
            AND estado <> 'reembolso_pendiente';
        ELSE
          UPDATE public.trabajos
          SET estado = 'cancelado',
              actualizado_en = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          WHERE id::text = v_acuerdo.id_trabajo::text;
        END IF;
      END IF;

      UPDATE public.acuerdos_trabajo
      SET estado = 'aplicado', aplicado_en = now()
      WHERE id = v_acuerdo.id;
      v_acuerdos := v_acuerdos + 1;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'acuerdo %: %', v_acuerdo.id, SQLERRM;
    END;
  END LOOP;

  FOR v_disputa IN
    SELECT *
    FROM public.disputas
    WHERE estado = 'abierta'
      AND decision_sugerida = 'liberar'
      AND vence_en IS NOT NULL
      AND vence_en <= now()
    FOR UPDATE
  LOOP
    BEGIN
      PERFORM public.aplicar_cierre_disputa(
        v_disputa.id::text,
        'sistema',
        'liberar',
        'Cierre automático: ' || COALESCE(v_disputa.motivo_regla, 'plazo')
      );
      v_liberados := v_liberados + 1;
    EXCEPTION WHEN others THEN
      UPDATE public.disputas
      SET estado = 'requiere_humano',
          decision_sugerida = 'humano',
          motivo_regla = 'fallo_cierre_automatico',
          prioridad = 'alta',
          actualizado_en = now()
      WHERE id = v_disputa.id;
    END;
  END LOOP;

  FOR v_disputa IN
    SELECT *
    FROM public.disputas
    WHERE estado = 'abierta'
      AND decision_sugerida = 'reembolsar'
      AND vence_en IS NOT NULL
      AND vence_en <= now()
    FOR UPDATE
  LOOP
    UPDATE public.disputas
    SET estado = 'reembolso_pendiente', actualizado_en = now()
    WHERE id = v_disputa.id;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'disputa_id', d.id,
    'pago_id', p.id,
    'resolucion', 'Devolución automática: ' || COALESCE(d.motivo_regla, 'plazo')
  )), '[]'::jsonb)
  INTO v_reembolsos
  FROM public.disputas d
  JOIN LATERAL (
    SELECT id
    FROM public.pagos
    WHERE id_trabajo::text = d.id_trabajo::text
      AND tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
      AND estado IN ('retenido', 'autorizado', 'pendiente', 'reembolsado')
    ORDER BY creado_en
    LIMIT 1
  ) p ON true
  WHERE d.estado = 'reembolso_pendiente';

  RETURN jsonb_build_object(
    'liberados', v_liberados,
    'acuerdos', v_acuerdos,
    'reembolsos', COALESCE(v_reembolsos, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.despachar_reembolsos_automaticos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_max integer := GREATEST(public.soporte_numero('soporte_reembolso_intentos_max', 8)::integer, 1);
  v_id bigint;
  v_enviados integer := 0;
  v_fallidos integer := 0;
  v_omitidos integer := 0;
BEGIN
  UPDATE public.disputas d
  SET estado = 'requiere_humano',
      decision_sugerida = 'humano',
      motivo_regla = 'fallo_reembolso',
      prioridad = 'alta',
      actualizado_en = now()
  FROM public.reembolsos_automaticos r
  WHERE r.id_disputa = d.id::text
    AND d.estado = 'reembolso_pendiente'
    AND r.estado = 'fallido'
    AND r.intentos >= v_max;

  FOR v_row IN
    SELECT d.id::text AS disputa_id,
           p.id::text AS pago_id,
           'Devolución automática: ' || COALESCE(d.motivo_regla, 'plazo') AS resolucion,
           r.estado AS estado_previo,
           COALESCE(r.intentos, 0) AS intentos
    FROM public.disputas d
    JOIN LATERAL (
      SELECT id
      FROM public.pagos
      WHERE id_trabajo::text = d.id_trabajo::text
        AND tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
        AND estado IN ('retenido', 'autorizado', 'pendiente')
      ORDER BY creado_en
      LIMIT 1
    ) p ON true
    LEFT JOIN public.reembolsos_automaticos r ON r.id_disputa = d.id::text
    WHERE d.estado = 'reembolso_pendiente'
      AND COALESCE(r.estado, 'pendiente') <> 'ejecutado'
      AND COALESCE(r.intentos, 0) < v_max
      AND (
        r.id_disputa IS NULL
        OR r.estado IN ('pendiente', 'fallido')
        OR (r.estado = 'en_curso' AND r.actualizado_en < now() - interval '10 minutes')
      )
  LOOP
    INSERT INTO public.reembolsos_automaticos (id_disputa, id_pago, estado, intentos, actualizado_en)
    VALUES (v_row.disputa_id, v_row.pago_id, 'en_curso', v_row.intentos + 1, now())
    ON CONFLICT (id_disputa) DO UPDATE
    SET estado = 'en_curso',
        id_pago = EXCLUDED.id_pago,
        intentos = public.reembolsos_automaticos.intentos + 1,
        ultimo_error = NULL,
        actualizado_en = now();

    BEGIN
      v_id := public.invocar_reembolso_edge(jsonb_build_object(
        'disputa_id', v_row.disputa_id,
        'pago_id', v_row.pago_id,
        'resolucion', v_row.resolucion
      ));
      UPDATE public.reembolsos_automaticos
      SET solicitud_id = v_id
      WHERE id_disputa = v_row.disputa_id
        AND estado = 'en_curso';
      v_enviados := v_enviados + 1;
    EXCEPTION WHEN others THEN
      UPDATE public.reembolsos_automaticos
      SET estado = 'fallido',
          ultimo_error = left(SQLERRM, 500),
          actualizado_en = now()
      WHERE id_disputa = v_row.disputa_id
        AND estado IS DISTINCT FROM 'ejecutado';
      v_fallidos := v_fallidos + 1;
    END;
  END LOOP;

  SELECT count(*) INTO v_omitidos
  FROM public.reembolsos_automaticos
  WHERE estado = 'ejecutado';

  RETURN jsonb_build_object(
    'enviados', v_enviados,
    'fallidos', v_fallidos,
    'ejecutados', v_omitidos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_cierre_disputa(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_cierre_disputa(text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.resolver_soporte_automatico() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_soporte_automatico() TO service_role;
REVOKE ALL ON FUNCTION public.despachar_reembolsos_automaticos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.despachar_reembolsos_automaticos() TO service_role;

COMMIT;
