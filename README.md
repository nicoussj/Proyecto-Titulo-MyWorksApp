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

El repositorio concentra tanto los **entregables académicos Capstone** como el **monorepo de software** que materializa el producto.

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

## 4. Arquitectura (visión de título)

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

| Componente | Rol en el proyecto de título |
|------------|------------------------------|
| `myworksapp_app/` | Aplicación móvil Flutter (experiencia principal) |
| `myworksapp_web/` | Canal web para clientes e invitados (urgencia sin sesión) |
| `myworksapp_desktop/` | Panel interno Capstone / operación |
| `shared/` | Contratos y lógica compartida web/desktop |
| `myworksapp_app/supabase/` | Migraciones, Edge Functions y configuración backend |
| `docs/` | Runbooks técnicos (Transbank, liquidación) |
| `Fase 1/`, `Fase 2/`, `Documentos Guia/` | Expediente académico Capstone |

---

## 5. Criterios de diseño profesional aplicados

- **Separación de secretos:** claves Transbank y service role solo en servidor (Edge / secrets).
- **PCI / tarjeta:** el usuario paga en Transbank; la app no captura PAN.
- **Escrow de negocio:** tras el commit Webpay el pago queda **retenido** hasta aprobación / liquidación admin.
- **Invitado web:** solo en web sin sesión se redirige a Transbank tras capturar datos y dirección; con sesión se evita abandonar el producto (popup/WebView).
- **Trazabilidad:** liquidaciones manuales registradas (`liquidaciones`) para auditoría académica y operativa.

---

## 6. Estructura del repositorio

| Ruta | Contenido |
|------|-----------|
| `Fase 1/`, `Fase 2/`, `Documentos Guia/` | Entregables y guías del Capstone |
| `Capstone_Project.mpp` | Planificación del proyecto |
| `myworksapp_app/`, `myworksapp_web/`, `myworksapp_desktop/`, `shared/` | Código del producto |
| `docs/RUNBOOK_TRANSBANK_PRODUCCION.md` | Paso a producción de pagos |
| `docs/RUNBOOK_PAYOUT.md` | Liquidación al profesional (manual → Khipu/Fintoc) |
| `INSTALL.md`, `DEMO.md`, `ESTADO_DEL_PROYECTO.md` | Instalación, demo y estado técnico |

---

## 7. Cómo ejecutar (resumen)

Detalle completo en [`INSTALL.md`](INSTALL.md).

```bash
# Web
cd myworksapp_web && npm install && npm run dev

# Desktop
cd myworksapp_desktop && npm install && npm run dev

# App Flutter
cd myworksapp_app && flutter pub get && flutter run
```

Configurar variables Supabase según `.env.example` de web/desktop y `--dart-define` en Flutter.

---

## 8. Estado respecto al título y al producto

| Dimensión | Estado actual |
|-----------|----------------|
| Definición / evidencia Fase 1 | Presente en carpetas académicas |
| MVP técnico multiplataforma | Implementado (monorepo) |
| Pagos Webpay (integración) | Implementado (Edge + clientes) |
| Liquidación al profesional | Manual por admin (automatización futura) |
| Lanzamiento comercial fin de año | Condicionado a empresa, secrets de producción y cierre de pendientes (MFA, E2E vivo, etc.) |

---

## 9. Autores

Proyecto de título profesional desarrollado por el equipo indicado arriba, sede **Duoc UC Puerto Montt**, en el marco del Capstone **PTY4614**.

Para dudas técnicas del monorepo, ver también [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md).
