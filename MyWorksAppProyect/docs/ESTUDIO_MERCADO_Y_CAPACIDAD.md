# Capacidad, escalabilidad y estudio de mercado

Fecha de esta nota: 16 de noviembre de 2026, hora de Chile (UTC−3).
El proyecto es un título. Las cifras de usuarios y de fichas describen el prototipo sobre los planes gratuitos que usa hoy (Vercel Hobby y Supabase Free). No son una promesa de lanzamiento.

Hay dos preguntas distintas y no se pueden responder con el mismo número:

1. Cuántas personas pueden usar la app **al mismo tiempo**.
2. Cuántas **fichas** de trabajadores y de clientes caben guardadas.

## 1. Lo que se volvió a ver en vivo el 16 de noviembre

A las 03:43 se leyó la web publicada y el catálogo, sin crear cuentas ni pedidos (`docs/pruebas/live/comprobar_en_vivo.mjs`, resultado en `docs/pruebas/live/resultados/live_20261116.json`).

| Lectura | Resultado |
|---|---|
| https://myworksapp-cl.vercel.app | HTTP 200 en 136 ms. Caché de Vercel en `HIT`. El HTML pesa 3.067 bytes, trae el contenedor de la aplicación y no trae un campo de tarjeta. |
| Oficios con alguien disponible | 12 oficios, en 829 ms: cerrajería, climatización, construcción, electricidad, ensamblaje, gasfitería, jardinería, limpieza, mudanza, pintura, plomería y soporte técnico. |
| Fichas distintas visibles | **42** profesionales. Gasfitería tiene 8; limpieza, 4; el resto, 3. |
| Primera página de un oficio | 3 filas en 267 ms. |

Después, Playwright abrió la misma URL. La portada cargó y no pidió el número de tarjeta. Al elegir Plomería, el navegador llamó al catálogo vivo y la respuesta fue correcta. Tampoco apareció un campo de tarjeta.

La consola de escritorio no está publicada en una URL propia: se abre desde el computador del administrador. Se compiló el hub contra el mismo proyecto de Supabase y se abrió en el preview. Un correo que no existe (`live-check-no-existe@example.com`) llegó a Auth, Auth lo rechazó y la pantalla se quedó en «Consola operativa». No se creó una cuenta y no se entró a la cola ni al dinero. El spec es `myworksapp_web/e2e/live-public.spec.ts` y se corre con `LIVE_WEB=1` y `LIVE_DESKTOP=1`.

## 2. Cuántos usuarios simultáneos anda bien

«Andar bien» aquí significa: cero errores, la latencia no sube al agregar gente, y el p95 queda bajo 800 ms en la web y bajo 3 s en la base (el corte de `anon`).

| Prueba | Cuándo | Qué se exigió | Hasta dónde se llegó | Cómo respondió |
|---|---|---|---|---|
| Carga de la web publicada y de Supabase, solo lecturas | 15 de noviembre, 19:29–19:47 | Buscar oficio, ver profesionales, ver horas, y que un anónimo no lea pedidos | 200 personas a la vez. 224 solicitudes por segundo de promedio y 312 en el pico de 5 s | 55.537 peticiones y 141.878 verificaciones, 0 fallas. p95 de 283 ms. Entre 30 y 200 personas la latencia no subió. |
| Estrés de la base, lecturas y escrituras de prueba | 16 de noviembre, 01:37–01:45 | Catálogo, agenda, chat y mensajes de prueba | 200 personas a la vez, más un salto de 20 a 200 en 10 s | 38.046 solicitudes, 0 errores. p95 entre 135 y 252 ms. El throughput creció lineal (8,8 a 179 solicitudes por segundo). |
| Escala sintética dentro de Postgres | 16 de noviembre, 01:19 y 01:35 | Buscar los pedidos de una persona entre 200.000 filas | 200.000 filas temporales, que no se guardaron | De 189,6 ms recorriendo la tabla a 0,051 ms usando el índice. |

Con 200 personas activas, Postgres tenía 31 conexiones de 60 y solo 4 ejecutando en ese instante. PostgREST reutiliza un pool: 200 navegadores no son 200 conexiones.

**No se encontró el punto en que se cae.** No se siguió subiendo por tres motivos que siguen vigentes:

- El plan Free de Supabase publica un tope de **200 conexiones simultáneas de Realtime** (chat y mapa en vivo). Las pruebas ya se sentaron en ese número.
- El mismo plan incluye **5 GB de egress al mes** y **500.000 invocaciones de Edge Functions**. El pico del 15 de noviembre ya movió 657 MB solo de la web. Gastar el resto buscando un quiebre deja a la defensa sin cupo.
- Un solo computador genera la carga. Pasado cierto ritmo, la latencia mide al generador y no a la plataforma.

La lectura de ingeniería es esta: **con las plataformas de hoy, la app anda bien con 200 personas a la vez.** Ese es el máximo que se midió y, para el chat y el seguimiento en vivo, también es el cupo publicado del plan. Por encima de 200 haría falta el plan de pago (Realtime sube a 500 en Pro) y repetir la prueba. No se afirma un máximo de 1.000 ni de 10.000.

Otras cuotas del mismo plan, consultadas el 16 de noviembre en la página de precios de Supabase, que no son lo mismo que «gente mirando ahora»:

| Cupo del plan Free | Qué limita | Qué no dice |
|---|---|---|
| 50.000 usuarios activos al mes | Cuentas que inician sesión en el mes | No se crearon 50.000 cuentas para medirlo |
| 500 MB de base | Cuánto se puede guardar | La base de la demo pesa 22 MB |
| 5 GB de egress | Cuánto se puede leer en el mes | El pico de un día ya usó 657 MB de la web |
| 500.000 Edge Functions | Cobros, reembolsos y estado de pago | No se estresó Webpay |
| API «ilimitada» | La cantidad de llamadas HTTP no tiene un número publicado | El egress y Realtime se acaban antes |
| Vercel Hobby: 100 GB de transferencia y 1.000.000 de requests de CDN | La portada y los archivos estáticos | La portada de hoy salió de caché |

La app móvil y la consola usan el mismo Supabase. No tienen un techo distinto de usuarios. La consola, además, la usan pocas personas (administrador, soporte y QA): su riesgo no es el volumen, es que un rol vea o mueva dinero de más. Eso lo cubren las 5 pruebas de permisos, no k6.

## 3. Cuántos trabajadores caben

El 16 de noviembre a las 03:43 el catálogo público mostró **42 profesionales distintos**. Una consulta de oficio devuelve como máximo 40 filas y luego pide la página siguiente, así que la pantalla no crece con el total de fichas.

La base completa pesa **22 MB** de los **500 MB** del plan: va en el 4 %. El tiempo de una consulta de catálogo, medido dentro de Postgres el mismo día, está entre 0,2 y 2,4 ms. Casi todo lo que ve el usuario (136 a 267 ms en la lectura de hoy, cerca de 135 ms en la carga del 15 de noviembre) es el viaje hasta Oregón, no el número de filas.

La prueba de 200.000 filas muestra que, con índice, buscar los pedidos de una persona no se degrada. No se cargaron 200.000 trabajadores en la base viva, así que ese número no es un aforo de fichas. El tope de fichas del plan actual es el disco de 500 MB. Con el tamaño de hoy hay margen holgado para la defensa. Pasar de ahí es cambiar de plan, no cambiar el código del catálogo.

## 4. Mercado nacional

Chile tiene **18.480.432** habitantes según el Censo 2024 (INE, resultados difundidos el 27 de marzo de 2025).

En el trimestre julio-septiembre de 2026, el INE estimó una tasa de ocupación informal de **26,4 %**: **2.451.443** personas. La tasa de las mujeres fue 28,2 % y la de los hombres 25,1 %. Dentro de ese grupo, las personas trabajadoras por cuenta propia informales fueron **1.213.995** (tasa de 62,1 % en esa categoría) y el personal de servicio doméstico informal fue **129.805** (tasa de 60,3 %). Las personas por cuenta propia y las asalariadas privadas juntas son el 85,6 % de la ocupación informal.

Ese es el terreno del problema del título: mucha gente trabaja por su cuenta, sin un local ni una forma estable de que la encuentren, y una parte grande de los oficios del hogar (aseo, reparaciones, instalaciones) se contrata por recomendación. La cifra nacional no dice cuántos de esos 1,2 millones son gasfíteres o electricistas. El INE no publica esa desagregación en el boletín usado aquí. Decir «el mercado es de un millón de maestros» sería inventarlo.

## 5. Mercado regional y de Puerto Montt

La Región de Los Lagos tiene **890.284** habitantes censados en 2024. Puerto Montt tiene **277.040** (140.496 mujeres y 136.544 hombres) y es la comuna más poblada de la región. Un observatorio que reutiliza el mismo censo anota que el 14,1 % de la comuna vive en zona rural y que la región, en conjunto, es más rural (29 %).

En el trimestre enero-marzo de 2026, la ocupación informal regional fue **28,1 %**: **115.522** personas (INE Los Lagos). En junio-agosto de 2026 la tasa regional bajó a **26,4 %**, alineada con el país, y la desocupación fue **7,8 %**. En esos doce meses la población ocupada regional cayó 1,0 % (3.820 personas). Construcción fue uno de los sectores que más empujó esa caída (−10,3 %).

Construcción no es lo mismo que un gasfíter a domicilio. Sirve como contexto: hay menos obra y, al lado, sigue existiendo la reparación de la casa. Puerto Montt concentra cerca de un tercio de la población regional (277.040 de 890.284, un 31 %). Osorno (166.455) y Puerto Varas (52.942) son los otros polos donde una red de oficios tiene densidad. Palena (1.903) o Chaitén (4.025) no tienen el mismo mercado: hay poca gente y más distancia.

Para un prototipo de título, el territorio defendible es el área urbana de Puerto Montt y las comunas vecinas de la provincia de Llanquihue, no «todo Chile el primer día».

## 6. Competencia

Se revisaron los sitios y una nota de prensa el 16 de noviembre de 2026. Lo que cada uno dice de sí mismo no fue auditado: una portada puede declarar 80.000 opiniones sin que este informe las haya contado.

| Quién | Cómo contrata | Dónde dice que llega | Pago | Qué lo separa de este prototipo |
|---|---|---|---|---|
| 2x3.cl | Agenda en línea y profesional verificado | Dice estar en todo Chile, e incluye la provincia de Llanquihue y la de Osorno | Pago protegido hasta que el servicio se completa; en trabajos grandes, por hitos | Es el parecido más directo. MyWorksApp suma la app Flutter, el PIN de inicio, el mapa en vivo y la consola con roles. 2x3 ya está en la calle; este proyecto no se lanza. |
| Jobbing.cl | La persona publica el trabajo y los profesionales cotizan. Ella elige. | Tiene página para Puerto Montt, además de Santiago, Concepción, Temuco y otras ciudades | El precio se acuerda entre las partes. El sitio no retiene el pago | No hay escrow ni seguimiento del estado dentro de la plataforma. |
| WorkMatchfy | Elige un prestador verificado | Declara Puerto Montt entre sus ciudades | Anticipo del 10 % para agendar y 90 % al terminar. Declara una comisión de 4,1 % | Cobra comisión. Este título no cobra, porque no es un comercio. |
| Clickie (Argentina) | Diagnóstico con IA y técnico asignado | La nota de abril de 2026 anuncia la expansión a Santiago. No menciona Los Lagos | No se revisó un cobro chileno | Aún no es un competidor en Puerto Montt. En Argentina declara 5.000 técnicos y unas 100 órdenes terminadas al mes: son cifras de la nota, no medidas aquí. |
| Sodimac y Mercado Libre | Venden materiales y, en Sodimac, un surtido grande de mejoramiento del hogar | Nacional | Pago del producto, no del oficio con retención hasta la conformidad | Compiten por el mismo gasto de la casa, no por el mismo flujo. Alguien puede comprar la llave en Sodimac y seguir buscando al gasfíter por WhatsApp. |
| WhatsApp, Facebook y el dato de un vecino | El canal que ya existe en la ciudad | Local | Efectivo o transferencia | No deja historial, no retiene el dinero y la reputación no viaja a la siguiente persona. Es la competencia real del prototipo en Puerto Montt. |

La brecha que el prototipo cubre, y que Jobbing y el WhatsApp no cubren, es la retención del pago hasta la conformidad, el estado del trabajo y el registro. 2x3 ya ofrece pago protegido y cobertura declarada en Llanquihue: por eso no se puede escribir que «no existe nada parecido». La diferencia de este trabajo es el paquete académico de tres clientes sobre una sola base, con las pruebas que este informe documenta, no un monopolio de mercado.

## 7. Impacto social

Lo que el prototipo puede hacer, si algún día operara de verdad:

- Darle a un trabajador de oficio un lugar donde lo encuentren sin depender solo del contacto de siempre. Eso conversa con la tasa de cuenta propia informal (62,1 % dentro de esa categoría, a nivel país).
- Dejar el dinero retenido hasta que la persona recibe el trabajo, y dejar escrito el estado. Baja el riesgo de pagar y no tener el arreglo, y el de trabajar y no recibir el pago. No reemplaza un contrato ni cotizaciones de AFP y salud.
- El aseo y el servicio doméstico tienen una informalidad alta (60,3 % en el país) y la tasa informal de las mujeres es más alta que la de los hombres. Limpieza es uno de los 12 oficios del catálogo. El prototipo no midió cuántas trabajadoras lo usarían. Afirmar un impacto de género ya logrado sería falso.
- En Puerto Montt el 14,1 % vive en zona rural, y la región llega al 29 %. El mismo día de servicio es razonable en la ciudad y débil en Palena o en las islas. La cobertura móvil no es pareja. El mapa en vivo ayuda donde hay señal, no donde no la hay.

Lo que este título no hace: no baja la desocupación del 7,8 % regional, no formaliza empleos y no se publicó en tiendas. El impacto de hoy es haber demostrado el flujo con pruebas, sobre un problema que las cifras del INE muestran que existe.

## 8. Fuentes

- Instituto Nacional de Estadísticas. (2025). *Censo de Población y Vivienda 2024. Presentación regional de Los Lagos*. https://censo2024.ine.gob.cl/wp-content/uploads/2025/03/10_PRESENTACION_REGIONAL-LOS-LAGOS.pdf
- Municipalidad de Puerto Montt. (2025, 27 de marzo). *Censo 2024 arrojó que Puerto Montt tiene 277 mil habitantes*. https://www.puertomontt.cl/censo-2024-arrojo-que-puerto-montt-tiene-277-mil-habitantes/
- Instituto Nacional de Estadísticas. (2026). *Boletín estadístico de informalidad laboral, trimestre julio-septiembre de 2026*. https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/boletines/2026/ene-informalidad-36.pdf
- Instituto Nacional de Estadísticas, Región de Los Lagos. (2026, 5 de mayo). *La tasa de ocupación informal en la Región de Los Lagos llegó a 28,1 % en el trimestre enero-marzo 2026*. https://regiones.ine.gob.cl/los-lagos/prensa/la-tasa-de-ocupacion-informal-en-la-region-de-los-lagos-llego-a-28-1-en-el-trimestre-enero-marzo-2026
- Instituto Nacional de Estadísticas, Región de Los Lagos. (2026). *Boletín de empleo trimestral, junio-agosto 2026*. https://regiones.ine.cl/documentos/default-source/region-x/historico/empleo_jja_2026.pdf
- Supabase. (s. f.). *Pricing*. Recuperado el 16 de noviembre de 2026. https://supabase.com/pricing
- Vercel. (s. f.). *Hobby plan*. Recuperado el 16 de noviembre de 2026. https://vercel.com/docs/plans/hobby
- 2x3. (s. f.). https://www.2x3.cl/
- Jobbing. (s. f.). https://www.jobbing.cl/
- WorkMatchfy. (s. f.). https://www.workmatchfy.com/
- El Ecosistema Startup. (2026, 22 de abril). *Clickie levanta US$150.000 con IA para servicios del hogar y se expande a Chile*. https://ecosistemastartup.com/clickie-levanta-us150-000-con-ia-para-servicios-del-hogar-y-se-expande-a-chile/
