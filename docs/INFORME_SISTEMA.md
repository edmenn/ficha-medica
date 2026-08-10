# Informe Técnico del Sistema

## Resumen Ejecutivo
Este proyecto es una aplicación Next.js 14 con TypeScript, App Router, Supabase como backend principal, almacenamiento de imágenes en Supabase Storage, generación de reportes en PDF/XLSX y un flujo de análisis de fichas médicas asistido por IA vía OpenRouter. La arquitectura combina renderizado server-side para páginas y layouts con componentes client-side para captura de imágenes, formularios y administración.

La separación entre `admin` y `user` existe a nivel de rol y navegación, pero no constituye todavía un entorno admin completamente aislado. El admin comparte el mismo root layout, la misma base visual y varios componentes del flujo operativo de usuario. Además, la protección de rutas está implementada de forma dispersa en páginas y endpoints, no como una capa centralizada de autorización por segmento.

## Arquitectura General
El sistema usa Next.js App Router con rutas agrupadas en `app/(auth)` y `app/(app)`. El acceso autenticado se controla con `middleware.ts` usando `supabase.auth.getUser()`, mientras que la autorización por rol se resuelve con `lib/auth.ts` y validaciones puntuales en páginas y APIs.

La persistencia vive en Supabase Postgres. Las tablas principales están definidas en `supabase/migrations/001_schema.sql` y protegidas con RLS en `supabase/migrations/002_rls.sql`. La app guarda usuarios extendidos en `public.users`, registros quirúrgicos en `public.surgical_records`, plantillas de campos personalizados en `public.custom_field_templates`, invitaciones en `public.invitations` y auditoría en `public.audit_log`.

El flujo operativo principal es:
1. El usuario se autentica.
2. `getCurrentUserProfile()` resuelve su perfil y rol desde `public.users`.
3. Si es `user`, entra al flujo de captura, análisis, edición y exportación de registros.
4. Si es `admin`, la app lo redirige al workspace de usuarios y revisión.

Referencias clave:
- [`middleware.ts`](../middleware.ts)
- [`lib/auth.ts`](../lib/auth.ts)
- [`supabase/migrations/001_schema.sql`](../supabase/migrations/001_schema.sql)
- [`supabase/migrations/002_rls.sql`](../supabase/migrations/002_rls.sql)

## Estructura de Carpetas
### Raíz y configuración
- [`package.json`](../package.json): scripts, dependencias y tooling.
- [`next.config.mjs`](../next.config.mjs): configuración de Next.
- [`tailwind.config.ts`](../tailwind.config.ts) y [`postcss.config.mjs`](../postcss.config.mjs): styling.
- [`tsconfig.json`](../tsconfig.json): TypeScript y aliases.
- [`middleware.ts`](../middleware.ts): protección de autenticación a nivel de request.

### App Router
- [`app/layout.tsx`](../app/layout.tsx): layout raíz, fuente global, metadata y service worker.
- [`app/page.tsx`](../app/page.tsx): redirect de entrada según rol.
- [`app/(auth)`](../app/%28auth%29): login y activación por invitación.
- [`app/(app)`](../app/%28app%29): área autenticada principal.
- [`app/api`](../app/api): endpoints HTTP.

### Lógica de dominio
- [`lib/auth.ts`](../lib/auth.ts): perfil actual y helpers de autorización.
- [`lib/records-db.ts`](../lib/records-db.ts): helpers tolerantes a compatibilidad de esquema.
- [`lib/record-utils.ts`](../lib/record-utils.ts): normalización, validación, merge y fechas.
- [`lib/openrouter.ts`](../lib/openrouter.ts): cliente y prompt para extracción IA.
- [`lib/crypto.ts`](../lib/crypto.ts): cifrado/descifrado de claves.
- [`lib/export`](../lib/export): exportación a Excel/PDF.
- [`lib/supabase`](../lib/supabase): clientes de Supabase server y browser.

### UI
- [`components/records`](../components/records): captura, lista, detalle y formulario de registros.
- [`components/admin`](../components/admin): vistas admin de usuario y registro.
- [`components/settings`](../components/settings): configuración de cuenta y panel de usuarios.
- [`components/ui`](../components/ui): navegación y autocompletado.
- [`components/capture`](../components/capture): captura/subida de imágenes.

## Rutas y Pantallas
### Rutas públicas/autenticación
- `/` -> [`app/page.tsx`](../app/page.tsx). Redirige a `/records` o `/admin/users` según rol.
- `/login` -> [`app/(auth)/login/page.tsx`](../app/%28auth%29/login/page.tsx). Login con email/contraseña.
- `/accept-invite/[token]` -> [`app/(auth)/accept-invite/[token]/page.tsx`](../app/%28auth%29/accept-invite/%5Btoken%5D/page.tsx). Activa cuenta desde invitación.

### Rutas operativas de usuario
- `/records` -> [`app/(app)/records/page.tsx`](../app/%28app%29/records/page.tsx). Lista registros del usuario.
- `/records/[id]` -> [`app/(app)/records/[id]/page.tsx`](../app/%28app%29/records/%5Bid%5D/page.tsx). Detalle editable del registro.
- `/new` -> [`app/(app)/new/page.tsx`](../app/%28app%29/new/page.tsx). Alta de nuevo registro con captura/IA.
- `/search` -> [`app/(app)/search/page.tsx`](../app/%28app%29/search/page.tsx). Búsqueda textual y por filtros.
- `/reports` -> [`app/(app)/reports/page.tsx`](../app/%28app%29/reports/page.tsx). Reportes y exportación.
- `/settings` -> [`app/(app)/settings/page.tsx`](../app/%28app%29/settings/page.tsx). Configuración de cuenta y campos.

### Rutas admin
- `/settings/users` -> redirige a `/admin/users` desde [`app/(app)/settings/users/page.tsx`](../app/%28app%29/settings/users/page.tsx).
- `/admin/users` -> [`app/(app)/admin/users/page.tsx`](../app/%28app%29/admin/users/page.tsx). Panel de usuarios e invitaciones.
- `/admin/users/[id]` -> [`app/(app)/admin/users/[id]/page.tsx`](../app/%28app%29/admin/users/%5Bid%5D/page.tsx). Detalle de un usuario.
- `/admin/users/[id]/records/[recordId]` -> [`app/(app)/admin/users/[id]/records/[recordId]/page.tsx`](../app/%28app%29/admin/users/%5Bid%5D/records/%5BrecordId%5D/page.tsx). Detalle supervisado de un registro.

### Acceso por usuario
- Rutas de usuario: visibles para `role = 'user'`.
- Rutas admin: visibles para `role = 'admin'`.
- La separación real es parcial: varias páginas de usuario redirigen al admin si detectan rol admin, pero no existe un layout de admin completamente aislado.

## Autenticación y Roles
La autenticación usa Supabase Auth. El login en [`app/(auth)/login/page.tsx`](../app/%28auth%29/login/page.tsx) hace `supabase.auth.signInWithPassword()`. La activación por invitación en [`app/(auth)/accept-invite/[token]/page.tsx`](../app/%28auth%29/accept-invite/%5Btoken%5D/page.tsx) crea el usuario en Supabase y luego inicia sesión.

La sesión se valida en dos niveles:
- `middleware.ts` verifica si existe `user` en Supabase Auth y bloquea navegación no autenticada.
- `lib/auth.ts` usa `getCurrentUserProfile()` para resolver el perfil extendido desde `public.users`.

Dónde se consulta el usuario actual:
- `getCurrentUserProfile()` en [`lib/auth.ts`](../lib/auth.ts) obtiene `auth.user` y luego consulta `public.users` con service role.
- Las páginas SSR y APIs llaman esa función para leer `id`, `email`, `role` y `preferred_model`.

Cómo se determina el rol:
- El rol está guardado en `public.users.role`.
- El schema define enum `user_role` con valores `admin` y `user` en [`supabase/migrations/001_schema.sql`](../supabase/migrations/001_schema.sql).
- RLS usa `public.is_admin()` en [`supabase/migrations/002_rls.sql`](../supabase/migrations/002_rls.sql).

Debilidades observadas:
- La autorización por rol no vive en una capa única; está repartida entre middleware, layouts, páginas y endpoints.
- El middleware solo protege autenticación, no distingue admin/user.
- Algunas rutas de usuario hacen `redirect('/admin/users')` si el perfil es admin, pero eso no reemplaza una política de acceso centralizada.

## Modelos / Datos
### Entidades principales
- `users`: perfil extendido del auth user. [`supabase/migrations/001_schema.sql`](../supabase/migrations/001_schema.sql)
- `surgical_records`: registros clínicos con `image_path`, `image_paths`, `ai_raw_response`, `extracted_data`, `final_data`, `status`.
- `custom_field_templates`: campos personalizados por usuario.
- `invitations`: invitaciones por email con token y expiración.
- `audit_log`: eventos de creación, edición y exportación.

### Tipos TypeScript
- [`types/index.ts`](../types/index.ts) define `UserProfile`, `SurgicalRecord`, `CustomFieldTemplate`, `Invitation`, `AuditEntry`, `SurgicalFields`, `AnalyzeResponse` y `ExportQuery`.

### Datos que maneja el sistema
- Identidad y rol del usuario.
- API key cifrada de OpenRouter y modelo preferido.
- Imágenes de fichas médicas y variantes rotadas.
- Campos clínicos estructurados.
- Estado del registro: `draft`, `reviewed`, `final`.
- Plantillas de campos personalizados.
- Invitaciones y auditoría.

### CRUD de registros
- Create: `POST /api/records` y `POST /api/analyze`.
- Read: `GET /api/records`, `GET /api/records/[id]`, listas de páginas de usuario y admin.
- Update: `PATCH /api/records/[id]`, server action `updateRecordAction`.
- Delete: `DELETE /api/records/[id]`, server action `deleteRecordAction`.

### Observaciones de esquema
- `supabase/migrations/003_modernization.sql` agrega compatibilidad con `image_paths`.
- `lib/records-db.ts` contiene fallback para trabajar con esquemas antiguos y nuevos.

## APIs / Backend
### Endpoints de autenticación y cuenta
- `GET /api/me` -> devuelve el perfil actual.
- `PATCH /api/settings` -> actualiza API key cifrada y modelo preferido.

### Endpoints de usuarios e invitaciones
- `GET/POST /api/users` -> admin lista o crea usuarios manualmente.
- `POST /api/invites` -> admin crea invitaciones; flujo público acepta invitación con token.
- `GET /api/invites?token=...` -> valida invitación.
- `GET /api/invites/list` -> admin lista invitaciones.

### Endpoints de registros
- `GET/POST /api/records` -> lista o crea registros.
- `GET/PATCH/DELETE /api/records/[id]` -> detalle, actualización y borrado.
- `POST /api/records/[id]/reanalyze` -> vuelve a extraer datos desde la imagen.
- `POST /api/analyze` -> sube imagen, usa OpenRouter, detecta duplicados y crea o fusiona registro.
- `GET /api/search` -> búsqueda general con filtros.
- `GET /api/search/filters` -> devuelve cirujanos y sanatorios.
- `GET /api/search/suggestions` -> autocompletado por usuario.
- `GET /api/custom-fields` y `POST /api/custom-fields` -> lectura y alta de plantillas.
- `DELETE /api/custom-fields/[id]` -> baja de plantilla.

### Exportación
- `GET /api/export?format=xlsx|pdf&from=...&to=...` -> exporta registros finales.

### Observaciones técnicas
- `POST /api/analyze` y `POST /api/records` usan `requireOperationalUser()` y bloquean admin para operación clínica.
- Varias consultas dependen de `createServiceClient()` para sortear RLS cuando hace falta acceso global.
- El backend realiza limpieza de imágenes huérfanas cuando falla una subida o el análisis.

## Componentes UI
### Layouts compartidos
- [`app/layout.tsx`](../app/layout.tsx): base global, fuente, service worker y estilos.
- [`app/(app)/layout.tsx`](../app/%28app%29/layout.tsx): layout autenticado con `BottomNav` y ancho distinto según rol.
- [`app/(auth)/layout.tsx`](../app/%28auth%29/layout.tsx): contenedor centrado para login/invitación.

### Componentes del flujo de usuario
- [`components/records/NewRecordClient.tsx`](../components/records/NewRecordClient.tsx): captura, análisis, deduplicación y guardado.
- [`components/records/RecordDetailClient.tsx`](../components/records/RecordDetailClient.tsx): edición, reanálisis y borrado.
- [`components/records/RecordForm.tsx`](../components/records/RecordForm.tsx): formulario principal de campos clínicos.
- [`components/records/FieldRow.tsx`](../components/records/FieldRow.tsx): fila de campo con marcador de IA/editado.
- [`components/records/RecordCard.tsx`](../components/records/RecordCard.tsx): tarjeta para búsqueda.
- [`components/records/RecordListItem.tsx`](../components/records/RecordListItem.tsx): item de lista.
- [`components/capture/ImageCapture.tsx`](../components/capture/ImageCapture.tsx): captura/subida de imágenes.
- [`components/ui/Combobox.tsx`](../components/ui/Combobox.tsx): autocompletado por sugerencias.

### Componentes admin
- [`components/settings/UsersAdminPanel.tsx`](../components/settings/UsersAdminPanel.tsx): panel admin de usuarios, creación manual e invitaciones.
- [`components/admin/AdminUserDetailPage.tsx`](../components/admin/AdminUserDetailPage.tsx): vista de usuario con métricas.
- [`components/admin/AdminRecordDetailPage.tsx`](../components/admin/AdminRecordDetailPage.tsx): vista de registro de solo lectura.

### Reutilización problemática
- [`components/records/RecordForm.tsx`](../components/records/RecordForm.tsx) se reutiliza tanto en usuario como en admin.
- [`components/settings/SettingsPageClient.tsx`](../components/settings/SettingsPageClient.tsx) contiene UI dual de cuenta normal y cuenta administrativa.
- [`components/ui/BottomNav.tsx`](../components/ui/BottomNav.tsx) cambia navegación según rol, pero comparte el mismo shell visual.

## Estado Actual del Admin
### Funciones admin existentes hoy
- Listado de usuarios.
- Detalle de usuario con recuento de registros.
- Vista de registros de un usuario específico.
- Creación manual de usuarios.
- Creación y seguimiento de invitaciones.
- Acceso a configuración de cuenta.

### Qué ve actualmente el admin
- En [`app/(app)/layout.tsx`](../app/%28app%29/layout.tsx), el admin entra al mismo layout general, solo con ancho mayor.
- En [`components/ui/BottomNav.tsx`](../components/ui/BottomNav.tsx), el admin ve una barra con `Usuarios` y `Cuenta`.
- En [`components/settings/SettingsPageClient.tsx`](../components/settings/SettingsPageClient.tsx), el admin ve una pantalla especial de cuenta administrativa.

### Qué partes del sistema de usuario aparecen en admin
- El admin usa el mismo sistema de perfiles, el mismo layout raíz, los mismos estilos y el mismo componente `RecordForm`.
- El admin no tiene todavía un shell propio separado ni un conjunto de rutas bajo un layout aislado tipo `app/(admin)`.
- La vista admin de registros es solo lectura, pero visualmente y conceptualmente sigue siendo la misma UI base del usuario.

### Qué habría que separar para un verdadero admin
- Navegación y layout propios.
- Un workspace de administración aislado.
- Componentes de lectura de registros específicos de admin.
- ABM de usuarios fuera del panel de configuración personal.
- Control de acceso por rol en layout o middleware de segmento, no solo por redirect local.

## Problemas Detectados
1. La separación admin/user es parcial y depende de redirects dispersos.
2. El middleware solo autentica; no aplica políticas de rol.
3. El admin comparte shell visual y varios componentes de usuario.
4. `SettingsPageClient` mezcla cuenta personal con caso admin.
5. Los endpoints de administración usan service role y consultas amplias, pero el aislamiento UI no acompaña.
6. Hay duplicación de lógica de autorización y filtrado entre páginas y APIs.
7. La búsqueda, reportes y registros de usuario están pensados como flujo único y luego excluyen admin con redirects, en vez de existir un workspace admin nativo.

## Recomendaciones
### Separación admin/user
- Crear un segmento dedicado `app/(admin)` con layout, navegación y pantallas exclusivas.
- Mantener `app/(app)` solo para usuarios operativos.
- Centralizar autorización en helpers reutilizables y validación de segmento.

### Estructura de carpetas sugerida
- `app/(admin)/layout.tsx`
- `app/(admin)/users/page.tsx`
- `app/(admin)/users/[id]/page.tsx`
- `app/(admin)/users/[id]/records/[recordId]/page.tsx`
- `components/admin/*` para toda la UI admin.
- `lib/auth/` o `lib/permissions/` para helpers de rol.

### Protección de rutas
- Mantener middleware de sesión, pero agregar una capa de autorización por segmento o por helper SSR.
- No depender solo de `redirect()` en páginas individuales.
- En endpoints sensibles, validar rol antes de tocar datos o service role.

### Estrategia ABM de usuarios
- Dejar el ABM exclusivamente en el segmento admin.
- Exponer listado, creación, edición de rol, invitaciones y estado de cuenta desde un panel dedicado.
- Evitar que la configuración personal incluya acciones de administración.

### Estrategia de impersonación
- Implementar impersonación como acción explícita del admin, con:
  - registro de auditoría,
  - banner visible de modo impersonado,
  - retorno seguro al admin original,
  - endpoints limitados solo a admin.
- No usar impersonación implícita ni compartir sesión sin marca de contexto.

## Plan Sugerido de Implementación
1. Separar rutas admin en `app/(admin)` y mover allí las pantallas actuales.
2. Crear helpers de autorización por rol para páginas y API.
3. Extraer un layout admin con navegación y branding propios.
4. Reubicar ABM de usuarios e invitaciones fuera de `settings`.
5. Definir un flujo formal de impersonación con auditoría.
6. Reducir reutilización accidental de componentes de usuario dentro del admin.
7. Agregar pruebas de ruta/rol para asegurar la separación.

## Dudas o Vacíos Detectados
- No hay evidencia de un panel admin separado a nivel de layout de segmento.
- La estructura exacta del componente `RecordForm` en modo admin puede requerir ajustes si se quiere evitar cualquier edición indirecta.
- No se observó un sistema de impersonación existente; la recomendación anterior es de diseño, no de estado actual.
- El proyecto contiene scripts y documentación de modernización en `docs/superpowers/`, pero el informe se basa en el código actual observado.
