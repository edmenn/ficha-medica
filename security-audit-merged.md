# Security Audit: Ficha Médica (Consolidado)

**Fecha:** 2026-08-10
**Proyecto:** ficha-medica (Next.js 14, Supabase, OpenRouter AI)
**Metodología:** skill `code-review-security` (OWASP Top 10, 2021) adaptada al stack TypeScript/Next.js/Supabase.
**Origen:** fusión de `security-audit.md` (Codex) y `security-audit-opencode.md` (opencode), deduplicada y verificada contra el código.

---

## Resumen ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| Critical  | 0 |
| High      | 3 |
| Medium    | 3 |
| Low       | 2 |
| Info      | 3 |

**Veredicto general:** la arquitectura de seguridad es **sólida** en control de acceso (guards + RLS bien configurados, impersonación auditada y validada, sin secretos hardcodeados, sin XSS/SQLi evidentes). Las mayores exposiciones provienen de **dependencias desactualizadas** (`next`, `xlsx`) y de **endpoints de autenticación sin rate limiting**.

> Nota de auditoría: este reporte combina dos auditorías independientes con la misma skill. Las diferencias originales surgieron porque la skill es una guía/checklist genérico (orientado a Python/FastAPI) que cada agente adaptó al stack real, y porque cada uno inspeccionó rutas de código distintas. Aquí se unifican los hallazgos y se corrigen dos que, tras verificación, eran condicionales o parcialmente incorrectos (ver Low/Info).

---

## Hallazgos

### [HIGH] Dependencias con vulnerabilidades conocidas (OWASP A06)
- **Categoría:** A06 – Vulnerable and Outdated Components
- **CVE/GHSA:** múltiples (ver detalle)
- **Fuente:** `npm audit --json`

`npm audit` reporta **12 vulnerabilidades high, 0 critical, 615 dependencias**.

- **`next@14.2.35`** → fix en `16.3.0` (salto mayor, breaking). Advisories incluyen:
  - SSRF vía WebSocket upgrades (GHSA-c4j6-fc7j-m34r, CVSS 8.6)
  - Request deserialization / Server Components DoS (GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3)
  - Disclosure de Server Function endpoints (GHSA-955p-x3mx-jcvp)
  - Middleware/proxy cache poisoning, cache confusion, request smuggling, XSS (CSP nonces, beforeInteractive)
- **`xlsx@0.18.5`** → Prototype Pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS (GHSA-5pgg-2g8v-p4x9). Paquete **descontinuado** en npm, `fixAvailable: false`. Mitigación: solo procesa XLSX subidos por el admin.
- **`undici`** (transitiva de Next) → TLS validation bypass (via SOCKS5), header injection, DoS. Fix disponible.
- **`nanoid`** → DoS por loop infinito con `size <= 0`. Fix disponible.
- **`eslint-config-next` / `@next/eslint-plugin-next` / `glob`** → afectadas transitivamente (dev-only, riesgo bajo en producción).
- **`postcss`** → advisories XSS / path traversal (transitiva, riesgo bajo).

**Recomendación:**
1. Planear migración a `next@15`/`16` (revisar breaking changes).
2. Reemplazar `xlsx` por `exceljs` o sheetjs desde fuente oficial.
3. `npm update` para `undici` y `nanoid`.

*Este audit confirma riesgo de dependencias, no prueba explotabilidad en el runtime exacto de la app.*

---

### [HIGH] Sin rate limiting / lockout en autenticación (OWASP A04 / A07)
- **Categoría:** A04 – Insecure Design / A07 – Identification and Authentication Failures
- **CWE:** CWE-307
- **Archivos:**
  - `app/api/invites/route.ts` (POST aceptar invitación + crear usuario; GET validar token)
  - `app/(auth)/login/page.tsx` (`signInWithPassword`)
  - `app/(auth)/accept-invite/[token]/page.tsx`

El login llama `signInWithPassword` directamente y el flujo de activación de invitación acepta contraseñas sin control anti-automatización, backoff ni lockout. No hay rate limit, CAPTCHA ni capa de seguimiento de intentos en el repo.

**Impacto:** credential stuffing y fuerza bruta facilitados; los tokens de invitación pueden sondearse.

**Recomendación:**
```ts
// rate limit por IP (upstash/redis en Vercel)
import { rateLimit } from "@upstash/ratelimit"
const limiter = new rateLimit({ interval: "60 s", limit: 5 })
```
- ≤5 intentos/minuto por IP en login y activación de invitación.
- Backoff exponencial o lockout tras 5+ fallos consecutivos.
- CAPTCHA solo si el abuso aparece en práctica.

---

### [HIGH] Política de contraseñas demasiado débil para cuentas creadas por admin (OWASP A07)
- **Categoría:** A07 – Identification and Authentication Failures
- **CWE:** CWE-521
- **Archivo:** `app/api/users/route.ts:43` (verificado: `password.length < 8`)

El endpoint de creación de usuarios acepta contraseñas de mínimo **8 caracteres**. Para un sistema de datos médicos está por debajo del estándar razonable (12+).

**Impacto:** contraseñas iniciales débiles para cuentas creadas manualmente; mayor riesgo si se reutilizan o adivinan.

**Recomendación:**
- Elevar el mínimo a 12+ caracteres.
- Reforzar la política en el límite del servidor, no solo en la UI.
- Si el admin crea credenciales temporales, forzar cambio de contraseña en el primer login.

---

### [MEDIUM] Errores de base de datos expuestos al cliente (OWASP A05)
- **Categoría:** A05 – Security Misconfiguration
- **CWE:** CWE-209
- **Archivos:** `app/api/records/[id]/route.ts`, `app/api/invites/route.ts`, `app/api/users/[id]/route.ts`, `app/api/users/route.ts`

Se devuelve `error.message` de Supabase directamente en las respuestas (estatus 500/400/404), lo que puede filtrar detalles internos del esquema o de la base.

**Recomendación:** mapear a mensajes genéricos y loguear el detalle en el servidor:
```ts
if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
console.error('[records]', error)
```

---

### [MEDIUM] Tokens de invitación expuestos en la URL (OWASP A08 / A03)
- **Categoría:** A08 – Software and Data Integrity Failures / A03 – Injection
- **Archivos:** `app/api/invites/route.ts` (GET), `app/(auth)/accept-invite/[token]/page.tsx`

El token viaja como **parámetro de ruta** (`/accept-invite/{token}`) y se valida por GET. Queda en logs del servidor, historial del navegador y referer.

**Recomendación:**
- Token de un solo uso (ya hay `accepted_at`).
- Expiración corta (ya hay `expires_at`).
- Considerar rotación tras el primer GET de validación.

---

### [MEDIUM] Middleware usa presencia de cookie como señal de sesión (OWASP A07)
- **Categoría:** A07 – Identification and Authentication Failures
- **Archivo:** `middleware.ts:5-17`

El middleware redirige según si existe cualquier cookie `sb-`. Es un atajo de UX, **no** una decisión de seguridad (no valida la sesión). La autorización real ocurre en el servidor (bien). El matcher excluye `/api/`, que dependen de los guards.

**Impacto:** posible confusión de redirección con cookies viejas/malformadas; falso sentido de seguridad si se asume que el middleware aplica auth.

**Recomendación:**
- Mantener la autorización real en los helpers del servidor.
- Tratar el middleware solo como enrutamiento.
- Si se desea enrutamiento robusto, validar la sesión server-side antes de redirigir.

---

### [LOW] Cookie de impersonación con `SameSite: lax` (OWASP A07)
- **Categoría:** A07 – Identification and Authentication Failures
- **Archivo:** `app/api/admin/impersonation/start/route.ts:51`

La cookie `IMPERSONATION_COOKIE` se crea con `httpOnly`, `secure` y `sameSite: lax`. `lax` permite envío en navegaciones top-level; `strict` es preferible para cookies de sesión sensibles.

> Verificación: la revocación **sí** está funcional — `lib/auth/impersonation.ts` (`getActiveImpersonation`) valida `ended_at IS NULL` en cada llamada, no solo la presencia de la cookie. El riesgo real aquí es solo el valor de `SameSite`.

**Recomendación:** cambiar a `sameSite: 'strict'`.

---

### [LOW] Ausencia de cabeceras de seguridad explícitas (OWASP A05)
- **Categoría:** A05 – Security Misconfiguration
- **Archivo:** `next.config.mjs` (vacío, sin `headers`)

No hay `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy` configuradas. La app depende de la plataforma de hosting o de los defaults del navegador.

**Recomendación:**
```js
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
```

---

### [INFO] Riesgo condicional: políticas RLS públicas en `invitations` (OWASP A01)
- **Categoría:** A01 – Broken Access Control / Verificación operativa
- **CWE:** CWE-200
- **Archivo:** `supabase/migrations/002_rls.sql` vs `supabase/migrations/005_security_hardening.sql:33`

La migración **002** define `invitations_accept ... for select using (true)` (lectura pública) y `invitations_admin` (admin). La migración **005** (vigente) **las elimina** (línea 33). Si la 005 se aplicó en producción, no hay exposición. Riesgo **solo** si la 005 no se aplicó o quedaron políticas huérfanas.

**Recomendación:** confirmar en el dashboard de Supabase que `invitations` no tenga políticas públicas activas y que los grants de la tabla y storage coincidan con el RLS.

---

### [INFO] Sin rate limiting general en API (OWASP A04)
- **Categoría:** A04 – Insecure Design
- **Archivos:** `app/api/analyze/route.ts`, `app/api/export/route.ts`

`/api/analyze` (llama a OpenRouter con la API key del usuario) y `/api/export` (XLSX/PDF) no tienen límite. Un usuario autenticado podría abusar del análisis AI (costo) o generar exports pesados.

---

### [INFO] Uso de `service_role_key` en todas las API (OWASP A05)
- **Categoría:** A05 – Security Misconfiguration / Arquitectura
- **Archivo:** `lib/supabase/server.ts` (`createServiceClient`)

Toda operación de API pasa por `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) y la autorización se delega a los guards Node. Correcto **si** los guards son exhaustivos; concentra el riesgo en cualquier ruta que olvide el guard. Mantener disciplina: usar `requireAdminApi` / `requireOperationalContext` en toda ruta.

---

## Verificaciones que PASARON

- ✅ **Sin secretos hardcodeados** en `app/`, `components/`, `lib/`, `middleware.ts` (solo `process.env.*`).
- ✅ **Sin XSS** evidente: sin `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.cookie` ni manipulación insegura de `innerHTML`.
- ✅ **Sin SQLi / shell injection**: se usa el cliente Supabase (parametrizado) en todas las consultas; sin `subprocess`/`os.system`/`pickle`.
- ✅ **RLS bien configurada** en `002_rls.sql` y reforzada en `005_security_hardening.sql` (policies por usuario `to authenticated`; `is_admin()` security definer en 002, retirada en 005 a favor de APIs con service role).
- ✅ **Control de acceso a recursos**: rutas usan `requireUserApi`, `requireAdminApi`, `requireOperationalContext`; los queries filtran por `user_id`/`effectiveUserId` (sin IDOR en records).
- ✅ **Impersonación validada**: no se permite impersonar admins ni usuarios inactivos; guard `admin_id === profile.id`; sesión activa validada (`ended_at IS NULL`) en cada uso; auditada en `audit_log`.
- ✅ **Auto-guardado de admin**: no se puede degradar/eliminar el propio usuario admin (`app/api/users/[id]/route.ts`).
- ✅ **Imágenes en Storage** con URLs firmadas (expiración 1h) y validación de MIME/tamaño (10MB).
- ✅ **Encriptación** de datos sensibles con `ENCRYPTION_KEY` desde entorno.
- ✅ **Cookies** `httpOnly` + `secure` en producción.

---

## Riesgo residual / pendiente de verificación operativa

- Que el proyecto de Supabase en producción tenga las políticas, grants, storage buckets y service role alineados con el RLS.
- Cabeceras de seguridad en tiempo de ejecución (sin confirmar en el deploy).
- Migraciones de BD aplicadas en orden en el entorno de producción.

---

## Prioridades de acción

1. **Alta** — Actualizar dependencias (`next`, `undici`, `nanoid`) y reemplazar `xlsx`.
2. **Alta** — Añadir rate limiting a login e invitaciones.
3. **Alta** — Elevar mínimo de contraseña a 12+ en `app/api/users/route.ts`.
4. **Media** — No exponer `error.message` de Supabase al cliente.
5. **Media** — Endurecer cookie de impersonación (`sameSite: strict`).
6. **Baja** — Cabeceras de seguridad; verificar políticas públicas en `invitations` (migración 005 aplicada).

---

## Referencias
- OWASP Top 10 (2021): https://owasp.org/Top10/
- GHSA-4r6h-8v6p-xvw6 (xlsx Prototype Pollution) · GHSA-5pgg-2g8v-p4x9 (xlsx ReDoS)
- GHSA-c4j6-fc7j-m34r (Next.js SSRF) · GHSA-h25m-26qc-wcjf (Next.js deserialization DoS)
- GHSA-955p-x3mx-jcvp (Next.js Server Function disclosure)
