#!/bin/sh
set -eu

# Disposable synthetic restore.  The target is always fresh and distinct from
# the source; PostgreSQL is recreated empty and populated only by logical
# dumps.  This operator never mutates or tears down a source project.
umask 077
die() { printf '%s\n' "restore: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "restore: $*"; }

BUNDLE_ROOT=
RELEASE_ID=
TARGET_PROJECT=
PUBLIC_KEY=
TRUSTED_FINGERPRINT=
BACKUP_PUBLIC_KEY=
BACKUP_TRUSTED_FINGERPRINT=
ENV_FILE=
BACKUP_DIR=
SOURCE_PROJECT=
SOURCE_RELEASE_ID=
RECEIPT=
PHOTO_FIXTURE=
PHOTO_SHA256=
PROOF_RECEIPT=
PROOF_RECEIPT_PRIVATE=0
SEALED_BACKUP_DIR=
PROOF_COMPOSE=
ROLLBACK_AUTHORITY_BUNDLE_ROOT=
ROLLBACK_AUTHORITY_RELEASE_ID=
PHOTO_RECOVERY_HANDLE_FILE=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -ge 2 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2 ;;
    --release-id) [ "$#" -ge 2 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2 ;;
    --target-project|--project) [ "$#" -ge 2 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2 ;;
    --public-key|--trusted-public-key) [ "$#" -ge 2 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2 ;;
    --trusted-fingerprint) [ "$#" -ge 2 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --backup-public-key) [ "$#" -ge 2 ] || die "--backup-public-key requires a value"; BACKUP_PUBLIC_KEY=$2; shift 2 ;;
    --backup-trusted-fingerprint) [ "$#" -ge 2 ] || die "--backup-trusted-fingerprint requires a value"; BACKUP_TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --env-file|--approved-env) [ "$#" -ge 2 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2 ;;
    --backup-dir) [ "$#" -ge 2 ] || die "--backup-dir requires a value"; BACKUP_DIR=$2; shift 2 ;;
    --source-project) [ "$#" -ge 2 ] || die "--source-project requires a value"; SOURCE_PROJECT=$2; shift 2 ;;
    --source-release-id) [ "$#" -ge 2 ] || die "--source-release-id requires a value"; SOURCE_RELEASE_ID=$2; shift 2 ;;
    --receipt) [ "$#" -ge 2 ] || die "--receipt requires a value"; RECEIPT=$2; shift 2 ;;
    --photo-fixture) [ "$#" -ge 2 ] || die "--photo-fixture requires a value"; PHOTO_FIXTURE=$2; shift 2 ;;
    --photo-sha256) [ "$#" -ge 2 ] || die "--photo-sha256 requires a value"; PHOTO_SHA256=$2; shift 2 ;;
    --proof-receipt) [ "$#" -ge 2 ] || die "--proof-receipt requires a value"; PROOF_RECEIPT=$2; shift 2 ;;
    --proof-compose) [ "$#" -ge 2 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2 ;;
    --photo-recovery-handle-file) [ "$#" -ge 2 ] || die "--photo-recovery-handle-file requires a value"; PHOTO_RECOVERY_HANDLE_FILE=$2; shift 2 ;;
    --rollback-authority-bundle-root) [ "$#" -ge 2 ] || die "--rollback-authority-bundle-root requires a value"; ROLLBACK_AUTHORITY_BUNDLE_ROOT=$2; shift 2 ;;
    --rollback-authority-release-id) [ "$#" -ge 2 ] || die "--rollback-authority-release-id requires a value"; ROLLBACK_AUTHORITY_RELEASE_ID=$2; shift 2 ;;
    --help) printf '%s\n' 'usage: restore.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --backup-public-key PEM --backup-trusted-fingerprint HEX64 --env-file PATH --backup-dir DIR --source-project PROJECT --receipt PATH --photo-fixture PATH --photo-sha256 HEX64 [--proof-receipt PATH]'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$BACKUP_PUBLIC_KEY" ] && [ -n "$BACKUP_TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] && [ -n "$BACKUP_DIR" ] && [ -n "$SOURCE_PROJECT" ] && [ -n "$RECEIPT" ] && [ -n "$PHOTO_FIXTURE" ] && [ -n "$PHOTO_SHA256" ] && [ -n "$PHOTO_RECOVERY_HANDLE_FILE" ] || die "bundle root, release id, target project, release trust, backup trust, env, backup, source, receipt, photo fixture, photo hash, and photo recovery handle are required"
SOURCE_RELEASE_ID=${SOURCE_RELEASE_ID:-$RELEASE_ID}
printf '%s' "$RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "release id is unsafe"
printf '%s' "$SOURCE_RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "source release id is unsafe"
printf '%s' "$TARGET_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "target project is unsafe"
printf '%s' "$SOURCE_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "source project is unsafe"
[ "$TARGET_PROJECT" != "$SOURCE_PROJECT" ] || die "restore target must be distinct from source project"
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$BACKUP_TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "backup trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$PHOTO_SHA256" | grep -Eq '^[0-9a-fA-F]{64}$' || die "photo fixture SHA-256 must be 64 hexadecimal characters"
[ -z "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" ] && [ -z "$ROLLBACK_AUTHORITY_RELEASE_ID" ] || {
  [ -n "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" ] && [ -n "$ROLLBACK_AUTHORITY_RELEASE_ID" ] || die "rollback authority bundle and release must be provided together"
  printf '%s' "$ROLLBACK_AUTHORITY_RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "rollback authority release id is unsafe"
  [ "$ROLLBACK_AUTHORITY_RELEASE_ID" = "$SOURCE_RELEASE_ID" ] || die "rollback authority release must match source release"
  [ "$SOURCE_RELEASE_ID" != "$RELEASE_ID" ] || die "rollback authority requires a distinct source release"
}

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
file_uid() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null || die "cannot inspect owner: $2"; }
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || die "cannot inspect mode: $2"; }
file_links() { stat -c '%h' "$1" 2>/dev/null || stat -f '%l' "$1" 2>/dev/null || die "cannot inspect link count: $2"; }
file_identity() { stat -c '%d:%i' "$1" 2>/dev/null || stat -f '%d:%i' "$1" 2>/dev/null || die "cannot inspect filesystem identity: $2"; }
require_dir() {
  require_absolute "$1" "$2"
  [ -d "$1" ] && [ ! -L "$1" ] || die "$2 is missing or a symlink"
  require_no_symlink_components "$1" "$2"
}
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || die "cannot inspect file mode"; }
file_links() { stat -c '%h' "$1" 2>/dev/null || stat -f '%l' "$1" 2>/dev/null || die "cannot inspect hard-link count"; }
file_size() { stat -c '%s' "$1" 2>/dev/null || stat -f '%z' "$1" 2>/dev/null || die "cannot inspect file size"; }
mode_is() { value=$1; shift; for allowed in "$@"; do [ "$value" = "$allowed" ] && return 0; done; return 1; }
mode_has_group_or_world_write() {
  case "$1" in
    ''|*[!0-7]*) return 1 ;;
    *[2367][0-7]|*[0-7][2367]) return 0 ;;
    *) return 1 ;;
  esac
}
canonical_dir() {
  (CDPATH= cd -P "$1" 2>/dev/null && pwd -P) || die "cannot resolve canonical directory: $2"
}
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
      tree_operator_uid=${tree_operator_uid:-$(id -u 2>/dev/null || true)}
      [ "$uid" = 0 ] || [ "$uid" = "$tree_operator_uid" ] || die "$label directory must be root/operator-owned: $current"
    fi
    mode=$(file_mode "$current" "$label")
    mode_has_group_or_world_write "$mode" && die "$label directory is group/world writable: $current"
    links=$(file_links "$current" "$label")
    case "$links" in ''|*[!0-9]*) die "$label directory link count cannot be inspected: $current" ;; esac
    [ "$links" -ge 1 ] || die "$label directory link count is invalid: $current"
    [ "$current" = / ] && break
    parent=$(dirname "$current")
    [ "$parent" != "$current" ] || die "$label ancestor walk did not reach filesystem root"
    current=$parent
  done
}
canonical_file() {
  parent=$(dirname "$1")
  name=$(basename "$1")
  canonical_parent=$(canonical_dir "$parent" "$2-parent")
  printf '%s/%s' "$canonical_parent" "$name"
}
sha256_file() { sha256sum "$1" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$1" | awk '{print $1}'; }
require_photo_fixture() {
  require_file "$PHOTO_FIXTURE" photo-fixture
  case "$PHOTO_FIXTURE" in "$BUNDLE_ROOT"/*) die "photo fixture must be outside bundle" ;; esac
  [ "$(file_links "$PHOTO_FIXTURE")" = 1 ] || die "photo fixture must not be a hard link"
  mode=$(file_mode "$PHOTO_FIXTURE"); mode_is "$mode" 400 440 600 640 || die "photo fixture mode is too broad"
  bytes=$(file_size "$PHOTO_FIXTURE"); case "$bytes" in *[!0-9]*|"") die "cannot bound photo fixture" ;; esac
  [ "$bytes" -gt 0 ] && [ "$bytes" -le 15728640 ] || die "photo fixture must be a non-empty bounded file"
  actual=$(sha256_file "$PHOTO_FIXTURE"); [ "$actual" = "$(printf '%s' "$PHOTO_SHA256" | tr 'A-F' 'a-f')" ] || die "photo fixture SHA-256 does not match"
}
require_proof_receipt_path() {
  if [ -n "$PROOF_RECEIPT" ]; then
    require_absolute "$PROOF_RECEIPT" proof-receipt
    require_no_symlink_components "$PROOF_RECEIPT" proof-receipt
    [ ! -e "$PROOF_RECEIPT" ] || die "proof receipt must be absent before the rehearsal"
    case "$PROOF_RECEIPT" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "proof receipt must be outside bundle" ;; esac
    proof_parent=$(dirname "$PROOF_RECEIPT"); require_dir "$proof_parent" proof-receipt-parent
    require_trusted_directory_tree "$proof_parent" proof-receipt-parent
  else
    PROOF_RECEIPT="$RECEIPT_PARENT/.target-proof.$$"
    PROOF_RECEIPT_PRIVATE=1
    [ ! -e "$PROOF_RECEIPT" ] || die "private target proof receipt path is already in use"
  fi
}
require_recovery_handle() {
  require_file "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle
  case "$PHOTO_RECOVERY_HANDLE_FILE" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "photo recovery handle must be outside bundle" ;; esac
  PHOTO_RECOVERY_HANDLE_PARENT=$(dirname "$PHOTO_RECOVERY_HANDLE_FILE")
  require_trusted_directory_tree "$PHOTO_RECOVERY_HANDLE_PARENT" photo-recovery-handle-parent
  PHOTO_RECOVERY_HANDLE_CANONICAL=$(canonical_file "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)
  [ "$PHOTO_RECOVERY_HANDLE_CANONICAL" = "$PHOTO_RECOVERY_HANDLE_FILE" ] || die "photo recovery handle must use a canonical absolute path"
  PHOTO_RECOVERY_HANDLE_NLINK=$(file_links "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  [ "$PHOTO_RECOVERY_HANDLE_NLINK" = 1 ] || die "photo recovery handle must not be hard-linked"
  PHOTO_RECOVERY_HANDLE_MODE=$(file_mode "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  case "$PHOTO_RECOVERY_HANDLE_MODE" in 400|600) ;; *) die "photo recovery handle mode must be 0400 or 0600" ;; esac
  PHOTO_RECOVERY_HANDLE_UID=$(file_uid "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  operator_uid=${operator_uid:-$(id -u 2>/dev/null || true)}
  host_os=$(uname -s 2>/dev/null || true)
  if [ "$host_os" = Linux ]; then [ "$PHOTO_RECOVERY_HANDLE_UID" = 0 ] || die "photo recovery handle must be root-owned"; else [ "$PHOTO_RECOVERY_HANDLE_UID" = 0 ] || [ "$PHOTO_RECOVERY_HANDLE_UID" = "$operator_uid" ] || die "photo recovery handle must be root/operator-owned"; fi
  PHOTO_RECOVERY_HANDLE_IDENTITY=$(file_identity "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  PHOTO_RECOVERY_HANDLE_SHA256=$(sha256_file "$PHOTO_RECOVERY_HANDLE_CANONICAL")
  PHOTO_RECOVERY_CONTENT=$(node - "$PHOTO_RECOVERY_HANDLE_CANONICAL" <<'NODE'
const fs = require('node:fs')
let value
try { value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) } catch { process.exit(41) }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!value || Object.keys(value).length !== 5 || value.schemaVersion !== 1 || value.dataClass !== 'synthetic' || !uuid.test(value.mediaAssetId) || !/^[0-9a-f]{64}$/.test(value.contentSha256) || !Number.isSafeInteger(value.contentLength) || value.contentLength <= 0) process.exit(42)
process.stdout.write(`${value.contentSha256}|${value.contentLength}`)
NODE
  ) || die "photo recovery handle JSON is invalid"
  IFS='|' read -r PHOTO_RECOVERY_CONTENT_SHA256 PHOTO_RECOVERY_CONTENT_LENGTH <<EOF
$PHOTO_RECOVERY_CONTENT
EOF
  printf '%s' "$PHOTO_RECOVERY_HANDLE_SHA256" | grep -Eq '^[0-9a-f]{64}$' || die "photo recovery handle digest is unavailable"
}
revalidate_recovery_handle() {
  old_canonical=${PHOTO_RECOVERY_HANDLE_CANONICAL:-}
  old_identity=${PHOTO_RECOVERY_HANDLE_IDENTITY:-}
  old_uid=${PHOTO_RECOVERY_HANDLE_UID:-}
  old_mode=${PHOTO_RECOVERY_HANDLE_MODE:-}
  old_nlink=${PHOTO_RECOVERY_HANDLE_NLINK:-}
  old_sha256=${PHOTO_RECOVERY_HANDLE_SHA256:-}
  require_recovery_handle
  [ -z "$old_canonical" ] || [ "$PHOTO_RECOVERY_HANDLE_CANONICAL" = "$old_canonical" ] || die "photo recovery handle canonical path changed"
  [ -z "$old_identity" ] || [ "$PHOTO_RECOVERY_HANDLE_IDENTITY" = "$old_identity" ] || die "photo recovery handle filesystem identity changed"
  [ -z "$old_uid" ] || [ "$PHOTO_RECOVERY_HANDLE_UID" = "$old_uid" ] || die "photo recovery handle owner changed"
  [ -z "$old_mode" ] || [ "$PHOTO_RECOVERY_HANDLE_MODE" = "$old_mode" ] || die "photo recovery handle mode changed"
  [ -z "$old_nlink" ] || [ "$PHOTO_RECOVERY_HANDLE_NLINK" = "$old_nlink" ] || die "photo recovery handle link count changed"
  [ -z "$old_sha256" ] || [ "$PHOTO_RECOVERY_HANDLE_SHA256" = "$old_sha256" ] || die "photo recovery handle changed"
  PHOTO_RECOVERY_HANDLE_FILE=$PHOTO_RECOVERY_HANDLE_CANONICAL
}
capture_receipt_parent() {
  require_trusted_directory_tree "$RECEIPT_PARENT" receipt-parent
  RECEIPT_PARENT_CANONICAL=$(canonical_dir "$RECEIPT_PARENT" receipt-parent)
  [ "$RECEIPT_PARENT_CANONICAL" = "$RECEIPT_PARENT" ] || die "receipt parent must use a canonical absolute path"
  RECEIPT_PARENT_IDENTITY=$(file_identity "$RECEIPT_PARENT_CANONICAL" receipt-parent)
  RECEIPT_PARENT_UID=$(file_uid "$RECEIPT_PARENT_CANONICAL" receipt-parent)
  RECEIPT_PARENT_MODE=$(file_mode "$RECEIPT_PARENT_CANONICAL" receipt-parent)
}
revalidate_receipt_parent() {
  old_identity=$RECEIPT_PARENT_IDENTITY; old_uid=$RECEIPT_PARENT_UID; old_mode=$RECEIPT_PARENT_MODE
  capture_receipt_parent
  [ "$RECEIPT_PARENT_IDENTITY" = "$old_identity" ] || die "receipt parent filesystem identity changed"
  [ "$RECEIPT_PARENT_UID" = "$old_uid" ] || die "receipt parent owner changed"
  [ "$RECEIPT_PARENT_MODE" = "$old_mode" ] || die "receipt parent mode changed"
}
capture_sealed_backup() {
  require_trusted_directory_tree "$BACKUP_DIR" sealed-backup
  SEALED_BACKUP_CANONICAL=$(canonical_dir "$BACKUP_DIR" sealed-backup)
  [ "$SEALED_BACKUP_CANONICAL" = "$BACKUP_DIR" ] || die "sealed backup must use a canonical absolute path"
  SEALED_BACKUP_IDENTITY=$(file_identity "$SEALED_BACKUP_CANONICAL" sealed-backup)
  SEALED_BACKUP_UID=$(file_uid "$SEALED_BACKUP_CANONICAL" sealed-backup)
  SEALED_BACKUP_MODE=$(file_mode "$SEALED_BACKUP_CANONICAL" sealed-backup)
}
revalidate_sealed_backup() {
  old_identity=$SEALED_BACKUP_IDENTITY; old_uid=$SEALED_BACKUP_UID; old_mode=$SEALED_BACKUP_MODE
  capture_sealed_backup
  [ "$SEALED_BACKUP_IDENTITY" = "$old_identity" ] || die "sealed backup filesystem identity changed"
  [ "$SEALED_BACKUP_UID" = "$old_uid" ] || die "sealed backup owner changed"
  [ "$SEALED_BACKUP_MODE" = "$old_mode" ] || die "sealed backup mode changed"
}
require_dir "$BUNDLE_ROOT" bundle
if [ -n "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" ]; then
  require_absolute "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" rollback-authority-bundle
  require_dir "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" rollback-authority-bundle
  [ "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" != "$BUNDLE_ROOT" ] || die "rollback authority bundle must be distinct from target bundle"
fi
require_recovery_handle
PHOTO_RECOVERY_HANDLE_FILE=$PHOTO_RECOVERY_HANDLE_CANONICAL
require_photo_fixture
require_file "$PUBLIC_KEY" public-key
require_file "$BACKUP_PUBLIC_KEY" backup-public-key
require_file "$ENV_FILE" env
require_dir "$BACKUP_DIR" backup
require_absolute "$RECEIPT" receipt
[ -z "$PROOF_COMPOSE" ] || {
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
}
[ ! -e "$RECEIPT" ] || die "restore receipt must be absent before the rehearsal"
RECEIPT_PARENT=$(dirname "$RECEIPT")
require_dir "$RECEIPT_PARENT" receipt-parent
capture_receipt_parent
require_proof_receipt_path
case "$BACKUP_DIR" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "backup directory overlaps bundle" ;; esac
case "$RECEIPT" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "receipt must be outside bundle" ;; esac

verify_bundle() {
  root=$1
  verifier="$root/operations/onprem-offline-bundle.mjs"
  [ -f "$verifier" ] || verifier="$root/onprem-offline-bundle.mjs"
  [ -f "$verifier" ] && [ ! -L "$verifier" ] || die "bundled offline verifier is missing"
  node "$verifier" verify --bundle-dir "$root" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
}
TARGET_PROOF="$BUNDLE_ROOT/operations/onprem-offline-target-proof.mjs"
AUTH_PROOF="$BUNDLE_ROOT/operations/onprem-keycloak-auth-proof.mjs"
PHOTO_AUTH_PROOF="$BUNDLE_ROOT/operations/onprem-photo-auth-proof.mjs"
require_file "$TARGET_PROOF" target-proof
require_file "$AUTH_PROOF" auth-proof
require_file "$PHOTO_AUTH_PROOF" photo-auth-proof
# The signed bundle verifier and exact-image preflight are read-only gates and
# must precede every Docker mutation.  Restore receives a generated env so the
# approved source env is never edited and the restore overlay gets exact target
# identities/volume names.
verify_bundle "$BUNDLE_ROOT"
if [ -n "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" ]; then
  verify_bundle "$ROLLBACK_AUTHORITY_BUNDLE_ROOT"
fi
ARCHIVE_IMAGE=$(node - "$BUNDLE_ROOT/bundle-manifest.json" <<'NODE'
const fs = require('node:fs')
let value
try { value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) } catch { process.exit(41) }
const image = value?.images?.postgres?.configImageId
if (typeof image !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(image)) process.exit(42)
process.stdout.write(image.toLowerCase())
NODE
) || die "signed postgres image identity is unavailable"
BACKEND_IMAGE=$(node - "$BUNDLE_ROOT/bundle-manifest.json" <<'NODE'
const fs = require('node:fs')
let value
try { value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) } catch { process.exit(41) }
const image = value?.images?.backend?.configImageId
if (typeof image !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(image)) process.exit(42)
process.stdout.write(image.toLowerCase())
NODE
) || die "signed backend image identity is unavailable"

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"
PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"
PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
RESTORE_COMPOSE="$BUNDLE_ROOT/deployment/restore.compose.yaml"
require_file "$CORE_COMPOSE" core-compose
require_file "$PHOTO_PROOF_COMPOSE" photo-proof-compose
require_file "$PHOTO_COMPOSE" photo-compose
require_file "$RESTORE_COMPOSE" restore-compose
V_POSTGRES="${TARGET_PROJECT}_postgres_data"
V_REDIS="${TARGET_PROJECT}_redis_data"
V_KEYCLOAK="${TARGET_PROJECT}_keycloak_data"
V_BOOTSTRAP="${TARGET_PROJECT}_keycloak_bootstrap_state"
V_PHOTO="${TARGET_PROJECT}_object_storage_data"
revalidate_receipt_parent
RESTORE_ENV_FILE=$(mktemp "$RECEIPT_PARENT/.restore-env.tmp.XXXXXX") || die "restore env could not be created"
chmod 600 "$RESTORE_ENV_FILE"
early_cleanup() { status=$?; rm -f "$RESTORE_ENV_FILE" 2>/dev/null || status=1; if [ -n "${SEALED_BACKUP_DIR:-}" ]; then rm -rf -- "$SEALED_BACKUP_DIR" 2>/dev/null || status=1; fi; exit "$status"; }
trap early_cleanup EXIT HUP INT TERM
if ! {
  cat <<EOF
HR_AXIS_RELEASE_ID=$RELEASE_ID
COMPOSE_PROJECT_NAME=$TARGET_PROJECT
HR_AXIS_PROJECT_ID=$TARGET_PROJECT
OFFLINE_RESTORE_POSTGRES_VOLUME=$V_POSTGRES
OFFLINE_RESTORE_REDIS_VOLUME=$V_REDIS
OFFLINE_RESTORE_KEYCLOAK_VOLUME=$V_KEYCLOAK
OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME=$V_BOOTSTRAP
OFFLINE_RESTORE_PHOTO_VOLUME=$V_PHOTO
REDIS_VOLUME=$V_REDIS
KEYCLOAK_VOLUME=$V_KEYCLOAK
KEYCLOAK_BOOTSTRAP_VOLUME=$V_BOOTSTRAP
PHOTO_VOLUME=$V_PHOTO
EOF
  awk -F= '$0 !~ /^[[:space:]]*#/ && $1 !~ /^(HR_AXIS_RELEASE_ID|COMPOSE_PROJECT_NAME|HR_AXIS_PROJECT_ID|OFFLINE_RESTORE_POSTGRES_VOLUME|OFFLINE_RESTORE_REDIS_VOLUME|OFFLINE_RESTORE_KEYCLOAK_VOLUME|OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME|OFFLINE_RESTORE_PHOTO_VOLUME|REDIS_VOLUME|KEYCLOAK_VOLUME|KEYCLOAK_BOOTSTRAP_VOLUME|PHOTO_VOLUME)$/ { print }' "$ENV_FILE"
} >"$RESTORE_ENV_FILE"; then rm -f "$RESTORE_ENV_FILE"; die "restore env could not be derived"; fi
env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
PUBLIC_HOST=$(env_value HR_AXIS_PUBLIC_HOST)
[ -n "$PUBLIC_HOST" ] || die "approved public host is missing"
printf '%s' "$PUBLIC_HOST" | grep -Eq '^[A-Za-z0-9.-]+$' || die "approved public host is unsafe"
require_external_secret_file() {
  name=$1; pathname=$2; kind=$3
  require_file "$pathname" "$name"
  [ "$(file_links "$pathname")" = 1 ] || die "$name must not be a hard link"
  mode=$(file_mode "$pathname")
  case "$kind" in
    private) mode_is "$mode" 400 440 600 640 || die "$name mode is too broad" ;;
    public) mode_is "$mode" 400 440 444 600 640 644 || die "$name mode is too broad" ;;
    *) die "unknown external secret kind" ;;
  esac
}
SECRET_ROOT=$(env_value HR_AXIS_SECRET_ROOT)
[ -n "$SECRET_ROOT" ] || die "safe synthetic auth account/CA derivation requires HR_AXIS_SECRET_ROOT"
require_dir "$SECRET_ROOT" HR_AXIS_SECRET_ROOT
case "$SECRET_ROOT" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "HR_AXIS_SECRET_ROOT must be outside bundle" ;; esac
PHOTO_STORAGE_SECRET_ROOT=$(env_value PHOTO_STORAGE_SECRET_ROOT)
[ -n "$PHOTO_STORAGE_SECRET_ROOT" ] || die "safe photo storage credential derivation requires PHOTO_STORAGE_SECRET_ROOT"
require_dir "$PHOTO_STORAGE_SECRET_ROOT" PHOTO_STORAGE_SECRET_ROOT
case "$PHOTO_STORAGE_SECRET_ROOT" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*) die "PHOTO_STORAGE_SECRET_ROOT must be outside bundle" ;; esac
AUTH_ACCOUNTS="$SECRET_ROOT/keycloak/synthetic-accounts"
AUTH_PHOTO_ACCOUNT="$SECRET_ROOT/keycloak/photo-proof-account"
AUTH_CA="$SECRET_ROOT/caddy/ca.crt"
require_external_secret_file synthetic-accounts "$AUTH_ACCOUNTS" private
require_external_secret_file photo-proof-account "$AUTH_PHOTO_ACCOUNT" private
require_external_secret_file TLS_CA_FILE "$AUTH_CA" public
if [ -n "$PROOF_COMPOSE" ]; then
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$RESTORE_ENV_FILE" --proof-compose "$PROOF_COMPOSE" >/dev/null 2>&1 || { rm -f "$RESTORE_ENV_FILE"; die "preflight failed"; }
else
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$RESTORE_ENV_FILE" >/dev/null 2>&1 || { rm -f "$RESTORE_ENV_FILE"; die "preflight failed"; }
fi

# Copy the exact untrusted backup closure through stable descriptors into a
# fresh root-only directory. Signature verification and every later consumer
# use this sealed copy, never the mutable delivery path.
BACKUP_SOURCE_DIR=$BACKUP_DIR
revalidate_receipt_parent
SEALED_BACKUP_DIR=$(node - "$BACKUP_SOURCE_DIR" "$RECEIPT_PARENT" <<'NODE'
const fs = require('node:fs'), path = require('node:path')
const [source, parent] = process.argv.slice(2)
const files = ['SHA256SUMS','backup-manifest.json','backup-signature.json','databases/hr_axis.dump','databases/keycloak.dump','volumes/redis-aof.tar','volumes/keycloak.tar','volumes/keycloak-bootstrap-state.tar','volumes/photo-object-storage.tar']
const dirs = new Set(['','databases','volumes'])
const fail = () => process.exit(41)
const identity = (s) => [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeMs,s.ctimeMs].join(':')
let sealed
try {
  const root = fs.lstatSync(source), parentStat = fs.lstatSync(parent)
  if (!root.isDirectory() || root.isSymbolicLink() || !parentStat.isDirectory() || parentStat.isSymbolicLink()) fail()
  if (process.platform !== 'win32' && (process.getuid?.() !== 0 || parentStat.uid !== 0 || (parentStat.mode & 0o022) !== 0)) fail()
  const actual = [], walk = (directory, prefix='') => { for (const entry of fs.readdirSync(directory,{withFileTypes:true})) { const rel=prefix?`${prefix}/${entry.name}`:entry.name, absolute=path.join(directory,entry.name), stat=fs.lstatSync(absolute); if (stat.isSymbolicLink()) fail(); if (stat.isDirectory()) { if(!dirs.has(rel)) fail(); walk(absolute,rel) } else { if(!stat.isFile() || stat.nlink!==1) fail(); actual.push(rel) } } }
  walk(source); actual.sort(); if (actual.length!==files.length || actual.some((value,index)=>value!==[...files].sort()[index])) fail()
  sealed = fs.mkdtempSync(path.join(parent,'.backup-seal.')); fs.chmodSync(sealed,0o700); fs.mkdirSync(path.join(sealed,'databases'),{mode:0o700}); fs.mkdirSync(path.join(sealed,'volumes'),{mode:0o700})
  for (const rel of files) { const src=path.join(source,rel), dst=path.join(sealed,rel), before=fs.lstatSync(src), flags=fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0), fd=fs.openSync(src,flags); let out; try { const opened=fs.fstatSync(fd); if(identity(before)!==identity(opened)||!opened.isFile()||opened.nlink!==1) fail(); if(['backup-manifest.json','backup-signature.json','SHA256SUMS'].includes(rel)&&(opened.size<=0||opened.size>1024*1024)) fail(); out=fs.openSync(dst,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL,0o600); const buffer=Buffer.allocUnsafe(1024 * 1024); let offset=0; while(true){const read=fs.readSync(fd,buffer,0,buffer.length,offset); if(read===0)break; let written=0; while(written<read)written+=fs.writeSync(out,buffer,written,read-written); offset+=read} fs.fsyncSync(out); if(offset!==opened.size||identity(opened)!==identity(fs.fstatSync(fd))) fail() } finally { if(out!==undefined)fs.closeSync(out); fs.closeSync(fd) } }
  if (process.platform !== 'win32') { for (const rel of ['', 'databases', 'volumes', ...files]) { const target=rel?path.join(sealed,rel):sealed; fs.chownSync(target,0,0); const stat=fs.lstatSync(target); if(stat.uid!==0 || (stat.mode&0o022)!==0 || (!stat.isDirectory()&&stat.nlink!==1)) fail() } }
  process.stdout.write(sealed)
} catch { if(sealed) fs.rmSync(sealed,{recursive:true,force:true}); fail() }
NODE
) || die "backup closure could not be sealed safely"
case "$SEALED_BACKUP_DIR" in [A-Za-z]:\\*) SEALED_BACKUP_DIR=$(cygpath -u "$SEALED_BACKUP_DIR") || die "backup closure seal path is invalid" ;; esac
[ -n "$SEALED_BACKUP_DIR" ] || die "backup closure seal is unavailable"
BACKUP_DIR=$SEALED_BACKUP_DIR
capture_sealed_backup

MANIFEST="$BACKUP_DIR/backup-manifest.json"
SIGNATURE="$BACKUP_DIR/backup-signature.json"
INVENTORY="$BACKUP_DIR/SHA256SUMS"
require_file "$MANIFEST" backup-manifest
require_file "$SIGNATURE" backup-signature
require_file "$INVENTORY" backup-inventory

# Verify the signed manifest, its external fingerprint, the exact allowlist,
# and every artifact hash before inspecting or mutating the target host.
BACKUP_VERIFICATION=$(node - "$BACKUP_DIR" "$MANIFEST" "$SIGNATURE" "$INVENTORY" "$BACKUP_PUBLIC_KEY" "$BACKUP_TRUSTED_FINGERPRINT" "$SOURCE_RELEASE_ID" "$SOURCE_PROJECT" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const { createHash, createPublicKey, verify } = require('node:crypto')
const [root, manifestPath, signaturePath, inventoryPath, publicPath, fingerprintExpected, releaseId, sourceProject] = process.argv.slice(2)
const artifacts = ['databases/hr_axis.dump', 'databases/keycloak.dump', 'volumes/redis-aof.tar', 'volumes/keycloak.tar', 'volumes/keycloak-bootstrap-state.tar', 'volumes/photo-object-storage.tar']
const metadata = ['SHA256SUMS', 'backup-manifest.json', 'backup-signature.json']
const expectedFiles = new Set([...artifacts, ...metadata])
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : (value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value)
const fail = (code) => process.exit(code)
let manifest, signature, publicKey, inventory
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  signature = JSON.parse(fs.readFileSync(signaturePath, 'utf8'))
  publicKey = createPublicKey(fs.readFileSync(publicPath))
  inventory = fs.readFileSync(inventoryPath, 'utf8')
} catch { fail(41) }
if (!manifest || manifest.schemaVersion !== 1 || manifest.operation !== 'backup' || manifest.dataClass !== 'synthetic' || manifest.releaseId !== releaseId || manifest.sourceProject !== sourceProject || manifest.sameHostRehearsal !== true || manifest.disasterRecovery !== false) fail(42)
if (typeof manifest.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.migrationTreeDigest)) fail(43)
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== artifacts.length || manifest.artifacts.some((value, index) => value !== artifacts[index])) fail(44)
if (typeof manifest.inventorySha !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.inventorySha) || createHash('sha256').update(inventory).digest('hex') !== manifest.inventorySha) fail(45)
if (signature.schemaVersion !== 1 || signature.algorithm !== 'Ed25519' || signature.fingerprintSha256 !== fingerprintExpected) fail(46)
const bytes = Buffer.from(JSON.stringify(canonical(manifest)))
if (signature.manifestSha256 !== createHash('sha256').update(bytes).digest('hex')) fail(47)
let signatureBytes
try { signatureBytes = Buffer.from(signature.signatureBase64, 'base64') } catch { fail(48) }
if (!verify(null, bytes, publicKey, signatureBytes)) fail(49)
const actualFingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
if (actualFingerprint !== fingerprintExpected) fail(50)
const lines = inventory.trimEnd().split(/\r?\n/)
if (lines.length !== artifacts.length) fail(51)
const seen = new Set()
const stableHash = (pathname) => {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)
  const fd = fs.openSync(pathname, flags)
  try {
    const before = fs.fstatSync(fd)
    if (!before.isFile() || before.nlink !== 1) fail(54)
    const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024)
    let offset = 0
    while (true) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, offset)
      if (count === 0) break
      hash.update(buffer.subarray(0, count)); offset += count
    }
    const after = fs.fstatSync(fd)
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || offset !== before.size) fail(54)
    return hash.digest('hex')
  } finally { fs.closeSync(fd) }
}
for (const line of lines) {
  const match = /^([0-9a-f]{64}) ([*]?)[ ]?(.+)$/.exec(line)
  const artifactPath = match?.[3]
  if (!match || !artifacts.includes(artifactPath) || seen.has(artifactPath)) fail(52)
  seen.add(artifactPath)
  const pathname = path.join(root, artifactPath)
  let stat
  try { stat = fs.lstatSync(pathname) } catch { fail(53) }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail(54)
  const hash = stableHash(pathname)
  if (hash !== match[1]) fail(55)
}
if (seen.size !== artifacts.length) fail(56)
const allowedDirs = new Set(['', 'databases', 'volumes'])
const walk = (directory, prefix = '') => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const pathname = path.join(directory, entry.name)
    const stat = fs.lstatSync(pathname)
    if (stat.isSymbolicLink()) fail(57)
    if (stat.isDirectory()) { if (!allowedDirs.has(relative)) fail(58); walk(pathname, relative) }
    else if (!stat.isFile() || !expectedFiles.has(relative)) fail(59)
  }
}
walk(root)
for (const relative of expectedFiles) {
  const pathname = path.join(root, relative)
  try { if (!fs.lstatSync(pathname).isFile()) fail(60) } catch { fail(61) }
}
if (typeof manifest.volumeTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.volumeTreeDigest)) fail(62)
if (typeof signature.manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(signature.manifestSha256)) fail(63)
if (typeof manifest.photoRecoveryHandleSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.photoRecoveryHandleSha256) || typeof manifest.photoContentSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.photoContentSha256) || !Number.isSafeInteger(manifest.photoContentLength) || manifest.photoContentLength <= 0) fail(64)
process.stdout.write(`${manifest.volumeTreeDigest}|${manifest.migrationTreeDigest}|${signature.manifestSha256}|${signature.fingerprintSha256}|${manifest.photoRecoveryHandleSha256}|${manifest.photoContentSha256}|${manifest.photoContentLength}`)
NODE
) || die "backup manifest/inventory/signature verification failed"
IFS='|' read -r BACKUP_VOLUME_DIGEST BACKUP_MIGRATION_DIGEST BACKUP_MANIFEST_SHA BACKUP_FINGERPRINT BACKUP_PHOTO_HANDLE_SHA256 BACKUP_PHOTO_CONTENT_SHA256 BACKUP_PHOTO_CONTENT_LENGTH <<EOF
$BACKUP_VERIFICATION
EOF
printf '%s' "$BACKUP_VOLUME_DIGEST" | grep -Eq '^[0-9a-f]{64}$' || die "backup volume aggregate digest is invalid"
printf '%s' "$BACKUP_MIGRATION_DIGEST" | grep -Eq '^[0-9a-f]{64}$' || die "backup migration tree digest is invalid"
printf '%s' "$BACKUP_MANIFEST_SHA" | grep -Eq '^[0-9a-f]{64}$' || die "backup manifest digest is invalid"
[ "$BACKUP_FINGERPRINT" = "$BACKUP_TRUSTED_FINGERPRINT" ] || die "backup fingerprint is not trusted"
[ "$BACKUP_PHOTO_HANDLE_SHA256" = "$PHOTO_RECOVERY_HANDLE_SHA256" ] || die "photo recovery handle does not match signed backup"
[ "$BACKUP_PHOTO_CONTENT_SHA256" = "$PHOTO_RECOVERY_CONTENT_SHA256" ] && [ "$BACKUP_PHOTO_CONTENT_LENGTH" = "$PHOTO_RECOVERY_CONTENT_LENGTH" ] || die "photo recovery content identity does not match signed backup"
# The signed manifest match establishes the recovery identity baseline.  Keep
# the canonical path and all leaf/ancestor trust checks live through target
# proof; the proof call revalidates again immediately before its Docker mount.
revalidate_recovery_handle

COMPATIBILITY="$BUNDLE_ROOT/evidence/migration-compatibility.json"
require_file "$COMPATIBILITY" migration-compatibility
if [ -n "$ROLLBACK_AUTHORITY_BUNDLE_ROOT" ]; then
  TARGET_MIGRATION_DIGEST=$(node - "$COMPATIBILITY" "$RELEASE_ID" <<'NODE'
const fs = require('node:fs')
const [path, targetRelease] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(path, 'utf8')) } catch { process.exit(41) }
if (!value || value.schemaVersion !== 1 || value.releaseId !== targetRelease || typeof value.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.migrationTreeDigest) || !Array.isArray(value.compatibleFrom)) process.exit(42)
process.stdout.write(value.migrationTreeDigest)
NODE
  ) || die "rollback target migration compatibility is invalid"
  AUTHORITY_COMPATIBILITY="$ROLLBACK_AUTHORITY_BUNDLE_ROOT/evidence/migration-compatibility.json"
  AUTHORITY_MANIFEST="$ROLLBACK_AUTHORITY_BUNDLE_ROOT/bundle-manifest.json"
  require_file "$AUTHORITY_COMPATIBILITY" rollback-authority-migration-compatibility
  require_file "$AUTHORITY_MANIFEST" rollback-authority-manifest
  # Rollback authority must contain exactly one compatibleFrom entry for the
  # target previous release, and that entry must carry the target digest.
  AUTHORITY_MIGRATION_DIGEST=$(node - "$AUTHORITY_MANIFEST" "$AUTHORITY_COMPATIBILITY" "$ROLLBACK_AUTHORITY_RELEASE_ID" "$SOURCE_RELEASE_ID" "$RELEASE_ID" "$TARGET_MIGRATION_DIGEST" "$BACKUP_MIGRATION_DIGEST" <<'NODE'
const fs = require('node:fs')
const [manifestPath, compatibilityPath, authorityRelease, sourceRelease, targetRelease, targetDigest, backupDigest] = process.argv.slice(2)
let manifest, value
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  value = JSON.parse(fs.readFileSync(compatibilityPath, 'utf8'))
} catch { process.exit(41) }
const digest = (item) => typeof item === 'string' && /^[0-9a-f]{64}$/.test(item)
if (!manifest || manifest.releaseId !== authorityRelease || authorityRelease !== sourceRelease || !value || value.schemaVersion !== 1 || value.releaseId !== authorityRelease || value.rollbackCompatible !== true || !digest(value.migrationTreeDigest) || !Array.isArray(value.compatibleFrom)) process.exit(42)
const matches = value.compatibleFrom.filter((entry) => entry && entry.sourceReleaseId === targetRelease && entry.sourceMigrationTreeDigest === targetDigest)
if (matches.length !== 1 || !digest(targetDigest) || backupDigest !== value.migrationTreeDigest) process.exit(43)
process.stdout.write(value.migrationTreeDigest)
NODE
  ) || die "rollback authority compatibility is invalid"
  [ "$AUTHORITY_MIGRATION_DIGEST" = "$BACKUP_MIGRATION_DIGEST" ] || die "rollback authority backup digest mismatch"
else
  TARGET_MIGRATION_DIGEST=$(node - "$COMPATIBILITY" "$RELEASE_ID" "$SOURCE_RELEASE_ID" "$BACKUP_MIGRATION_DIGEST" <<'NODE'
const fs = require('node:fs')
const [path, targetRelease, sourceRelease, backupDigest] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(path, 'utf8')) } catch { process.exit(41) }
if (!value || value.schemaVersion !== 1 || value.releaseId !== targetRelease || typeof value.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.migrationTreeDigest) || !Array.isArray(value.compatibleFrom)) process.exit(42)
if (sourceRelease === targetRelease) {
  if (backupDigest !== value.migrationTreeDigest) process.exit(43)
} else {
  const matches = value.compatibleFrom.filter((entry) => entry && entry.sourceReleaseId === sourceRelease && entry.sourceMigrationTreeDigest === backupDigest)
  if (matches.length !== 1) process.exit(44)
}
process.stdout.write(value.migrationTreeDigest)
NODE
  ) || die "forward_repair_or_database_restore_required"
fi
printf '%s' "$TARGET_MIGRATION_DIGEST" | grep -Eq '^[0-9a-f]{64}$' || die "target migration tree digest is invalid"

env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
[ "$(env_value HR_AXIS_DATA_CLASS)" = synthetic ] || die "restore requires synthetic data class"
[ "$(env_value HR_AXIS_STRICT_LOCAL)" = true ] || die "restore requires strict-local mode"

compose_core() {
  if [ -n "$PROOF_COMPOSE" ]; then docker compose --project-name "$TARGET_PROJECT" --env-file "$RESTORE_ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" --file "$RESTORE_COMPOSE" "$@"; else docker compose --project-name "$TARGET_PROJECT" --env-file "$RESTORE_ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$RESTORE_COMPOSE" "$@"; fi
}
compose_photo() { compose_core "$@"; }

# Compose output is intentionally quiet on the success path, but a failed
# disposable target must retain enough bounded, sanitized context to diagnose
# startup failures without leaking credentials into the rehearsal log.
sanitize_compose_diagnostics() {
  sed -E 's/(password|secret|token|postgresql:\/\/|redis:\/\/)[^[:space:]]*/\1[redacted]/gi' | tail -n 80
}
compose_failure_context() {
  compose_mode=$1
  service=$2
  if [ "$compose_mode" = photo ]; then
    compose_status=$(compose_photo ps --all --no-color --format '{{.Name}}|{{.State}}|{{.Health}}' "$service" 2>/dev/null || true)
    compose_logs=$(compose_photo logs --no-color --tail 80 "$service" 2>/dev/null || true)
  else
    compose_status=$(compose_core ps --all --no-color --format '{{.Name}}|{{.State}}|{{.Health}}' "$service" 2>/dev/null || true)
    compose_logs=$(compose_core logs --no-color --tail 80 "$service" 2>/dev/null || true)
  fi
  printf '%s\n' "restore: compose diagnostic service=$service" >&2
  if [ -n "$compose_status" ]; then
    printf '%s\n' "$compose_status" | sanitize_compose_diagnostics >&2
  else
    printf '%s\n' 'restore: compose status unavailable' >&2
  fi
  if [ -n "$compose_logs" ]; then
    printf '%s\n' "$compose_logs" | sanitize_compose_diagnostics >&2
  else
    printf '%s\n' 'restore: compose logs unavailable' >&2
  fi
}
compose_start() {
  compose_mode=$1
  service=$2
  failure_message=$3
  shift 3
  if [ "$compose_mode" = photo ]; then
    if compose_start_output=$(compose_photo "$@" 2>&1); then return 0; fi
  else
    if compose_start_output=$(compose_core "$@" 2>&1); then return 0; fi
  fi
  if [ -n "$compose_start_output" ]; then
    printf '%s\n' "$compose_start_output" | sanitize_compose_diagnostics >&2
  fi
  compose_failure_context "$compose_mode" "$service"
  die "$failure_message"
}

TARGET_PROOF_SHA256=
AUTH_RECEIPT_SHA256=
AUTH_TMP=
run_complete_target_proof() {
  revalidate_recovery_handle
  rm -f "$PROOF_RECEIPT" 2>/dev/null || die "target proof receipt destination could not be prepared"
  if [ -n "$PROOF_COMPOSE" ]; then
    node "$TARGET_PROOF" --execute --require-complete \
      --compose "$CORE_COMPOSE" --compose "$PHOTO_PROOF_COMPOSE" --compose "$PHOTO_COMPOSE" --compose "$PROOF_COMPOSE" --compose "$RESTORE_COMPOSE" \
      --env-file "$RESTORE_ENV_FILE" --project "$TARGET_PROJECT" --release-id "$RELEASE_ID" \
      --host "$PUBLIC_HOST" --accounts-file "$AUTH_ACCOUNTS" --photo-account-file "$AUTH_PHOTO_ACCOUNT" --ca-file "$AUTH_CA" \
      --photo-storage-secret-root "$PHOTO_STORAGE_SECRET_ROOT" \
      --photo-auth-image "$BACKEND_IMAGE" --connect-host caddy --connect-port 8443 \
      --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256" --photo-mode recover --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$PROOF_RECEIPT" \
      >/dev/null 2>&1 || die "complete target network proof failed"
  else
    node "$TARGET_PROOF" --execute --require-complete \
      --compose "$CORE_COMPOSE" --compose "$PHOTO_PROOF_COMPOSE" --compose "$PHOTO_COMPOSE" --compose "$RESTORE_COMPOSE" \
      --env-file "$RESTORE_ENV_FILE" --project "$TARGET_PROJECT" --release-id "$RELEASE_ID" \
      --host "$PUBLIC_HOST" --accounts-file "$AUTH_ACCOUNTS" --photo-account-file "$AUTH_PHOTO_ACCOUNT" --ca-file "$AUTH_CA" \
      --photo-storage-secret-root "$PHOTO_STORAGE_SECRET_ROOT" \
      --photo-auth-image "$BACKEND_IMAGE" --connect-host caddy --connect-port 8443 \
      --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256" --photo-mode recover --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$PROOF_RECEIPT" \
      >/dev/null 2>&1 || die "complete target network proof failed"
  fi
  TARGET_PROOF_SHA256=$(node - "$PROOF_RECEIPT" "$PHOTO_RECOVERY_CONTENT_SHA256" "$PHOTO_RECOVERY_CONTENT_LENGTH" <<'NODE'
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const [pathname, expectedSha, expectedLength] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(pathname, 'utf8')) } catch { process.exit(41) }
const queue = value?.queue
const photo = value?.photo
const digest = createHash('sha256').update(fs.readFileSync(pathname)).digest('hex')
if (
  value?.schemaVersion !== 1 || value?.dataClass !== 'synthetic' || value?.releaseClaimVerified !== true ||
  !queue || Object.keys(queue).length !== 6 || Object.values(queue).some((item) => item !== true) ||
  !photo || photo.photoAdminAuthenticated !== true || photo.nonSuperAdminDenied !== true || photo.deniedWriteDelta !== 0 || photo.exactWebpRead !== true || photo.repeatReadExact !== true || photo.canonicalIdentityVerified !== true || value.recoveredPreBackupPhoto !== true || photo.contentSha256 !== expectedSha || String(photo.contentLength) !== String(expectedLength) ||
  !/^[a-f0-9]{64}$/.test(photo.contentSha256) || !Number.isSafeInteger(photo.contentLength) || photo.contentLength <= 0 ||
  !/^[a-f0-9]{64}$/.test(digest)
) process.exit(42)
process.stdout.write(digest)
NODE
  ) || die "complete target proof receipt is invalid"
}

run_auth_proof() {
  AUTH_TMP=$(mktemp "$RECEIPT_PARENT/.auth-proof.tmp.XXXXXX") || die "auth proof output could not be created"
  chmod 600 "$AUTH_TMP"
  docker run --pull=never --rm --network "${TARGET_PROJECT}_proxy" \
    --volume "$AUTH_PROOF:/run/hr-axis/onprem-keycloak-auth-proof.mjs:ro" \
    --volume "$AUTH_ACCOUNTS:/run/hr-axis/synthetic-accounts:ro" \
    --volume "$AUTH_CA:/run/hr-axis/caddy-ca.crt:ro" \
    --entrypoint /nodejs/bin/node "$BACKEND_IMAGE" /run/hr-axis/onprem-keycloak-auth-proof.mjs \
      --host "$(env_value HR_AXIS_PUBLIC_HOST)" --connect-host caddy --connect-port 8443 \
      --accounts-file /run/hr-axis/synthetic-accounts --ca-file /run/hr-axis/caddy-ca.crt \
      >"$AUTH_TMP" 2>/dev/null || die "five-persona target auth proof failed"
  AUTH_RECEIPT_SHA256=$(node - "$AUTH_TMP" <<'NODE'
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const pathname = process.argv[2]
let value
try { value = JSON.parse(fs.readFileSync(pathname, 'utf8')) } catch { process.exit(41) }
const text = JSON.stringify(value)
if (/(?:access[_-]?token|refresh[_-]?token|id[_-]?token|password|private[_-]?key|client[_-]?secret)/i.test(text) || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(text)) process.exit(42)
if (
  value?.schemaVersion !== 1 || value?.dataClass !== 'synthetic' || value?.noRawCredentials !== true ||
  value?.personas?.count !== 5 || value?.scopeAuthorization?.crossScopeDenied !== true || value?.scopeAuthorization?.deniedActionWriteDelta !== 0
) process.exit(43)
if (value.personas.sessionsVerified !== undefined && value.personas.sessionsVerified !== 5) process.exit(44)
if (value.personas.crossScopeDenied !== undefined && value.personas.crossScopeDenied !== 5) process.exit(45)
if (value.personas.deniedMutationCount !== undefined && value.personas.deniedMutationCount !== 4) process.exit(46)
process.stdout.write(createHash('sha256').update(fs.readFileSync(pathname)).digest('hex'))
NODE
  ) || die "five-persona auth proof receipt is not an exact sanitized cross-scope proof"
}

# Exact fixed names are checked directly.  Label-filter inventory alone is not
# sufficient to prove that a disposable target is fresh.
for volume_name in "$V_POSTGRES" "$V_REDIS" "$V_KEYCLOAK" "$V_BOOTSTRAP" "$V_PHOTO"; do
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then die "exact target volume already exists: $volume_name"; fi
done
for network_name in "${TARGET_PROJECT}_edge" "${TARGET_PROJECT}_proxy" "${TARGET_PROJECT}_app" "${TARGET_PROJECT}_data"; do
  if docker network inspect "$network_name" >/dev/null 2>&1; then die "exact target network already exists: $network_name"; fi
done
for service_name in caddy frontend api worker keycloak redis postgres object-storage migrator synthetic-seed keycloak-bootstrap identity-binder; do
  if docker container inspect "${TARGET_PROJECT}-${service_name}-1" >/dev/null 2>&1; then die "exact target container already exists: $service_name"; fi
done
target_container_ids=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null) || die "target container inventory could not be inspected"
[ -z "$target_container_ids" ] || die "target container label collision detected"
target_hr_container_ids=$(docker ps -aq --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null) || die "target project container inventory could not be inspected"
[ -z "$target_hr_container_ids" ] || die "target project container label collision detected"
target_volume_ids=$(docker volume ls -q --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null) || die "target volume inventory could not be inspected"
[ -z "$target_volume_ids" ] || die "target volume label collision detected"
target_compose_volume_ids=$(docker volume ls -q --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null) || die "target Compose volume inventory could not be inspected"
[ -z "$target_compose_volume_ids" ] || die "target Compose volume label collision detected"
target_network_ids=$(docker network ls -q --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null) || die "target network inventory could not be inspected"
[ -z "$target_network_ids" ] || die "target network label collision detected"
target_hr_network_ids=$(docker network ls -q --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null) || die "target project network inventory could not be inspected"
[ -z "$target_hr_network_ids" ] || die "target project network label collision detected"

CREATED_VOLUMES=
MUTATION_STARTED=0
RECEIPT_TMP="$RECEIPT.tmp.$$"
STARTED_AT=$(date +%s)
cleanup_failed=0
cleanup_resources() {
  ids=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null) || { cleanup_failed=1; ids=; }
  for id in $ids; do
    meta=$(docker inspect "$id" --format '{{.Name}}|{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.docker.compose.service"}}' 2>/dev/null) || { cleanup_failed=1; meta=; }
    IFS='|' read -r resource_name project data_class release service <<EOF
$meta
EOF
    if [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ]; then
      case "$service" in caddy|frontend|api|worker|keycloak|redis|postgres|object-storage|migrator|synthetic-seed|keycloak-bootstrap|identity-binder)
        docker rm -f "$id" >/dev/null 2>&1 || cleanup_failed=1 ;;
      esac
    fi
  done
  for volume_name in $CREATED_VOLUMES; do
    meta=$(docker volume inspect "$volume_name" --format '{{.Name}}|{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.data-class"}}|{{index .Labels "com.hr-axis.release-id"}}' 2>/dev/null) || { cleanup_failed=1; meta=; }
    if [ "$meta" = "$volume_name|$TARGET_PROJECT|synthetic|$RELEASE_ID" ]; then
      docker volume rm "$volume_name" >/dev/null 2>&1 || cleanup_failed=1
    fi
  done
  for network_name in "${TARGET_PROJECT}_edge" "${TARGET_PROJECT}_proxy" "${TARGET_PROJECT}_app" "${TARGET_PROJECT}_data"; do
    meta=$(docker network inspect "$network_name" --format '{{.Name}}|{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.data-class"}}|{{index .Labels "com.hr-axis.release-id"}}' 2>/dev/null) || { cleanup_failed=1; meta=; continue; }
    case "$meta" in "$network_name|$TARGET_PROJECT|synthetic|$RELEASE_ID") docker network rm "$network_name" >/dev/null 2>&1 || cleanup_failed=1 ;; esac
  done
}
cleanup() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$MUTATION_STARTED" -eq 1 ]; then
    # Reinspect all target resources and remove only exact synthetic labels
    # belonging to this invocation.  No broad project-wide deletion is used.
    cleanup_failed=0
    cleanup_resources
  fi
  if [ "$status" -ne 0 ]; then rm -f "$RECEIPT_TMP" 2>/dev/null || cleanup_failed=1; fi
  if [ "$status" -ne 0 ]; then rm -f "$RECEIPT" 2>/dev/null || cleanup_failed=1; fi
  if [ -n "${AUTH_TMP:-}" ]; then rm -f "$AUTH_TMP" 2>/dev/null || cleanup_failed=1; fi
  if [ "${PROOF_RECEIPT_PRIVATE:-0}" -eq 1 ] && [ -n "${PROOF_RECEIPT:-}" ]; then rm -f "$PROOF_RECEIPT" 2>/dev/null || cleanup_failed=1; fi
  if [ -n "${RESTORE_ENV_FILE:-}" ]; then rm -f "$RESTORE_ENV_FILE" 2>/dev/null || cleanup_failed=1; fi
  if [ -n "${SEALED_BACKUP_DIR:-}" ]; then rm -rf -- "$SEALED_BACKUP_DIR" 2>/dev/null || cleanup_failed=1; fi
  [ "$cleanup_failed" -eq 0 ] || status=1
  exit "$status"
}
trap cleanup EXIT HUP INT TERM

create_volume() {
  class=$1; name=$2
  docker volume create --label "com.hr-axis.project=$TARGET_PROJECT" --label com.hr-axis.data-class=synthetic --label "com.hr-axis.release-id=$RELEASE_ID" --label "com.hr-axis.volume-class=$class" "$name" >/dev/null 2>&1 || die "fresh $class volume creation failed"
  CREATED_VOLUMES="$CREATED_VOLUMES $name"
}
restore_volume() {
  class=$1; name=$2
  revalidate_sealed_backup
  docker run --pull=never --rm --network none --volume "$name:/target" --volume "$BACKUP_DIR:/backup:ro" "$ARCHIVE_IMAGE" sh -c "tar -xf /backup/volumes/$class.tar -C /target" >/dev/null 2>&1 || die "fresh $class volume restore failed"
}

# Re-check the sealed artifact digests at the point of use. Any unexpected
# privileged mutation after signature verification fails before target state.
revalidate_sealed_backup
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS >/dev/null 2>&1) || die "sealed backup changed after verification"
MUTATION_STARTED=1
create_volume postgres "$V_POSTGRES"
create_volume redis-aof "$V_REDIS"
create_volume keycloak "$V_KEYCLOAK"
create_volume keycloak-bootstrap-state "$V_BOOTSTRAP"
create_volume photo-object-storage "$V_PHOTO"
restore_volume redis-aof "$V_REDIS"
restore_volume keycloak "$V_KEYCLOAK"
restore_volume keycloak-bootstrap-state "$V_BOOTSTRAP"
restore_volume photo-object-storage "$V_PHOTO"

compose_start core postgres "fresh postgres startup failed" --profile infra up --pull never --wait --wait-timeout 180 -d postgres
POSTGRES_CONTAINER=$(compose_core ps -q postgres 2>/dev/null | tail -n 1)
[ -n "$POSTGRES_CONTAINER" ] || die "fresh postgres container is unavailable"
POSTGRES_META=$(docker inspect "$POSTGRES_CONTAINER" --format '{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{.State.Running}}|{{index .State.Health "Status"}}' 2>/dev/null) || die "fresh postgres identity could not be inspected"
IFS='|' read -r project data_class release running health <<EOF
$POSTGRES_META
EOF
[ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ] && [ "$running" = true ] || die "fresh postgres labels/state are invalid"

revalidate_sealed_backup
docker exec -i "$POSTGRES_CONTAINER" pg_restore --username=hr_axis_bootstrap --no-owner --no-privileges --dbname=hr_axis <"$BACKUP_DIR/databases/hr_axis.dump" >/dev/null 2>&1 || die "hr_axis database restore failed"
revalidate_sealed_backup
docker exec -i "$POSTGRES_CONTAINER" pg_restore --username=hr_axis_bootstrap --no-owner --no-privileges --dbname=keycloak <"$BACKUP_DIR/databases/keycloak.dump" >/dev/null 2>&1 || die "keycloak database restore failed"

# Re-check the exact signed archive-byte aggregate after extraction, before
# any restored service starts.  The backup manifest signs the bytes of the
# four volume archives; re-tarring a live volume is not equivalent because
# tar metadata (especially the extracted root directory mtime) can change
# during restore.  Extraction itself is still fail-closed and the subsequent
# target health/database/queue/photo proofs validate the restored contents.
revalidate_sealed_backup
restored_volume_digest_input=
for class_name in redis-aof keycloak keycloak-bootstrap-state photo-object-storage; do
  class_hash=$(sha256sum "$BACKUP_DIR/volumes/$class_name.tar" 2>/dev/null | awk '{print $1}')
  printf '%s' "$class_hash" | grep -Eq '^[0-9a-f]{64}$' || die "restored volume hash is unavailable: $class_name"
  restored_volume_digest_input="$restored_volume_digest_input$class_name=$class_hash\n"
done
RESTORED_VOLUME_AGGREGATE=$(printf '%b' "$restored_volume_digest_input" | LC_ALL=C sort | sha256sum | awk '{print $1}')
[ -n "$RESTORED_VOLUME_AGGREGATE" ] || die "restored volume aggregate hash is unavailable"
[ "$RESTORED_VOLUME_AGGREGATE" = "$BACKUP_VOLUME_DIGEST" ] || die "restored volume aggregate hash does not match the signed backup"

compose_start core redis "fresh redis/keycloak startup failed" --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d redis keycloak
compose_start photo object-storage "fresh object-storage startup failed" --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d object-storage
compose_core --profile infra --profile keycloak-bootstrap run --pull never --rm --no-deps keycloak-bootstrap >/dev/null 2>&1 || die "Keycloak bootstrap reconcile failed"
compose_core --profile infra --profile keycloak-bootstrap --profile identity-binder run --pull never --rm --no-deps identity-binder >/dev/null 2>&1 || die "identity binder failed"
MIGRATOR_OUTPUT=$(compose_core --profile migrate run --pull never --rm --no-deps migrator 2>&1) || die "migration rehearsal failed"
MIGRATOR_DIGESTS=$(printf '%s\n' "$MIGRATOR_OUTPUT" | sed -n 's/.*migrationTreeDigest[^0-9a-fA-F]*\([0-9a-fA-F]\{64\}\).*/\1/p')
[ "$(printf '%s\n' "$MIGRATOR_DIGESTS" | sed '/^$/d' | wc -l | tr -d ' ')" = 1 ] || die "migrator must emit exactly one migration tree digest"
MIGRATOR_DIGEST=$(printf '%s' "$MIGRATOR_DIGESTS" | tr 'A-F' 'a-f')
[ "$MIGRATOR_DIGEST" = "$TARGET_MIGRATION_DIGEST" ] || die "migrator tree digest does not match signed target"
compose_start core postgres "fresh core runtime startup failed" --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d
compose_start photo object-storage "fresh photo runtime startup failed" --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d

service_id() {
  compose_name=$1; service=$2
  if [ "$compose_name" = core ]; then compose_core ps -q "$service" 2>/dev/null | tail -n 1; else compose_photo ps -q "$service" 2>/dev/null | tail -n 1; fi
}
require_healthy() {
  compose_name=$1; service=$2; id=$(service_id "$compose_name" "$service"); [ -n "$id" ] || die "restored service is missing: $service"
  meta=$(docker inspect "$id" --format '{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Running}}|{{index .State.Health "Status"}}' 2>/dev/null) || die "restored service identity could not be inspected: $service"
  IFS='|' read -r project data_class release compose_service running health <<EOF
$meta
EOF
  [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$RELEASE_ID" ] && [ "$compose_service" = "$service" ] && [ "$running" = true ] || die "restored service is not running with exact labels: $service"
  case "$health" in healthy|none|'') ;; *) die "restored service is unhealthy: $service" ;; esac
  printf '%s' "$id"
}
POSTGRES_CONTAINER=$(require_healthy core postgres)
REDIS_CONTAINER=$(require_healthy core redis)
require_healthy core caddy >/dev/null
require_healthy core frontend >/dev/null
require_healthy core keycloak >/dev/null
require_healthy core api >/dev/null
require_healthy core worker >/dev/null
OBJECT_STORAGE_CONTAINER=$(require_healthy photo object-storage)
docker exec "$POSTGRES_CONTAINER" psql --username=hr_axis_bootstrap --dbname=hr_axis --command='SELECT 1 FROM information_schema.tables LIMIT 1;' >/dev/null 2>&1 || die "restored database/schema query failed"
redis_ping=$(docker exec "$REDIS_CONTAINER" sh -c 'redis-cli -u "$(cat /run/secrets/redis_health_url)" --no-auth-warning PING' 2>/dev/null || true)
[ "$redis_ping" = PONG ] || die "restored Redis PING failed"

# The target is not considered recovered until the complete queue/photo proof
# and the five-persona authorization proof run against this exact target. Both
# receipts are validated and hashed before any disposable-target cleanup.
run_complete_target_proof
run_auth_proof

FINISHED_AT=$(date +%s)
STARTED_AT=${STARTED_AT:-$FINISHED_AT}
ELAPSED=$((FINISHED_AT - STARTED_AT))
cat >"$RECEIPT_TMP" <<EOF
{"schemaVersion":1,"operation":"restore","status":"passed","dataClass":"synthetic","releaseId":"$RELEASE_ID","sourceProject":"$SOURCE_PROJECT","targetProject":"$TARGET_PROJECT","sourceReleaseId":"$SOURCE_RELEASE_ID","sourceMigrationTreeDigest":"$BACKUP_MIGRATION_DIGEST","targetMigrationTreeDigest":"$TARGET_MIGRATION_DIGEST","backupManifestSha256":"$BACKUP_MANIFEST_SHA","backupFingerprintSha256":"$BACKUP_FINGERPRINT","photoRecoveryHandleSha256":"$PHOTO_RECOVERY_HANDLE_SHA256","photoContentSha256":"$PHOTO_RECOVERY_CONTENT_SHA256","photoContentLength":$PHOTO_RECOVERY_CONTENT_LENGTH,"recoveredPreBackupPhoto":true,"provisionalRtoSeconds":$ELAPSED,"sameHostRehearsal":true,"disasterRecovery":false,"targetFresh":true,"restoredVolumeAggregateDigest":"$RESTORED_VOLUME_AGGREGATE","targetProofReceiptSha256":"$TARGET_PROOF_SHA256","authReceiptSha256":"$AUTH_RECEIPT_SHA256","targetProof":{"queue":true,"photo":true,"auth":true},"cleanupVerified":false}
EOF
mv "$RECEIPT_TMP" "$RECEIPT"
# Publish provisional evidence before exact-label cleanup, then publish the
# final receipt only when every created resource has been removed successfully.
cleanup_failed=0
cleanup_resources
[ "$cleanup_failed" -eq 0 ] || die "exact disposable-target cleanup failed"
cat >"$RECEIPT_TMP" <<EOF
{"schemaVersion":1,"operation":"restore","status":"passed","dataClass":"synthetic","releaseId":"$RELEASE_ID","sourceProject":"$SOURCE_PROJECT","targetProject":"$TARGET_PROJECT","sourceReleaseId":"$SOURCE_RELEASE_ID","sourceMigrationTreeDigest":"$BACKUP_MIGRATION_DIGEST","targetMigrationTreeDigest":"$TARGET_MIGRATION_DIGEST","backupManifestSha256":"$BACKUP_MANIFEST_SHA","backupFingerprintSha256":"$BACKUP_FINGERPRINT","photoRecoveryHandleSha256":"$PHOTO_RECOVERY_HANDLE_SHA256","photoContentSha256":"$PHOTO_RECOVERY_CONTENT_SHA256","photoContentLength":$PHOTO_RECOVERY_CONTENT_LENGTH,"recoveredPreBackupPhoto":true,"provisionalRtoSeconds":$ELAPSED,"sameHostRehearsal":true,"disasterRecovery":false,"targetFresh":true,"restoredVolumeAggregateDigest":"$RESTORED_VOLUME_AGGREGATE","targetProofReceiptSha256":"$TARGET_PROOF_SHA256","authReceiptSha256":"$AUTH_RECEIPT_SHA256","targetProof":{"queue":true,"photo":true,"auth":true},"cleanupVerified":true,"cleanup":{"resourcesRemoved":true,"errors":0}}
EOF
mv "$RECEIPT_TMP" "$RECEIPT"
MUTATION_STARTED=0
rm -f "$RESTORE_ENV_FILE" || die "restore env cleanup failed"
revalidate_sealed_backup
rm -rf -- "$SEALED_BACKUP_DIR" || die "sealed backup cleanup failed"
[ ! -e "$SEALED_BACKUP_DIR" ] && [ ! -L "$SEALED_BACKUP_DIR" ] || die "sealed backup remained after cleanup"
SEALED_BACKUP_DIR=
trap - EXIT HUP INT TERM
say "PASS release=$RELEASE_ID target=$TARGET_PROJECT provisionalRtoSeconds=$ELAPSED sameHostRehearsal=true disasterRecovery=false"
