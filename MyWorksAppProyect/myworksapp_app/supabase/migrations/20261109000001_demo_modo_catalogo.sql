-- El selector de login de la demo lee listar_cuentas_demo_acceso, que
-- exige app_config.demo_modo = 1. En el proyecto de título el interruptor
-- quedó en 0 y el picker salía vacío.
-- Idempotente.

BEGIN;

INSERT INTO public.app_config (clave, valor)
VALUES ('demo_modo', '1')
ON CONFLICT (clave) DO UPDATE
SET valor = '1',
    actualizado_en = now();

COMMIT;
