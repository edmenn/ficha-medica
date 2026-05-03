# Arquitectura Admin/User

## Separación de entornos

El sistema separa los entornos con Next.js App Router route groups:

- `app/(user)/`: operación de fichas médicas para usuarios.
- `app/(admin)/`: administración de usuarios, métricas e impersonación.

Las URLs públicas principales son:

- Usuario: `/records`, `/records/[id]`, `/new`, `/search`, `/reports`, `/settings`.
- Admin: `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/users/[id]/records/[recordId]`, `/admin/settings`.

## Guards centralizados

`lib/auth/guards.ts` concentra las reglas:

- `requireUser()`: layouts/pages del entorno usuario.
- `requireAdmin()`: layouts/pages del entorno admin.
- `requireUserApi()`: APIs solo usuario.
- `requireAdminApi()`: APIs solo admin.
- `requireOperationalContext()`: APIs operativas con `effectiveUserId`.

`effectiveUserId` es el dueño real de los registros a operar. Para usuario normal es `profile.id`; para admin impersonando es `target_user_id`. El `audit_log.user_id` siempre guarda el usuario real que ejecutó la acción.

## Impersonación

El admin inicia impersonación desde `/admin/users` o `/admin/users/[id]`. El endpoint `POST /api/admin/impersonation/start` crea una fila en `impersonation_sessions`, guarda la cookie httpOnly `impersonation_session_id` y registra el inicio en `audit_log`.

Mientras la cookie está activa, el admin entra al entorno usuario y `requireOperationalContext()` opera sobre el usuario impersonado. `ImpersonationBanner` muestra el usuario activo y permite salir con `POST /api/admin/impersonation/stop`, que marca `ended_at`, borra la cookie y registra el cierre.

## Base de datos

La migración `supabase/migrations/004_impersonation.sql` agrega:

- `users.is_active` para baja lógica.
- `invitations.created_at` para listar invitaciones.
- Valores `impersonation_started` e `impersonation_ended` en `audit_action`.
- Tabla `impersonation_sessions` con RLS habilitado y sin policies para acceso solo por service role.

## Seguridad

- Admin sin impersonación recibe 403 en endpoints operativos.
- Admin no puede impersonar otros admins ni usuarios inactivos.
- La cookie es httpOnly, `sameSite=lax`, secure en producción y expira en 8 horas.
- APIs admin usan `requireAdminApi()`.
- APIs operativas filtran siempre por `effectiveUserId`.

## Pruebas Manuales

- Login admin debe entrar a `/admin`.
- Admin puede abrir `/admin/users`, crear usuarios e invitar.
- Admin inicia impersonación y termina en `/records` con banner visible.
- "Volver a admin" termina la sesión y vuelve al detalle del usuario.
- Login usuario debe entrar a `/records`.
- Usuario no debe acceder a `/admin`.
- Admin sin impersonación debe recibir 403 en `/api/records`.
