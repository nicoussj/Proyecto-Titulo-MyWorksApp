# Pruebas de rendimiento y de estrés — 23 de noviembre de 2026

23 de noviembre de 2026. Portafolio de título PTY4614.

## Para qué se midió

Se midió la lectura de la plataforma publicada: la portada, la fotografía webp de la categoría gasfitería y el catálogo público de profesionales. La web, la aplicación móvil y la consola de escritorio usan la misma base. En este equipo no había Docker ni una réplica local de Supabase, así que el estrés más alto no se hizo aparte: contra producción el techo quedó en 100 usuarios virtuales y en pocos minutos. No se crearon cuentas, pedidos ni cobros.

Antes y después de cada corrida, demo_modo_activo respondió verdadero. El modo de demostración siguió en 1. La herramienta fue k6 1.4.2. Cada usuario virtual pidió la portada, la imagen y dos veces el catálogo. Una llamada usa el tamaño de página de la web (20 filas). La otra es el camino de la app: la misma función listar_profesionales_catalogo con límite de 40 filas, que es lo que pide el repositorio de trabajadores de Flutter. No se cronometró el dibujo de la interfaz. El SDK de Flutter responde en el equipo y reconoce Linux y Chrome, pero esa comprobación no es la cifra de carga.

## Resultados

Con 1 usuario, durante 30 segundos, hubo 23 recorridos y 95 peticiones. Las verificaciones de contenido salieron 253 de 253. Errores: 0. La mediana global fue 105,9 ms y el p95 global 192,5 ms.

En ese perfil la portada quedó en p50 14,3 ms y p95 28,3 ms. La imagen webp, en p50 9,7 ms y p95 21,1 ms. El catálogo de la web, en p50 137,1 ms y p95 210,5 ms. El camino de la app, en p50 127,4 ms y p95 177,6 ms.

Con 50 usuarios el escenario duró 2 minutos y 5 segundos y la corrida, 2 minutos y 7 segundos. Hubo 4 213 recorridos y 16 855 peticiones, a 133,1 peticiones por segundo en promedio. Verificaciones correctas: 46 343. Errores: 0. Mediana global 92,1 ms y p95 global 149,0 ms.

Portada: p50 10,3 ms y p95 32,7 ms. Imagen webp: p50 8,0 ms y p95 26,7 ms. Catálogo web: p50 118,3 ms y p95 218,6 ms. Camino de la app: p50 118,4 ms y p95 220,1 ms.

Con 100 usuarios el escenario duró 1 minuto y 35 segundos y la corrida, 1 minuto y 36 segundos. Hubo 6 119 recorridos y 24 479 peticiones, a 254,2 peticiones por segundo en promedio. Verificaciones correctas: 67 309. Errores: 0. Mediana global 90,4 ms y p95 global 151,9 ms. La petición más lenta del catálogo web en este perfil tardó 557,2 ms.

Portada: p50 9,1 ms y p95 24,5 ms. Imagen webp: p50 7,1 ms y p95 21,3 ms. Catálogo web: p50 121,0 ms y p95 166,1 ms. Camino de la app: p50 121,0 ms y p95 167,0 ms.

Antes del desglose por recurso se hizo una pasada de comprobación, también con 50 usuarios y solo lecturas: 15 379 peticiones, 0 errores y p95 global de 187,8 ms. Esas cifras son el total, sin separar recursos. El desglose de portada, imagen y catálogo es el de los tres perfiles anteriores.

## Lectura de los números

La portada y la imagen se mantienen rápidas: con 100 usuarios el p95 queda en 24,5 ms y 21,3 ms. El catálogo, que sí consulta la base, es la parte más lenta y aun así el p95 no pasó de 220,1 ms. Subir de 50 a 100 usuarios no empeoró ese percentil: en el techo de 100 el catálogo web marcó 166,1 ms y el camino de la app 167,0 ms, por debajo de los 218,6 ms y 220,1 ms vistos con 50. No aparecieron respuestas 5xx ni cortes por límite de tasa. Dentro de este techo de lectura no se vio el quiebre. No se subió de 100 usuarios porque no había réplica local y el proyecto publicado tenía que seguir en pie.

## Consola de escritorio

La consola no se estresó contra producción. Sus lecturas de inicio, disputas y ajustes pasan por consola_resumen_periodo, consola_disputas_abiertas y consola_leer_config. Esas funciones están concedidas a la sesión autenticada y, en ajustes y en el resumen, exigen administrador. Con la clave pública el servidor respondió 401, permiso denegado, en las tres. No se forzó un inicio de sesión ni se probó una contraseña. Por eso este informe no trae un p95 de la consola.

## Cierre

La web y el camino de la app se pudieron medir, porque los dos leen el catálogo público. La consola no, porque sus lecturas no son anónimas. Después de las tres corridas, demo_modo_activo seguía en verdadero y la portada volvió a abrir con normalidad.

Figuras: `capturas/salida_k6.png`, `capturas/grafico_p50_p95.png`, `capturas/web_durante_carga.png`, `capturas/web_despues_estres.png`.
