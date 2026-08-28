// Copia las imagenes del bucket surgical-images de produccion al Supabase local.
// Lee rutas de image_paths desde el DB local (ya clonado) y descarga/sube por API.
import { execSync } from 'child_process'

const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || 'https://vpanzdhicflmvtjmjcig.supabase.co'
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD
const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL || 'http://127.0.0.1:54321'
const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL || process.env.SUPABASE_SERVICE_ROLE_KEY
const DB_CONTAINER = 'supabase_db_Osvaldo_-_Ficha_Medica'
const BUCKET = 'surgical-images'

if (!PROD_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY_PROD')
  process.exit(1)
}

const out = execSync(
  `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -t -A -c "select unnest(image_paths) from public.surgical_records where image_paths <> '{}'"`
).toString()
const paths = out.split('\n').map(s => s.trim()).filter(path => path && path !== 'manual-entry')
console.log('Imagenes a copiar:', paths.length)

for (const path of paths) {
  const dl = await fetch(`${PROD_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { authorization: `Bearer ${PROD_KEY}`, apikey: PROD_KEY },
  })
  if (!dl.ok) { console.log('  DL fail', path, dl.status); continue }
  const buf = Buffer.from(await dl.arrayBuffer())
  const up = await fetch(`${LOCAL_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${LOCAL_KEY}`,
      apikey: LOCAL_KEY,
      'Content-Type': dl.headers.get('content-type') || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: new Uint8Array(buf),
  })
  console.log(`  ${path} dl=${dl.status} up=${up.status} (${buf.length}b)`)
}
