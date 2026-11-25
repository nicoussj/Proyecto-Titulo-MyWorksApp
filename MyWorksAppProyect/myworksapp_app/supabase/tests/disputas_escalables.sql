-- Pruebas de procedencia, duplicado y reembolso automático.
-- Transacción con ROLLBACK. No apunta a producción.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/disputas_escalables.sql

BEGIN;

DO $$
DECLARE
  v_worker uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_ahora text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_webp bytea := decode('UklGRhoAAABXRUJQVlA4IA4AAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuU', 'base64');
  v_hash text;
  v_cero bytea := decode(repeat('00', 72), 'hex');
  v_otro bytea := decode(repeat('00', 72), 'hex');
  v_fila integer;
  v_nonce text;
  v_nonce2 text;
  v_reg jsonb;
  v_confianza text;
  v_intentos integer;
  v_estado_pago text;
  v_estado_reembolso text;
  v_estado_extra text;
  v_estado_job text;
BEGIN
  IF public.dhash_desde_luma(v_cero) IS DISTINCT FROM '0000000000000000' THEN
    RAISE EXCEPTION 'dhash de ceros = %', public.dhash_desde_luma(v_cero);
  END IF;
  FOR v_fila IN 0..7 LOOP
    v_otro := set_byte(v_otro, v_fila * 9, 255);
  END LOOP;
  IF public.dhash_desde_luma(v_otro) IS DISTINCT FROM '8080808080808080' THEN
    RAISE EXCEPTION 'dhash de marcas = %', public.dhash_desde_luma(v_otro);
  END IF;

  v_hash := encode(extensions.digest(v_webp, 'sha256'), 'hex');

  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
  VALUES
    (v_worker, 'authenticated', 'authenticated', 'disp-' || v_worker || '@prueba.test', now(), now()),
    (v_client, 'authenticated', 'authenticated', 'cli-' || v_client || '@prueba.test', now(), now());
  INSERT INTO public.perfiles (id, nombre, correo, rol, estado_cuenta, creado_en)
  VALUES
    (v_worker, 'Trabajador prueba', 'disp-' || v_worker || '@prueba.test', 'trabajador', 'activo', v_ahora),
    (v_client, 'Cliente prueba', 'cli-' || v_client || '@prueba.test', 'usuario', 'activo', v_ahora);
  INSERT INTO public.trabajos (
    id, id_usuario, id_trabajador, id_servicio, estado, direccion,
    latitud, longitud, creado_en, actualizado_en
  ) VALUES
    ('job-disp-a', v_client, v_worker, 'svc-plomeria', 'en_curso', 'Cardonal 1',
      -41.4717, -72.9366, v_ahora, v_ahora),
    ('job-disp-b', v_client, v_worker, 'svc-plomeria', 'en_curso', 'Cardonal 2',
      -41.4717, -72.9366, v_ahora, v_ahora);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_worker, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);

  INSERT INTO public.fotos_trabajo (id, id_trabajo, ruta_foto, creado_en, tipo_medio, imagen_webp)
  VALUES
    ('foto-a', 'job-disp-a', 'evidencia.webp', v_ahora, 'foto', v_webp),
    ('foto-b', 'job-disp-b', 'evidencia.webp', v_ahora, 'foto', v_webp),
    ('foto-lejos', 'job-disp-a', 'evidencia.webp', v_ahora, 'foto', v_webp);

  v_nonce := public.pedir_nonce_evidencia('job-disp-a');
  v_reg := public.registrar_evidencia_captura(
    'foto-a', 'job-disp-a', v_nonce, v_hash, v_hash, v_cero,
    -41.4717, -72.9366, 'antes', NULL, '0000000000000000'
  );
  IF v_reg->>'confianza' IS DISTINCT FROM 'confiable' THEN
    RAISE EXCEPTION 'la captura en el lugar debía ser confiable: %', v_reg;
  END IF;

  BEGIN
    PERFORM public.registrar_evidencia_captura(
      'foto-a', 'job-disp-a', v_nonce, v_hash, v_hash, v_cero,
      -41.4717, -72.9366, 'antes', NULL, '0000000000000000'
    );
    RAISE EXCEPTION 'un nonce reusado no fue rechazado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%nonce ya usado%' THEN
      RAISE;
    END IF;
  END;

  v_nonce2 := public.pedir_nonce_evidencia('job-disp-a');
  BEGIN
    PERFORM public.registrar_evidencia_captura(
      'foto-lejos', 'job-disp-a', v_nonce2, v_hash, v_hash, v_otro,
      -33.45, -70.66, 'despues', NULL, '8080808080808080'
    );
    RAISE EXCEPTION 'el gps fuera de radio no fue rechazado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%gps fuera de radio%' THEN
      RAISE;
    END IF;
  END;
  SELECT confianza INTO v_confianza FROM public.fotos_trabajo WHERE id = 'foto-lejos';
  IF v_confianza IS DISTINCT FROM 'no_verificada' THEN
    RAISE EXCEPTION 'la foto lejana quedó %', v_confianza;
  END IF;

  v_nonce2 := public.pedir_nonce_evidencia('job-disp-b');
  v_reg := public.registrar_evidencia_captura(
    'foto-b', 'job-disp-b', v_nonce2, v_hash, v_hash, v_cero,
    -41.4718, -72.9366, 'antes', NULL, '0000000000000000'
  );
  IF COALESCE((v_reg->>'duplicado')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'no detectó el duplicado: %', v_reg;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.alertas_evidencia
    WHERE tipo = 'evidencia_duplicada' AND id_foto = 'foto-b'
  ) THEN
    RAISE EXCEPTION 'no quedó la alerta de duplicado';
  END IF;

  INSERT INTO public.pagos (
    id, id_trabajo, monto, estado, tipo_pago, moneda, creado_en, actualizado_en
  ) VALUES (
    'pago-disp', 'job-disp-a', 15000, 'retenido', 'principal', 'CLP', now(), now()
  );
  INSERT INTO public.disputas (
    id, id_trabajo, abierta_por, motivo, descripcion, estado,
    origen, decision_sugerida, motivo_regla, creado_en, actualizado_en
  ) VALUES (
    'disp-reembolso', 'job-disp-a', v_worker, 'calidad', 'Prueba de reembolso automático',
    'reembolso_pendiente', 'sistema', 'reembolsar', 'sin_llegada_ni_evidencia', now(), now()
  );

  CREATE OR REPLACE FUNCTION public.invocar_reembolso_edge(p_body jsonb)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $mock$
  BEGIN
    -- Simula Transbank: marca todos los cobros retenidos del trabajo, no solo el principal.
    UPDATE public.pagos p
    SET estado = 'reembolsado',
        reembolsado_en = now(),
        actualizado_en = now()
    FROM public.disputas d
    WHERE d.id::text = p_body->>'disputa_id'
      AND p.id_trabajo::text = d.id_trabajo::text
      AND p.tipo_pago IN ('principal', 'orden_cambio', 'horas_extra')
      AND p.estado IN ('retenido', 'autorizado', 'pendiente');

    PERFORM public.aplicar_cierre_disputa(
      p_body->>'disputa_id',
      'sistema',
      'reembolsar',
      COALESCE(p_body->>'resolucion', 'Devolución automática de prueba')
    );
    PERFORM public.marcar_reembolso_automatico(
      p_body->>'disputa_id',
      p_body->>'pago_id',
      'ejecutado',
      NULL
    );
    RETURN 1;
  END;
  $mock$;

  PERFORM public.encadenar_soporte_automatico();
  SELECT estado INTO v_estado_pago FROM public.pagos WHERE id = 'pago-disp';
  SELECT estado, intentos INTO v_estado_reembolso, v_intentos
  FROM public.reembolsos_automaticos WHERE id_disputa = 'disp-reembolso';
  IF v_estado_pago IS DISTINCT FROM 'reembolsado' THEN
    RAISE EXCEPTION 'el cron no reembolsó el pago: %', v_estado_pago;
  END IF;
  IF v_estado_reembolso IS DISTINCT FROM 'ejecutado' OR v_intentos IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'reembolso % intentos %', v_estado_reembolso, v_intentos;
  END IF;

  PERFORM public.encadenar_soporte_automatico();
  SELECT intentos INTO v_intentos FROM public.reembolsos_automaticos WHERE id_disputa = 'disp-reembolso';
  IF v_intentos IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'el reembolso se reintentó estando ejecutado: %', v_intentos;
  END IF;

  INSERT INTO public.trabajos (
    id, id_usuario, id_trabajador, id_servicio, estado, direccion,
    latitud, longitud, creado_en, actualizado_en
  ) VALUES
    ('job-disp-c', v_client, v_worker, 'svc-plomeria', 'en_curso', 'Cardonal 3',
      -41.4717, -72.9366, v_ahora, v_ahora),
    ('job-disp-d', v_client, v_worker, 'svc-plomeria', 'en_curso', 'Cardonal 4',
      -41.4717, -72.9366, v_ahora, v_ahora);

  INSERT INTO public.pagos (
    id, id_trabajo, monto, estado, tipo_pago, moneda, creado_en, actualizado_en
  ) VALUES
    ('pago-c-principal', 'job-disp-c', 20000, 'retenido', 'principal', 'CLP', now(), now()),
    ('pago-c-oc', 'job-disp-c', 8000, 'retenido', 'orden_cambio', 'CLP', now() + interval '1 second', now()),
    ('pago-d-principal', 'job-disp-d', 18000, 'retenido', 'principal', 'CLP', now(), now()),
    ('pago-d-hx', 'job-disp-d', 5000, 'retenido', 'horas_extra', 'CLP', now() + interval '1 second', now());

  INSERT INTO public.disputas (
    id, id_trabajo, abierta_por, motivo, descripcion, estado,
    origen, decision_sugerida, motivo_regla, creado_en, actualizado_en
  ) VALUES (
    'disp-extra-c', 'job-disp-c', v_worker, 'calidad', 'Principal y orden de cambio retenidos',
    'abierta', 'admin', 'reembolsar', 'revision_manual', now(), now()
  );

  BEGIN
    PERFORM public.aplicar_cierre_disputa(
      'disp-extra-c',
      'sistema',
      'reembolsar',
      'No debe cerrar con extras retenidos'
    );
    RAISE EXCEPTION 'reembolsar con extras retenidos no fue rechazado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%todos los cobros%' THEN
      RAISE;
    END IF;
  END;
  SELECT estado INTO v_estado_extra FROM public.pagos WHERE id = 'pago-c-oc';
  IF v_estado_extra IS DISTINCT FROM 'retenido' THEN
    RAISE EXCEPTION 'la orden de cambio no debía moverse: %', v_estado_extra;
  END IF;
  SELECT estado INTO v_estado_pago FROM public.pagos WHERE id = 'pago-c-principal';
  IF v_estado_pago IS DISTINCT FROM 'retenido' THEN
    RAISE EXCEPTION 'el principal no debía marcarse reembolsado en SQL: %', v_estado_pago;
  END IF;

  UPDATE public.disputas
  SET estado = 'resuelta', actualizado_en = now()
  WHERE id_trabajo::text = 'job-disp-c'
    AND public.disputa_esta_activa(estado)
    AND id::text <> 'disp-extra-c';
  UPDATE public.disputas
  SET estado = 'reembolso_pendiente',
      decision_sugerida = 'reembolsar',
      actualizado_en = now()
  WHERE id = 'disp-extra-c';

  PERFORM public.encadenar_soporte_automatico();
  SELECT estado INTO v_estado_pago FROM public.pagos WHERE id = 'pago-c-principal';
  SELECT estado INTO v_estado_extra FROM public.pagos WHERE id = 'pago-c-oc';
  SELECT estado INTO v_estado_job FROM public.trabajos WHERE id = 'job-disp-c';
  IF v_estado_pago IS DISTINCT FROM 'reembolsado' OR v_estado_extra IS DISTINCT FROM 'reembolsado' THEN
    RAISE EXCEPTION 'el cron no reembolsó ambos cobros: principal=% extra=%', v_estado_pago, v_estado_extra;
  END IF;
  IF v_estado_job IS DISTINCT FROM 'cancelado' THEN
    RAISE EXCEPTION 'el trabajo con extras no quedó cancelado: %', v_estado_job;
  END IF;

  INSERT INTO public.disputas (
    id, id_trabajo, abierta_por, motivo, descripcion, estado,
    origen, decision_sugerida, motivo_regla, creado_en, actualizado_en
  ) VALUES (
    'disp-extra-d', 'job-disp-d', v_worker, 'calidad', 'Principal y horas extra retenidos',
    'abierta', 'admin', 'liberar', 'revision_manual', now(), now()
  );
  PERFORM public.aplicar_cierre_disputa(
    'disp-extra-d',
    'sistema',
    'liberar',
    'Liberar principal y horas extra juntos'
  );
  SELECT estado INTO v_estado_pago FROM public.pagos WHERE id = 'pago-d-principal';
  SELECT estado INTO v_estado_extra FROM public.pagos WHERE id = 'pago-d-hx';
  SELECT estado INTO v_estado_job FROM public.trabajos WHERE id = 'job-disp-d';
  IF v_estado_pago IS DISTINCT FROM 'liberado' OR v_estado_extra IS DISTINCT FROM 'liberado' THEN
    RAISE EXCEPTION 'liberar no movió ambos cobros: principal=% extra=%', v_estado_pago, v_estado_extra;
  END IF;
  IF v_estado_job IS DISTINCT FROM 'completado' THEN
    RAISE EXCEPTION 'el trabajo con horas extra no quedó completado: %', v_estado_job;
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM 1 FROM public.evidencia_nonces;
    RAISE EXCEPTION 'authenticated pudo leer los nonces';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

ROLLBACK;
