# Plan para modo local-only

Objetivo: dejar la app funcionando sin enviar imágenes ni texto clínico a terceros, incluyendo OCR, extracción, normalización y almacenamiento de resultados.

Este documento es solo de planificación. No requiere implementación ahora.

## Decisión de producto

- El procesamiento principal será local.
- No se enviarán imágenes clínicas a OpenRouter ni a otros proveedores externos.
- El envío a terceros, si existe en el futuro, quedará desactivado por defecto y separado del flujo principal.
- El objetivo es que el médico use la app sin depender de conectividad a servicios externos para procesar datos sensibles.

## Modelos y motores a usar

### OCR principal

- `PaddleOCR` en versión liviana para CPU
- preferencia por modelos `PP-OCR` mobile/slim
- uso para detección de texto y reconocimiento de texto impreso

### OCR alternativo

- `Tesseract` como fallback simple si se necesita una instalación mínima
- útil para textos bien escaneados, aunque con menor calidad que PaddleOCR en muchos casos

### Procesamiento de texto

- reglas locales para normalizar fechas, nombres, sanatorios y procedimientos
- parser local para campos estructurados
- opcionalmente un modelo local chico solo para limpieza o clasificación, nunca para leer la imagen cruda

### Exclusiones

- no usar OpenRouter como OCR principal
- no usar VLM remoto como paso obligatorio del flujo
- no usar un modelo grande que obligue a enviar la imagen a un tercero

## Alcance del modo local-only

Debe quedar local:

- subida de imagen
- OCR
- extracción de campos
- normalización de fechas y nombres
- detección de duplicados
- almacenamiento de resultado estructurado
- exportación PDF/XLSX
- auditoría interna
- cola de trabajos de OCR y parseo
- redacción de identificadores sensibles antes de persistir o exportar, si se define como política

Puede seguir siendo remoto solo si no contiene datos clínicos:

- autenticación del sistema
- hosting de la app
- almacenamiento general del proyecto

## Flujo objetivo

1. El médico sube la imagen a la app.
2. El servidor recibe la imagen.
3. El servidor crea un trabajo de procesamiento local.
4. Un worker toma el trabajo y ejecuta OCR local.
5. El OCR devuelve texto plano con bloques o líneas.
6. El parser local extrae campos clínicos y normaliza formatos.
7. Si hace falta, un modelo local chico corrige formato o agrupa texto, sin salir del servidor.
8. La app guarda el registro estructurado.
9. La imagen temporal se elimina según política de retención.

## Pipeline de procesamiento

### Entrada

- archivo de imagen enviado desde navegador o celular
- validación de tipo, tamaño y cantidad
- almacenamiento temporal en el servidor

### OCR

- conversión de imagen a texto local
- preservación de orden de lectura por líneas o bloques
- salida intermedia en texto plano

### Normalización

- limpieza de espacios y saltos de línea
- detección de fechas y conversión a formato único
- normalización de nombres de campos conocidos
- separación de valores múltiples con reglas simples

### Extracción

- mapeo del texto OCR a campos del formulario
- validación de campos obligatorios
- detección de duplicados en base a texto ya extraído

### Persistencia

- guardar solo el resultado necesario para el negocio
- conservar la imagen solo si es imprescindible y por tiempo limitado
- registrar auditoría de qué usuario procesó qué archivo y cuándo

## Qué hay que reemplazar más adelante

- Cualquier llamada a OpenRouter para análisis de imágenes.
- Cualquier uso de proveedor externo para leer o interpretar texto clínico.
- Cualquier fallback que mande imágenes completas a un tercero.
- Cualquier lógica que dependa de que el tercero “vea” el documento para que el sistema funcione

## Componentes que habrá que agregar

- motor OCR local para Linux CPU
- worker de procesamiento en segundo plano
- cola de trabajos
- política de retención y borrado
- configuración para activar o desactivar OCR local
- métricas de tiempo de procesamiento
- manejo de errores de OCR sin exponer datos sensibles
- instalación reproducible de dependencias del motor OCR
- pruebas con imágenes reales o sintéticas de ficha médica
- script de verificación del worker local

## Requisitos funcionales

- El sistema debe procesar imágenes sin depender de un tercero.
- El sistema debe producir resultados aceptables para texto médico impreso.
- El sistema debe soportar varios usuarios sin mezclar datos entre cuentas.
- El sistema debe dejar trazabilidad de qué se procesó, cuándo y por quién.
- el OCR debe funcionar en la VPS sin GPU
- el tiempo de procesamiento debe ser aceptable para uso humano normal
- el resultado debe poder alimentar el formulario actual sin cambios manuales grandes

## Requisitos de privacidad

- No enviar imágenes clínicas a terceros por defecto.
- No enviar DNI, nombre del paciente ni diagnóstico a servicios externos.
- Si en el futuro se habilita un tercero, debe ser una opción explícita y documentada.
- Mantener la posibilidad de borrar datos y exportarlos.
- preferir no guardar la imagen una vez extraídos los datos, salvo necesidad operativa
- si se guarda la imagen, definir retención corta y borrado automático

## Orden recomendado de trabajo

1. Primero estabilizar la app actual.
2. Luego introducir OCR local.
3. Después reemplazar el flujo de extracción remoto.
4. Finalmente retirar el camino externo o dejarlo solo como fallback manual.

## Notas de implementación futura

- La app puede seguir mostrando el mismo formulario actual.
- El cambio importante estará en el backend: donde hoy se llama a OpenRouter, más adelante se llamará al worker local.
- Si el OCR local falla, el sistema debe mostrar error claro y permitir reintento manual.
- Si el texto extraído es incompleto, el usuario debe poder corregirlo en el formulario antes de guardar.
- El local-only debe ser la ruta principal; cualquier asistencia externa quedará como excepción apagada por defecto.

## Criterio de salida

Este plan se considera listo cuando:

- la app puede funcionar sin OpenRouter para OCR y extracción
- no se requiere enviar datos clínicos a terceros para usar la funcionalidad principal
- el flujo local produce resultados suficientemente buenos para el uso médico previsto
