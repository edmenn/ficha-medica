# Entorno local aislado

El desarrollo local usa un **Supabase local** (Docker + CLI), separado de producción.
Producción usa el proyecto Supabase cloud; local usa `http://127.0.0.1:54321`.

## Comandos

```bash
npm run db:start        # levanta Supabase local (aplica migraciones 001-008)
npm run db:seed         # crea usuarios de prueba + registros de ejemplo
npm run db:clone-prod   # clona datos reales de produccion al entorno local
npm run db:stop         # detiene Supabase local
npm run dev             # levanta Next en http://localhost:3000
```

## Clonar datos de produccion

`npm run db:clone-prod` copia al entorno local:
- Tablas `public` (users, surgical_records, audit_log, invitations, impersonation_sessions, custom_field_templates)
- Usuarios `auth` (para poder loguear con las credenciales reales)
- Imagenes del bucket `surgical-images`

Requisitos:
- Supabase CLI linkeado al proyecto de produccion
- `DB_PASS` (password de la DB de produccion, en `.env.local.prod-backup`)
- `SUPABASE_SERVICE_ROLE_KEY_PROD` (service role key de produccion) para copiar imagenes

Usos de password: `DB_PASS='J8GFnk3F*6s!Pv' SUPABASE_SERVICE_ROLE_KEY_PROD='...' npm run db:clone-prod`

> Despues de clonar, logueate con las credenciales reales de produccion (la password es la misma).

## Usuarios de prueba

| Rol   | Email                                        | Password               |
|-------|----------------------------------------------|------------------------|
| user  | e2e-user-aa7b0cae1a86@example.com            | E2E-user-Secret-2026!  |
| user  | test@example.com                             | Test-user-Secret-2026! |
| admin | e2e-admin-aa7b0cae1a86@example.com           | E2E-admin-Secret-2026! |

## Arquitectura

- `.env.local` apunta al Supabase **local** (`127.0.0.1:54321`).
- `.env.local.prod-backup` guarda las credenciales de **producción** (no versionar).
- Migraciones en `supabase/migrations/` se aplican automáticamente al hacer `supabase start`.
- Datos de prueba: `scripts/seed-local.mjs` (idempotente; no duplica usuarios/registros).

## Volver a apuntar a producción

Restaurá el backup: `cp .env.local.prod-backup .env.local` y reiniciá `npm run dev`.

> Cuidado: local y producción son bases distintas. Los cambios en local NO tocan producción.
