#!/bin/sh
set -eu
set +x
umask 077

# This script is intentionally kcadm-only: the realm is reconciled in place,
# no realm import contains users, and no command output can carry a token or
# credential into the container log.

die() {
  printf '%s\n' "keycloak bootstrap: failed closed ($1)" >&2
  exit 1
}

phase_marker() {
  phase="$1"
  case "$phase" in
    secret-input|server-start|bootstrap-authentication|realm-reconciliation|synthetic-account-reconciliation|subject-manifest|server-log-scan) ;;
    *) die 'bootstrap phase marker is not allowlisted' ;;
  esac
  printf '%s\n' "keycloak bootstrap: phase=$phase" >&2
}

validate_synthetic_photo_proof_mode() {
  strict_local="$1"
  data_class="$2"
  accounts_enabled="$3"
  photo_proof_enabled="$4"
  proof_file="$5"
  case "$strict_local" in
    true|false) ;;
    *) die 'HR_AXIS_STRICT_LOCAL must be true or false' ;;
  esac
  case "$data_class" in
    synthetic|company) ;;
    *) die 'HR_AXIS_DATA_CLASS must be synthetic or company' ;;
  esac
  case "$accounts_enabled" in
    true|false) ;;
    *) die 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED must be true or false' ;;
  esac
  case "$photo_proof_enabled" in
    true|false) ;;
    *) die 'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED must be true or false' ;;
  esac

  if [ "$accounts_enabled" = true ]; then
    [ "$strict_local" = true ] || die 'synthetic account contract requires strict-local mode'
    [ "$data_class" = synthetic ] || die 'synthetic account contract requires synthetic data class'
  fi

  if [ "$photo_proof_enabled" = true ]; then
    [ "$accounts_enabled" = true ] || die 'synthetic photo proof requires synthetic accounts to be enabled'
    [ "$strict_local" = true ] || die 'synthetic photo proof requires strict-local mode'
    [ "$data_class" = synthetic ] || die 'synthetic photo proof requires synthetic data class'
    [ -r "$proof_file" ] || die 'synthetic photo proof account contract is enabled but its secret file is unavailable'
    return 0
  fi

  # A dormant or production-shaped bootstrap must never silently accept a
  # mounted proof credential. Operators must remove the secret and keep the
  # feature disabled instead of relying on a flag to suppress reconciliation.
  if [ -e "$proof_file" ]; then
    die 'synthetic photo proof account secret is forbidden while photo proof is disabled'
  fi
}

read_secret() {
  file="$1"
  [ -r "$file" ] || die 'required secret file is unavailable'
  value="$(tr -d '\r\n' < "$file")"
  [ -n "$value" ] || die 'required secret file is empty'
  [ "${#value}" -le 256 ] || die 'secret value exceeds the bounded length'
  case "$value" in
    *[!A-Za-z0-9._@+:/=-]*) die 'secret value contains unsupported characters' ;;
  esac
  printf '%s' "$value"
}

read_database_secret() {
  file="$1"
  [ -r "$file" ] || die 'required database secret file is unavailable'
  value="$(tr -d '\r\n' < "$file")"
  [ -n "$value" ] || die 'required database secret is empty'
  [ "${#value}" -le 512 ] || die 'database secret value exceeds the bounded length'
  case "$value" in
    *[!A-Za-z0-9._:/?\&=%+-]*) die 'database secret contains unsupported characters' ;;
  esac
  printf '%s' "$value"
}

read_config() {
  value="$1"
  name="$2"
  [ -n "$value" ] || die "required configuration is missing: $name"
  case "$value" in
    *[!A-Za-z0-9._:/-]*) die "configuration contains unsupported characters: $name" ;;
  esac
  printf '%s' "$value"
}

read_smtp_sender() {
  value="$1"
  [ -n "$value" ] || die 'required configuration is missing: KEYCLOAK_SMTP_FROM'
  [ "${#value}" -le 254 ] || die 'SMTP from value contains unsupported characters'
  # Keep the local part intentionally narrow: ASCII letters/digits plus dot,
  # plus, and hyphen, with alphanumeric edges only.  Display names,
  # quoted forms, comments, and internationalized addresses are out of scope.
  case "$value" in
    *[!A-Za-z0-9.+@-]*) die 'SMTP from value contains unsupported characters' ;;
    *@*) ;;
    *) die 'SMTP from value contains unsupported characters' ;;
  esac

  local_part="${value%%@*}"
  domain="${value#*@}"
  case "$domain" in
    ''|*@*) die 'SMTP from value contains unsupported characters' ;;
  esac
  [ -n "$local_part" ] || die 'SMTP from value contains unsupported characters'
  [ "${#local_part}" -le 64 ] || die 'SMTP from value contains unsupported characters'
  case "$local_part" in
    [!A-Za-z0-9]*|*[!A-Za-z0-9]|*..*) die 'SMTP from value contains unsupported characters' ;;
  esac

  [ "${#domain}" -le 253 ] || die 'SMTP from value contains unsupported characters'
  case "$domain" in
    *.*) ;;
    *) die 'SMTP from value contains unsupported characters' ;;
  esac
  case "$domain" in
    .*|*.|*..*) die 'SMTP from value contains unsupported characters' ;;
  esac
  old_ifs="$IFS"
  IFS='.'
  set -- $domain
  IFS="$old_ifs"
  for label in "$@"; do
    [ -n "$label" ] || die 'SMTP from value contains unsupported characters'
    [ "${#label}" -le 63 ] || die 'SMTP from value contains unsupported characters'
    case "$label" in
      -*|*-|*[!A-Za-z0-9-]*) die 'SMTP from value contains unsupported characters' ;;
    esac
  done
  printf '%s' "$value"
}

validate_public_origin() {
  origin="$1"
  case "$origin" in
    https://[A-Za-z0-9.-]*) ;;
    *) die 'public origin must be an exact HTTPS origin' ;;
  esac
  host="${origin#https://}"
  [ "$host" != "$origin" ] || die 'public origin must contain a hostname'
  [ "${#host}" -le 253 ] || die 'public origin hostname is too long'
  case "$host" in
    ''|.*|*.|*..*|*[!A-Za-z0-9.-]*) die 'public origin hostname is not a valid hostname' ;;
  esac
  old_ifs="$IFS"
  IFS='.'
  set -- $host
  IFS="$old_ifs"
  for label in "$@"; do
    [ -n "$label" ] || die 'public origin hostname contains an empty label'
    [ "${#label}" -le 63 ] || die 'public origin hostname label is too long'
    case "$label" in
      -*|*-|*[!A-Za-z0-9-]*) die 'public origin hostname label is invalid' ;;
    esac
  done
}

json_array() {
  value="$1"
  [ -n "$value" ] || { printf '[]'; return; }
  old_ifs="$IFS"
  IFS=','
  set -- $value
  IFS="$old_ifs"
  printf '['
  first=true
  for item in "$@"; do
    case "$item" in
      ''|*[!A-Za-z0-9._:-]*) die 'synthetic scope value contains unsupported characters' ;;
    esac
    if [ "$first" = true ]; then first=false; else printf ','; fi
    printf '"%s"' "$item"
  done
  printf ']'
}

csv_first_fields_matching_second() {
  target="$1"
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    case "$row" in
      *,*,*) die 'kcadm CSV row contains unexpected fields' ;;
      *,*) ;;
      *) die 'kcadm CSV row contains unexpected fields' ;;
    esac
    first="${row%%,*}"
    second="${row#*,}"
    [ -n "$first" ] || die 'kcadm CSV row contains an empty first field'
    [ -n "$second" ] || die 'kcadm CSV row contains an empty second field'
    [ "$second" = "$target" ] || continue
    printf '%s\n' "$first"
  done
}

csv_first_fields() {
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    case "$row" in
      *,*) die 'kcadm CSV row contains unexpected fields' ;;
    esac
    printf '%s\n' "$row"
  done
}

csv_item_count() {
  value="$1"
  if [ -z "$value" ]; then
    printf '0'
    return
  fi
  old_ifs="$IFS"
  IFS=','
  set -- $value
  IFS="$old_ifs"
  count=0
  for item in "$@"; do
    [ -n "$item" ] || die 'CSV item list contains an empty value'
    case "$item" in
      *[!A-Za-z0-9._:-]*) die 'CSV item list contains unsupported characters' ;;
    esac
    count=$((count + 1))
  done
  printf '%s' "$count"
}

read_photo_proof_account() {
  proof_file="$1"
  [ -r "$proof_file" ] || die 'synthetic photo proof account contract is enabled but its secret file is unavailable'
  photo_proof_row_count=0
  photo_proof_row=''
  while IFS= read -r row || [ -n "$row" ]; do
    [ -n "$row" ] || die 'synthetic photo proof account contract contains a blank row'
    case "$row" in
      \#*) die 'synthetic photo proof account contract contains a comment row' ;;
    esac
    [ "$photo_proof_row_count" -eq 0 ] || die 'synthetic photo proof account contract must contain exactly one row'
    photo_proof_row="$row"
    photo_proof_row_count=$((photo_proof_row_count + 1))
  done < "$proof_file"
  [ "$photo_proof_row_count" -eq 1 ] || die 'synthetic photo proof account contract must contain exactly one row'

  old_ifs="$IFS"
  IFS='|'
  # The final field is checked for a pipe below because POSIX read assigns any
  # surplus fields to the last variable instead of reporting an arity error.
  read -r photo_proof_key photo_proof_username photo_proof_password photo_proof_roles \
    photo_proof_employee_id photo_proof_company_ids photo_proof_region_ids photo_proof_store_ids \
    photo_proof_read_company_ids photo_proof_read_region_ids photo_proof_read_store_ids photo_proof_assigned_store_ids \
    <<EOF
$photo_proof_row
EOF
  IFS="$old_ifs"
  case "$photo_proof_assigned_store_ids" in *'|'*) die 'synthetic photo proof account contract has extra fields' ;; esac

  [ "$photo_proof_key" = 'onprem.photo-proof-admin' ] || die 'synthetic photo proof account key is not the approved proof admin'
  [ "$photo_proof_username" = 'onprem.photo-proof-admin' ] || die 'synthetic photo proof account username is not the approved proof admin'
  [ "$photo_proof_roles" = 'SUPER_ADMIN' ] || die 'synthetic photo proof account role must be exactly SUPER_ADMIN'
  [ "$photo_proof_employee_id" = 'synthetic-employee-photo-proof-admin' ] || die 'synthetic photo proof account employee identity drifted'
  [ "$photo_proof_company_ids" = 'company-001' ] || die 'synthetic photo proof account company scope drifted'
  [ "$photo_proof_region_ids" = 'region-001' ] || die 'synthetic photo proof account region scope drifted'
  [ "$photo_proof_store_ids" = 'store-100' ] || die 'synthetic photo proof account store scope drifted'
  [ "$photo_proof_read_company_ids" = 'company-001' ] || die 'synthetic photo proof account read-company scope drifted'
  [ "$photo_proof_read_region_ids" = 'region-001' ] || die 'synthetic photo proof account read-region scope drifted'
  [ "$photo_proof_read_store_ids" = 'store-100' ] || die 'synthetic photo proof account read-store scope drifted'
  [ "$photo_proof_assigned_store_ids" = 'store-100' ] || die 'synthetic photo proof account action scope drifted'
  [ "${#photo_proof_password}" -ge 32 ] || die 'synthetic photo proof account password is below the minimum length'
  case "$photo_proof_password" in
    *[!A-Za-z0-9._@+:/=-]*) die 'synthetic photo proof account password contains unsupported characters' ;;
  esac
}

readonly KCADM_TIMEOUT_SECONDS=20
readonly BOOTSTRAP_TIMEOUT_SECONDS=900
bootstrap_watchdog_pid=''

kcadm_timeout() {
  timeout --signal=TERM --kill-after=5s "${KCADM_TIMEOUT_SECONDS}s" /opt/keycloak/bin/kcadm.sh "$@"
}

kcadm() {
  kcadm_timeout "$@" --config "$config_file"
}

kcadm_quiet() {
  kcadm "$@" >/dev/null 2>&1
}

kcadm_query() {
  kcadm "$@"
}

start_bootstrap_watchdog() {
  (
    sleep "$BOOTSTRAP_TIMEOUT_SECONDS"
    kill -TERM "$$" >/dev/null 2>&1 || true
  ) &
  bootstrap_watchdog_pid="$!"
}

server="${KEYCLOAK_SERVER:-http://keycloak:8080}"
realm="${KEYCLOAK_REALM:-store-ops}"
client_id="${KEYCLOAK_CLIENT_ID:-store-ops-admin-web}"
public_origin="${KEYCLOAK_PUBLIC_ORIGIN:-}"
[ "$realm" = 'store-ops' ] || die 'only the approved store-ops realm is supported'
[ "$client_id" = 'store-ops-admin-web' ] || die 'only the approved browser client is supported'
validate_public_origin "$public_origin"
realm_config_file="${KEYCLOAK_REALM_CONFIG_FILE:-/opt/keycloak/realm-config.json}"
[ -r "$realm_config_file" ] || die 'sanitized realm configuration fixture is unavailable'
grep -Fq '"realm": "store-ops"' "$realm_config_file" || die 'realm fixture parity check failed'
grep -Fq '"clientId": "store-ops-admin-web"' "$realm_config_file" || die 'browser client fixture parity check failed'
for fixture_role in STORE_MANAGER REGION_MANAGER REPORT_VIEWER STORE_PERSONNEL VISUAL_MERCHANDISER; do
  grep -Fq "$fixture_role" "$realm_config_file" || die 'synthetic role fixture parity check failed'
done
! grep -Eq '"users"[[:space:]]*:' "$realm_config_file" || die 'realm fixture must remain user-free'

bootstrap_username_file="${KEYCLOAK_BOOTSTRAP_USERNAME_FILE:-/run/secrets/keycloak_bootstrap_username}"
bootstrap_password_file="${KEYCLOAK_BOOTSTRAP_PASSWORD_FILE:-/run/secrets/keycloak_bootstrap_password}"
bootstrap_user="$(read_secret "$bootstrap_username_file")"
bootstrap_password="$(read_secret "$bootstrap_password_file")"
case "$bootstrap_user" in
  bootstrap-[a-z0-9-]*) ;;
  *) die 'bootstrap principal must use the temporary bootstrap-* name' ;;
esac

smtp_host="$(read_config "${KEYCLOAK_SMTP_HOST:-}" KEYCLOAK_SMTP_HOST)"
smtp_port="$(read_config "${KEYCLOAK_SMTP_PORT:-}" KEYCLOAK_SMTP_PORT)"
smtp_from="$(read_smtp_sender "${KEYCLOAK_SMTP_FROM:-}")"
smtp_starttls="$(read_config "${KEYCLOAK_SMTP_STARTTLS:-}" KEYCLOAK_SMTP_STARTTLS)"
case "$smtp_port" in *[!0-9]*) die 'SMTP port must be numeric' ;; esac
case "$smtp_starttls" in true|false) ;; *) die 'SMTP STARTTLS must be true or false' ;; esac
smtp_auth_user_file="${KEYCLOAK_SMTP_AUTH_USER_FILE:-/run/secrets/keycloak_smtp_auth_user}"
smtp_password_file="${KEYCLOAK_SMTP_PASSWORD_FILE:-/run/secrets/keycloak_smtp_password}"
smtp_auth_user="$(read_secret "$smtp_auth_user_file")"
smtp_password="$(read_secret "$smtp_password_file")"

database_url_file="${KEYCLOAK_DATABASE_URL_FILE:-/run/secrets/keycloak_database_url}"
database_username_file="${KEYCLOAK_DATABASE_USERNAME_FILE:-/run/secrets/keycloak_database_username}"
database_password_file="${KEYCLOAK_DATABASE_PASSWORD_FILE:-/run/secrets/keycloak_database_password}"
database_url="$(read_database_secret "$database_url_file")"
database_username="$(read_secret "$database_username_file")"
database_password="$(read_secret "$database_password_file")"
database_ca_file="${KEYCLOAK_DB_CA_FILE:-/run/secrets/postgres_tls_ca}"
[ -r "$database_ca_file" ] || die 'Keycloak PostgreSQL CA secret is unavailable'

export KC_DB=postgres
export KC_DB_URL="$database_url"
export KC_DB_USERNAME="$database_username"
export KC_DB_PASSWORD="$database_password"
export KC_HOSTNAME="$public_origin"
export KC_HOSTNAME_STRICT=true
export KC_PROXY_HEADERS=xforwarded
phase_marker secret-input

state_dir="${KEYCLOAK_SUBJECT_MANIFEST_DIR:-/var/lib/keycloak-bootstrap}"
manifest_path="$state_dir/subjects.v1.json"
photo_proof_manifest_path="${KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE:-$state_dir/photo-proof-subject.v1.json}"
mkdir -p "$state_dir"
chmod 0700 "$state_dir"
tmp_dir="$(mktemp -d /tmp/keycloak-bootstrap.XXXXXX)"
config_file="$tmp_dir/kcadm.config"
client_file="$tmp_dir/client.json"
smtp_file="$tmp_dir/smtp.json"
manifest_tmp="$state_dir/.subjects.v1.json.tmp"
photo_proof_manifest_tmp="$state_dir/.photo-proof-subject.v1.json.tmp"
server_log="$tmp_dir/keycloak-server.log"
accounts_file="${KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE:-/run/secrets/keycloak_synthetic_accounts}"
photo_proof_account_file="${KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ACCOUNT_FILE:-/run/secrets/keycloak_synthetic_photo_proof_account}"
strict_local="${HR_AXIS_STRICT_LOCAL:-false}"
data_class="${HR_AXIS_DATA_CLASS:-synthetic}"
accounts_enabled="${KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED:-false}"
photo_proof_enabled="${KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED:-false}"
validate_synthetic_photo_proof_mode "$strict_local" "$data_class" "$accounts_enabled" "$photo_proof_enabled" "$photo_proof_account_file"
scan_server_log() {
  [ -r "$server_log" ] || {
    printf '%s\n' 'keycloak bootstrap: server log scan skipped (server did not start)' >&2
    return 0
  }
  log_bytes="$(wc -c < "$server_log" | tr -d ' ')"
  case "$log_bytes" in
    ''|*[!0-9]*) printf '%s\n' 'keycloak bootstrap: server log scan failed (invalid bounded size)' >&2; return 1 ;;
  esac
  [ "$log_bytes" -le 4194304 ] || {
    printf '%s\n' 'keycloak bootstrap: server log scan failed (log exceeded bounded size)' >&2
    return 1
  }
  log_text="$(cat "$server_log")"
  secret_found=false
  bootstrap_candidate="$(tr -d '\r\n' < "$bootstrap_password_file")"
  for candidate in "$bootstrap_candidate" "${bootstrap_password:-}" "$smtp_password" "$smtp_auth_user" "$database_password" "$database_url"; do
    [ -n "$candidate" ] || continue
    case "$log_text" in *"$candidate"*) secret_found=true ;; esac
  done
  if [ -r "$accounts_file" ]; then
    while IFS='|' read -r account_key account_username account_password _rest; do
      [ -n "$account_key" ] || continue
      case "$account_key" in \#*) continue ;; esac
      [ -n "$account_password" ] || continue
      case "$log_text" in *"$account_password"*) secret_found=true ;; esac
    done < "$accounts_file"
  fi
  if [ -r "$photo_proof_account_file" ]; then
    while IFS='|' read -r _photo_key _photo_username _photo_password _photo_roles _photo_employee _photo_company _photo_region _photo_store _photo_read_company _photo_read_region _photo_read_store _photo_assigned_store; do
      [ -n "$_photo_key" ] || continue
      [ -n "$_photo_password" ] || continue
      case "$log_text" in *"$_photo_password"*) secret_found=true ;; esac
    done < "$photo_proof_account_file"
  fi
  unset log_text candidate bootstrap_candidate account_key account_username account_password _rest _photo_key _photo_username _photo_password _photo_roles _photo_employee _photo_company _photo_region _photo_store _photo_read_company _photo_read_region _photo_read_store _photo_assigned_store
  if [ "$secret_found" = true ]; then
    printf '%s\n' 'keycloak bootstrap: server log scan failed (secret value detected)' >&2
    return 1
  fi
  printf 'keycloak bootstrap: server log scan passed (bounded bytes=%s)\n' "$log_bytes" >&2
}
cleanup() {
  status="$?"
  set +e
  if [ -n "${bootstrap_watchdog_pid:-}" ]; then
    kill "$bootstrap_watchdog_pid" >/dev/null 2>&1 || true
    wait "$bootstrap_watchdog_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "${server_pid:-}" ]; then
    kill "$server_pid" >/dev/null 2>&1 || true
    wait "$server_pid" >/dev/null 2>&1 || true
  fi
  if [ "$status" -eq 0 ]; then
    phase_marker server-log-scan
  fi
  scan_server_log || [ "$status" -ne 0 ] || status=1
  rm -rf "$tmp_dir" "$manifest_tmp" "$photo_proof_manifest_tmp"
  unset bootstrap_password smtp_password smtp_auth_user database_password database_username database_url photo_proof_password KEYCLOAK_BOOTSTRAP_SERVICE_SECRET
  trap - EXIT HUP INT TERM
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

start_bootstrap_watchdog

# The server is intentionally started only after the dedicated bootstrap-admin
# command has created (or exposed an interrupted run's) temporary service
# client. No permanent admin credentials are passed to the production service.
export KEYCLOAK_BOOTSTRAP_SERVICE_SECRET="$bootstrap_password"
timeout --signal=TERM --kill-after=5s "${KCADM_TIMEOUT_SECONDS}s" /opt/keycloak/bin/kc.sh bootstrap-admin service \
  --client-id "$bootstrap_user" --client-secret:env=KEYCLOAK_BOOTSTRAP_SERVICE_SECRET --no-prompt --optimized \
  >/dev/null 2>&1 || true
unset KEYCLOAK_BOOTSTRAP_SERVICE_SECRET
unset bootstrap_password

server_pid=''
phase_marker server-start
/opt/keycloak/bin/kc.sh start --optimized --http-enabled=true --http-port=8080 \
  --http-management-port=9000 --health-enabled=true --metrics-enabled=true \
  >"$tmp_dir/keycloak-server.log" 2>&1 &
server_pid="$!"

credentials_ready=false
attempt=0
phase_marker bootstrap-authentication
while [ "$attempt" -lt 30 ]; do
  if KC_CLI_CLIENT_SECRET="$(tr -d '\r\n' < "$bootstrap_password_file")" kcadm_timeout config credentials \
      --server "$server" --realm master --client "$bootstrap_user" --config "$config_file" >/dev/null 2>&1; then
    credentials_ready=true
    break
  fi
  kill -0 "$server_pid" >/dev/null 2>&1 || die 'temporary Keycloak server exited before authentication'
  attempt=$((attempt + 1))
  sleep 1
done
[ "$credentials_ready" = true ] || die 'temporary bootstrap principal authentication failed'

# Realm settings are updated in place. There is deliberately no delete/recreate
# path: a retry can reconcile an interrupted run without destroying identities.
phase_marker realm-reconciliation
if ! kcadm_query get "realms/$realm" >/dev/null 2>&1; then
  kcadm_quiet create realms -s "realm=$realm" -s enabled=true || die 'realm creation failed'
fi
kcadm_quiet update "realms/$realm" \
  -s enabled=true \
  -s sslRequired=external \
  -s registrationAllowed=false \
  -s loginWithEmailAllowed=true \
  -s duplicateEmailsAllowed=false \
  -s resetPasswordAllowed=true \
  -s verifyEmail=true \
  -s rememberMe=true >/dev/null 2>&1 || die 'realm settings reconciliation failed'

for role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
  if ! kcadm_query get "roles/$role" -r "$realm" >/dev/null 2>&1; then
    kcadm_quiet create roles -r "$realm" -s "name=$role" || die 'realm role reconciliation failed'
  fi
done

redirect_uri="$public_origin/auth/callback"
logout_uri="$public_origin/auth/login"
cat > "$client_file" <<JSON
{"clientId":"$client_id","name":"HR Axis browser","enabled":true,"protocol":"openid-connect","publicClient":true,"standardFlowEnabled":true,"implicitFlowEnabled":false,"directAccessGrantsEnabled":false,"serviceAccountsEnabled":false,"redirectUris":["$redirect_uri"],"webOrigins":["$public_origin"],"attributes":{"pkce.code.challenge.method":"S256","post.logout.redirect.uris":"$logout_uri"},"defaultClientScopes":["web-origins","profile","roles","email","basic"]}
JSON
client_uuid="$(kcadm_query get clients -r "$realm" -q "clientId=$client_id" --fields id --format csv --noquotes | sed -n '1p')"
if [ -n "$client_uuid" ]; then
  kcadm_quiet update "clients/$client_uuid" -r "$realm" -f "$client_file" || die 'browser client reconciliation failed'
else
  kcadm_quiet create clients -r "$realm" -f "$client_file" || die 'browser client creation failed'
  client_uuid="$(kcadm_query get clients -r "$realm" -q "clientId=$client_id" --fields id --format csv --noquotes | sed -n '1p')"
fi
[ -n "$client_uuid" ] || die 'browser client id was not resolved'

resolve_client_scope_uuid() {
  scope_name="$1"
  scope_rows="$(kcadm_query get client-scopes -r "$realm" -q "name=$scope_name" --fields id,name --format csv --noquotes 2>/dev/null)" || die 'client scope inventory read failed'
  scope_matches="$(printf '%s\n' "$scope_rows" | csv_first_fields_matching_second "$scope_name")"
  scope_count="$(printf '%s\n' "$scope_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  [ "$scope_count" -eq 1 ] || die 'client scope identity is missing or ambiguous'
  scope_uuid="$scope_matches"
  case "$scope_uuid" in
    *[!A-Fa-f0-9-]*) die 'client scope id contains unsupported characters' ;;
  esac
  printf '%s' "$scope_uuid"
}

attached_scope_rows="$(kcadm_query get "clients/$client_uuid/default-client-scopes" -r "$realm" --fields id,name --format csv --noquotes 2>/dev/null)" || die 'browser client default scopes reconciliation read failed'
for expected_scope in web-origins profile roles email basic; do
  attached_scope_matches="$(printf '%s\n' "$attached_scope_rows" | csv_first_fields_matching_second "$expected_scope")"
  attached_scope_count="$(printf '%s\n' "$attached_scope_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  case "$attached_scope_count" in
    0)
      scope_uuid="$(resolve_client_scope_uuid "$expected_scope")"
      kcadm_quiet update "clients/$client_uuid/default-client-scopes/$scope_uuid" -r "$realm" -n || die 'browser client default scope attachment failed'
      ;;
    1) ;;
    *) die 'browser client default scope attachment is ambiguous' ;;
  esac
done

create_or_update_mapper() {
  mapper_name="$1"
  mapper_json="$2"
  mapper_file="$tmp_dir/$mapper_name.json"
  printf '%s\n' "$mapper_json" > "$mapper_file"
  mapper_uuid="$(find_mapper_uuid "$mapper_name")"
  if [ -n "$mapper_uuid" ]; then
    case "$mapper_uuid" in
      *[!A-Fa-f0-9-]*) die 'claim mapper id contains unsupported characters' ;;
    esac
    mapper_update_file="$tmp_dir/$mapper_name.update.json"
    printf '{"id":"%s",%s\n' "$mapper_uuid" "${mapper_json#\{}" > "$mapper_update_file"
    chmod 0600 "$mapper_update_file"
    kcadm_quiet update "clients/$client_uuid/protocol-mappers/models/$mapper_uuid" -r "$realm" -f "$mapper_update_file" || die 'claim mapper update failed'
  else
    kcadm_quiet create "clients/$client_uuid/protocol-mappers/models" -r "$realm" -f "$mapper_file" || die 'claim mapper creation failed'
  fi
}

find_mapper_uuid() {
  mapper_name="$1"
  mapper_rows="$(kcadm_query get "clients/$client_uuid/protocol-mappers/models" -r "$realm" --fields id,name --format csv --noquotes 2>/dev/null)" || die 'claim mapper inventory read failed'
  mapper_matches="$(printf '%s\n' "$mapper_rows" | csv_first_fields_matching_second "$mapper_name")"
  mapper_count="$(printf '%s\n' "$mapper_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  case "$mapper_count" in
    0) printf '%s' '' ;;
    1) printf '%s' "$mapper_matches" ;;
    *) die 'claim mapper inventory contains duplicate names' ;;
  esac
}

create_or_update_mapper roles '{"name":"roles","protocol":"openid-connect","protocolMapper":"oidc-usermodel-realm-role-mapper","consentRequired":false,"config":{"multivalued":"true","userinfo.token.claim":"true","id.token.claim":"true","access.token.claim":"true","claim.name":"roles","jsonType.label":"String"}}'
create_or_update_mapper store-ops-api-audience '{"name":"store-ops-api-audience","protocol":"openid-connect","protocolMapper":"oidc-audience-mapper","consentRequired":false,"config":{"included.client.audience":"store-ops-api","id.token.claim":"false","access.token.claim":"true","userinfo.token.claim":"false"}}'
for claim in employee_id company_ids region_ids store_ids read_company_ids read_region_ids read_store_ids assigned_store_ids; do
  create_or_update_mapper "$claim" "{\"name\":\"$claim\",\"protocol\":\"openid-connect\",\"protocolMapper\":\"oidc-usermodel-attribute-mapper\",\"consentRequired\":false,\"config\":{\"multivalued\":\"true\",\"user.attribute\":\"$claim\",\"claim.name\":\"$claim\",\"jsonType.label\":\"String\",\"access.token.claim\":\"true\",\"id.token.claim\":\"true\",\"userinfo.token.claim\":\"true\"}}"
done

cat > "$smtp_file" <<JSON
{"smtpServer":{"host":"$smtp_host","port":"$smtp_port","from":"$smtp_from","starttls":"$smtp_starttls","auth":"true","user":"$smtp_auth_user","password":"$smtp_password"}}
JSON
kcadm_quiet update "realms/$realm" -r "$realm" -f "$smtp_file" || die 'SMTP contract reconciliation failed'

# Read back every managed surface after mutation. These checks compare only
# the approved non-secret representation; a mismatch leaves the run retryable
# and the candidate manifest unpublished.
realm_state="$(kcadm_query get "realms/$realm" -r "$realm" 2>/dev/null)" || die 'realm parity read failed'
realm_compact="$(printf '%s' "$realm_state" | tr -d '[:space:]')"
printf '%s' "$realm_compact" | grep -Fq '"realm":"store-ops"' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"enabled":true' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"sslRequired":"external"' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"registrationAllowed":false' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"loginWithEmailAllowed":true' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"resetPasswordAllowed":true' || die 'realm parity mismatch'
printf '%s' "$realm_compact" | grep -Fq '"verifyEmail":true' || die 'realm parity mismatch'
for expected_smtp_field in '"host":"'"$smtp_host"'"' '"port":"'"$smtp_port"'"' '"from":"'"$smtp_from"'"' '"starttls":"'"$smtp_starttls"'"' '"auth":"true"' '"user":"'"$smtp_auth_user"'"'; do
  printf '%s' "$realm_compact" | grep -Fq "$expected_smtp_field" || die 'SMTP parity mismatch'
done
printf '%s' "$realm_state" | grep -Eq '"password"[[:space:]]*:[[:space:]]*"[^"]+"' || die 'SMTP parity mismatch'

client_state="$(kcadm_query get "clients/$client_uuid" -r "$realm" 2>/dev/null)" || die 'browser client parity read failed'
client_compact="$(printf '%s' "$client_state" | tr -d '[:space:]')"
for expected_client_field in '"clientId":"store-ops-admin-web"' '"enabled":true' '"publicClient":true' '"standardFlowEnabled":true' '"implicitFlowEnabled":false' '"directAccessGrantsEnabled":false' '"serviceAccountsEnabled":false' '"redirectUris":["'"$redirect_uri"'"]' '"webOrigins":["'"$public_origin"'"]'; do
  printf '%s' "$client_compact" | grep -Fq "$expected_client_field" || die 'browser client parity mismatch'
done
printf '%s' "$client_compact" | grep -Fq '"pkce.code.challenge.method":"S256"' || die 'browser client PKCE parity mismatch'
printf '%s' "$client_compact" | grep -Fq '"post.logout.redirect.uris":"'"$logout_uri"'"' || die 'browser client logout parity mismatch'

assert_mapper() {
  mapper_name="$1"
  mapper_type="$2"
  mapper_uuid="$(find_mapper_uuid "$mapper_name")"
  [ -n "$mapper_uuid" ] || die 'managed mapper parity read failed'
  mapper_state="$(kcadm_query get "clients/$client_uuid/protocol-mappers/models/$mapper_uuid" -r "$realm" 2>/dev/null)" || die 'managed mapper parity read failed'
  mapper_compact="$(printf '%s' "$mapper_state" | tr -d '[:space:]')"
  printf '%s' "$mapper_compact" | grep -Fq "\"id\":\"$mapper_uuid\"" || die 'managed mapper identity parity mismatch'
  printf '%s' "$mapper_compact" | grep -Fq "\"name\":\"$mapper_name\"" || die 'managed mapper name parity mismatch'
  printf '%s' "$mapper_compact" | grep -Fq "\"protocolMapper\":\"$mapper_type\"" || die 'managed mapper type parity mismatch'
  if [ "$mapper_name" = 'store-ops-api-audience' ]; then
    printf '%s' "$mapper_compact" | grep -Fq '"included.client.audience":"store-ops-api"' || die 'audience mapper parity mismatch'
    printf '%s' "$mapper_compact" | grep -Fq '"access.token.claim":"true"' || die 'audience mapper access-token parity mismatch'
    printf '%s' "$mapper_compact" | grep -Fq '"id.token.claim":"false"' || die 'audience mapper id-token parity mismatch'
    printf '%s' "$mapper_compact" | grep -Fq '"userinfo.token.claim":"false"' || die 'audience mapper userinfo parity mismatch'
  elif [ "$mapper_name" = 'roles' ]; then
    printf '%s' "$mapper_compact" | grep -Fq '"claim.name":"roles"' || die 'roles mapper claim parity mismatch'
    printf '%s' "$mapper_compact" | grep -Fq '"multivalued":"true"' || die 'roles mapper multivalue parity mismatch'
    for mapper_flag in 'access.token.claim":"true' 'id.token.claim":"true' 'userinfo.token.claim":"true'; do
      printf '%s' "$mapper_compact" | grep -Fq "\"$mapper_flag" || die 'roles mapper token parity mismatch'
    done
  else
    printf '%s' "$mapper_compact" | grep -Fq "\"user.attribute\":\"$mapper_name\"" || die 'claim mapper source parity mismatch'
    printf '%s' "$mapper_compact" | grep -Fq "\"claim.name\":\"$mapper_name\"" || die 'claim mapper target parity mismatch'
    for mapper_flag in 'access.token.claim":"true' 'id.token.claim":"true' 'userinfo.token.claim":"true'; do
      printf '%s' "$mapper_compact" | grep -Fq "\"$mapper_flag" || die 'claim mapper token parity mismatch'
    done
  fi
}

default_scope_rows="$(kcadm_query get "clients/$client_uuid/default-client-scopes" -r "$realm" --fields name --format csv --noquotes 2>/dev/null)" || die 'browser client default scopes parity read failed'
default_scope_names="$(printf '%s\n' "$default_scope_rows" | csv_first_fields | sed '/^[[:space:]]*$/d')"
default_scope_count="$(printf '%s\n' "$default_scope_names" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
[ "$default_scope_count" -eq 5 ] || die 'browser client default scopes parity mismatch'
for expected_scope in web-origins profile roles email basic; do
  printf '%s\n' "$default_scope_names" | grep -Fqx "$expected_scope" || die 'browser client default scopes parity mismatch'
done
assert_mapper roles oidc-usermodel-realm-role-mapper
assert_mapper store-ops-api-audience oidc-audience-mapper
for claim in employee_id company_ids region_ids store_ids read_company_ids read_region_ids read_store_ids assigned_store_ids; do
  assert_mapper "$claim" oidc-usermodel-attribute-mapper
done
for role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
  role_state="$(kcadm_query get "roles/$role" -r "$realm" 2>/dev/null)" || die 'realm role parity mismatch'
  role_compact="$(printf '%s' "$role_state" | tr -d '[:space:]')"
  printf '%s' "$role_compact" | grep -Fq "\"name\":\"$role\"" || die 'realm role parity mismatch'
done

manifest_subjects=''
manifest_first=true
seen_personas=''
synthetic_account_count=0
phase_marker synthetic-account-reconciliation
accounts_file="${KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE:-/run/secrets/keycloak_synthetic_accounts}"
if [ "$accounts_enabled" = true ]; then
  [ -r "$accounts_file" ] || die 'synthetic account contract is enabled but its secret file is unavailable'
  while IFS='|' read -r account_key username password roles employee_id company_ids region_ids store_ids read_company_ids read_region_ids read_store_ids assigned_store_ids account_extra; do
    [ -n "$account_key" ] || continue
    case "$account_key" in \#*) continue ;; esac
    synthetic_account_count=$((synthetic_account_count + 1))
    [ "$synthetic_account_count" -le 5 ] || die 'synthetic account contract must contain exactly five approved personas'
    [ -z "${account_extra:-}" ] || die 'synthetic account row contains extra fields'
    case "$account_key:$username:$employee_id" in *[!A-Za-z0-9._:-]*) die 'synthetic account identity contains unsupported characters' ;; esac
    case "$account_key:$roles" in
      onprem.store-manager:STORE_MANAGER|onprem.region-manager:REGION_MANAGER|onprem.report-viewer:REPORT_VIEWER|onprem.store-personnel:STORE_PERSONNEL|onprem.visual-merchandiser:VISUAL_MERCHANDISER) ;;
      *) die 'synthetic account persona is not one of the five approved roles' ;;
    esac
    case ",$seen_personas," in *,"$account_key",*) die 'duplicate synthetic account persona' ;; esac
    seen_personas="$seen_personas,$account_key"
    [ "${#password}" -ge 32 ] || die 'synthetic account password is below the minimum length'
    user_uuid="$(kcadm_query get users -r "$realm" -q "username=$username" --fields id --format csv --noquotes | sed -n '1p')"
    if [ -z "$user_uuid" ]; then
      kcadm_quiet create users -r "$realm" -s "username=$username" -s enabled=true -s emailVerified=true || die 'synthetic account creation failed'
      user_uuid="$(kcadm_query get users -r "$realm" -q "username=$username" --fields id --format csv --noquotes | sed -n '1p')"
    fi
    [ -n "$user_uuid" ] || die 'synthetic account subject was not resolved'
    password_file="$tmp_dir/${account_key}.reset-password.json"
    cat > "$password_file" <<JSON
{"type":"password","value":"$password","temporary":false}
JSON
    chmod 0600 "$password_file"
    kcadm_quiet update "users/$user_uuid/reset-password" -r "$realm" -f "$password_file" -n || die 'synthetic account password update failed'
    unset password
    profile_email="$username@example.invalid"
    user_json="$tmp_dir/$account_key.json"
    {
      printf '{"username":"%s","email":"%s","firstName":"Synthetic","lastName":"Persona","enabled":true,"emailVerified":true,"requiredActions":[],"attributes":{"employee_id":' "$username" "$profile_email"
      json_array "$employee_id"
      printf ',"company_ids":'
      json_array "$company_ids"
      printf ',"region_ids":'
      json_array "$region_ids"
      printf ',"store_ids":'
      json_array "$store_ids"
      printf ',"read_company_ids":'
      json_array "$read_company_ids"
      printf ',"read_region_ids":'
      json_array "$read_region_ids"
      printf ',"read_store_ids":'
      json_array "$read_store_ids"
      printf ',"assigned_store_ids":'
      json_array "$assigned_store_ids"
      printf '}}\n'
    } > "$user_json"
    kcadm_quiet update "users/$user_uuid" -r "$realm" -f "$user_json" || die 'synthetic account claim update failed'
    unset profile_email
    managed_role_names="$(kcadm_query get "users/$user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null || true)"
    for managed_role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
      case ",$roles," in
        *,$managed_role,*) ;;
        *)
          if printf '%s\n' "$managed_role_names" | grep -Fqx "$managed_role"; then
            kcadm_quiet remove-roles -r "$realm" --uusername "$username" --rolename "$managed_role" || die 'stale synthetic account role removal failed'
          fi
          ;;
      esac
    done
    old_ifs="$IFS"
    IFS=','
    set -- $roles
    IFS="$old_ifs"
    for role in "$@"; do
      case "$role" in SUPER_ADMIN|REPORT_VIEWER|STORE_MANAGER|STORE_PERSONNEL|REGION_MANAGER|AUDITOR|HR_ADMIN|INTEGRATION_ADMIN|SNAPSHOT_OPERATOR|VISUAL_MERCHANDISER) ;; *) die 'synthetic account role is not approved' ;; esac
      kcadm_quiet add-roles -r "$realm" --uusername "$username" --rolename "$role" || die 'synthetic account role assignment failed'
    done
    reconciled_role_names="$(kcadm_query get "users/$user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null || true)"
    for role in $(printf '%s' "$roles" | tr ',' ' '); do
      printf '%s\n' "$reconciled_role_names" | grep -Fqx "$role" || die 'synthetic account role parity mismatch'
    done
    if [ "$manifest_first" = true ]; then manifest_first=false; else manifest_subjects="$manifest_subjects,"; fi
    manifest_subjects="$manifest_subjects{\"accountKey\":\"$account_key\",\"subject\":\"$user_uuid\",\"roleCodes\":[\"$roles\"],\"readScope\":{\"companies\":$(csv_item_count "$read_company_ids") ,\"regions\":$(csv_item_count "$read_region_ids") ,\"stores\":$(csv_item_count "$read_store_ids")},\"actionScope\":{\"assignedStores\":$(csv_item_count "$assigned_store_ids")}}"
  done < "$accounts_file"
  for required_persona in onprem.store-manager onprem.region-manager onprem.report-viewer onprem.store-personnel onprem.visual-merchandiser; do
    case ",$seen_personas," in *,"$required_persona",*) ;; *) die 'synthetic account contract must provide all five approved personas' ;; esac
  done
  [ "$synthetic_account_count" -eq 5 ] || die 'synthetic account contract must contain exactly five approved personas'
fi

if [ "$photo_proof_enabled" = true ]; then
  read_photo_proof_account "$photo_proof_account_file"
  photo_user_rows="$(kcadm_query get users -r "$realm" -q "username=$photo_proof_username" --fields id --format csv --noquotes)" || die 'synthetic photo proof account inventory read failed'
  photo_user_matches="$(printf '%s\n' "$photo_user_rows" | csv_first_fields)"
  photo_user_count="$(printf '%s\n' "$photo_user_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  photo_user_uuid=''
  case "$photo_user_count" in
    0) ;;
    1) photo_user_uuid="$photo_user_matches" ;;
    *) die 'synthetic photo proof account identity is ambiguous' ;;
  esac
  if [ -z "${photo_user_uuid:-}" ]; then
    kcadm_quiet create users -r "$realm" -s "username=$photo_proof_username" -s enabled=true -s emailVerified=true || die 'synthetic photo proof account creation failed'
    photo_user_rows="$(kcadm_query get users -r "$realm" -q "username=$photo_proof_username" --fields id --format csv --noquotes)" || die 'synthetic photo proof account subject was not resolved'
    photo_user_matches="$(printf '%s\n' "$photo_user_rows" | csv_first_fields)"
    photo_user_count="$(printf '%s\n' "$photo_user_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
    [ "$photo_user_count" -eq 1 ] || die 'synthetic photo proof account subject was not resolved'
    photo_user_uuid="$photo_user_matches"
  fi
  case "$photo_user_uuid" in
    ''|*[!A-Fa-f0-9-]*) die 'synthetic photo proof account subject contains unsupported characters' ;;
  esac

  photo_password_file="$tmp_dir/photo-proof.reset-password.json"
  cat > "$photo_password_file" <<JSON
{"type":"password","value":"$photo_proof_password","temporary":false}
JSON
  chmod 0600 "$photo_password_file"
  kcadm_quiet update "users/$photo_user_uuid/reset-password" -r "$realm" -f "$photo_password_file" -n || die 'synthetic photo proof account password update failed'
  unset photo_proof_password

  photo_profile_email="$photo_proof_username@example.invalid"
  photo_user_json="$tmp_dir/photo-proof-account.json"
  {
    printf '{"username":"%s","email":"%s","firstName":"Synthetic","lastName":"PhotoProofAdmin","enabled":true,"emailVerified":true,"requiredActions":[],"attributes":{"employee_id":' "$photo_proof_username" "$photo_profile_email"
    json_array "$photo_proof_employee_id"
    printf ',"company_ids":'
    json_array "$photo_proof_company_ids"
    printf ',"region_ids":'
    json_array "$photo_proof_region_ids"
    printf ',"store_ids":'
    json_array "$photo_proof_store_ids"
    printf ',"read_company_ids":'
    json_array "$photo_proof_read_company_ids"
    printf ',"read_region_ids":'
    json_array "$photo_proof_read_region_ids"
    printf ',"read_store_ids":'
    json_array "$photo_proof_read_store_ids"
    printf ',"assigned_store_ids":'
    json_array "$photo_proof_assigned_store_ids"
    printf '}}\n'
  } > "$photo_user_json"
  kcadm_quiet update "users/$photo_user_uuid" -r "$realm" -f "$photo_user_json" || die 'synthetic photo proof account claim update failed'
  unset photo_profile_email

  photo_managed_role_names="$(kcadm_query get "users/$photo_user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null || true)"
  for managed_role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
    case ",$photo_proof_roles," in
      *,$managed_role,*) ;;
      *)
        if printf '%s\n' "$photo_managed_role_names" | grep -Fqx "$managed_role"; then
          kcadm_quiet remove-roles -r "$realm" --uusername "$photo_proof_username" --rolename "$managed_role" || die 'stale synthetic photo proof account role removal failed'
        fi
        ;;
    esac
  done
  kcadm_quiet add-roles -r "$realm" --uusername "$photo_proof_username" --rolename SUPER_ADMIN || die 'synthetic photo proof account role assignment failed'
  photo_reconciled_role_names="$(kcadm_query get "users/$photo_user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null || true)"
  photo_reconciled_managed_role_names="$(printf '%s\n' "$photo_reconciled_role_names" | csv_first_fields | grep -E '^(SUPER_ADMIN|REPORT_VIEWER|STORE_MANAGER|STORE_PERSONNEL|REGION_MANAGER|AUDITOR|HR_ADMIN|INTEGRATION_ADMIN|SNAPSHOT_OPERATOR|VISUAL_MERCHANDISER)$' || true)"
  photo_reconciled_role_count="$(printf '%s\n' "$photo_reconciled_managed_role_names" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  [ "$photo_reconciled_role_count" -eq 1 ] || die 'synthetic photo proof account role parity mismatch'
  printf '%s\n' "$photo_reconciled_managed_role_names" | grep -Fqx SUPER_ADMIN || die 'synthetic photo proof account role parity mismatch'

  photo_proof_subject_json="$(printf '{"schemaVersion":"onprem-keycloak-photo-proof-subject-v1","dataClass":"synthetic","provider":"oidc","realm":"%s","clientId":"%s","accountKey":"onprem.photo-proof-admin","username":"onprem.photo-proof-admin","subject":"%s","roleCodes":["SUPER_ADMIN"],"readScope":{"companies":["00000000-0000-0000-0000-000000000001"],"regions":["00000000-0000-0000-0000-000000000010"],"stores":["00000000-0000-0000-0000-000000000100"]},"actionScope":{"assignedStores":["00000000-0000-0000-0000-000000000100"]}}' "$realm" "$client_id" "$photo_user_uuid")"
  printf '%s\n' "$photo_proof_subject_json" > "$photo_proof_manifest_tmp"
  chmod 0600 "$photo_proof_manifest_tmp"
else
  photo_user_rows="$(kcadm_query get users -r "$realm" -q "username=onprem.photo-proof-admin" --fields id --format csv --noquotes 2>/dev/null)" || die 'stale synthetic photo proof account inventory read failed'
  photo_user_matches="$(printf '%s\n' "$photo_user_rows" | csv_first_fields)"
  photo_user_count="$(printf '%s\n' "$photo_user_matches" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
  case "$photo_user_count" in
    0) ;;
    1)
      photo_user_uuid="$photo_user_matches"
      case "$photo_user_uuid" in
        ''|*[!A-Fa-f0-9-]*) die 'synthetic photo proof account subject contains unsupported characters' ;;
      esac
      photo_managed_role_names="$(kcadm_query get "users/$photo_user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null)" || die 'stale synthetic photo proof role inventory read failed'
      photo_disable_file="$tmp_dir/photo-proof-disabled.json"
      printf '%s\n' '{"enabled":false}' > "$photo_disable_file"
      chmod 0600 "$photo_disable_file"
      kcadm_quiet update "users/$photo_user_uuid" -r "$realm" -f "$photo_disable_file" || die 'stale synthetic photo proof account disable failed'
      for managed_role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
        if printf '%s\n' "$photo_managed_role_names" | grep -Fqx "$managed_role"; then
          kcadm_quiet remove-roles -r "$realm" --uusername onprem.photo-proof-admin --rolename "$managed_role" || die 'stale synthetic photo proof role removal failed'
        fi
      done
      photo_disabled_state="$(kcadm_query get "users/$photo_user_uuid" -r "$realm" 2>/dev/null)" || die 'stale synthetic photo proof disable parity read failed'
      photo_disabled_compact="$(printf '%s' "$photo_disabled_state" | tr -d '[:space:]')"
      printf '%s' "$photo_disabled_compact" | grep -Fq '"enabled":false' || die 'stale synthetic photo proof account remained enabled'
      photo_remaining_role_names="$(kcadm_query get "users/$photo_user_uuid/role-mappings/realm" -r "$realm" --fields name --format csv --noquotes 2>/dev/null)" || die 'stale synthetic photo proof role parity read failed'
      for managed_role in SUPER_ADMIN REPORT_VIEWER STORE_MANAGER STORE_PERSONNEL REGION_MANAGER AUDITOR HR_ADMIN INTEGRATION_ADMIN SNAPSHOT_OPERATOR VISUAL_MERCHANDISER; do
        if printf '%s\n' "$photo_remaining_role_names" | grep -Fqx "$managed_role"; then
          die 'stale synthetic photo proof managed role remained assigned'
        fi
      done
      ;;
    *) die 'synthetic photo proof account identity is ambiguous' ;;
  esac
  rm -f "$photo_proof_manifest_path" "$photo_proof_manifest_tmp"
fi

phase_marker subject-manifest
printf '%s\n' "{\"schemaVersion\":\"onprem-keycloak-subjects-v1\",\"dataClass\":\"synthetic\",\"provider\":\"oidc\",\"realm\":\"$realm\",\"clientId\":\"$client_id\",\"subjects\":[${manifest_subjects}]}" > "$manifest_tmp"
chmod 0600 "$manifest_tmp"

# The temporary service client is removed before the manifest becomes visible.
# If this deletion fails, the trap removes the candidate and the run remains
# retryable; a subsequent run can authenticate an interrupted client with the
# same secret and finish its cleanup.
bootstrap_client_uuid="$(kcadm_query get clients -r master -q "clientId=$bootstrap_user" --fields id --format csv --noquotes | sed -n '1p')"
[ -n "$bootstrap_client_uuid" ] || die 'temporary bootstrap client was not found for deletion'
kcadm_quiet delete "clients/$bootstrap_client_uuid" -r master || die 'temporary bootstrap client deletion failed'
if kcadm_query get "clients/$bootstrap_client_uuid" -r master >/dev/null 2>&1; then
  die 'temporary bootstrap client still exists'
fi
mv -f "$manifest_tmp" "$manifest_path"
if [ "$photo_proof_enabled" = true ]; then
  mv -f "$photo_proof_manifest_tmp" "$photo_proof_manifest_path"
fi
printf '%s\n' 'keycloak bootstrap complete: synthetic realm contract reconciled'
