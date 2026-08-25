#!/bin/sh
set -eu

# ONP-5 is a synthetic, same-host rehearsal.  It is not an encrypted DR
# backup and it never archives the physical PostgreSQL data volume.
umask 077
die() { printf '%s\n' "backup: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "backup: $*"; }

BUNDLE_ROOT=
RELEASE_ID=
TARGET_PROJECT=
PUBLIC_KEY=
BACKUP_PRIVATE_KEY=
TRUSTED_FINGERPRINT=
BACKUP_TRUSTED_FINGERPRINT=
ENV_FILE=
BACKUP_DIR=
PROOF_COMPOSE=
PHOTO_RECOVERY_HANDLE_FILE=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -ge 2 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2 ;;
    --release-id) [ "$#" -ge 2 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2 ;;
    --target-project|--project) [ "$#" -ge 2 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2 ;;
    --public-key|--trusted-public-key) [ "$#" -ge 2 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2 ;;
    --backup-private-key|--private-key|--signing-key|--owner-private-key) [ "$#" -ge 2 ] || die "--backup-private-key requires a value"; BACKUP_PRIVATE_KEY=$2; shift 2 ;;
    --trusted-fingerprint) [ "$#" -ge 2 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --backup-trusted-fingerprint) [ "$#" -ge 2 ] || die "--backup-trusted-fingerprint requires a value"; BACKUP_TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --env-file|--approved-env) [ "$#" -ge 2 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2 ;;
    --backup-dir) [ "$#" -ge 2 ] || die "--backup-dir requires a value"; BACKUP_DIR=$2; shift 2 ;;
    --proof-compose) [ "$#" -ge 2 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2 ;;
    --photo-recovery-handle-file) [ "$#" -ge 2 ] || die "--photo-recovery-handle-file requires a value"; PHOTO_RECOVERY_HANDLE_FILE=$2; shift 2 ;;
    --help) printf '%s\n' 'usage: backup.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --backup-private-key PEM --backup-trusted-fingerprint HEX64 --env-file PATH --backup-dir ABSENT_DIR'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$BACKUP_PRIVATE_KEY" ] && [ -n "$BACKUP_TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] && [ -n "$BACKUP_DIR" ] && [ -n "$PHOTO_RECOVERY_HANDLE_FILE" ] || die "bundle root, release id, target project, release trust, backup private key/trust, env, backup dir, and photo recovery handle are required"
printf '%s' "$RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "release id is unsafe"
printf '%s' "$TARGET_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "target project is unsafe"
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$BACKUP_TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "backup trusted fingerprint must be 64 lowercase hex characters"

require_absolute() { case "$1" in /*) ;; *) die "$2 must be an absolute path" ;; esac; }
require_no_symlink_components() {
  path=$1
  while [ "$path" != / ] && [ -n "$path" ]; do
    [ ! -L "$path" ] || die "$2 contains a symlink component"
    next=$(dirname "$path")
    [ "$next" != "$path" ] || break
    path=$next
  done
}
require_file() {
  require_absolute "$1" "$2"
  [ -f "$1" ] && [ ! -L "$1" ] || die "$2 is missing or a symlink"
  require_no_symlink_components "$1" "$2"
}
require_dir() {
  require_absolute "$1" "$2"
  [ -d "$1" ] && [ ! -L "$1" ] || die "$2 is missing or a symlink"
  require_no_symlink_components "$1" "$2"
}
file_uid() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null || die "cannot inspect owner: $2"; }
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || die "cannot inspect mode: $2"; }
file_nlink() { stat -c '%h' "$1" 2>/dev/null || stat -f '%l' "$1" 2>/dev/null || die "cannot inspect link count: $2"; }
file_identity() { stat -c '%d:%i' "$1" 2>/dev/null || stat -f '%d:%i' "$1" 2>/dev/null || die "cannot inspect filesystem identity: $2"; }
sha256_file() { sha256sum "$1" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$1" | awk '{print $1}'; }
mode_has_group_or_world_write() {
  case "$1" in
    ''|*[!0-7]*) return 1 ;;
    *[2367][0-7]|*[0-7][2367]) return 0 ;;
    *) return 1 ;;
  esac
}
canonical_dir() {
  directory=$1
  (CDPATH= cd -P "$directory" 2>/dev/null && pwd -P) || die "cannot resolve canonical directory: $2"
}
# The backup parent and every ancestor are canonical, root-owned, private
# directories (backup parent must be root-owned and not group/world writable).
# This trust boundary is checked again before each output use.
require_trusted_directory_tree() {
  directory=$1
  label=$2
  require_absolute "$directory" "$label"
  canonical=$(canonical_dir "$directory" "$label")
  [ "$canonical" = "$directory" ] || die "$label must use a canonical absolute path"
  current=$canonical
  while :; do
    [ -d "$current" ] && [ ! -L "$current" ] || die "$label ancestor is missing or symlinked: $current"
    uid=$(file_uid "$current" "$label")
    host_os=$(uname -s 2>/dev/null || true)
    if [ "$host_os" = Linux ]; then
      [ "$uid" = 0 ] || die "$label directory must be root-owned: $current"
    else
      # Windows/Git-shell contract harnesses cannot expose uid 0. The real
      # offline target is Linux and remains strictly root-owned there.
      operator_uid=${operator_uid:-$(id -u 2>/dev/null || true)}
      [ "$uid" = 0 ] || [ "$uid" = "$operator_uid" ] || die "$label directory must be root-owned: $current"
    fi
    mode=$(file_mode "$current" "$label")
    case "$mode" in ''|*[!0-7]*) die "$label directory mode cannot be inspected: $current" ;; esac
    mode_has_group_or_world_write "$mode" && die "$label directory is group/world writable: $current"
    nlink=$(file_nlink "$current" "$label")
    case "$nlink" in ''|*[!0-9]*) die "$label directory link count cannot be inspected: $current" ;; esac
    [ "$nlink" -ge 1 ] || die "$label directory link count is invalid: $current"
    [ "$current" = / ] && break
    parent=$(dirname "$current")
    [ "$parent" != "$current" ] || die "$label ancestor walk did not reach filesystem root"
    current=$parent
  done
}
capture_backup_parent_identity() {
  BACKUP_PARENT_CANONICAL=$(canonical_dir "$BACKUP_PARENT" backup-parent)
  BACKUP_PARENT_UID=$(file_uid "$BACKUP_PARENT_CANONICAL" backup-parent)
  BACKUP_PARENT_MODE=$(file_mode "$BACKUP_PARENT_CANONICAL" backup-parent)
  BACKUP_PARENT_IDENTITY=$(file_identity "$BACKUP_PARENT_CANONICAL" backup-parent)
}
revalidate_backup_parent() {
  require_trusted_directory_tree "$BACKUP_PARENT" backup-parent
  current=$(canonical_dir "$BACKUP_PARENT" backup-parent)
  [ "$current" = "$BACKUP_PARENT_CANONICAL" ] || die "backup parent canonical identity changed"
  [ "$(file_identity "$current" backup-parent)" = "$BACKUP_PARENT_IDENTITY" ] || die "backup parent filesystem identity changed"
  [ "$(file_uid "$current" backup-parent)" = "$BACKUP_PARENT_UID" ] || die "backup parent owner changed"
  [ "$(file_mode "$current" backup-parent)" = "$BACKUP_PARENT_MODE" ] || die "backup parent mode changed"
}
require_output_directory() {
  directory=$1
  [ -d "$directory" ] && [ ! -L "$directory" ] || die "temporary backup directory is missing or symlinked"
  require_no_symlink_components "$directory" temporary-backup
  canonical=$(canonical_dir "$directory" temporary-backup)
  parent=$(dirname "$canonical")
  [ "$parent" = "$BACKUP_PARENT_CANONICAL" ] || die "temporary backup directory escaped trusted parent"
  name=$(basename "$canonical")
  case "$name" in .backup.tmp.*) ;; *) die "temporary backup directory name is unsafe" ;; esac
  temp_uid=$(file_uid "$canonical" temporary-backup)
  host_os=$(uname -s 2>/dev/null || true)
  if [ "$host_os" = Linux ]; then
    [ "$temp_uid" = 0 ] || die "temporary backup directory must be root-owned"
  else
    # Git-shell contract harnesses cannot expose uid 0; production Linux
    # remains strictly root-owned through the branch above.
    [ "$temp_uid" = 0 ] || [ "$temp_uid" = "$operator_uid" ] || die "temporary backup directory must be root-owned"
  fi
  [ "$(file_mode "$canonical" temporary-backup)" = 700 ] || die "temporary backup directory mode must be 0700"
  nlink=$(file_nlink "$canonical" temporary-backup)
  case "$nlink" in ''|*[!0-9]*) die "temporary backup directory link count cannot be inspected" ;; esac
  [ "$nlink" -ge 1 ] || die "temporary backup directory link count is invalid"
}
capture_temp_identity() {
  TEMP_DIR_CANONICAL=$(canonical_dir "$TEMP_DIR" temporary-backup)
  TEMP_DIR_UID=$(file_uid "$TEMP_DIR_CANONICAL" temporary-backup)
  TEMP_DIR_MODE=$(file_mode "$TEMP_DIR_CANONICAL" temporary-backup)
  TEMP_DIR_IDENTITY=$(file_identity "$TEMP_DIR_CANONICAL" temporary-backup)
}
revalidate_temp_identity() {
  require_output_directory "$TEMP_DIR"
  current=$(canonical_dir "$TEMP_DIR" temporary-backup)
  [ "$current" = "$TEMP_DIR_CANONICAL" ] || die "temporary backup directory canonical identity changed"
  [ "$(file_identity "$current" temporary-backup)" = "$TEMP_DIR_IDENTITY" ] || die "temporary backup directory filesystem identity changed"
  [ "$(file_uid "$current" temporary-backup)" = "$TEMP_DIR_UID" ] || die "temporary backup directory owner changed"
  [ "$(file_mode "$current" temporary-backup)" = "$TEMP_DIR_MODE" ] || die "temporary backup directory mode changed"
}
require_recovery_handle() {
  require_file "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle
  case "$PHOTO_RECOVERY_HANDLE_FILE" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "photo recovery handle must be outside bundle" ;; esac
  PHOTO_RECOVERY_HANDLE_PARENT=$(dirname "$PHOTO_RECOVERY_HANDLE_FILE")
  require_trusted_directory_tree "$PHOTO_RECOVERY_HANDLE_PARENT" photo-recovery-handle-parent
  [ "$(dirname "$PHOTO_RECOVERY_HANDLE_FILE")" = "$PHOTO_RECOVERY_HANDLE_PARENT" ] || die "photo recovery handle parent must be canonical"
  [ "$(file_nlink "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)" = 1 ] || die "photo recovery handle must not be hard-linked"
  handle_uid=$(file_uid "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)
  host_os=$(uname -s 2>/dev/null || true)
  if [ "$host_os" = Linux ]; then [ "$handle_uid" = 0 ] || die "photo recovery handle must be root-owned"; else [ "$handle_uid" = 0 ] || [ "$handle_uid" = "$operator_uid" ] || die "photo recovery handle must be root/operator-owned"; fi
  handle_mode=$(file_mode "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)
  case "$handle_mode" in 400|600) ;; *) die "photo recovery handle mode must be 0400 or 0600" ;; esac
  PHOTO_RECOVERY_HANDLE_IDENTITY=$(file_identity "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)
  PHOTO_RECOVERY_HANDLE_SHA256=$(sha256_file "$PHOTO_RECOVERY_HANDLE_FILE")
  PHOTO_RECOVERY_CONTENT=$(node - "$PHOTO_RECOVERY_HANDLE_FILE" <<'NODE'
const fs = require('node:fs')
const pathname = process.argv[2]
let value
try { value = JSON.parse(fs.readFileSync(pathname, 'utf8')) } catch { process.exit(41) }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const digest = /^[0-9a-f]{64}$/
if (!value || Object.keys(value).length !== 5 || value.schemaVersion !== 1 || value.dataClass !== 'synthetic' || !uuid.test(value.mediaAssetId) || !digest.test(value.contentSha256) || !Number.isSafeInteger(value.contentLength) || value.contentLength <= 0) process.exit(42)
process.stdout.write(`${value.contentSha256}|${value.contentLength}`)
NODE
  ) || die "photo recovery handle JSON is invalid"
  IFS='|' read -r PHOTO_RECOVERY_CONTENT_SHA256 PHOTO_RECOVERY_CONTENT_LENGTH <<EOF
$PHOTO_RECOVERY_CONTENT
EOF
  printf '%s' "$PHOTO_RECOVERY_HANDLE_SHA256" | grep -Eq '^[0-9a-f]{64}$' || die "photo recovery handle digest is unavailable"
}
revalidate_recovery_handle() {
  old_identity=${PHOTO_RECOVERY_HANDLE_IDENTITY:-}
  old_sha256=${PHOTO_RECOVERY_HANDLE_SHA256:-}
  require_recovery_handle
  [ -z "$old_identity" ] || [ "$PHOTO_RECOVERY_HANDLE_IDENTITY" = "$old_identity" ] || die "photo recovery handle identity changed"
  [ -z "$old_sha256" ] || [ "$PHOTO_RECOVERY_HANDLE_SHA256" = "$old_sha256" ] || die "photo recovery handle changed"
}
require_absolute "$BUNDLE_ROOT" bundle
require_absolute "$PUBLIC_KEY" public-key
require_absolute "$BACKUP_PRIVATE_KEY" backup-private-key
require_absolute "$ENV_FILE" env
require_absolute "$BACKUP_DIR" backup
[ "$BACKUP_DIR" != / ] || die "backup directory cannot be filesystem root"
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
fi
require_dir "$BUNDLE_ROOT" bundle
require_file "$PUBLIC_KEY" public-key
require_file "$BACKUP_PRIVATE_KEY" backup-private-key
require_file "$ENV_FILE" env
private_uid=$(stat -c '%u' "$BACKUP_PRIVATE_KEY" 2>/dev/null || stat -f '%u' "$BACKUP_PRIVATE_KEY" 2>/dev/null || true)
private_gid=$(stat -c '%g' "$BACKUP_PRIVATE_KEY" 2>/dev/null || stat -f '%g' "$BACKUP_PRIVATE_KEY" 2>/dev/null || true)
private_mode=$(stat -c '%a' "$BACKUP_PRIVATE_KEY" 2>/dev/null || stat -f '%Lp' "$BACKUP_PRIVATE_KEY" 2>/dev/null || true)
private_nlink=$(stat -c '%h' "$BACKUP_PRIVATE_KEY" 2>/dev/null || stat -f '%l' "$BACKUP_PRIVATE_KEY" 2>/dev/null || true)
operator_uid=$(id -u 2>/dev/null || true)
operator_gid=$(id -g 2>/dev/null || true)
[ -n "$private_uid" ] && [ -n "$private_gid" ] && [ -n "$private_mode" ] && [ -n "$private_nlink" ] || die "backup private-key ownership/mode cannot be inspected"
[ "$private_uid" = 0 ] || [ "$private_uid" = "$operator_uid" ] || die "backup private-key must be root/operator-owned"
[ "$private_gid" = 0 ] || [ "$private_gid" = "$operator_gid" ] || die "backup private-key group must be root/operator-owned"
[ "$private_nlink" = 1 ] || die "backup private-key must not be hard-linked"
case "$private_mode" in 400|600) ;; *) die "backup private-key mode must be 0400 or 0600" ;; esac
BACKUP_PARENT=$(dirname "$BACKUP_DIR")
require_trusted_directory_tree "$BACKUP_PARENT" backup-parent
capture_backup_parent_identity
[ "$(dirname "$BACKUP_DIR")" = "$BACKUP_PARENT_CANONICAL" ] || die "backup output must use a canonical parent"
[ "$(dirname "$BACKUP_DIR")/$(basename "$BACKUP_DIR")" = "$BACKUP_DIR" ] || die "backup output path must be canonical"
[ ! -e "$BACKUP_DIR" ] || die "backup output must be absent before the rehearsal"
case "$BACKUP_DIR" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "backup directory overlaps bundle" ;; esac
case "$BACKUP_PRIVATE_KEY:$PUBLIC_KEY" in "$BUNDLE_ROOT"/*:*|*:"$BUNDLE_ROOT"/*) die "signing/trusted keys must be outside bundle" ;; esac
require_recovery_handle

VERIFIER="$BUNDLE_ROOT/operations/onprem-offline-bundle.mjs"
[ -f "$VERIFIER" ] || VERIFIER="$BUNDLE_ROOT/onprem-offline-bundle.mjs"
[ -f "$VERIFIER" ] && [ ! -L "$VERIFIER" ] || die "bundled offline verifier is missing"

# Signature and preflight are deliberately first.  They are read-only and
# precede every Docker or filesystem mutation in this operator.
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
if [ -n "$PROOF_COMPOSE" ]; then
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --proof-compose "$PROOF_COMPOSE" >/dev/null 2>&1 || die "preflight failed"
else
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" >/dev/null 2>&1 || die "preflight failed"
fi
SIGNED_IMAGE_LINES=$(node - "$BUNDLE_ROOT/bundle-manifest.json" <<'NODE'
const fs = require('node:fs')
let value
try { value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) } catch { process.exit(41) }
const names = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
if (!value?.images || Object.keys(value.images).length !== names.length) process.exit(42)
const seen = new Set()
for (const name of names) {
  const image = value.images[name]
  const imageId = image?.configImageId
  if (!image || image.name !== name || typeof image.archive !== 'string' || typeof image.repoTag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(image.repoTag) || typeof image.archiveSha256 !== 'string' || typeof imageId !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(imageId) || !/^[0-9a-f]{64}$/.test(image.archiveSha256) || seen.has(imageId.toLowerCase())) process.exit(43)
  seen.add(imageId.toLowerCase())
  process.stdout.write(`${name}|${image.repoTag}|${imageId.toLowerCase()}\n`)
}
NODE
) || die "signed image identities are unavailable"
ARCHIVE_IMAGE=$(printf '%s\n' "$SIGNED_IMAGE_LINES" | awk -F'|' '$1 == "postgres" { print $2; exit }')
[ -n "$ARCHIVE_IMAGE" ] || die "signed postgres image identity is unavailable"
signed_image_for_service() {
  case "$1" in
    api|worker|migrator|synthetic-seed|keycloak-bootstrap|identity-binder) image_name=backend ;;
    frontend) image_name=frontend ;;
    keycloak) image_name=keycloak ;;
    caddy) image_name=caddy ;;
    postgres) image_name=postgres ;;
    redis) image_name=redis ;;
    object-storage) image_name=seaweedfs ;;
    *) die "unknown Compose service: $1" ;;
  esac
  image=$(printf '%s\n' "$SIGNED_IMAGE_LINES" | awk -F'|' -v wanted="$image_name" '$1 == wanted { print $2; exit }')
  [ -n "$image" ] || die "signed image is missing for Compose service: $1"
  printf '%s' "$image"
}
signed_image_runtime_id_for_service() {
  image_repo_tag=$(signed_image_for_service "$1")
  image_runtime_id=$(docker image inspect --format '{{.Id}}' "$image_repo_tag" 2>/dev/null || true)
  printf '%s' "$image_runtime_id" | grep -Eq '^sha256:[0-9a-f]{64}$' || die "signed image runtime id is invalid: $1"
  printf '%s' "$image_runtime_id"
}

env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
[ "$(env_value HR_AXIS_DATA_CLASS)" = synthetic ] || die "backup requires synthetic data class"
[ "$(env_value HR_AXIS_STRICT_LOCAL)" = true ] || die "backup requires strict-local mode"

# The ledger is observed migration evidence. Its digest is copied into the
# signed backup manifest; an env declaration alone is never accepted as
# quiescence or migration evidence.
LEDGER_FILE=$(env_value MIGRATION_LEDGER_FILE)
require_file "$LEDGER_FILE" migration-ledger
MIGRATION_TREE_DIGEST=$(node - "$LEDGER_FILE" "$TARGET_PROJECT" "$RELEASE_ID" <<'NODE'
const fs = require('node:fs')
const [path, project, releaseId] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(path, 'utf8')) } catch { process.exit(41) }
if (!value || value.project !== project || value.releaseId !== releaseId || value.status !== 'clean' || value.dirty === true || value.orphanCount !== 0 || value.checksumValid !== true) process.exit(42)
const digest = value.migrationTreeDigest ?? value.treeDigest
if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/i.test(digest)) process.exit(43)
process.stdout.write(digest.toLowerCase())
NODE
) || die "migration ledger is invalid, dirty, orphaned, or checksum-invalid"

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"
PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"
PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
require_file "$CORE_COMPOSE" core-compose
require_file "$PHOTO_PROOF_COMPOSE" photo-proof-compose
require_file "$PHOTO_COMPOSE" photo-compose
compose_core() {
  if [ -n "$PROOF_COMPOSE" ]; then docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"; else docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"; fi
}
compose_photo() { compose_core "$@"; }

POSTGRES_CONTAINER=
API_CONTAINER= WORKER_CONTAINER= KEYCLOAK_CONTAINER= REDIS_CONTAINER= OBJECT_STORAGE_CONTAINER=
RESTART_CORE_SERVICES=
RESTART_PHOTO_SERVICES=
FOUND_CADDY= FOUND_FRONTEND= FOUND_API= FOUND_WORKER= FOUND_KEYCLOAK= FOUND_REDIS= FOUND_POSTGRES= FOUND_OBJECT_STORAGE=
FOUND_KEYCLOAK_BOOTSTRAP= FOUND_IDENTITY_BINDER= FOUND_MIGRATOR= FOUND_SYNTHETIC_SEED=
CONTAINER_IDS=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null || true)
[ -n "$CONTAINER_IDS" ] || die "no target Compose containers were found"
for id in $CONTAINER_IDS; do
  meta=$(docker inspect "$id" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Running}}|{{.Image}}' 2>/dev/null) || die "service identity could not be inspected"
  IFS='|' read -r compose_project project data_class release service running image <<EOF
$meta
EOF
  [ "$compose_project" = "$TARGET_PROJECT" ] || continue
  [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ] || die "service labels do not match exact target: $service"
  case "$service" in
    caddy|frontend|api|worker|keycloak|redis|postgres|object-storage|keycloak-bootstrap|identity-binder|migrator|synthetic-seed) ;;
    *) die "unknown Compose service: $service" ;;
  esac
  expected_image=$(signed_image_runtime_id_for_service "$service")
  [ "$image" = "$expected_image" ] || die "runtime image identity mismatch: $service"
  case "$service" in
    caddy) [ -z "$FOUND_CADDY" ] || die "duplicate caddy service"; FOUND_CADDY=$id ;;
    frontend) [ -z "$FOUND_FRONTEND" ] || die "duplicate frontend service"; FOUND_FRONTEND=$id ;;
    api) [ -z "$FOUND_API" ] || die "duplicate api service"; FOUND_API=$id; [ "$running" = true ] && RESTART_CORE_SERVICES="$RESTART_CORE_SERVICES api" ;;
    worker) [ -z "$FOUND_WORKER" ] || die "duplicate worker service"; FOUND_WORKER=$id; [ "$running" = true ] && RESTART_CORE_SERVICES="$RESTART_CORE_SERVICES worker" ;;
    keycloak) [ -z "$FOUND_KEYCLOAK" ] || die "duplicate keycloak service"; FOUND_KEYCLOAK=$id; KEYCLOAK_CONTAINER=$id; [ "$running" = true ] && RESTART_CORE_SERVICES="$RESTART_CORE_SERVICES keycloak" ;;
    redis) [ -z "$FOUND_REDIS" ] || die "duplicate redis service"; FOUND_REDIS=$id; REDIS_CONTAINER=$id; [ "$running" = true ] && RESTART_CORE_SERVICES="$RESTART_CORE_SERVICES redis" ;;
    postgres) [ -z "$FOUND_POSTGRES" ] || die "duplicate postgres service"; FOUND_POSTGRES=$id; POSTGRES_CONTAINER=$id ;;
    object-storage) [ -z "$FOUND_OBJECT_STORAGE" ] || die "duplicate object-storage service"; FOUND_OBJECT_STORAGE=$id; OBJECT_STORAGE_CONTAINER=$id; [ "$running" = true ] && RESTART_PHOTO_SERVICES="$RESTART_PHOTO_SERVICES object-storage" ;;
    keycloak-bootstrap) [ -z "$FOUND_KEYCLOAK_BOOTSTRAP" ] || die "duplicate keycloak-bootstrap service"; FOUND_KEYCLOAK_BOOTSTRAP=$id; [ "$running" = false ] || die "write-capable one-shot service must be stopped: keycloak-bootstrap" ;;
    identity-binder) [ -z "$FOUND_IDENTITY_BINDER" ] || die "duplicate identity-binder service"; FOUND_IDENTITY_BINDER=$id; [ "$running" = false ] || die "write-capable one-shot service must be stopped: identity-binder" ;;
    migrator) [ -z "$FOUND_MIGRATOR" ] || die "duplicate migrator service"; FOUND_MIGRATOR=$id; [ "$running" = false ] || die "write-capable one-shot service must be stopped: migrator" ;;
    synthetic-seed) [ -z "$FOUND_SYNTHETIC_SEED" ] || die "duplicate synthetic-seed service"; FOUND_SYNTHETIC_SEED=$id; [ "$running" = false ] || die "write-capable one-shot service must be stopped: synthetic-seed" ;;
  esac
done
[ -n "$FOUND_CADDY" ] && [ -n "$FOUND_FRONTEND" ] && [ -n "$FOUND_API" ] && [ -n "$FOUND_WORKER" ] && [ -n "$FOUND_KEYCLOAK" ] && [ -n "$FOUND_REDIS" ] && [ -n "$FOUND_POSTGRES" ] && [ -n "$FOUND_OBJECT_STORAGE" ] || die "exact long-lived service topology is incomplete"
API_CONTAINER=$FOUND_API
WORKER_CONTAINER=$FOUND_WORKER

V_POSTGRES= V_REDIS= V_KEYCLOAK= V_BOOTSTRAP= V_PHOTO=
volume_ids=$(docker volume ls -q --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null || true)
[ -n "$volume_ids" ] || die "no labelled target volumes were found"
for volume_id in $volume_ids; do
  meta=$(docker volume inspect "$volume_id" --format '{{.Name}}|{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.data-class"}}|{{index .Labels "com.hr-axis.release-id"}}|{{index .Labels "com.hr-axis.volume-class"}}' 2>/dev/null) || die "target volume identity could not be inspected"
  IFS='|' read -r volume_name project data_class release volume_class <<EOF
$meta
EOF
  [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ] || die "target volume labels do not match exact release"
  case "$volume_class" in
    postgres) [ -z "$V_POSTGRES" ] || die "duplicate postgres volume class"; V_POSTGRES=$volume_name ;;
    redis-aof) [ -z "$V_REDIS" ] || die "duplicate redis-aof volume class"; V_REDIS=$volume_name ;;
    keycloak) [ -z "$V_KEYCLOAK" ] || die "duplicate keycloak volume class"; V_KEYCLOAK=$volume_name ;;
    keycloak-bootstrap-state) [ -z "$V_BOOTSTRAP" ] || die "duplicate keycloak-bootstrap-state volume class"; V_BOOTSTRAP=$volume_name ;;
    photo-object-storage) [ -z "$V_PHOTO" ] || die "duplicate photo-object-storage volume class"; V_PHOTO=$volume_name ;;
    *) die "unexpected labelled volume class: $volume_class" ;;
  esac
done
[ -n "$V_POSTGRES" ] && [ -n "$V_REDIS" ] && [ -n "$V_KEYCLOAK" ] && [ -n "$V_BOOTSTRAP" ] && [ -n "$V_PHOTO" ] || die "each exact labelled volume class is required"

# All checks above are read-only. Revalidate the canonical parent and its
# identity immediately before the first writer/quiesce action.
revalidate_backup_parent

TEMP_DIR=
TEMP_DIR_CANONICAL=
TEMP_DIR_UID=
TEMP_DIR_MODE=
TEMP_DIR_IDENTITY=
OUTPUT_COMMITTED=0
STOP_ATTEMPTED=0
resume_services() {
  resume_failed=0
  if [ -n "$RESTART_CORE_SERVICES" ]; then
    # Compose stop has no image-resolution operation; every start/run below is
    # explicitly pull-free.
    compose_core --profile infra --profile runtime up --pull never --wait --wait-timeout 120 -d $RESTART_CORE_SERVICES >/dev/null 2>&1 || resume_failed=1
  fi
  if [ -n "$RESTART_PHOTO_SERVICES" ]; then
    compose_photo up --pull never --wait --wait-timeout 120 -d $RESTART_PHOTO_SERVICES >/dev/null 2>&1 || resume_failed=1
  fi
  validate_resumed_service() {
    id=$1; expected_service=$2
    meta=$(docker inspect "$id" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Running}}|{{.State.Status}}|{{.State.Restarting}}|{{.State.Dead}}|{{.State.Error}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}|{{.Image}}' 2>/dev/null) || return 1
    IFS='|' read -r compose_project project data_class release service running state_status restarting dead state_error health restart_count image <<EOF
$meta
EOF
    [ "$compose_project" = "$TARGET_PROJECT" ] && [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ] && [ "$service" = "$expected_service" ] || return 1
    [ "$running" = true ] && [ "$state_status" = running ] && [ "$restarting" = false ] && [ "$dead" = false ] && [ -z "$state_error" ] && [ "$health" = healthy ] || return 1
    case "$restart_count" in ''|*[!0-9]*) return 1 ;; esac
    [ "$image" = "$(signed_image_runtime_id_for_service "$service")" ] || return 1
  }
  for service in api worker keycloak redis; do
    case " $RESTART_CORE_SERVICES " in *" $service "*)
      case "$service" in api) id=$API_CONTAINER ;; worker) id=$WORKER_CONTAINER ;; keycloak) id=$KEYCLOAK_CONTAINER ;; redis) id=$REDIS_CONTAINER ;; esac
      validate_resumed_service "$id" "$service" || resume_failed=1
    ;; esac
  done
  case " $RESTART_PHOTO_SERVICES " in *' object-storage '*) validate_resumed_service "$OBJECT_STORAGE_CONTAINER" object-storage || resume_failed=1 ;; esac
  [ "$resume_failed" -eq 0 ]
}
cleanup() {
  status=$?
  if [ "$STOP_ATTEMPTED" -eq 1 ]; then
    if ! resume_services; then
      status=1
      if [ "$OUTPUT_COMMITTED" -eq 1 ]; then
        printf '%s\n' "backup: FAIL: backup-created-but-resume-failed; signed backup retained at $BACKUP_DIR" >&2
      fi
    fi
  fi
  if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then rm -r "$TEMP_DIR" 2>/dev/null || true; fi
  exit "$status"
}
abort_on_signal() {
  # Do not run resume/Compose cleanup from a timeout signal.  Those Docker
  # calls may block while the daemon is stopping and can prevent the bounded
  # operator from returning.  The workflow cleanup step removes only the
  # exact synthetic targets after the interrupted operation exits.
  trap - EXIT HUP INT TERM
  exit 124
}
trap cleanup EXIT
trap abort_on_signal HUP INT TERM

# Quiesce is a mechanical Compose action.  No env flag or made-up writer
# label can substitute for these exact service names and post-stop checks.
STOP_ATTEMPTED=1
compose_core stop api worker keycloak redis >/dev/null 2>&1 || die "core writer quiesce failed"
compose_photo stop object-storage >/dev/null 2>&1 || die "photo writer quiesce failed"
for service_id in "$API_CONTAINER" "$WORKER_CONTAINER" "$KEYCLOAK_CONTAINER" "$REDIS_CONTAINER" "$OBJECT_STORAGE_CONTAINER"; do
  running=$(docker inspect "$service_id" --format '{{.State.Running}}' 2>/dev/null) || die "quiesced service state could not be inspected"
  [ "$running" = false ] || die "writer service remained running after quiesce"
done
running=$(docker inspect "$POSTGRES_CONTAINER" --format '{{.State.Running}}' 2>/dev/null) || die "postgres state could not be inspected"
[ "$running" = true ] || die "postgres must remain running for logical dumps"

# Quiescence can take time. Re-prove the captured parent immediately before
# the first pathname-based output creation; writable ancestors were already
# rejected, so an adjacent user cannot redirect this mktemp operation.
revalidate_backup_parent
revalidate_recovery_handle
TEMP_DIR=$(mktemp -d "$BACKUP_PARENT/.backup.tmp.XXXXXX") || die "temporary backup directory could not be created"
chmod 700 "$TEMP_DIR"
require_output_directory "$TEMP_DIR"
capture_temp_identity
mkdir "$TEMP_DIR/databases" "$TEMP_DIR/volumes"

# PostgreSQL remains online only for logical dumps.  Its physical volume is
# intentionally absent from the artifact allowlist.
revalidate_backup_parent
revalidate_temp_identity
revalidate_recovery_handle
docker exec "$POSTGRES_CONTAINER" pg_dump --username=hr_axis_bootstrap --format=custom --no-owner --no-privileges --dbname=hr_axis >"$TEMP_DIR/databases/hr_axis.dump" 2>/dev/null || die "hr_axis database dump failed"
revalidate_backup_parent
revalidate_temp_identity
revalidate_recovery_handle
docker exec "$POSTGRES_CONTAINER" pg_dump --username=hr_axis_bootstrap --format=custom --no-owner --no-privileges --dbname=keycloak >"$TEMP_DIR/databases/keycloak.dump" 2>/dev/null || die "keycloak database dump failed"
[ -s "$TEMP_DIR/databases/hr_axis.dump" ] && [ -s "$TEMP_DIR/databases/keycloak.dump" ] || die "database dump output is empty"

archive_volume() {
  volume=$1; class=$2
  revalidate_backup_parent
  revalidate_temp_identity
  docker run --pull=never --rm --network none --volume "$volume:/source:ro" --volume "$TEMP_DIR:/backup" "$ARCHIVE_IMAGE" sh -c "tar --numeric-owner -cf /backup/volumes/$class.tar -C /source ." >/dev/null 2>&1 || die "labelled $class volume archive failed"
  [ -s "$TEMP_DIR/volumes/$class.tar" ] || die "labelled $class volume archive is empty"
}
archive_volume "$V_REDIS" redis-aof
archive_volume "$V_KEYCLOAK" keycloak
archive_volume "$V_BOOTSTRAP" keycloak-bootstrap-state
archive_volume "$V_PHOTO" photo-object-storage

EXPECTED_ARTIFACTS='databases/hr_axis.dump databases/keycloak.dump volumes/redis-aof.tar volumes/keycloak.tar volumes/keycloak-bootstrap-state.tar volumes/photo-object-storage.tar'
(cd "$TEMP_DIR" && sha256sum $EXPECTED_ARTIFACTS | LC_ALL=C sort -k2) >"$TEMP_DIR/SHA256SUMS" 2>/dev/null || die "backup inventory could not be written"
INVENTORY_SHA=$(sha256sum "$TEMP_DIR/SHA256SUMS" | awk '{print $1}')
[ -n "$INVENTORY_SHA" ] || die "backup inventory digest is unavailable"
VOLUME_TREE_DIGEST=$(for class in redis-aof keycloak keycloak-bootstrap-state photo-object-storage; do sha256sum "$TEMP_DIR/volumes/$class.tar" | awk -v c="$class" '{print c "=" $1}'; done | LC_ALL=C sort | sha256sum | awk '{print $1}')
ARTIFACT_TREE_DIGEST=$(printf '%s\n' "$EXPECTED_ARTIFACTS" | sha256sum | awk '{print $1}')
revalidate_backup_parent
revalidate_temp_identity
revalidate_recovery_handle
cat >"$TEMP_DIR/backup-manifest.json" <<EOF
{"schemaVersion":1,"operation":"backup","dataClass":"synthetic","releaseId":"$RELEASE_ID","sourceProject":"$TARGET_PROJECT","migrationTreeDigest":"$MIGRATION_TREE_DIGEST","photoRecoveryHandleSha256":"$PHOTO_RECOVERY_HANDLE_SHA256","photoContentSha256":"$PHOTO_RECOVERY_CONTENT_SHA256","photoContentLength":$PHOTO_RECOVERY_CONTENT_LENGTH,"artifacts":["databases/hr_axis.dump","databases/keycloak.dump","volumes/redis-aof.tar","volumes/keycloak.tar","volumes/keycloak-bootstrap-state.tar","volumes/photo-object-storage.tar"],"inventorySha":"$INVENTORY_SHA","artifactTreeDigest":"$ARTIFACT_TREE_DIGEST","volumeTreeDigest":"$VOLUME_TREE_DIGEST","sameHostRehearsal":true,"disasterRecovery":false}
EOF
node - "$TEMP_DIR/backup-manifest.json" "$TEMP_DIR/backup-signature.json" "$BACKUP_PRIVATE_KEY" "$BACKUP_TRUSTED_FINGERPRINT" <<'NODE'
const fs = require('node:fs')
const { createHash, createPrivateKey, createPublicKey, sign } = require('node:crypto')
const [manifestPath, signaturePath, privatePath, expectedFingerprint] = process.argv.slice(2)
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : (value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value)
let manifest, key
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); key = createPrivateKey(fs.readFileSync(privatePath)) } catch { process.exit(41) }
if (key.asymmetricKeyType !== 'ed25519') process.exit(42)
const publicKey = createPublicKey(key)
const fingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
if (fingerprint !== expectedFingerprint) process.exit(43)
const bytes = Buffer.from(JSON.stringify(canonical(manifest)))
const signature = sign(null, bytes, key).toString('base64')
fs.writeFileSync(signaturePath, JSON.stringify({ schemaVersion: 1, algorithm: 'Ed25519', fingerprintSha256: fingerprint, manifestSha256: createHash('sha256').update(bytes).digest('hex'), signatureBase64: signature }) + '\n', { mode: 0o600 })
NODE

# The final rename is the only output publication. Revalidate both canonical
# identities immediately before publication. Restarting is handled by
# the EXIT trap; a failed resume turns the rehearsal into a failure while the
# already committed signed backup remains retained for recovery.
revalidate_backup_parent
revalidate_temp_identity
[ ! -e "$BACKUP_DIR" ] || die "backup output appeared before publication"
mv "$TEMP_DIR" "$BACKUP_DIR"
TEMP_DIR=
OUTPUT_COMMITTED=1
if ! resume_services; then
  STOP_ATTEMPTED=0
  printf '%s\n' "backup: FAIL: backup-created-but-resume-failed; signed backup retained at $BACKUP_DIR" >&2
  exit 1
fi
STOP_ATTEMPTED=0
say "PASS release=$RELEASE_ID project=$TARGET_PROJECT sameHostRehearsal=true disasterRecovery=false"
