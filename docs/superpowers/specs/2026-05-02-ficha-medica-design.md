# Ficha Médica — Design Spec
**Date:** 2026-05-02  
**Status:** Approved

---

## Overview

Web app mobile-first para digitalizar y gestionar registros quirúrgicos a partir de fotografías. El usuario saca una foto de un documento médico, la IA extrae los datos, el usuario los revisa/corrige, y los guarda. Soporte para búsqueda, filtros, reportes y exportaciones.

**Usuarios:** Múltiples (invite-only). Siempre conectados.  
**Hosting:** Vercel (free tier) + Supabase (free tier). Costo operativo: $0.  
**IA:** OpenRouter — cada usuario configura su propia API key.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (serverless, Vercel) |
| Base de datos | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password + invitaciones) |
| Storage | Supabase Storage (imágenes originales) |
| IA | OpenRouter API (llamada desde servidor) |
| Deploy | Vercel (frontend + API) |

---

## Arquitectura

```
[Celular / Browser]
      ↓ HTTPS
[Next.js en Vercel]
  ├── App Router (UI)
  └── API Routes
        ├── /api/analyze   → llama OpenRouter con key del usuario
        ├── /api/records   → CRUD registros
        ├── /api/search    → búsqueda full-text
        ├── /api/export    → genera Excel / PDF
        └── /api/invites   → gestión invitaciones
      ↓
[Supabase]
  ├── PostgreSQL (datos)
  ├── Storage (imágenes)
  └── Auth (sesiones)
```

La API key de OpenRouter del usuario se guarda **encriptada con AES-256** en la DB. La clave de encriptación vive únicamente en variables de entorno de Vercel — nunca toca la DB ni el cliente.

---

## Modelo de datos

### `users` (extensión de Supabase Auth)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | Supabase Auth |
| email | text | |
| role | enum: admin/user | |
| openrouter_key | text | AES-256 encriptado |
| preferred_model | text | ej. claude-3.5-sonnet |
| created_at | timestamptz | |

### `surgical_records`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| image_path | text | path en Supabase Storage |
| ai_raw_response | jsonb | respuesta cruda OpenRouter — inmutable |
| extracted_data | jsonb | JSON estructurado parseado de la IA |
| final_data | jsonb | datos corregidos por el usuario |
| status | enum: draft/reviewed/final | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `record_fields`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| record_id | uuid FK | |
| field_name | text | paciente, cirujano, etc. |
| ai_value | text | valor original detectado por IA |
| final_value | text | valor corregido por usuario |
| confidence | float | 0–1, indicador visual de confianza |

### `custom_field_templates`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | campos propios de cada usuario |
| field_name | text | |
| field_type | enum: text/number/date/bool | |
| is_required | boolean | |
| display_order | int | |

### `invitations`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| email | text | |
| token | text unique | |
| invited_by | uuid FK | |
| accepted_at | timestamptz | null si pendiente |
| expires_at | timestamptz | 72hs por defecto |

### `audit_log`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| record_id | uuid FK | |
| action | enum: created/edited/exported | |
| diff | jsonb | campos que cambiaron |
| created_at | timestamptz | |

**Row Level Security** habilitado en todas las tablas. Política: cada usuario solo ve sus propios registros. El rol `admin` puede ver registros de todos los usuarios (útil para reportes globales del equipo).

---

## Trazabilidad de datos por registro

Tres capas inmutables/mutables:

1. `ai_raw_response` — respuesta JSON cruda de OpenRouter. **Nunca se modifica.**
2. `extracted_data` — campos parseados y estructurados desde la respuesta IA.
3. `final_data` — valores corregidos por el usuario. Usado en reportes y exportaciones.

Esto garantiza auditoría completa: siempre se puede comparar qué detectó la IA vs qué guardó el médico.

---

## Campos estándar detectados por IA

- Paciente (apellido y nombre)
- Fecha cirugía
- Hora inicio / Hora fin / Duración
- Diagnóstico
- Procedimiento
- Cirujano principal
- Ayudantes
- Anestesiólogo
- Instrumentador
- Sanatorio / Hospital
- Observaciones

Todos editables. Campos faltantes se guardan como `null` — la IA no inventa valores.

---

## Flujo principal (captura → guardado)

1. Usuario toca **"Nueva ficha"**
2. Captura foto con cámara del celular (o sube imagen existente)
3. Cliente comprime imagen a <500KB y convierte HEIC→JPEG si es necesario
4. Imagen se sube a Supabase Storage
5. API Route `/api/analyze` llama a OpenRouter con la imagen (key del usuario, desencriptada en servidor)
6. Respuesta JSON se guarda como `ai_raw_response` y se parsea a `extracted_data`
7. Usuario ve formulario de revisión con campos pre-cargados; campos de baja confianza se destacan visualmente
8. Usuario corrige/completa y confirma
9. `final_data` y `status: final` se guardan en DB
10. Registro aparece en la lista

---

## Módulos UI (8 pantallas)

| Pantalla | Descripción |
|----------|-------------|
| Lista de registros | Listado cronológico con búsqueda rápida y botón "Nueva ficha" |
| Captura | Cámara nativa + upload. Formatos: JPG, PNG, HEIC, PDF |
| Procesando | Estado de análisis IA con preview de imagen |
| Revisar / Editar | Formulario completo editable, campos con indicador de confianza |
| Búsqueda | Full-text + filtros por fecha, médico, paciente, sanatorio |
| Reportes | Rango de fechas, estadísticas básicas, export Excel/PDF |
| Configuración | API key OpenRouter, modelo preferido, campos personalizados |
| Admin usuarios | Listado de usuarios activos, enviar invitaciones (solo admin) |

**Navegación:** Bottom bar con 5 ítems (Registros, Buscar, Nueva [CTA], Reportes, Config).

---

## Seguridad

- API keys encriptadas con **AES-256** en Next.js antes de persistir. Clave en Vercel env vars.
- RLS en todas las tablas Supabase — queries server-side únicamente.
- Imágenes en Supabase Storage con políticas de acceso privado — URLs firmadas con expiración.
- Auth invite-only — registro libre deshabilitado.
- Logs de auditoría de todas las modificaciones a registros.

---

## Riesgos técnicos y mitigaciones

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Timeout Vercel 10s en análisis imagen | Alta | Comprimir imagen <500KB en cliente; fallback a Supabase Edge Function si necesario |
| Calidad de extracción IA variable | Alta | Indicador de confianza por campo; nunca auto-guardar sin revisión del usuario |
| Límite 1GB storage Supabase free | Media | Comprimir imágenes a <500KB en cliente (canvas API) antes de subir |
| Seguridad API keys en DB | Media | AES-256 + clave solo en Vercel env; key nunca expuesta al cliente |
| HEIC no soportado en browser | Baja | Convertir HEIC→JPEG con `heic2any` en cliente antes de subir |

---

## Roadmap MVP (4 semanas)

### Sprint 1 — Base
- Setup Next.js 14 + Supabase
- Auth con Supabase (email/password)
- Sistema de invitaciones
- Schema completo de DB con RLS
- Deploy en Vercel

### Sprint 2 — Core IA
- Captura de foto + upload a Storage con compresión
- Integración OpenRouter (API Route `/api/analyze`)
- Formulario de revisión/edición con indicadores de confianza
- Guardar registro con trazabilidad 3 capas

### Sprint 3 — Gestión
- Lista de registros + búsqueda full-text
- Filtros (fecha, médico, paciente, sanatorio)
- Vista detalle de registro
- Campos personalizados (CRUD)
- Admin de usuarios

### Sprint 4 — Reportes + Pulido
- Exportación Excel (`xlsx`)
- Exportación PDF (`@react-pdf/renderer`)
- Estadísticas básicas (conteo, promedio duración)
- PWA manifest + installable en celular
- Pruebas con usuarios reales + fixes

---

## Dependencias clave

```
next, react, typescript
@supabase/supabase-js, @supabase/ssr
tailwindcss
openai          # cliente OpenAI-compatible para OpenRouter
xlsx            # exportación Excel
@react-pdf/renderer  # exportación PDF
heic2any        # conversión HEIC→JPEG en cliente
```
