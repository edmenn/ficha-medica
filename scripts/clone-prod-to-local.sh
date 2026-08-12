#!/usr/bin/env bash
# Clona los datos de produccion al entorno local de Supabase.
# Requiere: Docker corriendo, Supabase CLI linkeado a produccion y el password
# de la DB de produccion en $DB_PASS (suele estar en .env.local.prod-backup).
set -euo pipefail

DB_PASS="${DB_PASS:-}"
DB_CONTAINER="supabase_db_Osvaldo_-_Ficha_Medica"
TMP_AUTH="/tmp/auth-users-dump.sql"
TMP_PUBLIC="/tmp/prod-dump.sql"
TMP_AUTH_CLEAN="/tmp/auth-users-clean.sql"

if [[ -z "$DB_PASS" ]]; then
  echo "Falta DB_PASS. Ej.: DB_PASS='xxxx' $0" >&2
  exit 1
fi

echo "==> Dump de produccion (public)"
supabase db dump --linked --schema public --data-only --use-copy \
  --password "$DB_PASS" --file "$TMP_PUBLIC"

echo "==> Dump de produccion (auth.users / identities)"
supabase db dump --linked --schema auth --data-only --use-copy \
  --password "$DB_PASS" --file "$TMP_AUTH"

# Extraer solo las tablas auth necesarias para login
awk '/^COPY "auth"."users"/,/^\\\.$/' "$TMP_AUTH" > /tmp/part1.sql
awk '/^COPY "auth"."identities"/,/^\\\.$/' "$TMP_AUTH" > /tmp/part2.sql
{
  echo "SET session_replication_role = replica;"
  cat /tmp/part1.sql
  echo ""
  cat /tmp/part2.sql
  echo "SET session_replication_role = DEFAULT;"
} > "$TMP_AUTH_CLEAN"

echo "==> Limpieza de tablas locales"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE public.audit_log CASCADE;
TRUNCATE public.surgical_records CASCADE;
TRUNCATE public.custom_field_templates CASCADE;
TRUNCATE public.impersonation_sessions CASCADE;
TRUNCATE public.invitations CASCADE;
TRUNCATE public.users CASCADE;
DELETE FROM auth.identities;
DELETE FROM auth.sessions;
DELETE FROM auth.users;
SQL

echo "==> Restaurar auth"
docker cp "$TMP_AUTH_CLEAN" "$DB_CONTAINER":/tmp/auth-users-clean.sql
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/auth-users-clean.sql

echo "==> Restaurar public"
docker cp "$TMP_PUBLIC" "$DB_CONTAINER":/tmp/prod-dump.sql
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/prod-dump.sql

echo "==> Copiar imagenes de storage"
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY_PROD:-}" ]]; then
  node scripts/sync-storage-prod-to-local.mjs
else
  echo "  (skip storage: falta SUPABASE_SERVICE_ROLE_KEY_PROD)"
fi

echo "==> Clon completado."
echo "Login local: usar las credenciales de produccion (misma password)."
