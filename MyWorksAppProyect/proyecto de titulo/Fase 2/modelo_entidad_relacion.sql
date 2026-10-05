-- MyWorksApp — modelo entidad-relación (PostgreSQL)
-- Versión 2.0 · 32 tablas public · 2026-10-04
--
-- Fuente: migraciones ES + 20260923 liquidaciones + 20261002/03 Oneclick
--         + 20261004 normalizar_y_optimizar (no el dump inglés histórico).
--
-- Importar:
--   pgModeler     File → Import → Database (o pegar y generar diagrama)
--   DBeaver       Postgres vacío → ejecutar este script → View Diagram
--   DataGrip      schema vacío → Diagrams
--   dbdiagram.io  usar el .dbml hermano
--
-- No ejecutar contra el proyecto Supabase de producción.
--
-- Fidelidad vs. constraints físicos:
--   En el dump remoto varias FK de “trabajador” apuntan a perfiles.id.
--   Aquí se modela el sentido de negocio (trabajadores.id_usuario).
--   liquidaciones.id_trabajador, trabajador_precios.id_usuario,
--   trabajador_servicios_extra.id_usuario y metodos_pago_oneclick.id_usuario
--   son text y no pueden ser FK a uuid.

BEGIN;

CREATE TABLE perfiles (
  id uuid PRIMARY KEY,
  nombre text NOT NULL DEFAULT '',
  correo text,
  rol text NOT NULL DEFAULT 'usuario',
  estado_cuenta text NOT NULL DEFAULT 'activo',
  ruta_foto_perfil text,
  creado_en text NOT NULL
);

CREATE TABLE trabajadores (
  id_usuario uuid PRIMARY KEY REFERENCES perfiles (id) ON DELETE CASCADE,
  profesion text NOT NULL DEFAULT '',
  descripcion text,
  calificacion numeric(4, 2) NOT NULL DEFAULT 0,
  disponible integer NOT NULL DEFAULT 1,
  tarifa_visita numeric(12, 0) NOT NULL DEFAULT 15000,
  categoria_servicio text NOT NULL DEFAULT 'general',
  niveles_precio jsonb NOT NULL DEFAULT '{}'::jsonb,
  servicios_personalizados jsonb NOT NULL DEFAULT '[]'::jsonb,
  precios_configurados integer NOT NULL DEFAULT 0,
  zona_trabajo text,
  conteo_rechazos integer NOT NULL DEFAULT 0
);

CREATE TABLE servicios (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  categoria text NOT NULL DEFAULT 'general',
  activo integer NOT NULL DEFAULT 1,
  requiere_certificacion integer NOT NULL DEFAULT 0,
  modelo_precio text NOT NULL DEFAULT 'por_hora',
  aviso_legal text,
  creado_en text,
  actualizado_en text
);

CREATE TABLE trabajador_servicios (
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  categoria_servicio text NOT NULL,
  PRIMARY KEY (id_trabajador, categoria_servicio)
);

CREATE TABLE trabajador_precios (
  id_usuario text NOT NULL,
  codigo text NOT NULL,
  monto_clp numeric(12, 0) NOT NULL CHECK (monto_clp >= 0),
  PRIMARY KEY (id_usuario, codigo)
);

CREATE TABLE trabajador_servicios_extra (
  id text NOT NULL,
  id_usuario text NOT NULL,
  titulo text NOT NULL,
  subtitulo text NOT NULL DEFAULT '',
  monto_clp numeric(12, 0) NOT NULL CHECK (monto_clp >= 0),
  unidad text NOT NULL DEFAULT 'fijo' CHECK (unidad IN ('fijo', 'por_m2')),
  PRIMARY KEY (id_usuario, id)
);

CREATE TABLE portafolio_trabajador (
  id text PRIMARY KEY,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  ruta_foto text NOT NULL,
  descripcion text,
  tipo_medio text DEFAULT 'foto',
  creado_en text NOT NULL
);

CREATE TABLE impulsos (
  id text PRIMARY KEY,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  tipo_impulso text NOT NULL,
  fecha_inicio text NOT NULL,
  fecha_fin text NOT NULL,
  creado_en text NOT NULL
);

CREATE TABLE configuraciones_servicio (
  id text PRIMARY KEY,
  id_servicio text NOT NULL UNIQUE REFERENCES servicios (id) ON DELETE CASCADE,
  esquema_config text NOT NULL,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

CREATE TABLE trabajos (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  id_trabajador uuid REFERENCES trabajadores (id_usuario) ON DELETE SET NULL,
  id_servicio text REFERENCES servicios (id) ON DELETE SET NULL,
  estado text NOT NULL,
  direccion text NOT NULL DEFAULT '',
  latitud double precision,
  longitud double precision,
  descripcion text,
  fecha_programada text,
  metadatos_servicio text,
  modalidad_cobro text,
  estado_pago text,
  id_comuna text,
  instantanea_precio text,
  id_sku_servicio text,
  horas_bloque integer,
  id_cotizacion_seleccionada text,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

CREATE TABLE propuestas_cotizacion (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  monto_total_clp integer NOT NULL,
  descripcion text NOT NULL,
  validez_hasta text,
  desglose text,
  estado text NOT NULL,
  creado_en text NOT NULL
);

CREATE TABLE pagos (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_orden_cambio text,
  tipo_pago text NOT NULL DEFAULT 'principal',
  monto numeric(12, 0) NOT NULL,
  moneda text NOT NULL DEFAULT 'CLP',
  estado text NOT NULL,
  metodo_pago text,
  id_transaccion text,
  autorizado_en text,
  liberado_en text,
  reembolsado_en text,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL,
  ambiente text,
  token_tbk text,
  url_tbk text,
  buy_order text,
  handoff_consumido_en timestamptz,
  reembolso_solicitado_en timestamptz,
  orden_detalle_oneclick text,
  cobro_reclamado_en timestamptz
);

CREATE UNIQUE INDEX pagos_un_principal_activo_uidx
  ON pagos (id_trabajo)
  WHERE tipo_pago = 'principal'
    AND estado IN ('pendiente', 'retenido', 'autorizado');

CREATE TABLE ordenes_cambio (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario),
  tipo text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  monto_clp integer NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente_cliente',
  id_pago text,
  creado_en text NOT NULL,
  respondido_en text
);

CREATE TABLE liquidaciones (
  id text PRIMARY KEY,
  id_pago text NOT NULL REFERENCES pagos (id),
  id_trabajo text NOT NULL REFERENCES trabajos (id),
  id_trabajador text,
  monto_clp numeric NOT NULL CHECK (monto_clp > 0),
  proveedor text NOT NULL DEFAULT 'manual'
    CHECK (proveedor IN ('manual', 'khipu', 'fintoc')),
  referencia_transferencia text NOT NULL,
  notas text,
  id_operador text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX liquidaciones_pago_uidx ON liquidaciones (id_pago);

CREATE TABLE metodos_pago_oneclick (
  id_usuario text PRIMARY KEY,
  username text NOT NULL,
  tbk_user text,
  tipo_tarjeta text,
  ultimos4 text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'activa', 'rechazada')),
  token_inscripcion text,
  id_trabajo_pendiente text,
  url_inscripcion text,
  ticket_handoff text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX metodos_pago_oneclick_ticket_handoff_uidx
  ON metodos_pago_oneclick (ticket_handoff)
  WHERE ticket_handoff IS NOT NULL;

CREATE TABLE mensajes (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_remitente uuid NOT NULL REFERENCES perfiles (id),
  id_destinatario uuid NOT NULL REFERENCES perfiles (id),
  contenido text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  ruta_imagen text,
  leido integer NOT NULL DEFAULT 0,
  creado_en text NOT NULL
);

CREATE TABLE fotos_trabajo (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  ruta_foto text NOT NULL,
  tipo_medio text NOT NULL DEFAULT 'foto',
  creado_en text NOT NULL
);

CREATE TABLE calificaciones (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_usuario uuid REFERENCES perfiles (id),
  puntaje integer NOT NULL,
  comentario text,
  creado_en text NOT NULL
);

CREATE TABLE disputas (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  abierta_por uuid NOT NULL REFERENCES perfiles (id),
  motivo text NOT NULL,
  descripcion text,
  estado text NOT NULL,
  resolucion text,
  resuelta_por uuid REFERENCES perfiles (id),
  resuelta_en text,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

CREATE TABLE cancelaciones_trabajo (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL UNIQUE REFERENCES trabajos (id) ON DELETE CASCADE,
  cancelado_por uuid NOT NULL REFERENCES perfiles (id),
  motivo text NOT NULL,
  cancelado_en text NOT NULL
);

CREATE TABLE tickets_soporte (
  id text PRIMARY KEY,
  id_trabajo text REFERENCES trabajos (id),
  nombre_cliente text NOT NULL,
  nombre_trabajador text NOT NULL,
  asunto text NOT NULL,
  monto_escrow integer NOT NULL,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'resuelto')),
  creado_en timestamptz DEFAULT now()
);

CREATE TABLE notificaciones (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  cuerpo text NOT NULL,
  id_relacionado text,
  leido integer NOT NULL DEFAULT 0,
  creado_en text NOT NULL
);

CREATE TABLE suscripciones (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  tipo_plan text NOT NULL,
  estado text NOT NULL,
  fecha_inicio text NOT NULL,
  fecha_fin text,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

CREATE TABLE codigos_restablecimiento (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id),
  codigo text NOT NULL,
  correo text NOT NULL,
  expira_en text NOT NULL,
  usado integer DEFAULT 0,
  creado_en text NOT NULL
);

CREATE TABLE consentimientos_usuario (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  version_consentimiento text NOT NULL,
  aceptado integer NOT NULL DEFAULT 0,
  aceptado_en text NOT NULL,
  direccion_ip text,
  agente_usuario text
);

CREATE TABLE bloqueos_usuario (
  id text PRIMARY KEY,
  id_bloqueador uuid NOT NULL REFERENCES perfiles (id),
  id_bloqueado uuid NOT NULL REFERENCES perfiles (id),
  creado_en text NOT NULL,
  UNIQUE (id_bloqueador, id_bloqueado)
);

CREATE TABLE reportes (
  id text PRIMARY KEY,
  id_reportante uuid NOT NULL REFERENCES perfiles (id),
  id_usuario_reportado uuid NOT NULL REFERENCES perfiles (id),
  motivo text NOT NULL,
  descripcion text,
  estado text NOT NULL DEFAULT 'pendiente',
  creado_en text NOT NULL
);

CREATE TABLE eventos_abuso (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  tipo_abuso text NOT NULL,
  conteo integer NOT NULL,
  detectado_en text NOT NULL,
  accion_tomada text,
  accion_tomada_en text,
  resuelto integer DEFAULT 0
);

CREATE TABLE acciones_pendientes (
  id text PRIMARY KEY,
  id_usuario uuid NOT NULL REFERENCES perfiles (id) ON DELETE CASCADE,
  tipo_accion text NOT NULL,
  tipo_entidad text NOT NULL,
  id_entidad text,
  datos text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente_sync',
  conteo_reintentos integer DEFAULT 0,
  mensaje_error text,
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

CREATE TABLE registros_error_app (
  id text PRIMARY KEY,
  id_usuario uuid REFERENCES perfiles (id),
  tipo_error text NOT NULL DEFAULT 'error',
  mensaje text NOT NULL,
  traza_pila text,
  metadatos jsonb,
  estado text NOT NULL DEFAULT 'nuevo',
  version_app text,
  plataforma text,
  creado_en text NOT NULL
);

CREATE TABLE eventos_analitica (
  id text PRIMARY KEY,
  nombre_evento text NOT NULL,
  id_usuario uuid REFERENCES perfiles (id),
  rol text,
  marca_tiempo text NOT NULL,
  metadatos text
);

CREATE TABLE banderas_funcionalidad (
  id text PRIMARY KEY,
  nombre_bandera text NOT NULL,
  habilitada integer NOT NULL DEFAULT 0,
  version_app text,
  rol text,
  id_usuario uuid REFERENCES perfiles (id),
  creado_en text NOT NULL,
  actualizado_en text NOT NULL
);

ALTER TABLE trabajos
  ADD CONSTRAINT trabajos_cotizacion_seleccionada_fkey
  FOREIGN KEY (id_cotizacion_seleccionada) REFERENCES propuestas_cotizacion (id);

ALTER TABLE pagos
  ADD CONSTRAINT pagos_orden_cambio_fkey
  FOREIGN KEY (id_orden_cambio) REFERENCES ordenes_cambio (id);

ALTER TABLE ordenes_cambio
  ADD CONSTRAINT ordenes_cambio_pago_fkey
  FOREIGN KEY (id_pago) REFERENCES pagos (id);

COMMENT ON TABLE perfiles IS 'Identidad de app = auth.users.id';
COMMENT ON TABLE trabajadores IS 'Ficha profesional 1:1 con perfiles. calificacion y tarifa_visita son numeric tras 20261004.';
COMMENT ON TABLE trabajador_precios IS 'Filas derivadas del JSON niveles_precio (trigger explotar_oferta_trabajador). id_usuario es text.';
COMMENT ON TABLE trabajador_servicios_extra IS 'Filas derivadas del JSON servicios_personalizados. id_usuario es text.';
COMMENT ON TABLE trabajos IS 'Pedido y ciclo de vida. id_trabajador e id_servicio opcionales.';
COMMENT ON TABLE pagos IS 'Escrow Webpay/Oneclick; token_tbk/url_tbk/tbk_user no salen al cliente.';
COMMENT ON TABLE liquidaciones IS 'Comprobante de pago al profesional (manual hoy). Un pago → una liquidación.';
COMMENT ON COLUMN liquidaciones.id_trabajador IS 'text; no FK a trabajadores.id_usuario (uuid)';
COMMENT ON TABLE metodos_pago_oneclick IS 'Tarjeta inscrita Oneclick; PK text = auth.uid. Solo service_role.';
COMMENT ON TABLE trabajador_servicios IS 'N:M por slug categoria, no por servicios.id';
COMMENT ON TABLE cancelaciones_trabajo IS 'Como máximo una cancelación por trabajo (UNIQUE id_trabajo).';

COMMIT;
