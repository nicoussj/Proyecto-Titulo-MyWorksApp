/**
 * Webpay (`tbkConfig`) y Oneclick (`oneclickConfig`) leen `TBK_ENV` en
 * `myworksapp_app/supabase/functions/_shared/tbk.ts`.
 * Con `integration` usan https://webpay3gint.transbank.cl y los códigos
 * públicos de integración. Con `production` usan https://webpay3g.transbank.cl
 * y las claves del comercio. Ese secreto no está en el repositorio, así que
 * el sitio no afirma que los cobros desplegados sean de prueba.
 */
export const PAYMENTS_CONFIRMED_AS_INTEGRATION = false;

export const ACADEMIC_BANNER_TEXT = PAYMENTS_CONFIRMED_AS_INTEGRATION
  ? 'Proyecto de título académico — Duoc UC. Este sitio es un prototipo con fines educativos: no es un servicio comercial, los profesionales y reseñas son de demostración y los pagos se procesan en ambiente de pruebas de Transbank, sin cobros reales.'
  : 'Proyecto de título académico — Duoc UC. Este sitio es un prototipo con fines educativos: no es un servicio comercial, los profesionales y reseñas son de demostración. No realices pagos con datos reales.';

export const ACADEMIC_ACTION_NOTE = PAYMENTS_CONFIRMED_AS_INTEGRATION
  ? 'Sitio académico de demostración. Pagos en ambiente de pruebas.'
  : 'Sitio académico de demostración. No realices pagos con datos reales.';

export const ACADEMIC_META_DESCRIPTION =
  'Proyecto de título académico de Ingeniería en Informática, Duoc UC (sede Puerto Montt). Prototipo educativo de MyWorksApp: no es un servicio comercial. No realices pagos con datos reales.';

export const ACADEMIC_INDICATOR = 'Proyecto de título académico — Duoc UC';
