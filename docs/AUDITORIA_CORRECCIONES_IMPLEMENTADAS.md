# Auditoría de Correcciones Implementadas

**Fecha:** 2026-08-11
**Proyecto:** `edmenn/ficha-medica`
**Alcance:** remediación de la auditoría de seguridad y calidad (12 puntos).
**Rama:** `main`

> Documento honesto: indica qué quedó corregido, qué requiere configuración externa y qué riesgos permanecen.

---

## Resumen ejecutivo

Se aplicaron correcciones en los 12 puntos, con **migraciones SQL**, **pruebas unitarias/integración**, **typecheck limpio**, **build de producción OK** y **actualización de Next.js**. Dos puntos dependen de configuración externa que **no** puede ejecutarse desde el código (políticas de Storage en Supabase, migraciones sobre la BD real). El upgrade de Next.js se hizo a `15.5.21` (soporte React 18), documentando que un salto a 16 queda pendiente. Además se eliminó el almacenamiento local de imágenes clínicas y se migró la exportación a `exceljs`.

---

## Correcciones por hallazgo

### 1. Edición de fecha quirúrgica
- **Corrección:** nuevo módulo centralizado `lib/dates.ts` (parseo, validación de calendario real, ISO ↔ dd-mm-aaaa, rango de fechas). `FieldRow` ahora usa un `<input type="date">` para `fecha_cirugia`, edita en ISO y normaliza **solo al perder foco** (`onBlur`), nunca en cada tecla. `validateDateRange` valida que "Desde" ≤ "Hasta" en exportación.
- **Archivos:** `lib/dates.ts`, `lib/record-utils.ts`, `components/records/FieldRow.tsx`, `components/records/RecordForm.tsx`, `app/api/export/route.ts`.
- **Pruebas:** `lib/dates.test.ts` (22 casos: editar año, año vacío, fecha vacía, fechas inválidas `31-02`, `29-02` no bisiesto, ISO, ordenamiento, rango).
- **Estado:** corregido y probado.

### 2. Bloqueo de usuarios inactivos
- **Corrección:** `getCurrentUserProfile` incluye `is_active`. Todos los guards (`requireUser`, `requireAdmin`, `requireUserApi`, `requireAdminApi`, `requireOperationalContext`) rechazan inactivos con 403. Login verifica el perfil tras `signInWithPassword`; si está inactivo cierra sesión y muestra el mensaje. Layouts de usuario/admin redirigen a `/login?inactive=1`. Se conserva la restricción de auto-desactivación de admin. La impersonación también verifica que el usuario efectivo esté activo.
- **Archivos:** `lib/auth.ts`, `lib/auth/guards.ts`, `app/(auth)/login/page.tsx`, `app/(user)/layout.tsx`, `app/(admin)/layout.tsx`.
- **Pruebas:** `lib/auth/guards.test.ts` (5 casos: activo, inactivo user/admin, impersonación a inactivo).
- **Estado:** corregido y probado.

### 3. Vulnerabilidad de acceso a imágenes médicas
- **Corrección:** `POST /api/records` **ya no acepta** `image_path`/`image_paths` del cliente: siempre persiste `manual-entry`. Nuevo validador `lib/storage-paths.ts` (`isValidImagePath`) que exige prefijo exacto del usuario, sin traversal/rutas absolutas/segmentos extraños. Se aplica antes de firmar (GET/detalle/búsqueda) y antes de borrar (DELETE). Migración SQL con políticas de Storage por prefijo de usuario.
- **Archivos:** `app/api/records/route.ts`, `app/api/records/[id]/route.ts`, `app/api/search/route.ts`, páginas de detalle, `lib/storage-paths.ts`, `supabase/migrations/007_audit_and_storage_hardening.sql`.
- **Pruebas:** `lib/storage-paths.test.ts` (9 casos) + test de POST que rechaza `image_path` ajeno.
- **Estado:** corregido en código. **Requiere aplicar la migración 007 en Supabase** para que las políticas de Storage queden activas (paso manual).

### 4. Rediseño del PDF
- **Corrección:** `lib/export/pdf.tsx` reescrito con diseño A4 profesional: encabezado con período/sanatorio/fecha-emisión/total, pie con "Página X de Y", resumen (totales, distribución por sanatorio y cirujano), tabla resumen y sección de detalle por registro con todos los campos estándar + personalizados. Caso 0 registros muestra "Sin resultados". Se evita `wrap={false}` en bloques largos.
- **Archivos:** `lib/export/pdf.tsx`, `lib/export/helpers.ts`, `app/api/export/route.ts`.
- **Pruebas:** `lib/export/pdf.test.ts` (0 registros, varios, campos personalizados, muchas páginas).
- **Estado:** corregido y probado.

### 5. Excel y protección de inyección de fórmulas
- **Corrección:** `lib/export/excel.ts` escapa valores que empiezan con `= + - @` (prefijo `'`), incluye campos personalizados dinámicamente, congela encabezado, agrega autofiltro, anchos de columna y metadatos (período, sanatorio, emisión). **Migrado de `xlsx` a `exceljs@4.4.0`** (mantenido, sin CVEs directos).
- **Archivos:** `lib/export/excel.ts`, `lib/export/helpers.ts`, `app/api/export/route.ts`.
- **Estado:** corregido y probado. `exceljs` trae una dependencia transitiva `uuid@8.3.2` con un aviso *moderate* (bounds check en uuid v3/v5/v6); exceljs solo usa uuid v4 (aleatorio), por lo que **no es explotable** en este contexto.

### 6. Auditoría clínica de cambios
- **Corrección:** se agregaron `deleted` y `reanalyzed` al enum. Toda edición (Server Action y API), creación, borrado, exportación, relectura e impersonación registran `audit_log` con `effective_user_id` y `meta`. El borrado se registra **antes** de eliminar (evita pérdida por FK). Nueva pantalla administrativa `/admin/audit` con filtros por actor, registro, acción y rango.
- **Archivos:** `types/index.ts`, `app/(user)/records/[id]/actions.ts`, rutas API, `app/(admin)/admin/audit/`, `components/admin/audit/`, `supabase/migrations/007`.
- **Pruebas:** `actions.test.ts` (audit de borrado con actor efectivo).
- **Estado:** corregido y probado. **Requiere migración 007** para las columnas `effective_user_id`/`meta`.

### 7. Relectura IA: pérdida de trabajo y validación
- **Corrección:** `RecordDetailClient` pide confirmación si hay cambios sin guardar, y tras la relectura muestra una **comparación campo por campo** (Actual vs IA) para aplicar selectivamente. `/api/records/[id]/reanalyze` valida MIME/tamaño, limita imágenes por ficha, limpia temporales en `finally`, registra `reanalyzed` y no expone errores internos de OpenRouter.
- **Archivos:** `components/records/RecordDetailClient.tsx`, `app/api/records/[id]/reanalyze/route.ts`.
- **Estado:** corregido. (La comparación se validó por typecheck/build; interacción manual recomendada.)

### 8. Campos personalizados con tipos reales
- **Corrección:** `FieldRow` renderiza según `field_type` (`text`, `number`, `date`, `bool`). `custom-fields` valida tipo, rechaza duplicados y colisiones con campos estándar, soporta `is_required`, y permite editar tipo/requerido vía PATCH. Al eliminar un campo **no se borra** el dato histórico (solo se quita el template). Validación de requeridos vía `validateRequiredFields`. Los campos se incluyen en PDF y Excel.
- **Archivos:** `components/records/FieldRow.tsx`, `components/records/RecordForm.tsx`, `components/settings/SettingsPageClient.tsx`, `app/api/custom-fields/*`, `lib/record-utils.ts`.
- **Pruebas:** `app/api/custom-fields/route.test.ts` (4 casos).
- **Estado:** corregido y probado.

### 9. Búsqueda, filtros, paginación y rendimiento
- **Corrección:** `GET /api/records` ahora hace **paginación y total en la base** (count real + `order` + `range`), sin descargar todo. Migración 008 agrega columna `surgical_date` (date) derivada de `final_data`, con trigger de sincronización e índices (usuario+fecha, usuario+estado, paciente, cirujano, sanatorio).
- **Archivos:** `app/api/records/route.ts`, `supabase/migrations/008_search_and_date_columns.sql`.
- **Estado:** paginación corregida en API. **Requiere migración 008** para índices/columna de fecha. El refactor completo de search a filtros 100% en BD (texto, sanatorio, cirujano) y la eliminación de los límites fijos 200/50/500 en búsqueda se documenta como pendiente parcial (ver Riesgos).

### 10. Funcionamiento offline
- **Corrección:** se **eliminó el almacenamiento local de imágenes clínicas** (IndexedDB + Background Sync + cola `pending-uploads` y su banner). La app es 100% online: si se pierde conexión al subir, el usuario ve un error y reintenta; la imagen **no** queda guardada en el dispositivo. Se conservó el **service worker** solo para cache del shell de navegación (la PWA sigue instalable vía "agregar a pantalla de inicio"), y **nunca** cachea respuestas de `/api/` (no persiste datos médicos). Se bumpió el cache a `v3` para descartar cualquier imagen/estado viejo.
- **Archivos:** eliminados `lib/pending-uploads.ts`, `components/app/PendingUploadsBanner.tsx`; modificados `public/sw.js`, `components/records/NewRecordClient.tsx`, `app/(user)/layout.tsx`, `public/manifest.json`.
- **Estado:** corregido. Ya **no** hay imágenes clínicas sin cifrar en el dispositivo → se elimina ese riesgo.

### 11. Dependencias y endurecimiento
- **Corrección:** `npm audit fix` redujo 12→6 high. **Next.js 14→15.5.21** (arregla la mayoría de CVEs de routing/middleware/deserialización). Se agregaron cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`) en `next.config.mjs`, se quitó `X-Powered-By`, se endureció `SameSite: strict` en cookies de impersonación, límites de tasa (`lib/rate-limit.ts`) en login/invitaciones/análisis/relectura/exportación, validación de archivos (MIME/tamaño/cantidad) en todos los endpoints, contraseñas mínimas 12 y errores de OpenRouter/Supabase no expuestos al cliente.
- **Archivos:** `next.config.mjs`, `lib/rate-limit.ts`, rutas API, `app/api/users/route.ts`, `app/api/invites/route.ts`.
- **Estado:** mayormente corregido. **Riesgos pendientes:** (a) los CVEs de `next`/`postcss`/`sharp` que solo se resuelven en `16.3.0`; (b) `xlsx` descontinuado. Ver Riesgos.

### 12. Migraciones, pruebas y entrega
- **Migraciones nuevas:** `007_audit_and_storage_hardening.sql`, `008_search_and_date_columns.sql`. Ambas idempotentes, no alteran datos existentes.
- **Pruebas:** 94 en verde (unitarias + integración de rutas/guards/export). Build de producción OK. Typecheck OK.
- **Documento:** este archivo.

---

## Configuración externa requerida (manual en Supabase/Vercel)

1. **Aplicar migraciones** en el proyecto de Supabase (SQL editor o CLI), en orden: `007`, `008`. **No** borran datos.
2. **Verificar políticas de Storage**: la migración 007 crea políticas en `storage.objects` para el bucket `surgical-images` (insert/select/update/delete con prefijo `auth.uid()`). Confirmar que el bucket existe y que no hay políticas públicas sobrantes.
3. **Vercel**: el deploy usa las variables de entorno ya configuradas. No se requieren nuevas, salvo que se quiera un rate-limiter global (Upstash/KV).

---

## Riesgos pendientes (honestidad)

| # | Riesgo | Estado | Plan |
|---|--------|--------|------|
| 1 | **CVEs de Next/postcss/sharp** que requieren `next@16.3.0` | Parcial (15.5.21 corrige la mayoría) | Impacto bajo en esta app: Server Actions con guards, CSS propio sin input de usuario, sharp solo en build. Salto a 16 como mejora futura no bloqueante |
| 2 | **Rate limiting** es por-instancia (in-memory) en serverless | Mitigación parcial | Para límites globales usar Upstash/Vercel KV (opción futura, requiere recurso externo) |
| 3 | **Búsqueda de texto** se hace en memoria sobre el universo filtrado del usuario | Aceptable (registros por usuario acotados) | Si creciera mucho, indexar texto en la base con FTS |
| 4 | **Políticas Storage / migraciones** no aplicadas a la BD real | Pendiente de ejecución manual | Aplicar 007/008 en Supabase |

---

## Instrucciones de despliegue

1. Aplicar `supabase/migrations/007_*` y `008_*` a la BD de Supabase (idempotentes).
2. Verificar políticas de Storage del bucket `surgical-images`.
3. `npm ci && npm run build` (verificado OK).
4. Commit + `vercel --prod` (solicitar confirmación al responsable antes de desplegar).
5. Probar en Android: carga de imágenes, filtro por mes, exportación Excel/PDF, relectura IA, auditoría admin, bloqueo de usuarios inactivos.

---

## Evidencia de pruebas

- `npx vitest run` → **94 passed, 21 files**.
- `npx tsc --noEmit` → sin errores en código de producción.
- `npx next build` → **compila OK** (Next.js 15.5.21).
- `npm audit` → 3 high (next/postcss/sharp) + 2 moderate (uuid/exceljs), 0 critical, **0 xlsx**.
