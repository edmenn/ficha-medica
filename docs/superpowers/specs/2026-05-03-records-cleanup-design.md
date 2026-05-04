# Records Cleanup Design

**Date:** 2026-05-03  
**Scope:** Reset de datos operativos, simplificación del modelo clínico, corrección de fechas, borradores y UX de registros  
**Decision source:** instrucciones directas del usuario, sin más preguntas

---

## Objetivo

Corregir el flujo clínico actual para que:

- se eliminen todos los datos operativos existentes, preservando sólo acceso de usuarios
- cada ficha maneje una sola fecha clínica: la fecha de inicio
- la fecha se detecte, normalice y muestre siempre como `dd-mm-aaaa`
- el flujo de borradores y duplicados sea coherente
- la lista de registros use dropdown para tamaño de página

---

## Reglas cerradas

- Borrado total de datos operativos actuales.
- Conservar únicamente usuarios y acceso.
- Eliminar del modelo activo: `fecha_fin`, `hora_inicio`, `hora_fin`, `duracion`.
- Conservar sólo `fecha_cirugia`, entendida como fecha de inicio clínica.
- Mostrar y guardar fecha en formato `dd-mm-aaaa`.
- El admin se rediseña en una spec separada.

---

## Sección 1: Reset total de datos

### Qué se elimina

- `surgical_records`
- `audit_log`
- `invitations`
- `custom_field_templates`
- imágenes en bucket `surgical-images`

### Qué se preserva

- usuarios de auth
- filas de `public.users`
- credenciales y acceso

### Estrategia

Se ejecuta un script administrativo idempotente con service role:

1. listar y borrar objetos del bucket `surgical-images`
2. truncar/limpiar tablas operativas en orden seguro
3. verificar que queden `0` registros operativos y que usuarios sigan presentes

Rationale: el usuario pidió borrado total, no migración de datos.

---

## Sección 2: Modelo clínico simplificado

### Cambio funcional

La ficha deja de modelar rango temporal. Sólo queda:

- `fecha_cirugia`

Se eliminan del dominio activo:

- `fecha_fin`
- `hora_inicio`
- `hora_fin`
- `duracion`

### Impacto técnico

Se actualizan:

- `types/index.ts`
- parser IA
- prompt IA
- validaciones
- formularios
- exports
- cards/listados
- tests

No se requiere migración compleja sobre datos históricos porque los datos operativos serán eliminados.

---

## Sección 3: Fecha correcta en `dd-mm-aaaa`

### Problema actual

La extracción actual mezcla dos responsabilidades:

- inferir cuál fecha del documento es la clínica
- convertir a formato ISO

Eso produce inversiones de orden y años incorrectos.

### Nueva regla

La IA debe devolver la fecha clínica exactamente como fecha de inicio y en convención `DD-MM-AAAA`.

### Reglas de extracción

- priorizar fecha de cirugía/inicio/procedimiento
- ignorar fecha de impresión, emisión, cierre o finalización
- si el documento muestra `22-01-26`, normalizar a `22-01-2026`
- si el documento muestra `19-01-26`, normalizar a `19-01-2026`

### Regla de normalización

La capa de normalización acepta entradas comunes:

- `DD-MM-AA`
- `DD/MM/AA`
- `DD-MM-AAAA`
- `AAAA-MM-DD`

Y siempre devuelve:

- `dd-mm-aaaa`

Si no puede normalizar sin ambigüedad razonable, conserva texto limpio en vez de inventar otra fecha.

---

## Sección 4: Borradores y duplicados

### Problema actual

El flujo crea borradores al analizar, pero el usuario percibe incoherencia:

- si no guarda, no ve claramente el borrador
- al intentar crear otra ficha, aparece conflicto por duplicado

### Nuevo comportamiento

1. `POST /api/analyze` sigue creando un registro `draft` al terminar análisis exitoso.
2. La lista de registros debe mostrar esos drafts con etiqueta legible `Borrador`.
3. La detección de duplicados sigue comparando paciente + fecha.
4. La UX de duplicado debe ser explícita y consistente:
   - si existe ficha previa, ofrecer abrirla o crear otra igualmente
   - el estado no debe bloquear silenciosamente guardado posterior

### Ajuste adicional

Después del reset total, no habrá ruido histórico que distorsione esta validación.

---

## Sección 5: Lista y paginación

### Cambio requerido

La selección `10 / 20 / 50 / 100` deja de mostrarse como botones en línea.

### Nuevo diseño

Usar un `select`/dropdown único para `pageSize`.

### Reglas

- conserva opciones `10`, `20`, `50`, `100`
- al cambiar el valor, vuelve a página `1`
- mantiene query params compatibles

---

## Sección 6: Consecuencias para orden y visualización

Como `fecha_cirugia` deja de ser ISO y pasa a `dd-mm-aaaa`, cualquier ordenación lexicográfica en SQL deja de ser confiable.

Dado el tamaño pequeño del sistema, la estrategia aprobada es:

- leer registros necesarios del usuario
- ordenar por fecha usando helper de parsing en servidor/app
- paginar sobre el resultado ordenado

Esto evita reintroducir conversiones ISO en el valor visible.

---

## Verificación requerida

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- script de reset confirma:
  - `surgical_records = 0`
  - `audit_log = 0`
  - `invitations = 0`
  - `custom_field_templates = 0`
  - bucket sin imágenes
  - usuarios siguen presentes

---

## Fuera de alcance de esta spec

- workspace administrativo separado
- navegación y layout exclusivo para admins
- vista de usuarios y registros por usuario

Eso se cubre en la segunda spec: `admin workspace`.
