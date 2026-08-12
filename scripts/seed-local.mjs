import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { email: 'e2e-user-aa7b0cae1a86@example.com', password: 'E2E-user-Secret-2026!', role: 'user' },
  { email: 'e2e-admin-aa7b0cae1a86@example.com', password: 'E2E-admin-Secret-2026!', role: 'admin' },
  { email: 'test@example.com', password: 'Test-user-Secret-2026!', role: 'user' },
]

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket('surgical-images')
  if (error) {
    const { error: createError } = await supabase.storage.createBucket('surgical-images', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    })
    if (createError) throw new Error(`No se pudo crear bucket: ${createError.message}`)
    console.log('Bucket surgical-images creado.')
  } else {
    console.log('Bucket surgical-images ya existe.')
  }
  return data?.id
}

async function ensureUser({ email, password, role }) {
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw new Error(`listUsers: ${listError.message}`)
  const found = (existing?.users ?? []).find(u => u.email === email)
  if (found) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(found.id, { user_metadata: { role } })
    if (updateError) throw new Error(`updateUser ${email}: ${updateError.message}`)
    console.log(`Usuario existente: ${email}`)
    return found.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  console.log(`Usuario creado: ${email}`)
  return data.user.id
}

async function ensureProfile(userId, email, role) {
  const { data: existing, error: selectError } = await supabase
    .from('users').select('id, role').eq('id', userId).maybeSingle()
  if (selectError) throw new Error(`select users ${email}: ${selectError.message}`)
  if (existing) {
    if (existing.role !== role) {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId)
      if (error) throw new Error(`update profile ${email}: ${error.message}`)
      console.log(`Perfil actualizado: ${email} -> ${role}`)
    }
    return
  }
  const { error } = await supabase.from('users').insert({ id: userId, email, role })
  if (error) throw new Error(`insert profile ${email}: ${error.message}`)
  console.log(`Perfil creado: ${email} (${role})`)
}

async function seedRecords(userId, count = 3) {
  const { data: existing, error: countError } = await supabase
    .from('surgical_records').select('id').eq('user_id', userId).limit(1)
  if (countError) throw new Error(`count records: ${countError.message}`)
  if (existing && existing.length > 0) {
    console.log(`Ya hay registros para ${userId}; skip.`)
    return
  }

  const now = new Date()
  const records = Array.from({ length: count }).map((_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const fecha = `${dd}-${mm}-${yyyy}`
    const procedimientos = ['Apendicectomía', 'Colecistectomía', 'Hernioplastia', 'Cesárea', 'Artroscopia de rodilla']
    const sanatorios = ['Sanatorio Parque', 'Clínica del Sol', 'Sanatorio Americano', 'Hospital Central']
    return {
      user_id: userId,
      image_path: `seed/${userId}/${i}.jpg`,
      image_paths: [`seed/${userId}/${i}.jpg`],
      status: 'final',
      final_data: {
        paciente: `Paciente de prueba ${i + 1}`,
        fecha_cirugia: fecha,
        diagnostico: `Diagnóstico ${i + 1}`,
        procedimiento: procedimientos[i % procedimientos.length],
        cirujano: 'Dr. Prueba',
        ayudantes: null,
        anestesiologo: 'Dra. Anestesia',
        instrumentador: null,
        sanatorio: sanatorios[i % sanatorios.length],
        observaciones: `Registro de prueba generado en seed local (${i + 1}).`,
      },
      surgical_date: `${yyyy}-${mm}-${dd}`,
    }
  })

  const { error } = await supabase.from('surgical_records').insert(records)
  if (error) throw new Error(`insert records: ${error.message}`)
  console.log(`${count} registros creados para ${userId}.`)
}

async function main() {
  await ensureBucket()
  const ids = {}
  for (const u of USERS) {
    const id = await ensureUser(u)
    await ensureProfile(id, u.email, u.role)
    ids[u.email] = id
  }
  await seedRecords(ids['e2e-user-aa7b0cae1a86@example.com'])
  await seedRecords(ids['test@example.com'])
  console.log('\nSeed local completado.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
