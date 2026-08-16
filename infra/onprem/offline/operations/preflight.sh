#!/bin/sh
set -eu

# Read-only target gate. The verifier and every check in this file run before
# an installer may load an archive or ask Compose to create a resource.
die() { printf '%s\n' "preflight: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "preflight: $*"; }
BUNDLE_ROOT=; RELEASE_ID=; TARGET_PROJECT=; PUBLIC_KEY=; TRUSTED_FINGERPRINT=; ENV_FILE=; PROOF_COMPOSE=
ALLOW_UNLOADED_IMAGES=0; ALLOW_MISSING_LEDGER=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -gt 1 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2;;
    --release-id) [ "$#" -gt 1 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2;;
    --target-project|--project) [ "$#" -gt 1 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2;;
    --public-key|--trusted-public-key) [ "$#" -gt 1 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2;;
    --trusted-fingerprint) [ "$#" -gt 1 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2;;
    --env-file|--approved-env) [ "$#" -gt 1 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2;;
    --proof-compose) [ "$#" -gt 1 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2;;
    --allow-unloaded-images) ALLOW_UNLOADED_IMAGES=1; shift;;
    --allow-missing-ledger) ALLOW_MISSING_LEDGER=1; shift;;
    --help) printf '%s\n' 'usage: preflight.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --env-file PATH'; exit 0;;
    *) die "unknown argument: $1";;
  esac
done
[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] || die "bundle root, release id, target project, public key, trusted fingerprint, and approved env are required"
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "release id is not a safe identifier"
printf '%s' "$TARGET_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "target project is not a safe identifier"
case "$BUNDLE_ROOT:$PUBLIC_KEY:$ENV_FILE" in /*:*:/*) ;; *) die "bundle, public-key, and env paths must be absolute";; esac
case "$BUNDLE_ROOT" in /) die "bundle root must not be the filesystem root";; */) BUNDLE_ROOT=${BUNDLE_ROOT%/};; esac
case "$BUNDLE_ROOT" in '//'*) die "bundle root must use a canonical absolute path";; *'/./'*|*'/../'*|*/.|*/..) die "bundle root must not contain dot path components";; esac
[ -z "$PROOF_COMPOSE" ] || {
  case "$PROOF_COMPOSE" in /*) ;; *) die "proof Compose path must be absolute";; esac
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
}
[ -d "$BUNDLE_ROOT" ] && [ ! -L "$BUNDLE_ROOT" ] || die "bundle root is missing or a symlink"
[ -f "$PUBLIC_KEY" ] && [ ! -L "$PUBLIC_KEY" ] || die "trusted public key is missing or a symlink"
[ -f "$ENV_FILE" ] && [ ! -L "$ENV_FILE" ] || die "approved env file is missing or a symlink"
case "$ENV_FILE" in "$BUNDLE_ROOT"/*) die "approved env file must be outside the bundle root";; esac

file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || die "cannot inspect file mode"; }
file_uid() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null || die "cannot inspect file owner"; }
file_gid() { stat -c '%g' "$1" 2>/dev/null || stat -f '%g' "$1" 2>/dev/null || die "cannot inspect file group"; }
file_links() { stat -c '%h' "$1" 2>/dev/null || stat -f '%l' "$1" 2>/dev/null || die "cannot inspect hard-link count"; }
file_size() { stat -c '%s' "$1" 2>/dev/null || stat -f '%z' "$1" 2>/dev/null || die "cannot inspect file size"; }
mode_is() { wanted=$1; shift; for mode in "$@"; do [ "$wanted" = "$mode" ] && return 0; done; return 1; }
mode_has_group_or_world_write() {
  mode=$1
  case "$mode" in
    ''|*[!0-7]*) return 1;;
    *[2367][0-7]|*[0-7][2367]) return 0;;
    *) return 1;;
  esac
}
require_private_mode() {
  if mode_has_group_or_world_write "$1"; then
    die "$2 is group/world writable"
  fi
}
require_external_input_path() {
  external_path=$1
  external_label=$2
  case "$external_path" in /*) ;; *) die "$external_label must be an absolute path";; esac
  canonical_external_path=$(realpath -e -- "$external_path" 2>/dev/null) || die "$external_label cannot be resolved canonically"
  [ "$canonical_external_path" = "$external_path" ] || die "$external_label must not contain symlink or non-canonical path components"
  if [ -d "$external_path" ]; then
    external_ancestor=$external_path
  else
    external_ancestor=${external_path%/*}
    [ -n "$external_ancestor" ] || external_ancestor=/
  fi
  while :; do
    [ -d "$external_ancestor" ] && [ ! -L "$external_ancestor" ] || die "external input ancestor is missing or symlinked: $external_label"
    [ "$(file_uid "$external_ancestor")" = 0 ] || die "external input ancestor must be root-owned: $external_label"
    if mode_has_group_or_world_write "$(file_mode "$external_ancestor")"; then
      die "external input ancestor is group/world writable: $external_label"
    fi
    [ "$external_ancestor" = / ] && break
    external_parent=${external_ancestor%/*}
    [ -n "$external_parent" ] || external_parent=/
    [ "$external_parent" != "$external_ancestor" ] || die "external input ancestor walk did not reach filesystem root: $external_label"
    external_ancestor=$external_parent
  done
}
require_bundle_dir() {
  directory=$1
  [ -d "$directory" ] && [ ! -L "$directory" ] || die "bundle directory is missing, symlinked, or not a directory: $directory"
  [ "$(file_uid "$directory")" = 0 ] || die "bundle directory must be root-owned: $directory"
  require_private_mode "$(file_mode "$directory")" "bundle directory: $directory"
}
require_signed_file() {
  pathname=$1
  [ -f "$pathname" ] && [ ! -L "$pathname" ] || die "signed bundle entry is missing, symlinked, or not a regular file: $pathname"
  [ "$(file_links "$pathname")" = 1 ] || die "signed bundle file must not be a hard link: $pathname"
  [ "$(file_uid "$pathname")" = 0 ] || die "signed bundle file must be root-owned: $pathname"
  mode=$(file_mode "$pathname")
  require_private_mode "$mode" "signed bundle file: $pathname"
  relative=${pathname#"$BUNDLE_ROOT"/}
  case "$relative" in
    operations/*.sh|operations/*.mjs|deployment/keycloak/bootstrap.sh|deployment/postgres/entrypoint-tls.sh|deployment/postgres/010-bootstrap-roles.sh|deployment/photo-storage/bootstrap.sh)
      [ "$mode" = 755 ] || die "signed executable lost required 0755 mode: $relative"
      ;;
  esac
}
operator_uid=$(id -u 2>/dev/null || true)
[ "$operator_uid" = 0 ] || die "root privileges are required for host installation"
[ "$(uname -s 2>/dev/null || true)" = Linux ] || die "target host must be Linux"

# Delivery media is an input boundary, not an execution boundary.  Before the
# signed verifier or any Docker command is reached, prove that the sealed root
# and every existing ancestor are real root-owned directories without
# group/world write access.  Then inspect only filesystem metadata for the
# exact bundle tree.  In particular, image archives are never opened or read
# here; their signed digests are checked by the verifier and by docker load.
bundle_path=$BUNDLE_ROOT
while :; do
  require_bundle_dir "$bundle_path"
  [ "$bundle_path" = / ] && break
  parent_path=${bundle_path%/*}
  [ -n "$parent_path" ] || parent_path=/
  [ "$parent_path" != "$bundle_path" ] || die "bundle root ancestor walk did not reach filesystem root"
  bundle_path=$parent_path
done
bundle_entries=$(find -P "$BUNDLE_ROOT" -mindepth 1 -print 2>/dev/null) || die "cannot inspect bundle entry metadata"
while IFS= read -r bundle_entry; do
  [ -n "$bundle_entry" ] || continue
  [ ! -L "$bundle_entry" ] || die "bundle contains a symlink entry: $bundle_entry"
  if [ -d "$bundle_entry" ]; then
    require_bundle_dir "$bundle_entry"
  elif [ -f "$bundle_entry" ]; then
    require_signed_file "$bundle_entry"
  else
    die "bundle contains a special filesystem entry: $bundle_entry"
  fi
done <<EOF
$bundle_entries
EOF
key_mode=$(file_mode "$PUBLIC_KEY"); mode_is "$key_mode" 400 440 444 600 640 644 || die "trusted public key mode is too broad"
[ "$(file_uid "$PUBLIC_KEY")" = 0 ] || die "trusted public key must be root-owned"
[ "$(file_links "$PUBLIC_KEY")" = 1 ] || die "trusted public key must not be a hard link"
env_mode=$(file_mode "$ENV_FILE"); mode_is "$env_mode" 600 640 || die "approved env mode must be 0600 or 0640"
[ "$(file_uid "$ENV_FILE")" = 0 ] || die "approved env file must be root-owned"
[ "$(file_links "$ENV_FILE")" = 1 ] || die "approved env file must not be a hard link"
require_external_input_path "$PUBLIC_KEY" "trusted public key"
require_external_input_path "$ENV_FILE" "approved env file"
env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
require_env() { value=$(env_value "$1"); [ -n "$value" ] || die "approved env is missing $1"; printf '%s' "$value"; }
require_env_match() { [ "$(env_value "$1")" = "$2" ] || die "approved env identity mismatch for $1"; }
require_env_match HR_AXIS_RELEASE_ID "$RELEASE_ID"
require_env_match COMPOSE_PROJECT_NAME "$TARGET_PROJECT"
require_env_match HR_AXIS_PROJECT_ID "$TARGET_PROJECT"
require_env_match KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED true
require_env_match KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED true
PUBLIC_HOST=$(require_env HR_AXIS_PUBLIC_HOST)
printf '%s' "$PUBLIC_HOST" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$' || die "public hostname is not a sanitized DNS name"

# Both roots are owner-supplied and must remain outside the signed bundle.
hr_axis_secret_root=$(require_env HR_AXIS_SECRET_ROOT)
photo_storage_secret_root=$(require_env PHOTO_STORAGE_SECRET_ROOT)
for secret_root_pair in "HR_AXIS_SECRET_ROOT:$hr_axis_secret_root" "PHOTO_STORAGE_SECRET_ROOT:$photo_storage_secret_root"; do
  secret_root_name=${secret_root_pair%%:*}
  secret_root=${secret_root_pair#*:}
  case "$secret_root" in /*) ;; *) die "$secret_root_name must be an absolute path";; esac
  case "$secret_root" in "$BUNDLE_ROOT"/*) die "$secret_root_name must be outside the bundle";; esac
  [ -d "$secret_root" ] && [ ! -L "$secret_root" ] || die "$secret_root_name must name a real directory"
  require_external_input_path "$secret_root" "$secret_root_name"
  [ "$(file_uid "$secret_root")" = 0 ] || die "$secret_root_name must be root-owned"
  mode_is "$(file_mode "$secret_root")" 700 || die "$secret_root_name mode must be 0700"
done
secret_values=$(awk -F= '$0 !~ /^[[:space:]]*#/ && $1 ~ /(PASSWORD|SECRET|TOKEN|PRIVATE_KEY|ACCESS_KEY)/ && $2 != "" { print $2 }' "$ENV_FILE")
while IFS= read -r value; do
  [ -z "$value" ] || case "$value" in /*) ;; *) die "approved env contains a literal secret value";; esac
done <<EOF
$secret_values
EOF

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"; PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"; PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
[ -f "$CORE_COMPOSE" ] && [ ! -L "$CORE_COMPOSE" ] || die "bundled core Compose file is missing"
[ -f "$PHOTO_PROOF_COMPOSE" ] && [ ! -L "$PHOTO_PROOF_COMPOSE" ] || die "bundled photo-proof Compose overlay is missing"
[ -f "$PHOTO_COMPOSE" ] && [ ! -L "$PHOTO_COMPOSE" ] || die "bundled photo Compose file is missing"
[ -f "$BUNDLE_ROOT/bundle-manifest.json" ] && [ -f "$BUNDLE_ROOT/bundle-signature.json" ] || die "signed bundle manifest/signature is missing"
VERIFIER="$BUNDLE_ROOT/operations/onprem-offline-bundle.mjs"; [ -f "$VERIFIER" ] || VERIFIER="$BUNDLE_ROOT/onprem-offline-bundle.mjs"
[ -f "$VERIFIER" ] || die "bundled offline verifier is missing"
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"

image_env_name() {
  case "$1" in backend) printf '%s' HR_AXIS_BACKEND_IMAGE;; frontend) printf '%s' HR_AXIS_FRONTEND_IMAGE;; keycloak) printf '%s' KEYCLOAK_IMAGE;; caddy) printf '%s' CADDY_IMAGE;; postgres) printf '%s' POSTGRES_IMAGE;; redis) printf '%s' REDIS_IMAGE;; seaweedfs) printf '%s' SEAWEEDFS_IMAGE;; *) die "unknown signed image";; esac
}
IMAGE_LINES=$(node - "$BUNDLE_ROOT/bundle-manifest.json" <<'NODE'
const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); const names=['backend','frontend','keycloak','caddy','postgres','redis','seaweedfs'];
if(!m.images||Object.keys(m.images).length!==7) process.exit(41); for(const n of names){const i=m.images[n]; if(!i||i.name!==n||!i.archive||!i.repoTag||typeof i.archiveSha256!=='string'||!/^[0-9a-f]{64}$/.test(i.archiveSha256)||!/^sha256:[0-9a-f]{64}$/.test(i.configImageId)) process.exit(42); process.stdout.write(`${n}|${i.archive}|${i.repoTag}|${i.configImageId}\n`)}
NODE
) || die "signed image manifest is invalid"
image_count=0
while IFS='|' read -r name archive identity image_id; do
  [ -n "$name" ] || continue
  image_count=$((image_count+1)); var=$(image_env_name "$name")
  [ "$(env_value "$var")" = "$image_id" ] || die "approved env image identity mismatch: $var"
done <<EOF
$IMAGE_LINES
EOF
[ "$image_count" -eq 7 ] || die "signed manifest must contain exactly seven images"

version_at_least() {
  version=$(printf '%s' "$1" | sed 's/^[^0-9]*//; s/[-+].*$//')
  req_major=$2; req_minor=$3; req_patch=${4:-0}
  major=${version%%.*}; rest=${version#*.}
  if [ "$rest" = "$version" ]; then minor=0; patch=0; else
    minor=${rest%%.*}; patch=${rest#*.}; [ "$patch" = "$rest" ] && patch=0
  fi
  case "$major:$minor:$patch:$req_major:$req_minor:$req_patch" in *[!0-9:]*|::*|*::*) return 1;; esac
  [ "$major" -gt "$req_major" ] || {
    [ "$major" -eq "$req_major" ] && {
      [ "$minor" -gt "$req_minor" ] || { [ "$minor" -eq "$req_minor" ] && [ "$patch" -ge "$req_patch" ]; }
    }
  }
}
version_at_least "$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)" 24 0 0 || die "Docker Engine 24 or newer is required"
version_at_least "$(docker compose version --short 2>/dev/null || true)" 2 24 4 || die "Docker Compose plugin 2.24.4 or newer is required"
version_at_least "$(node --version 2>/dev/null || true)" 20 0 0 || die "Node.js 20 or newer is required"
disk_kib=$(df -Pk "$BUNDLE_ROOT" 2>/dev/null|awk 'NR==2{print $4}'); inode_free=$(df -Pi "$BUNDLE_ROOT" 2>/dev/null|awk 'NR==2{print $4}'); case "$disk_kib:$inode_free" in *[!0-9:]*|:*) die "disk/inode capacity cannot be measured";; esac
[ "$disk_kib" -ge 8000000 ] || die "insufficient free disk capacity"; [ "$inode_free" -ge 100000 ] || die "insufficient free inode capacity"
memory_bytes=$(free -b 2>/dev/null|awk '/^Mem:/{print $7;exit}'); case "$memory_bytes" in *[!0-9]*|"") die "free memory cannot be measured";; esac; [ "$memory_bytes" -ge 4294967296 ] || die "insufficient free memory"
cpu_count=$(nproc 2>/dev/null||true); case "$cpu_count" in *[!0-9]*|"") die "CPU capacity cannot be measured";; esac; [ "$cpu_count" -ge 4 ] || die "insufficient CPU capacity"

compose_config() {
  if [ -n "$PROOF_COMPOSE" ]; then
    docker compose --project-name "$TARGET_PROJECT" --profile '*' --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"
  else
    docker compose --project-name "$TARGET_PROJECT" --profile '*' --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"
  fi
}
CONFIG=$(compose_config config --format json 2>/dev/null) || die "merged Compose config rendering failed"
printf '%s' "$CONFIG" | node -e '
const c = JSON.parse(require("fs").readFileSync(0, "utf8"))
const expected = {
  "com.hr-axis.project": process.argv[1],
  "com.hr-axis.release-id": process.argv[2],
  "com.hr-axis.data-class": "synthetic",
}
if (!c.services || !Object.keys(c.services).includes("object-storage")) process.exit(41)
for (const serviceName of ["keycloak-bootstrap", "identity-binder"]) {
  if (c.services?.[serviceName]?.environment?.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED !== "true") process.exit(44)
}
if (typeof c.secrets?.keycloak_synthetic_photo_proof_account?.file !== "string") process.exit(45)
for (const [kind, entries] of Object.entries({ services: c.services, networks: c.networks, volumes: c.volumes })) {
  for (const [name, entry] of Object.entries(entries || {})) {
    const labels = entry && entry.labels
    if (kind === "services" && (!labels || typeof labels !== "object")) process.exit(42)
    if (!labels || typeof labels !== "object") continue
    for (const [key, value] of Object.entries(expected)) if (labels[key] !== value) process.exit(43)
  }
}
' "$TARGET_PROJECT" "$RELEASE_ID" 2>/dev/null || die "merged Compose labels are missing or mismatched"

# Compose's rendered top-level secrets are authoritative. Never infer safety
# from TLS_* aliases alone: inspect every source, including photo credentials.
SECRET_LINES=$(printf '%s' "$CONFIG" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); for(const [n,v] of Object.entries(c.secrets||{})){if(v&&typeof v.file==="string") process.stdout.write(`${n}\t${v.file}\n`)}' 2>/dev/null) || die "cannot extract rendered secret sources"
[ -n "$SECRET_LINES" ] || die "merged Compose rendered no secret sources"
secret_path() { printf '%s\n' "$SECRET_LINES"|awk -F '	' -v n="$1" '$1==n{print $2;exit}'; }
rendered_secret_identity() {
  case "$1" in
    caddy_tls_certificate|caddy_tls_ca|postgres_tls_certificate|postgres_tls_ca) printf '%s' 0:0:444;;
    caddy_tls_private_key) printf '%s' 10001:10001:400;;
    postgres_tls_private_key|postgres_bootstrap_password|postgres_migrator_password|postgres_api_password|postgres_worker_password|postgres_keycloak_database_password) printf '%s' 70:70:400;;
    keycloak_*|binder_database_url) printf '%s' 1000:1000:400;;
    redis_users_acl|redis_health_url) printf '%s' 999:1000:400;;
    migrator_database_url|api_database_url|worker_database_url|redis_api_url|redis_worker_url|browser_session_secret) printf '%s' 65532:65532:400;;
    photo_primary_access_key_id|photo_primary_secret_access_key|photo_recovery_access_key_id|photo_recovery_secret_access_key) printf '%s' 65532:0:440;;
    *) die "rendered secret source has no approved identity policy: $1";;
  esac
}
while IFS='	' read -r secret_name secret_file; do
  [ -n "$secret_name" ] || continue
  case "$secret_file" in /*) ;; *) die "rendered secret source is not absolute: $secret_name";; esac
  case "$secret_file" in "$BUNDLE_ROOT"/*) die "rendered secret source is inside bundle: $secret_name";; esac
  [ -f "$secret_file" ] && [ ! -L "$secret_file" ] || die "rendered secret source is missing or symlinked: $secret_name"
  [ "$(file_links "$secret_file")" = 1 ] || die "rendered secret source is a hard link: $secret_name"
  require_external_input_path "$secret_file" "rendered secret source: $secret_name"
  expected_identity=$(rendered_secret_identity "$secret_name")
  observed_identity="$(file_uid "$secret_file"):$(file_gid "$secret_file"):$(file_mode "$secret_file")"
  [ "$observed_identity" = "$expected_identity" ] || die "rendered secret source identity is unsafe: $secret_name"
  bytes=$(file_size "$secret_file"); case "$bytes" in *[!0-9]*|"") die "cannot bound rendered secret source: $secret_name";; esac
  [ "$bytes" -le 1048576 ] || die "rendered secret source is too large: $secret_name"
  value=$(cat "$secret_file")
  case "$secret_name" in
    keycloak_database_username) ;;
    *) [ -z "$value" ] || case "$CONFIG" in *"$value"*) die "Compose config contains a rendered secret value: $secret_name";; esac;;
  esac
done <<EOF
$SECRET_LINES
EOF
TLS_CERT_FILE=$(secret_path caddy_tls_certificate); TLS_KEY_FILE=$(secret_path caddy_tls_private_key); TLS_CA_FILE=$(secret_path caddy_tls_ca)
[ -n "$TLS_CERT_FILE" ] && [ -n "$TLS_KEY_FILE" ] && [ -n "$TLS_CA_FILE" ] || die "rendered TLS certificate/key/CA sources are required"
openssl x509 -in "$TLS_CERT_FILE" -noout -checkend 0 >/dev/null 2>&1 || die "TLS certificate is expired"
openssl x509 -in "$TLS_CERT_FILE" -noout -checkhost "$PUBLIC_HOST" >/dev/null 2>&1 || die "TLS certificate hostname mismatch"
openssl x509 -in "$TLS_CA_FILE" -noout >/dev/null 2>&1 || die "TLS CA cannot be parsed"
openssl x509 -in "$TLS_CERT_FILE" -noout >/dev/null 2>&1 || die "TLS certificate cannot be parsed"
openssl verify -CAfile "$TLS_CA_FILE" "$TLS_CERT_FILE" >/dev/null 2>&1 || die "TLS certificate chain does not verify"
openssl pkey -in "$TLS_KEY_FILE" -noout -check >/dev/null 2>&1 || die "TLS private key is invalid"
TLS_TMP=$(mktemp -d "${TMPDIR:-/tmp}/onprem-preflight-tls.XXXXXX") || die "cannot create TLS verification workspace"
cleanup_tls() { rm -f "$TLS_TMP/cert.pub" "$TLS_TMP/cert.der" "$TLS_TMP/key.der"; rmdir "$TLS_TMP" 2>/dev/null || true; }
trap cleanup_tls EXIT HUP INT TERM
openssl x509 -in "$TLS_CERT_FILE" -pubkey -noout > "$TLS_TMP/cert.pub" || die "cannot extract TLS certificate public key"
openssl pkey -pubin -in "$TLS_TMP/cert.pub" -outform DER -out "$TLS_TMP/cert.der" >/dev/null 2>&1 || die "cannot encode TLS certificate public key"
openssl pkey -in "$TLS_KEY_FILE" -pubout -outform DER -out "$TLS_TMP/key.der" >/dev/null 2>&1 || die "cannot encode TLS private key public key"
cert_public_digest=$(openssl dgst -sha256 "$TLS_TMP/cert.der" 2>/dev/null | sed 's/^.*= //')
key_public_digest=$(openssl dgst -sha256 "$TLS_TMP/key.der" 2>/dev/null | sed 's/^.*= //')
[ -n "$cert_public_digest" ] && [ "$cert_public_digest" = "$key_public_digest" ] || die "TLS certificate and private key public keys do not match"

check_labels() {
  kind=$1
  case "$kind" in
    container) ids=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null||true); fmt='{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.hr-axis.data-class"}}'; inspect='docker inspect';;
    network) ids=$(docker network ls -q --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null||true); fmt='{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.release-id"}}|{{index .Labels "com.hr-axis.data-class"}}'; inspect='docker network inspect';;
    volume) ids=$(docker volume ls -q --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null||true); fmt='{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.release-id"}}|{{index .Labels "com.hr-axis.data-class"}}'; inspect='docker volume inspect';;
    *) die "unsupported resource inventory";;
  esac
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    labels=$(eval "$inspect \"$id\" --format '$fmt'" 2>/dev/null||true)
    [ "$labels" = "$TARGET_PROJECT|$RELEASE_ID|synthetic" ] || die "existing mismatched $kind resource"
  done <<EOF
$ids
EOF
}
check_labels container; check_labels network; check_labels volume
manifest_image_id() {
  printf '%s\n' "$IMAGE_LINES" | awk -F '|' -v wanted="$1" '$1 == wanted { print $4; exit }'
}
runtime_image_for_service() {
  case "$1" in
    api|worker|identity-binder|migrator|synthetic-seed) manifest_image_id backend;;
    keycloak|keycloak-bootstrap) manifest_image_id keycloak;;
    frontend) manifest_image_id frontend;;
    caddy) manifest_image_id caddy;;
    postgres) manifest_image_id postgres;;
    redis) manifest_image_id redis;;
    object-storage) manifest_image_id seaweedfs;;
    *) return 1;;
  esac
}
runtime_container_ids=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null || true)
while IFS= read -r runtime_container_id; do
  [ -n "$runtime_container_id" ] || continue
  runtime_record=$(docker inspect "$runtime_container_id" --format '{{index .Config.Labels "com.docker.compose.service"}}|{{.Image}}' 2>/dev/null || true)
  runtime_service=$(printf '%s' "$runtime_record" | cut -d'|' -f1)
  runtime_image=$(printf '%s' "$runtime_record" | cut -d'|' -f2)
  [ -n "$runtime_service" ] || die "existing target container has no Compose service label"
  expected_runtime_image=$(runtime_image_for_service "$runtime_service") || die "existing target container has an unsupported Compose service: $runtime_service"
  [ "$runtime_image" = "$expected_runtime_image" ] || die "existing target container image identity mismatch: $runtime_service"
done <<EOF
$runtime_container_ids
EOF
for image_record in $IMAGE_LINES; do
  image_name=$(printf '%s' "$image_record"|cut -d'|' -f1); image_archive=$(printf '%s' "$image_record"|cut -d'|' -f2); image_id=$(printf '%s' "$image_record"|cut -d'|' -f4)
  [ -f "$BUNDLE_ROOT/$image_archive" ] && [ ! -L "$BUNDLE_ROOT/$image_archive" ] || die "image archive is missing: $image_name"
  if [ "$ALLOW_UNLOADED_IMAGES" -eq 0 ]; then [ "$(docker image inspect --format '{{.Id}}' "$image_id" 2>/dev/null||true)" = "$image_id" ] || die "exact image is unavailable or has wrong image id: $image_name"; fi
done
ledger_file=$(env_value MIGRATION_LEDGER_FILE); ledger_required=$(env_value MIGRATION_LEDGER_REQUIRED)
if [ -n "$ledger_file" ]; then
  case "$ledger_file" in /*) ;; *) die "migration ledger path must be absolute";; esac
  [ "$ledger_file" != "$BUNDLE_ROOT" ] && [ "$ledger_file" != "$hr_axis_secret_root" ] && [ "$ledger_file" != "$photo_storage_secret_root" ] || die "migration ledger must be outside bundle and secret roots"
  case "$ledger_file" in "$BUNDLE_ROOT"/*|"$hr_axis_secret_root"/*|"$photo_storage_secret_root"/*) die "migration ledger must be outside bundle and secret roots";; esac
  ledger_parent=$(dirname "$ledger_file")
  [ -d "$ledger_parent" ] && [ ! -L "$ledger_parent" ] || die "migration ledger parent is missing or symlinked"
  require_external_input_path "$ledger_parent" "migration ledger parent"
  ledger_parent_links=$(file_links "$ledger_parent")
  case "$ledger_parent_links" in ''|*[!0-9]*) die "migration ledger parent link count cannot be inspected";; esac
  [ "$ledger_parent_links" -ge 1 ] || die "migration ledger parent link count is invalid"
  ledger_parent_owner=$(file_uid "$ledger_parent")
  [ "$ledger_parent_owner" = 0 ] || [ "$ledger_parent_owner" = "$operator_uid" ] || die "migration ledger parent owner is unsafe"
  parent_mode=$(file_mode "$ledger_parent"); mode_is "$parent_mode" 700 750 || die "migration ledger parent mode is too broad"
  if [ -f "$ledger_file" ]; then
    [ ! -L "$ledger_file" ] || die "migration ledger is symlinked"
    require_external_input_path "$ledger_file" "migration ledger"
    [ "$(file_links "$ledger_file")" = 1 ] || die "migration ledger is a hard link"
    mode=$(file_mode "$ledger_file"); mode_is "$mode" 600 640 || die "migration ledger mode is too broad"
    ledger_owner=$(file_uid "$ledger_file")
    [ "$ledger_owner" = 0 ] || [ "$ledger_owner" = "$operator_uid" ] || die "migration ledger owner is unsafe"
  elif [ "$ALLOW_MISSING_LEDGER" -eq 0 ] && [ "$ledger_required" = true ]; then
    die "migration ledger is required but unavailable"
  fi
elif [ "$ledger_required" = true ] && [ "$ALLOW_MISSING_LEDGER" -eq 0 ]; then
  die "migration ledger is required but unavailable"
fi
say "PASS project=$TARGET_PROJECT release=$RELEASE_ID images=7"
