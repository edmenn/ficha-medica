# Admin Workspace Design

**Date:** 2026-05-03  
**Scope:** Entorno exclusivo de administración, separado del flujo clínico  
**Decision source:** instrucciones directas del usuario, sin más preguntas

---

## Objetivo

Rediseñar el rol `admin` para que deje de ser “usuario bloqueado” y pase a ser un workspace propio de backoffice.

El admin debe:

- entrar a un entorno exclusivo de administración
- ver el listado de usuarios
- entrar a un usuario
- ver los registros/archivos de ese usuario
- inspeccionar detalle de registros en modo lectura

El admin no debe usar el flujo clínico normal como si cargara fichas propias.

---

## Cambio conceptual

### Antes

- el admin comparte navegación con usuarios operativos
- ve pantallas como `records`, `search`, `reports`, `new`
- simplemente se bloquea al intentar operar

### Después

- el admin entra a rutas `admin/*`
- la navegación inferior cambia por completo
- las pantallas clínicas dejan de ser el centro del rol admin
- el admin trabaja sobre usuarios y sus registros, no sobre sus propias fichas

---

## Sección 1: Navegación separada

### Nuevo destino principal del admin

- `/admin/users`

### Rutas clínicas que deben dejar de ser workspace principal del admin

- `/records`
- `/records/[id]`
- `/new`
- `/search`
- `/reports`

### Comportamiento

Si un admin entra a esas rutas, debe ser redirigido a `/admin/users`.

`/settings` puede seguir existiendo, pero en modo admin debe comportarse como configuración de cuenta + acceso a herramientas administrativas, no como configuración clínica.

---

## Sección 2: Listado de usuarios

### Página

- `/admin/users`

### Contenido

- usuarios activos
- rol
- fecha de alta
- cantidad de registros por usuario
- acceso a detalle del usuario
- herramientas existentes de crear usuario/invitar usuario

### Fuente de datos

Server-side con service role, porque el admin necesita visibilidad completa y consistente.

---

## Sección 3: Detalle de usuario administrado

### Página

- `/admin/users/[id]`

### Contenido

- email y rol del usuario
- fecha de alta
- resumen de actividad
- lista de registros de ese usuario
- estado de cada registro
- fecha clínica y sanatorio

### Regla

Es una vista de supervisión, no una sesión “impersonada”.

---

## Sección 4: Detalle de registro en modo lectura

### Página

- `/admin/users/[id]/records/[recordId]`

### Contenido

- imágenes/archivos asociados
- datos estructurados del registro
- estado
- formulario reutilizado en modo read-only

### Regla

El admin puede ver, no editar ni releer con IA ni borrar desde esta vista.

---

## Sección 5: Layout y navegación admin

### Bottom nav admin

El admin debe tener navegación exclusiva:

- `Usuarios`
- `Cuenta`

No debe ver:

- `Nueva`
- `Registros`
- `Buscar`
- `Reportes`

---

## Sección 6: Seguridad y acceso

### Lectura administrativa

Las pantallas admin usarán consultas server-side con `createServiceClient()` y chequeo estricto de rol admin.

### Escritura administrativa

Se mantienen sólo las capacidades de administración de usuarios/invitaciones.

### Operación clínica

`requireOperationalUser()` sigue bloqueando endpoints clínicos para admins.

Eso es correcto a nivel API; lo que cambia es el workspace de UI.

---

## Verificación requerida

- login admin lleva a navegación administrativa coherente
- admin no queda atrapado en `/new` con mensaje de error, sino redirigido
- admin ve usuarios
- admin puede abrir un usuario
- admin puede abrir un registro del usuario y ver imágenes/datos en solo lectura
- `npm test`
- `npx tsc --noEmit`
- `npm run build`

---

## Fuera de alcance de esta spec

- edición administrativa de registros de terceros
- impersonación de usuario
- analytics complejos de administración
