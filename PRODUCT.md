# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Médico (`DOCTOR`)**: endocrinólogo o médico general de una clínica u hospital colombiano. Trabaja en un computador de escritorio o portátil, entre consultas, y necesita saber en segundos qué pacientes asignados requieren atención (triage), revisar métricas (TIR, TBR, TAR, CV, GMI, AGP), atender alertas y aprobar, modificar o rechazar con motivo las sugerencias de la IA. Solo ve a sus pacientes asignados.
- **Paciente (`PATIENT`)**: persona con diabetes importada por su clínica. Activa su cuenta con un código de un solo uso y registra glucosa, insulina, comidas, actividad y síntomas; ve su tendencia, su plan activo y sus recordatorios. Edades y habilidades digitales variadas.
- **Administrador de clínica (`CLINIC_ADMIN`)**: importa pacientes (FHIR R4 o CSV), emite y reenvía credenciales, gestiona médicos, equipos de atención, metas, reglas de alerta y plantillas. No ve datos clínicos detallados.
- **Visitante de la landing** (inferido, sin confirmar): evaluador académico, directivo o médico de una clínica que quiere entender qué hace Insumap. Acción principal confirmada: entrar a la demo con datos simulados eligiendo rol.

## Product Purpose

Plataforma B2B2C de monitoreo de pacientes con diabetes: la clínica trae a sus pacientes, el paciente registra sus datos y el equipo médico asignado los vigila con triage, métricas, alertas y apoyo de IA. Éxito: el médico detecta a tiempo al paciente que se descompensa y decide con información completa; el paciente registra en pocos pasos.

## Positioning

(Inferido de `docs/Insumap.md`, sin confirmar.) La IA solo propone; el médico aprueba, modifica o rechaza con motivo, y cada decisión queda auditada. Los pacientes llegan desde los sistemas de la clínica (FHIR R4 o CSV) con credenciales de un solo uso, no por registro abierto.

## Operating Context

- **Prioridad de visualización: PC.** Todas las superficies se diseñan primero para escritorio (1280 a 1920 px) y se adaptan hacia abajo; la del paciente sigue siendo usable en el celular como PWA.
- Español de Colombia. Unidad de glucosa mg/dL siempre visible.
- Datos 100 % simulados (clínica demo `is_demo`); el aviso "Datos simulados" se muestra en todas las pantallas.

## Capabilities and Constraints

- React 19, Vite, TypeScript estricto, React Router, TanStack Query, Zod, Recharts, MSW mientras la API crece.
- **Nada quemado en el frontend:** textos en `src/i18n/es.ts`; parámetros clínicos (metas, umbrales), límites de campos, catálogos y contenido de datos llegan desde la API (o sus mocks MSW con la forma del contrato de `docs/API.md` del backend).
- El access token vive solo en memoria; nada sensible en `localStorage`. Prohibido `dangerouslySetInnerHTML`.
- MFA TOTP obligatorio para el personal.

## Brand Commitments

- Nombre: Insumap.
- Aviso regulatorio siempre visible (login, pie de cada vista y junto a todo contenido de IA): "Insumap no es un dispositivo médico y no reemplaza el criterio clínico. La IA solo propone; el médico decide."
- Decisión del usuario del 2026-11-19 (aplica a toda la app, no solo a la landing): la aplicación se presenta como producto en producción. Sin franja "Datos simulados", sin selector de rol, sin "demo" ni "proyecto académico" en ninguna pantalla. Las cuentas de las fixtures solo se documentan en el README para desarrollo. Reemplaza AGENTS.md 3.5 y el principio 5.
- Excepción en la landing pública (`/`), por decisión del usuario del 2026-11-19:
  - Se presenta como producto en producción, sin "demo", "datos simulados" ni "proyecto académico".
  - Lleva un aviso regulatorio en el pie y junto a la tarjeta de IA: "Insumap no es un dispositivo médico y no reemplaza el criterio clínico. La IA solo propone; el médico decide."
  - Las vistas de ejemplo del producto se rotulan "Vista de ejemplo".
- Todo contenido de IA se rotula como sugerencia pendiente de la decisión del médico. El paciente nunca ve una dosis sugerida por la IA.

## Evidence on Hand

No hay clientes, testimonios, métricas de uso ni logos de clínicas reales. La landing no puede inventar clientes, cifras de impacto ni certificaciones; solo describe capacidades reales del producto, con vistas rotuladas "Vista de ejemplo" y el aviso regulatorio (ver Brand Commitments).

## Anti-references

Confirmado por el usuario: nada con aspecto de plantilla SaaS (tarjetas iguales, gradientes, hero genérico), nada de frases poéticas ni información de poco valor, y ninguna mala decisión de UI/UX.

## Product Principles

1. El médico decide; la IA explica y propone.
2. Lo urgente primero: el triage ordena por riesgo, no por orden alfabético.
3. Ningún rango se comunica solo con color; la unidad siempre se ve.
4. Ningún valor clínico vive en el cliente: viene de la clínica.
5. Cada valor clínico muestra su origen (sensor, glucómetro o manual) y su hora.

## Accessibility & Inclusion

WCAG 2.2 AA verificado con axe; foco visible y navegación por teclado; objetivos táctiles de al menos 48 px en la superficie del paciente; textos claros para pacientes con baja habilidad digital.
