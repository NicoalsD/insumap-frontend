# Insumap - Frontend

Cliente web de Insumap, diseñado primero para escritorio (1280 a 1920 px, base de 1440 px) y adaptado hacia abajo: PWA del paciente (instalable, usable desde 360 px), dashboard del médico con triage y consola del administrador de la clínica.

Consume la API de `insumap-backend`.

## Estado

En construcción (Fase 0: documentación y planeación).

## Repositorios de Insumap

| Repositorio | Rol |
|---|---|
| [insumap-backend](https://github.com/NicoalsD/insumap-backend) | API, dominio, patrones, seguridad y documentación canónica |
| [insumap-database](https://github.com/NicoalsD/insumap-database) | Esquemas, migraciones, RLS, roles SQL y semillas (PostgreSQL 18) |
| [insumap-frontend](https://github.com/NicoalsD/insumap-frontend) | PWA del paciente, dashboard del médico y consola del admin |
| [insumap-ai](https://github.com/NicoalsD/insumap-ai) | Servicio de IA: pronóstico, triage, patrones y LLM con guardrails |
| [insumap-simulator](https://github.com/NicoalsD/insumap-simulator) | Clínica, médicos y pacientes simulados; exporta FHIR y CSV |

## Stack

React 19, Vite, TypeScript, React Router, TanStack Query, Zod, Recharts, Vitest, Playwright, axe y MSW.

## Inicio rápido

> Disponible desde la Fase 1.

```bash
npm ci                                          # instala dependencias
npm run dev                                     # servidor de desarrollo
npm run lint                                    # ESLint
npm test                                        # Vitest
npx playwright test                             # pruebas extremo a extremo y accesibilidad (axe)
```

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas para agentes y convenciones del repositorio.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): cómo contribuir (cuentas, ramas, commits y PR).
- [Índice de documentación canónica](https://github.com/NicoalsD/insumap-backend/tree/develop/docs).

## Equipo

- Nicolas Diaz ([`NicoalsD`](https://github.com/NicoalsD))
- Drako Salazar ([`Drako2305`](https://github.com/Drako2305))
- Nicolas Mora ([`nicomora70`](https://github.com/nicomora70))

> Insumap no es un dispositivo médico y no reemplaza el criterio clínico. La IA solo propone; el médico decide.

## Cuentas de desarrollo (solo con `VITE_USE_MOCKS=true`)

Con Mock Service Worker, el login acepta estas cuentas ficticias (dominio reservado `example.test`). El código MFA de las cuentas de personal es `123456`.

| Rol | Correo | Contraseña |
|---|---|---|
| Médico | `mauricio.henao@example.test` | `clave-ficticia-medico` |
| Admin de clínica | `marta.pineda@example.test` | `clave-ficticia-admin` |
| Paciente | `luisa.ortiz@example.test` | `clave-ficticia-paciente` |
