import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function readEnvFile(path) {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

async function listAllStoragePaths(supabase, bucket, prefix = '') {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    throw new Error(`No se pudo listar storage (${prefix || '/'}): ${error.message}`)
  }

  const files = []
  for (const entry of data ?? []) {
    const currentPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id) {
      files.push(currentPath)
      continue
    }
    files.push(...await listAllStoragePaths(supabase, bucket, currentPath))
  }

  return files
}

async function countRows(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`)
  return count ?? 0
}

async function deleteTableRows(supabase, table) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null)
  if (error) throw new Error(`No se pudo borrar ${table}: ${error.message}`)
}

async function main() {
  const env = readEnvFile('.env.local')
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const tables = ['surgical_records', 'audit_log', 'invitations', 'custom_field_templates']

  console.log('Conteos antes:')
  for (const table of tables) {
    console.log(`- ${table}: ${await countRows(supabase, table)}`)
  }

  const beforeUsers = await countRows(supabase, 'users')
  console.log(`- users: ${beforeUsers}`)

  const storagePaths = await listAllStoragePaths(supabase, 'surgical-images')
  console.log(`- surgical-images: ${storagePaths.length} archivo(s)`)

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from('surgical-images').remove(storagePaths)
    if (error) throw new Error(`No se pudo borrar storage: ${error.message}`)
  }

  for (const table of tables) {
    await deleteTableRows(supabase, table)
  }

  console.log('\nConteos después:')
  for (const table of tables) {
    console.log(`- ${table}: ${await countRows(supabase, table)}`)
  }

  const afterUsers = await countRows(supabase, 'users')
  const remainingStorage = await listAllStoragePaths(supabase, 'surgical-images')
  console.log(`- users: ${afterUsers}`)
  console.log(`- surgical-images: ${remainingStorage.length} archivo(s)`)

  if (afterUsers !== beforeUsers) {
    throw new Error(`La cantidad de usuarios cambió (${beforeUsers} -> ${afterUsers})`)
  }
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
