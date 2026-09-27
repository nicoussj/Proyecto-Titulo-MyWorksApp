-- MyWorksApp — modelo entidad-relación (PostgreSQL)
-- Versión 1.6 · 29 tablas public · 2026-09-27
--
-- Importar:
--   pgModeler     File → Import → Database (o pegar y generar diagrama)
--   DBeaver       conectar a un Postgres vacío → ejecutar este script
--                 luego clic derecho en public → View Diagram
--   DataGrip      ejecutar en un schema vacío → Diagrams
--   Azure Data Studio / pgAdmin  Query Tool → Execute → ERD
--
-- No usar contra el proyecto Supabase de producción: es un script de modelado
-- (CREATE TABLE, no migraciones idempotentes).
--
-- Nota de revisión: en el dump remoto varias FK de “trabajador” apuntan a
-- perfiles.id. Aquí se modela el sentido de negocio (trabajadores.id_usuario).
-- liquidaciones.id_trabajador es text y no puede referenciar uuid.

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
  calificacion double precision NOT NULL DEFAULT 0,
  disponible integer NOT NULL DEFAULT 1,
  tarifa_visita double precision NOT NULL DEFAULT 15000,
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
  modelo_precio text NOT NULL DEFAULT 'hourly',
  aviso_legal text,
  creado_en text,
  actualizado_en text
);

CREATE TABLE trabajador_servicios (
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  categoria_servicio text NOT NULL,
  PRIMARY KEY (id_trabajador, categoria_servicio)
);

CREATE TABLE portafolio_trabajador (
  id text PRIMARY KEY,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario) ON DELETE CASCADE,
  ruta_foto text NOT NULL,
  descripcion text,
  tipo_medio text DEFAULT 'photo',
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
  id_servicio text NOT NULL REFERENCES servicios (id) ON DELETE CASCADE,
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
  monto double precision NOT NULL,
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
  handoff_consumido_en timestamptz
);

CREATE TABLE ordenes_cambio (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_trabajador uuid NOT NULL REFERENCES trabajadores (id_usuario),
  tipo text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  monto_clp integer NOT NULL,
  estado text NOT NULL DEFAULT 'pending_client',
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

CREATE TABLE mensajes (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  id_remitente uuid NOT NULL REFERENCES perfiles (id),
  id_destinatario uuid NOT NULL REFERENCES perfiles (id),
  contenido text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  ruta_imagen text,
  leido integer NOT NULL DEFAULT 0,
  creado_en text NOT NULL
);

CREATE TABLE fotos_trabajo (
  id text PRIMARY KEY,
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
  ruta_foto text NOT NULL,
  tipo_medio text NOT NULL DEFAULT 'photo',
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
  id_trabajo text NOT NULL REFERENCES trabajos (id) ON DELETE CASCADE,
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
  estado text DEFAULT 'Pending' CHECK (estado IN ('Pending', 'Resolved')),
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
  creado_en text NOT NULL
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
  estado text NOT NULL DEFAULT 'pending_sync',
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
  estado text NOT NULL DEFAULT 'new',
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

-- Ciclos lógicos (ambos lados nullable)
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
COMMENT ON TABLE trabajadores IS 'Ficha profesional 1:1 con perfiles';
COMMENT ON TABLE trabajos IS 'Pedido y ciclo de vida';
COMMENT ON TABLE pagos IS 'Escrow Webpay; token_tbk/url_tbk solo service_role';
COMMENT ON TABLE liquidaciones IS 'Comprobante de pago al profesional (manual hoy)';
COMMENT ON COLUMN liquidaciones.id_trabajador IS 'text; no FK a trabajadores.id_usuario (uuid)';
COMMENT ON TABLE trabajador_servicios IS 'N:M por slug categoria, no por servicios.id';

COMMIT;
