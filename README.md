# Transformador geodesico INEGI

Aplicacion estatica (HTML, CSS y JavaScript) para los 15 puntos de prueba precargados. No usa Python, Node.js ni backend.

## Ejecucion en Windows

Puede abrir `index.html` directamente en un navegador moderno. Para que el navegador tenga menos restricciones sobre CORS, sirva la carpeta con cualquier servidor HTTP estatico que ya tenga instalado, por ejemplo un servidor disponible en el sistema, y abra `http://localhost:<puerto>/`.

No se incluye ni se ejecuta un servidor Node.js ni Python.

## Uso

Seleccione los marcos, zona, hemisferio y tipo de Z. La aplicacion envia cada punto por separado al servicio oficial:

- TRANINV: `https://www.inegi.org.mx/app/geo2/traninv/api/utm`
- El campo `datum=nad27` transforma desde NAD27 hacia ITRF92.
- El campo `datum=itrf92` transforma desde ITRF92 hacia NAD27.

Las respuestas se registran en el reporte detallado. Z nunca se interpreta como altura transformada; se conserva y se identifica como dato original.

## Estado de integracion

- NAD27 <-> ITRF92: verificado por llamadas individuales contra TRANINV.
- ITRF92 <-> ITRF2008: verificado desde navegador con `POST multipart/form-data` contra TRANITRF y descarga ZIP por `GET`.
- Rutas que combinan TRANINV con TRANITRF: encadenadas mediante ITRF92.

### Formato comprobado de TRANITRF

El formulario usa:

- `POST https://www.inegi.org.mx/app/geo2/tranitrf/recibe.do`
- Campos `todo=upload`, `de_a=de92a00` o `de00a92`, `select=1` o `2` y archivo `tyfile`.
- Descarga con `GET https://www.inegi.org.mx/app/geo2/tranitrf/download.do?file=<archivo.zip>`.

La aplicacion procesa el TXT por lotes, extrae en memoria `CALCULOS.txt` y registra la respuesta JSON y ZIP. Requiere altura elipsoidal confirmada para estas rutas.

La precision cartografica y las limitaciones de TRANINV deben contrastarse con la documentacion oficial de INEGI antes de uso operativo.
