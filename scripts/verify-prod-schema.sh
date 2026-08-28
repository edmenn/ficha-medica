#!/usr/bin/env bash
# Verifica que el esquema de la DB de producción coincida con las migraciones
# del repo. Reporta objetos faltantes. Hace UNA sola conexión a la DB.
#
# Uso:
#   DB_PASS='...' bash scripts/verify-prod-schema.sh
#
# Requiere: psql (instalar con `brew install libpq`) y el password de la DB de
# producción en DB_PASS. Conexión directa (IPv6).
set -uo pipefail

DB_PASS="${DB_PASS:-}"
PSQL_BIN="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
DB_HOST="db.vpanzdhicflmvtjmjcig.supabase.co"
DB_USER="postgres"
DB_NAME="postgres"

if [[ -z "$DB_PASS" ]]; then
  echo "Falta DB_PASS. Ej.: DB_PASS='...' bash scripts/verify-prod-schema.sh" >&2
  exit 1
fi
if [[ ! -x "$PSQL_BIN" ]]; then
  echo "No se encuentra psql en $PSQL_BIN. Instalá libpq: brew install libpq" >&2
  exit 1
fi

# Consulta única: devuelve un objeto por línea "tipo\tnombre" en una sola pasada.
SQL=$(cat <<'EOF'
select 'table' || chr(9) || tablename from pg_tables where schemaname='public'
union all
select 'function' || chr(9) || proname from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and proname in ('handle_new_user','is_admin','update_updated_at','sync_surgical_date')
union all
select 'trigger' || chr(9) || n.nspname||'.'||c.relname||'.'||t.tgname from pg_trigger t join pg_class c on t.tgrelid=c.oid join pg_namespace n on c.relnamespace=n.oid where not t.tgisinternal and tgname in ('surgical_records_updated_at','trg_sync_surgical_date','on_auth_user_created')
union all
select 'policy' || chr(9) || tablename||'.'||policyname from pg_policies where schemaname='public'
union all
select 'bucket' || chr(9) || name from storage.buckets
EOF
)

RESULT=$(PGPASSWORD="$DB_PASS" "$PSQL_BIN" -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tA -c "$SQL" 2>&1)
if [[ $? -ne 0 ]]; then
  echo "Error al conectar a la DB de producción:" >&2
  echo "$RESULT" >&2
  exit 1
fi

missing=()

require_table() { echo "$RESULT" | grep -q "table	$1" || missing+=("tabla public.$1"); }
require_function() { echo "$RESULT" | grep -q "function	$1" || missing+=("funcion public.$1"); }
require_trigger() { echo "$RESULT" | grep -q "trigger	$1" || missing+=("trigger $1"); }
require_policy() { echo "$RESULT" | grep -q "policy	$1" || missing+=("policy public.$1"); }
require_bucket() { echo "$RESULT" | grep -q "bucket	$1" || missing+=("bucket storage.$1"); }

echo "==> Verificando esquema de produccion ($DB_HOST) ..."

# Tablas (001, 007, 009, 010, 011)
require_table "users"
require_table "surgical_records"
require_table "invitations"
require_table "audit_log"
require_table "impersonation_sessions"
require_table "ai_usage"
require_table "user_sanatoriums"

# Funciones public (001, 002, 007, 008)
require_function "handle_new_user"
require_function "is_admin"
require_function "update_updated_at"
require_function "sync_surgical_date"

# Triggers
require_trigger "public.surgical_records.surgical_records_updated_at"
require_trigger "public.surgical_records.trg_sync_surgical_date"
require_trigger "auth.users.on_auth_user_created"

# Policies (002, 007, 009, 011)
require_policy "users.users_select_own"
require_policy "users.users_select_admin"
require_policy "users.users_update_own"
require_policy "surgical_records.records_select_own"
require_policy "surgical_records.records_select_admin"
require_policy "surgical_records.records_insert_own"
require_policy "surgical_records.records_update_own"
require_policy "surgical_records.records_delete_own"
require_policy "audit_log.audit_select_own"
require_policy "audit_log.audit_select_admin"
require_policy "audit_log.audit_insert"
require_policy "invitations.invitations_admin"
require_policy "invitations.invitations_accept"
require_policy "ai_usage.ai_usage_select_own"
require_policy "ai_usage.ai_usage_select_admin"
require_policy "ai_usage.ai_usage_insert_own"
require_policy "user_sanatoriums.user_sanatoriums_select_own"
require_policy "user_sanatoriums.user_sanatoriums_select_admin"
require_policy "user_sanatoriums.user_sanatoriums_insert_own"
require_policy "user_sanatoriums.user_sanatoriums_delete_own"

# Buckets (007)
require_bucket "surgical-images"

if [[ ${#missing[@]} -eq 0 ]]; then
  echo "OK: el esquema de produccion coincide con las migraciones del repo."
  exit 0
fi

echo ""
echo "FALTAN los siguientes objetos en produccion:"
for item in "${missing[@]}"; do
  echo "  - $item"
done
echo ""
echo "Para corregir, aplicá la migracion correspondiente de supabase/migrations/."
exit 1
