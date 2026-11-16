# My Works App — Proyecto de Título Profesional

**Institución:** Duoc UC — Sede Puerto Montt  
**Asignatura / programa:** Capstone PTY4614 (APT)  
**Tipo de proyecto:** Proyecto de título profesional (desarrollo de software)  
**Equipo:** Mathias Alejandro Jara Alvarado · Nicolas Chiguay · Gabriel Valderas

---

## 1. Resumen del proyecto

**My Works App** es una plataforma digital multiplataforma que conecta **hogares y clientes** con **profesionales de oficios** (electricidad, gasfitería, armado, plomería, etc.) en Chile.

El proyecto de título aborda el problema de la **informalidad, la desconfianza y la falta de trazabilidad** en la contratación de servicios a domicilio: el cliente no siempre sabe a quién contratar, el profesional no siempre tiene un canal formal de demanda, y el pago suele quedar expuesto a incumplimientos.

La solución propuesta es un **ecosistema comercial** (app móvil, web y panel de escritorio) con:

- solicitud y agendamiento de visitas o urgencias;
- perfiles y roles (cliente, profesional, administración);
- **pago protegido (escrow de negocio)** mediante Transbank Webpay Plus;
- seguimiento del trabajo y herramientas operativas para el equipo interno.

El repositorio concentra los **entregables académicos Capstone** en la raíz y el **monorepo de software** dentro de [`MyWorksAppProyect/`](MyWorksAppProyect/).

---

## 2. Objetivo general

Diseñar, implementar y validar un **MVP multiplataforma** de marketplace de servicios del hogar, con base de datos y autenticación en la nube, pagos en ambiente de integración Transbank y flujos diferenciados para cliente, profesional y administración, en el marco de un proyecto de título profesional en Duoc UC.

### Objetivos específicos

1. Definir el problema, alcance y stack tecnológico del proyecto (Fase 1 — definición APT).
2. Modelar e implementar dominio, autenticación, trabajos y políticas de acceso (Supabase / PostgreSQL / RLS).
3. Desarrollar interfaces cliente (Flutter + web) y hub operativo (desktop).
4. Integrar pagos Webpay sin capturar datos de tarjeta en el cliente (Edge Functions).
5. Documentar operación, riesgos y criterios de paso a producción (runbooks).
6. Evidenciar el trabajo académico Capstone (fases, guías, presentaciones).

---

## 3. Alcance del producto (qué entrega el título)

| Actor | Capacidad principal |
|-------|---------------------|
| **Cliente** | Buscar oficio, solicitar visita/urgencia, pagar con Webpay, seguir el servicio |
| **Profesional** | Gestionar trabajos y perfil desde la app móvil |
| **Administración / soporte** | Operar desde el hub desktop: métricas, disputas, liquidación manual del escrow |

**Fuera de alcance inmediato del MVP académico-comercial (documentado como pendiente):** MFA obligatorio, payout bancario automatizado (Khipu/Fintoc), firma electrónica legal Ley 19.799, métricas de negocio reales en producción.

---

## 4. Arquitectura de software

### En una frase

> **Monorepo multiplataforma** con arquitectura **cliente–servidor** sobre **Supabase (BaaS)**. Tres clientes (Flutter, web React/Vite, desktop Tauri) usan el mismo backend (Auth, PostgreSQL, RLS, Edge Functions). En móvil: organización **modular por features** con capas prácticas (UI → servicios → repositorios), inspirada en Clean Architecture de forma pragmática.

### Tipo de arquitectura

| Concepto | Qué es en este proyecto |
|----------|-------------------------|
| Cliente–servidor | Datos centralizados en la nube; las apps consultan Supabase |
| BaaS | Backend como servicio (Auth + Postgres + políticas RLS) |
| Monorepo | Código de app, web, desktop y `shared/` en un solo árbol (`MyWorksAppProyect/`) |
| Feature-First | En Flutter, pantallas por funcionalidad + `core/` compartido |
| Capas pragmáticas | Presentación → aplicación → dominio → infraestructura (repositorios) |
| Edge / serverless | Webpay y guest-checkout en Edge Functions (no en el dispositivo) |

### Diagrama

```text
┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│  App Flutter    │   │  Web (Vite)     │   │  Desktop (Tauri)     │
│  Cliente /      │   │  Landing +      │   │  Admin / soporte /   │
│  profesional    │   │  checkout web   │   │  ejecutivo            │
└────────┬────────┘   └────────┬────────┘   └──────────┬───────────┘
         │                     │                         │
         └──────────┬──────────┴──────────┬──────────────┘
                    ▼                     ▼
            shared/ (TypeScript)    Supabase (Auth + DB + RLS)
                    │                     │
                    └──────────┬──────────┘
                               ▼
                    Edge Functions Webpay / guest-checkout
                               ▼
                         Transbank (integración)
```

| Componente | Rol |
|------------|-----|
| `MyWorksAppProyect/myworksapp_app/` | App móvil Flutter |
| `MyWorksAppProyect/myworksapp_web/` | Canal web (sesión o invitado) |
| `MyWorksAppProyect/myworksapp_desktop/` | Hub operativo |
| `MyWorksAppProyect/shared/` | Contratos TS compartidos |
| `MyWorksAppProyect/myworksapp_app/supabase/` | Migraciones y Edge Functions |
| `Fase 1/`, `Fase 2/`, `Documentos Guia/` | Expediente académico Capstone |

Diccionario de datos (fácil de explicar): [`MyWorksAppProyect/docs/DICCIONARIO_BASE_DATOS.md`](MyWorksAppProyect/docs/DICCIONARIO_BASE_DATOS.md).

---

## 5. Metodología y sprints

Trabajamos por entregas cortas: un flujo se implementa, se prueba y se sube. No hubo Scrum ceremonial (sin tablero diario ni puntos de historia). El plan de la guía 2.4 usa las semanas 1 a 18. El repositorio empieza el 10 de agosto de 2026. Estos cinco sprints son los mismos que el informe final.

| Sprint | Cuándo | Qué se entregó | Cómo se probó | Estado |
|--------|--------|----------------|---------------|--------|
| 1. Definición | Semanas 1 a 4. Agosto 2026 | Problema, objetivos y evidencias de la Fase 1 | Entrega documental. Aún no había producto | Cerrado |
| 2. Datos y seguridad | Semanas 5 a 8. Septiembre 2026 | Base en Supabase y políticas RLS | Auditoría del 16 de noviembre: 181 casos útiles, 0 fallas | Cerrado. La prueba formal es posterior al código |
| 3. Tres clientes y cobro | Semanas 7 a 14. Octubre 2026 | App, web, hub y Webpay en integración | El recorrido de punta a punta quedó para el sprint 4 | Código entregado |
| 4. Pruebas del flujo | 13 al 16 de noviembre de 2026 | Reagendar, cancelar, calificar, roles de consola, carga y Lighthouse | Web: 20 pruebas Playwright el 16 de noviembre (la de invitación del escritorio incluida). Teléfono físico: no | Parcial a propósito en el teléfono |
| 5. Cierre | 16 de noviembre de 2026 | Auditoría de la base, diccionario de 52 tablas, informe final | Cada cifra tiene archivo. La demo oral es de la defensa | Informe cerrado |

Un ciclo, en simple: elegir un flujo, acordar el estado en la base, implementarlo, probarlo, explicarlo y subirlo.

---

## 6. Criterios de diseño profesional aplicados

- **Separación de secretos:** las claves de Transbank y del servidor solo viven en el backend (Edge / secrets de Supabase). Nadie del equipo las pone en la app que se instala en el celular.
- **Datos de la tarjeta de crédito/débito (PCI):** el usuario **no escribe el número de su tarjeta en My Works App**. Paga en la página oficial de **Transbank**.  
  En seguridad de pagos, al número de la tarjeta se le llama **PAN** (*Primary Account Number* = el número largo impreso en la tarjeta).  
  **En simple:** nosotros nunca pedimos ni guardamos ese número; Transbank lo maneja. Así reducimos el riesgo de fraude y cumplimos con buenas prácticas bancarias.
- **Escrow de negocio (plata “retenida”):** cuando Transbank confirma el cobro, el pago queda marcado como **retenido** en nuestra base. El profesional **no** recibe el dinero de inmediato: primero se completa el trabajo y un administrador registra la transferencia. Eso da confianza al cliente.
- **Invitado en la web:** si alguien pide una urgencia **sin** iniciar sesión, completa nombre/correo/teléfono/dirección y luego va a Transbank. Si ya tiene sesión, paga en una ventana controlada **sin** abandonar My Works App.
- **Trazabilidad:** cada vez que se paga al profesional, queda un registro en la tabla `liquidaciones` (quién liquidó, cuánto, referencia de la transferencia). Sirve para auditoría académica y operativa.

---

## 7. Estructura del repositorio

| Ruta | Contenido |
|------|-----------|
| `Fase 1/` | Entregables y evidencias de definición APT |
| `Fase 2/` | Entregables de la siguiente fase Capstone |
| `Documentos Guia/` | Guías e instructivos del programa |
| `Capstone_Project.mpp` | Planificación del proyecto |
| **`MyWorksAppProyect/`** | **Monorepo del producto** (app, web, desktop, shared, docs técnicos, CI) |
| `MyWorksAppProyect/docs/` | Runbooks (Transbank, liquidación) y diccionario BD |
| `MyWorksAppProyect/INSTALL.md` | Instalación y demo técnica |

---

## 8. Cómo ejecutar (resumen)

Detalle completo en [`MyWorksAppProyect/INSTALL.md`](MyWorksAppProyect/INSTALL.md).

```bash
# Web
cd MyWorksAppProyect/myworksapp_web && npm install && npm run dev

# Desktop
cd MyWorksAppProyect/myworksapp_desktop && npm install && npm run dev

# App Flutter
cd MyWorksAppProyect/myworksapp_app && flutter pub get && flutter run
```

Configurar variables Supabase según `.env.example` de web/desktop y `--dart-define` en Flutter.

---

## 9. Estado del título

Esto es un proyecto de título. No se lanza al mercado y no se sube a tiendas. Webpay queda en ambiente de integración: la tarjeta de prueba demuestra la retención, la liberación y el reembolso.

| Qué | Dónde está | Estado |
|-----|------------|--------|
| Informe final | `Fase 2/Myworksapp_Informe_Final - APT.docx` | Cerrado, con sprints y análisis de cada prueba |
| Definición Fase 1 | `Fase 1/` | Entregada |
| Informe de avance | `Fase 2/2.4_DesarrolloProyecto_APT_MyWorksApp.docx` | Entregado. Ahí la matriz de las tres interfaces aún figuraba en curso |
| Diccionario (52 tablas) | `MyWorksAppProyect/docs/DICCIONARIO_BASE_DATOS.md` | Generado desde la base viva el 16 de noviembre |
| Casos de uso y UML | `MyWorksAppProyect/docs/casos_de_uso.md` y `docs/uml/` | 34 casos. Web y escritorio tienen diagrama propio (08 y 09) |
| Pruebas | Informe final, sección de análisis, y `MyWorksAppProyect/docs/pruebas/` | Explicadas una por una. El teléfono físico no se recorrió |
| Instalación | `MyWorksAppProyect/INSTALL.md` | Lista |
| Webpay de integración | `MyWorksAppProyect/docs/RUNBOOK_TRANSBANK_PRODUCCION.md` | Runbook de cómo sería producción. No se usa en este título |

---

## 10. Autores

Proyecto de título profesional desarrollado por el equipo indicado arriba, sede **Duoc UC Puerto Montt**, en el marco del Capstone **PTY4614**.

Para el estado técnico del monorepo, ver [`MyWorksAppProyect/ESTADO_DEL_PROYECTO.md`](MyWorksAppProyect/ESTADO_DEL_PROYECTO.md).
