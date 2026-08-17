#!/bin/sh
set -eu

# Source-free, target-bound synthetic smoke. It performs read-only Docker
# inspection and invokes only the signed Keycloak proof shipped in the bundle.
die() { printf '%s\n' "smoke: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "smoke: $*"; }
BUNDLE_ROOT=; RELEASE_ID=; TARGET_PROJECT=; PUBLIC_KEY=; TRUSTED_FINGERPRINT=; ENV_FILE=; RECEIPT_DIR=; RECEIPT_PATH=; PROOF_COMPOSE=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -gt 1 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2;;
    --release-id) [ "$#" -gt 1 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2;;
    --target-project|--project) [ "$#" -gt 1 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2;;
    --public-key|--trusted-public-key) [ "$#" -gt 1 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2;;
    --trusted-fingerprint) [ "$#" -gt 1 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2;;
    --env-file|--approved-env) [ "$#" -gt 1 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2;;
    --receipt) [ "$#" -gt 1 ] || die "--receipt requires a value"; RECEIPT_PATH=$2; shift 2;;
    --receipt-dir) [ "$#" -gt 1 ] || die "--receipt-dir requires a value"; RECEIPT_DIR=$2; shift 2;;
    --proof-compose) [ "$#" -gt 1 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2;;
    --help) printf '%s\n' 'usage: smoke.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --env-file PATH --receipt PATH'; exit 0;;
    *) die "unknown argument: $1";;
  esac
done
[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] || die "bundle root, release id, target project, public key, trusted fingerprint, and approved env are required"
[ -n "$RECEIPT_PATH" ] || { [ -n "$RECEIPT_DIR" ] || die "receipt path or receipt directory is required"; RECEIPT_PATH="$RECEIPT_DIR/runtime-receipt.json"; }
case "$BUNDLE_ROOT:$PUBLIC_KEY:$ENV_FILE:$RECEIPT_PATH" in /*:*:/*:/*) ;; *) die "bundle, public-key, env, and receipt paths must be absolute";; esac
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
fi
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
case "$RECEIPT_PATH" in "$BUNDLE_ROOT"/*) die "receipt must be outside the bundle";; esac

env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || die "cannot inspect file mode"; }
file_gid() { stat -c '%g' "$1" 2>/dev/null || stat -f '%g' "$1" 2>/dev/null || die "cannot inspect file group"; }
file_links() { stat -c '%h' "$1" 2>/dev/null || stat -f '%l' "$1" 2>/dev/null || die "cannot inspect hard-link count"; }
file_size() { stat -c '%s' "$1" 2>/dev/null || stat -f '%z' "$1" 2>/dev/null || die "cannot inspect file size"; }
file_uid() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null || die "cannot inspect file owner"; }
file_identity() { stat -c '%d:%i' "$1" 2>/dev/null || stat -f '%d:%i' "$1" 2>/dev/null || die "cannot inspect filesystem identity"; }
mode_has_group_or_world_write() { case "$1" in ''|*[!0-7]*) return 1 ;; *[2367][0-7]|*[0-7][2367]) return 0 ;; *) return 1 ;; esac; }
canonical_dir() { (CDPATH= cd -P "$1" 2>/dev/null && pwd -P) || die "cannot resolve canonical directory: $2"; }
require_trusted_directory_tree() {
  directory=$1; label=$2; canonical=$(canonical_dir "$directory" "$label")
  [ "$canonical" = "$directory" ] || die "$label must use a canonical absolute path"
  current=$canonical
  while :; do
    [ -d "$current" ] && [ ! -L "$current" ] || die "$label ancestor is missing or symlinked: $current"
    uid=$(file_uid "$current"); host_os=$(uname -s 2>/dev/null || true); operator_uid=$(id -u 2>/dev/null || true)
    if [ "$host_os" = Linux ]; then [ "$uid" = 0 ] || die "$label directory must be root-owned: $current"; else [ "$uid" = 0 ] || [ "$uid" = "$operator_uid" ] || die "$label directory must be root/operator-owned: $current"; fi
    mode=$(file_mode "$current"); mode_has_group_or_world_write "$mode" && die "$label ancestor is group/world writable: $current"
    [ "$current" = / ] && break
    parent=$(dirname "$current"); [ "$parent" != "$current" ] || die "$label ancestor walk failed"; current=$parent
  done
}
RECEIPT_PARENT=$(dirname "$RECEIPT_PATH")
[ -d "$RECEIPT_PARENT" ] || die "receipt parent directory is missing"
require_trusted_directory_tree "$RECEIPT_PARENT" "receipt parent"
RECEIPT_PARENT_IDENTITY=$(file_identity "$RECEIPT_PARENT")
RECEIPT_PARENT_UID=$(file_uid "$RECEIPT_PARENT")
RECEIPT_PARENT_MODE=$(file_mode "$RECEIPT_PARENT")
revalidate_receipt_parent() {
  require_trusted_directory_tree "$RECEIPT_PARENT" "receipt parent"
  [ "$(file_identity "$RECEIPT_PARENT")" = "$RECEIPT_PARENT_IDENTITY" ] || die "receipt parent filesystem identity changed"
  [ "$(file_uid "$RECEIPT_PARENT")" = "$RECEIPT_PARENT_UID" ] || die "receipt parent owner changed"
  [ "$(file_mode "$RECEIPT_PARENT")" = "$RECEIPT_PARENT_MODE" ] || die "receipt parent mode changed"
}
[ ! -e "$RECEIPT_PATH" ] && [ ! -L "$RECEIPT_PATH" ] || die "receipt destination must be absent"

VERIFIER="$BUNDLE_ROOT/operations/onprem-offline-bundle.mjs"; [ -f "$VERIFIER" ] || VERIFIER="$BUNDLE_ROOT/onprem-offline-bundle.mjs"; [ -f "$VERIFIER" ] || die "bundled offline verifier is missing"
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
if [ -n "$PROOF_COMPOSE" ]; then
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --proof-compose "$PROOF_COMPOSE" >/dev/null || die "preflight failed"
else
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" >/dev/null || die "preflight failed"
fi

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"; PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"; PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
[ -f "$CORE_COMPOSE" ] && [ -f "$PHOTO_PROOF_COMPOSE" ] && [ -f "$PHOTO_COMPOSE" ] || die "merged Compose files are missing"
compose() {
  if [ -n "$PROOF_COMPOSE" ]; then docker compose --project-name "$TARGET_PROJECT" --profile '*' --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"; else docker compose --project-name "$TARGET_PROJECT" --profile '*' --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"; fi
}
expected_project=$(env_value HR_AXIS_PROJECT_ID); [ -n "$expected_project" ] || expected_project=$TARGET_PROJECT
[ "$(env_value HR_AXIS_DATA_CLASS)" = synthetic ] || die "runtime smoke requires HR_AXIS_DATA_CLASS=synthetic"
[ "$(env_value HR_AXIS_STRICT_LOCAL)" = true ] || die "runtime smoke requires strict-local mode"
for disabled in PHOTO_MEDIA_REAL_VM_PILOT_ENABLED VISUAL_COMPARISON_ENQUEUE_ENABLED VISUAL_COMPARISON_ADVISORY_ENQUEUE_ENABLED VISUAL_COMPARISON_ADVISORY_REVIEW_ENABLED VISUAL_COMPARISON_WORKER_ENABLED; do [ "$(env_value "$disabled")" != true ] || die "runtime smoke refuses enabled provider/AI flag: $disabled"; done

services='caddy frontend api worker postgres redis keycloak object-storage'
service_id() { id=$(compose ps -q "$1" 2>/dev/null || true); [ -n "$id" ] || die "target service is not running: $1"; printf '%s' "$id"; }
service_var() { case "$1" in object-storage) printf '%s' object_storage_id;; *) printf '%s_id' "$1";; esac; }
inspect_labels_health() { value=$(docker inspect "$2" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{.State.Health.Status}}' 2>/dev/null || true); [ "$value" = "$TARGET_PROJECT|$expected_project|$RELEASE_ID|synthetic|healthy" ] || die "service labels/health mismatch: $1"; }
for service in $services; do id=$(service_id "$service"); inspect_labels_health "$service" "$id"; variable=$(service_var "$service"); eval "$variable=\$id"; done

check_ports() {
  inspect_json=$(docker inspect "$2" --format '{{json .}}' 2>/dev/null || true)
  printf '%s' "$inspect_json" | node -e '
const v=JSON.parse(require("fs").readFileSync(0,"utf8")||"{}"), expected=process.argv[1]
const has=(x)=>x&&typeof x==="object"&&Object.values(x).some((e)=>Array.isArray(e)?e.length>0:Boolean(e))
const bindings=has(v.HostConfig?.PortBindings)||has(v.NetworkSettings?.Ports)
if (expected === "proof") { if (bindings) process.exit(2) }
else { const p=v.NetworkSettings?.Ports||{}, entries=Object.entries(p).filter(([,e])=>Array.isArray(e)&&e.length); if(expected === "caddy"){ if(!entries.some(([k])=>k==="443/tcp")||entries.some(([k])=>k!=="443/tcp")||has(v.HostConfig?.PortBindings)&&Object.keys(v.HostConfig.PortBindings).some((k)=>k!=="443/tcp")) process.exit(3) } else if(entries.length||has(v.HostConfig?.PortBindings)) process.exit(4) }
' "$([ -n "$PROOF_COMPOSE" ] && printf proof || printf "$1")" 2>/dev/null || die "unexpected public port mapping: $1"
}
for service in $services; do variable=$(service_var "$service"); eval "id=\${$variable}"; check_ports "$service" "$id"; done

docker exec "$postgres_id" psql --username=hr_axis_bootstrap --dbname=hr_axis --tuples-only --no-align --command 'SELECT to_regclass('"'"'audit.schema_migration'"'"') IS NOT NULL;' 2>/dev/null | grep -qx t || die "authenticated Postgres schema query failed"
docker exec "$redis_id" sh -ec 'redis-cli -u "$(cat /run/secrets/redis_health_url)" --no-auth-warning PING | grep -qx PONG' >/dev/null 2>&1 || die "authenticated Redis PING failed"
object_network=$(docker inspect "$object_storage_id" --format '{{range $name,$value := .NetworkSettings.Networks}}{{$name}} {{end}}' 2>/dev/null | awk '{print $1}')
[ -n "$object_network" ] || die "object-storage private network is missing"
docker network inspect "$object_network" --format '{{.Internal}}' 2>/dev/null | grep -qx true || die "object-storage network is not internal"

RENDERED_CONFIG=$(compose config --format json 2>/dev/null) || die "cannot inspect rendered Compose config for auth secrets"
RENDERED_SECRET_SOURCES=$(printf '%s' "$RENDERED_CONFIG" | node -e '
const c = JSON.parse(require("fs").readFileSync(0, "utf8"))
for (const name of ["keycloak_synthetic_accounts", "caddy_tls_ca"]) {
  const source = c.secrets?.[name]
  if (!source || typeof source !== "object" || typeof source.file !== "string" || source.file.length === 0) process.exit(2)
  process.stdout.write(`${name}\t${source.file}\n`)
}
' 2>/dev/null) || die "rendered auth secrets keycloak_synthetic_accounts and caddy_tls_ca must each have exactly one string file source"
rendered_secret_path() {
  secret_name=$1
  printf '%s\n' "$RENDERED_SECRET_SOURCES" | awk -F '	' -v wanted="$secret_name" '$1 == wanted { count++; path=$2 } END { if (count != 1 || path == "") exit 1; print path }' || die "rendered auth secret must have exactly one string file source: $secret_name"
}
validate_rendered_secret_source() {
  secret_name=$1; expected_identity=$2; secret_file=$3
  case "$secret_file" in /*) ;; *) die "rendered secret source is not absolute: $secret_name";; esac
  case "$secret_file" in "$BUNDLE_ROOT"/*) die "rendered secret source is inside bundle: $secret_name";; esac
  [ -f "$secret_file" ] && [ ! -L "$secret_file" ] || die "rendered secret source is missing or symlinked: $secret_name"
  [ "$(file_links "$secret_file")" = 1 ] || die "rendered secret source is a hard link: $secret_name"
  canonical_secret=$(realpath -e -- "$secret_file" 2>/dev/null) || die "rendered secret source cannot be resolved canonically: $secret_name"
  [ "$canonical_secret" = "$secret_file" ] || die "rendered secret source must use a canonical path: $secret_name"
  require_trusted_directory_tree "$(dirname "$secret_file")" "rendered secret source: $secret_name"
  observed_identity="$(file_uid "$secret_file"):$(file_gid "$secret_file"):$(file_mode "$secret_file")"
  [ "$observed_identity" = "$expected_identity" ] || die "rendered secret source identity is unsafe: $secret_name"
  bytes=$(file_size "$secret_file"); case "$bytes" in ''|*[!0-9]*) die "cannot bound rendered secret source: $secret_name";; esac
  [ "$bytes" -le 1048576 ] || die "rendered secret source is too large: $secret_name"
}
ACCOUNTS_SOURCE=$(rendered_secret_path keycloak_synthetic_accounts)
CA_SOURCE=$(rendered_secret_path caddy_tls_ca)
validate_rendered_secret_source keycloak_synthetic_accounts 1000:1000:400 "$ACCOUNTS_SOURCE"
validate_rendered_secret_source caddy_tls_ca 0:0:444 "$CA_SOURCE"
AUTH_PROOF="$BUNDLE_ROOT/operations/onprem-keycloak-auth-proof.mjs"; [ -f "$AUTH_PROOF" ] && [ ! -L "$AUTH_PROOF" ] || die "bundled Keycloak auth proof is missing"
PUBLIC_HOST=$(env_value HR_AXIS_PUBLIC_HOST); [ -n "$PUBLIC_HOST" ] || die "approved public host is missing"
if [ -n "$PROOF_COMPOSE" ]; then
  BACKEND_IMAGE=$(env_value HR_AXIS_BACKEND_IMAGE)
  printf '%s' "$BACKEND_IMAGE" | grep -Eq '^sha256:[0-9a-f]{64}$' || die "approved backend image identity is invalid"
  AUTH_OUTPUT=$(docker run --pull=never --rm --user 1000:1000 --network "${TARGET_PROJECT}_proxy" \
    --volume "$AUTH_PROOF:/run/hr-axis/onprem-keycloak-auth-proof.mjs:ro" \
    --volume "$ACCOUNTS_SOURCE:/run/hr-axis/synthetic-accounts:ro" \
    --volume "$CA_SOURCE:/run/hr-axis/caddy-ca.crt:ro" \
    --entrypoint /nodejs/bin/node "$BACKEND_IMAGE" /run/hr-axis/onprem-keycloak-auth-proof.mjs --host "$PUBLIC_HOST" --connect-host caddy --connect-port 8443 \
    --accounts-file /run/hr-axis/synthetic-accounts --ca-file /run/hr-axis/caddy-ca.crt 2>/dev/null) || die "Keycloak synthetic auth proof failed"
else
  AUTH_OUTPUT=$(node "$AUTH_PROOF" --host "$PUBLIC_HOST" --connect-host 127.0.0.1 --connect-port 443 --accounts-file "$ACCOUNTS_SOURCE" --ca-file "$CA_SOURCE" 2>/dev/null) || die "Keycloak synthetic auth proof failed"
fi
printf '%s' "$AUTH_OUTPUT" | node -e 'const v=JSON.parse(require("fs").readFileSync(0,"utf8")); if(v.dataClass!=="synthetic"||v.personas?.count!==5||v.scopeAuthorization?.crossScopeDenied!==true||v.scopeAuthorization?.deniedActionWriteDelta!==0)process.exit(2)' 2>/dev/null || die "Keycloak receipt is not a sanitized five-persona cross-scope proof"

RUNTIME_EVIDENCE="$BUNDLE_ROOT/evidence/runtime-receipt.json"; [ -f "$RUNTIME_EVIDENCE" ] && [ ! -L "$RUNTIME_EVIDENCE" ] || die "signed runtime receipt is missing"
node - "$RUNTIME_EVIDENCE" "$RELEASE_ID" <<'NODE'
const fs=require('node:fs'); const [path,release]=process.argv.slice(2); let value; try{value=JSON.parse(fs.readFileSync(path,'utf8'))}catch{process.exit(1)}
const text=JSON.stringify(value); if(!text.includes(release)||!/photo|seaweed|storage/i.test(text)||!/(sha256:)?[0-9a-f]{64}/i.test(text)) process.exit(2)
NODE
[ "$?" -eq 0 ] || die "signed runtime receipt does not bind release and photo version/hash proof"

revalidate_receipt_parent
receipt_tmp=$(mktemp "$RECEIPT_PARENT/.runtime-receipt.XXXXXX") || die "cannot create atomic receipt"
trap 'rm -f "$receipt_tmp"' EXIT HUP INT TERM
umask 077
evidence_hash=$(sha256sum "$RUNTIME_EVIDENCE" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$RUNTIME_EVIDENCE" | awk '{print $1}')
printf '{"schemaVersion":1,"project":"%s","releaseId":"%s","dataClass":"synthetic","services":["caddy","frontend","api","worker","postgres","redis","keycloak","object-storage"],"keycloak":{"personas":5,"crossScopeDenied":true},"runtimeEvidenceSha256":"%s"}\n' "$TARGET_PROJECT" "$RELEASE_ID" "$evidence_hash" > "$receipt_tmp"
chmod 0600 "$receipt_tmp"; [ "$(file_mode "$receipt_tmp")" = 600 ] || die "receipt mode is not 0600"
receipt_content=$(cat "$receipt_tmp")
SECRET_LINES=$(compose config --format json 2>/dev/null | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); for(const [n,v] of Object.entries(c.secrets||{})){if(v&&typeof v.file==="string")process.stdout.write(`${n}\t${v.file}\n`)}' 2>/dev/null) || die "cannot inspect rendered secrets for receipt scan"
while IFS='	' read -r secret_name secret_file; do
  [ -n "$secret_name" ] || continue
  bytes=$(file_size "$secret_file"); [ "$bytes" -le 1048576 ] || die "secret source exceeds bounded receipt scan"
  value=$(cat "$secret_file")
  case "$secret_name" in
    keycloak_database_username) ;;
    *) [ -z "$value" ] || case "$receipt_content" in *"$value"*) die "runtime receipt contains an external secret value";; esac;;
  esac
done <<EOF
$SECRET_LINES
EOF
revalidate_receipt_parent
[ ! -e "$RECEIPT_PATH" ] && [ ! -L "$RECEIPT_PATH" ] || die "receipt destination must remain absent before publication"
ln "$receipt_tmp" "$RECEIPT_PATH" || die "atomic no-clobber receipt install failed"
rm -f "$receipt_tmp" || { rm -f "$RECEIPT_PATH"; die "receipt temporary link cleanup failed"; }
[ "$(file_links "$RECEIPT_PATH")" = 1 ] || { rm -f "$RECEIPT_PATH"; die "published receipt link count is invalid"; }
trap - EXIT HUP INT TERM
say "PASS project=$TARGET_PROJECT release=$RELEASE_ID services=8 receipt=$RECEIPT_PATH"
