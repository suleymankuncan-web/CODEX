#!/bin/sh
set -eu

# Upgrade is a disposable rehearsal.  It never installs, migrates, or
# reconfigures the active current project; the next bundle is restored into a
# fresh operator-supplied target.
umask 077
die() { printf '%s\n' "upgrade: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "upgrade: $*"; }

BUNDLE_ROOT=
NEXT_BUNDLE_ROOT=
RELEASE_ID=
NEXT_RELEASE_ID=
SOURCE_PROJECT=
TARGET_PROJECT=
PUBLIC_KEY=
TRUSTED_FINGERPRINT=
BACKUP_PUBLIC_KEY=
BACKUP_TRUSTED_FINGERPRINT=
ENV_FILE=
BACKUP_DIR=
RECEIPT=
PHOTO_FIXTURE=
PHOTO_SHA256=
PROOF_RECEIPT=
PROOF_COMPOSE=
PHOTO_RECOVERY_HANDLE_FILE=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -ge 2 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2 ;;
    --next-bundle-root) [ "$#" -ge 2 ] || die "--next-bundle-root requires a value"; NEXT_BUNDLE_ROOT=$2; shift 2 ;;
    --release-id) [ "$#" -ge 2 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2 ;;
    --next-release-id) [ "$#" -ge 2 ] || die "--next-release-id requires a value"; NEXT_RELEASE_ID=$2; shift 2 ;;
    --source-project|--current-project) [ "$#" -ge 2 ] || die "--source-project requires a value"; SOURCE_PROJECT=$2; shift 2 ;;
    --target-project|--project) [ "$#" -ge 2 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2 ;;
    --public-key|--trusted-public-key) [ "$#" -ge 2 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2 ;;
    --trusted-fingerprint) [ "$#" -ge 2 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --backup-public-key) [ "$#" -ge 2 ] || die "--backup-public-key requires a value"; BACKUP_PUBLIC_KEY=$2; shift 2 ;;
    --backup-trusted-fingerprint) [ "$#" -ge 2 ] || die "--backup-trusted-fingerprint requires a value"; BACKUP_TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --env-file|--approved-env) [ "$#" -ge 2 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2 ;;
    --backup-dir) [ "$#" -ge 2 ] || die "--backup-dir requires a value"; BACKUP_DIR=$2; shift 2 ;;
    --receipt) [ "$#" -ge 2 ] || die "--receipt requires a value"; RECEIPT=$2; shift 2 ;;
    --photo-fixture) [ "$#" -ge 2 ] || die "--photo-fixture requires a value"; PHOTO_FIXTURE=$2; shift 2 ;;
    --photo-sha256) [ "$#" -ge 2 ] || die "--photo-sha256 requires a value"; PHOTO_SHA256=$2; shift 2 ;;
    --proof-receipt) [ "$#" -ge 2 ] || die "--proof-receipt requires a value"; PROOF_RECEIPT=$2; shift 2 ;;
    --proof-compose) [ "$#" -ge 2 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2 ;;
    --photo-recovery-handle-file) [ "$#" -ge 2 ] || die "--photo-recovery-handle-file requires a value"; PHOTO_RECOVERY_HANDLE_FILE=$2; shift 2 ;;
    --help) printf '%s\n' 'usage: upgrade.sh --bundle-root CURRENT --next-bundle-root NEXT --release-id ID --next-release-id NEXT_ID --source-project PROJECT --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --backup-public-key PEM --backup-trusted-fingerprint HEX64 --env-file PATH --backup-dir DIR --receipt PATH --photo-fixture PATH --photo-sha256 HEX64 [--proof-receipt PATH]'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$BUNDLE_ROOT" ] && [ -n "$NEXT_BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$NEXT_RELEASE_ID" ] && [ -n "$SOURCE_PROJECT" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$BACKUP_PUBLIC_KEY" ] && [ -n "$BACKUP_TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] && [ -n "$BACKUP_DIR" ] && [ -n "$RECEIPT" ] && [ -n "$PHOTO_FIXTURE" ] && [ -n "$PHOTO_SHA256" ] && [ -n "$PHOTO_RECOVERY_HANDLE_FILE" ] || die "current/next bundles, identities, release/backup trust, env, backup, source, target, receipt, photo fixture, photo hash, and photo recovery handle are required"
[ "$BUNDLE_ROOT" != "$NEXT_BUNDLE_ROOT" ] || die "current and next bundle roots must be distinct"
[ "$SOURCE_PROJECT" != "$TARGET_PROJECT" ] || die "upgrade target must be distinct from source project"
printf '%s' "$RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "release id is unsafe"
printf '%s' "$NEXT_RELEASE_ID" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "next release id is unsafe"
printf '%s' "$SOURCE_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "source project is unsafe"
printf '%s' "$TARGET_PROJECT" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' || die "target project is unsafe"
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$BACKUP_TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "backup trusted fingerprint must be 64 lowercase hex characters"
printf '%s' "$PHOTO_SHA256" | grep -Eq '^[0-9a-fA-F]{64}$' || die "photo fixture SHA-256 must be 64 hexadecimal characters"
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || [ "$PROOF_COMPOSE" = "$NEXT_BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be an exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
fi
require_absolute() { case "$1" in /*) ;; *) die "$2 must be an absolute path" ;; esac; }
require_no_symlink_components() { path=$1; while [ "$path" != / ] && [ -n "$path" ]; do [ ! -L "$path" ] || die "$2 contains a symlink component"; next=$(dirname "$path"); [ "$next" != "$path" ] || break; path=$next; done; }
require_file() { require_absolute "$1" "$2"; [ -f "$1" ] && [ ! -L "$1" ] || die "$2 is missing or a symlink"; require_no_symlink_components "$1" "$2"; }
require_dir() { require_absolute "$1" "$2"; [ -d "$1" ] && [ ! -L "$1" ] || die "$2 is missing or a symlink"; require_no_symlink_components "$1" "$2"; }
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
file_uid() { stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null || die "cannot inspect owner: $2"; }
file_identity() { stat -c '%d:%i' "$1" 2>/dev/null || stat -f '%d:%i' "$1" 2>/dev/null || die "cannot inspect filesystem identity: $2"; }
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
  case "$PHOTO_FIXTURE" in "$BUNDLE_ROOT"/*|"$NEXT_BUNDLE_ROOT"/*) die "photo fixture must be outside signed bundles" ;; esac
  [ "$(file_links "$PHOTO_FIXTURE")" = 1 ] || die "photo fixture must not be a hard link"
  mode=$(file_mode "$PHOTO_FIXTURE"); mode_is "$mode" 400 440 600 640 || die "photo fixture mode is too broad"
  bytes=$(file_size "$PHOTO_FIXTURE"); case "$bytes" in *[!0-9]*|"") die "cannot bound photo fixture" ;; esac
  [ "$bytes" -gt 0 ] && [ "$bytes" -le 15728640 ] || die "photo fixture must be a non-empty bounded file"
  actual=$(sha256_file "$PHOTO_FIXTURE"); [ "$actual" = "$(printf '%s' "$PHOTO_SHA256" | tr 'A-F' 'a-f')" ] || die "photo fixture SHA-256 does not match"
}
require_recovery_handle() {
  require_file "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle
  case "$PHOTO_RECOVERY_HANDLE_FILE" in "$BUNDLE_ROOT"/*|"$NEXT_BUNDLE_ROOT"/*) die "photo recovery handle must be outside signed bundles" ;; esac
  PHOTO_RECOVERY_HANDLE_PARENT=$(dirname "$PHOTO_RECOVERY_HANDLE_FILE")
  require_trusted_directory_tree "$PHOTO_RECOVERY_HANDLE_PARENT" photo-recovery-handle-parent
  PHOTO_RECOVERY_HANDLE_CANONICAL=$(canonical_file "$PHOTO_RECOVERY_HANDLE_FILE" photo-recovery-handle)
  [ "$PHOTO_RECOVERY_HANDLE_CANONICAL" = "$PHOTO_RECOVERY_HANDLE_FILE" ] || die "photo recovery handle must use a canonical absolute path"
  PHOTO_RECOVERY_HANDLE_NLINK=$(file_links "$PHOTO_RECOVERY_HANDLE_CANONICAL")
  [ "$PHOTO_RECOVERY_HANDLE_NLINK" = 1 ] || die "photo recovery handle must not be hard-linked"
  PHOTO_RECOVERY_HANDLE_MODE=$(file_mode "$PHOTO_RECOVERY_HANDLE_CANONICAL"); case "$PHOTO_RECOVERY_HANDLE_MODE" in 400|600) ;; *) die "photo recovery handle mode must be 0400 or 0600" ;; esac
  PHOTO_RECOVERY_HANDLE_UID=$(file_uid "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  operator_uid=${operator_uid:-$(id -u 2>/dev/null || true)}
  host_os=$(uname -s 2>/dev/null || true)
  if [ "$host_os" = Linux ]; then [ "$PHOTO_RECOVERY_HANDLE_UID" = 0 ] || die "photo recovery handle must be root-owned"; else [ "$PHOTO_RECOVERY_HANDLE_UID" = 0 ] || [ "$PHOTO_RECOVERY_HANDLE_UID" = "$operator_uid" ] || die "photo recovery handle must be root/operator-owned"; fi
  PHOTO_RECOVERY_HANDLE_IDENTITY=$(file_identity "$PHOTO_RECOVERY_HANDLE_CANONICAL" photo-recovery-handle)
  node - "$PHOTO_RECOVERY_HANDLE_CANONICAL" <<'NODE' >/dev/null 2>&1 || die "photo recovery handle JSON is invalid"
const fs = require('node:fs'); const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!value || Object.keys(value).length !== 5 || value.schemaVersion !== 1 || value.dataClass !== 'synthetic' || !uuid.test(value.mediaAssetId) || !/^[0-9a-f]{64}$/.test(value.contentSha256) || !Number.isSafeInteger(value.contentLength) || value.contentLength <= 0) process.exit(42)
NODE
  PHOTO_RECOVERY_HANDLE_SHA256=$(sha256_file "$PHOTO_RECOVERY_HANDLE_CANONICAL")
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
  RECEIPT_PARENT_MODE=$(file_mode "$RECEIPT_PARENT_CANONICAL")
}
revalidate_receipt_parent() {
  old_identity=$RECEIPT_PARENT_IDENTITY; old_uid=$RECEIPT_PARENT_UID; old_mode=$RECEIPT_PARENT_MODE
  capture_receipt_parent
  [ "$RECEIPT_PARENT_IDENTITY" = "$old_identity" ] || die "receipt parent filesystem identity changed"
  [ "$RECEIPT_PARENT_UID" = "$old_uid" ] || die "receipt parent owner changed"
  [ "$RECEIPT_PARENT_MODE" = "$old_mode" ] || die "receipt parent mode changed"
}

# A target restore may include the Keycloak reconciliation command, whose
# internal watchdog is deliberately much longer than the rehearsal's useful
# phase budget. Keep the outer lifecycle bounded and retain only a sanitized
# tail for diagnosis instead of silently waiting until the hosted job timeout.
readonly TARGET_RESTORE_TIMEOUT_SECONDS=900
readonly TARGET_RESTORE_KILL_AFTER_SECONDS=30
sanitize_restore_diagnostics() {
  sed -E 's/(password|secret|token|postgresql:\/\/|redis:\/\/)[^[:space:]]*/\1[redacted]/gi' | tail -n 160
}
run_target_restore() {
  restore_label=$1
  shift
  command -v timeout >/dev/null 2>&1 || die "timeout command is required for $restore_label target restore"
  restore_log=$(mktemp "$RECEIPT_PARENT/.$restore_label-target-restore.XXXXXX") || die "$restore_label target restore diagnostic log could not be created"
  say "target-restore: start label=$restore_label timeout=${TARGET_RESTORE_TIMEOUT_SECONDS}s"
  if timeout --foreground --signal=TERM --kill-after="${TARGET_RESTORE_KILL_AFTER_SECONDS}s" "${TARGET_RESTORE_TIMEOUT_SECONDS}s" "$@" >"$restore_log" 2>&1; then
    rm -f -- "$restore_log" || die "$restore_label target restore diagnostic cleanup failed"
    say "target-restore: complete label=$restore_label"
    return 0
  else
    restore_status=$?
  fi
  printf '%s\n' "upgrade: $restore_label target restore diagnostics" >&2
  tail -n 160 "$restore_log" | sanitize_restore_diagnostics >&2
  rm -f -- "$restore_log" || true
  if [ "$restore_status" -eq 124 ] || [ "$restore_status" -eq 137 ]; then
    die "$restore_label target restore timed out after ${TARGET_RESTORE_TIMEOUT_SECONDS}s"
  fi
  die "$restore_label target restore failed (exit $restore_status)"
}
require_dir "$BUNDLE_ROOT" current-bundle
require_dir "$NEXT_BUNDLE_ROOT" next-bundle
require_file "$PUBLIC_KEY" public-key
require_file "$BACKUP_PUBLIC_KEY" backup-public-key
require_file "$ENV_FILE" env
require_dir "$BACKUP_DIR" backup
require_absolute "$RECEIPT" receipt
[ ! -e "$RECEIPT" ] || die "receipt must be absent before the rehearsal"
RECEIPT_PARENT=$(dirname "$RECEIPT"); require_dir "$RECEIPT_PARENT" receipt-parent; capture_receipt_parent
require_photo_fixture
require_recovery_handle
PHOTO_RECOVERY_HANDLE_FILE=$PHOTO_RECOVERY_HANDLE_CANONICAL
if [ -n "$PROOF_RECEIPT" ]; then
  require_absolute "$PROOF_RECEIPT" proof-receipt
  require_no_symlink_components "$PROOF_RECEIPT" proof-receipt
  [ ! -e "$PROOF_RECEIPT" ] || die "proof receipt must be absent before the rehearsal"
  require_dir "$(dirname "$PROOF_RECEIPT")" proof-receipt-parent
  require_trusted_directory_tree "$(dirname "$PROOF_RECEIPT")" proof-receipt-parent
  case "$PROOF_RECEIPT" in "$BUNDLE_ROOT"|"$BUNDLE_ROOT"/*|"$NEXT_BUNDLE_ROOT"|"$NEXT_BUNDLE_ROOT"/*) die "proof receipt must be outside signed bundles" ;; esac
fi

verify_bundle() {
  root=$1
  verifier="$root/operations/onprem-offline-bundle.mjs"
  [ -f "$verifier" ] || verifier="$root/onprem-offline-bundle.mjs"
  [ -f "$verifier" ] && [ ! -L "$verifier" ] || die "bundled verifier is missing"
  node "$verifier" verify --bundle-dir "$root" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "signed bundle verification failed"
}
verify_bundle "$BUNDLE_ROOT"
verify_bundle "$NEXT_BUNDLE_ROOT"

MANIFEST="$BACKUP_DIR/backup-manifest.json"
SIGNATURE="$BACKUP_DIR/backup-signature.json"
INVENTORY="$BACKUP_DIR/SHA256SUMS"
require_file "$MANIFEST" backup-manifest
require_file "$SIGNATURE" backup-signature
require_file "$INVENTORY" backup-inventory

# This verifier is intentionally independent of any arbitrary receipt.  It
# checks the external trust fingerprint and signed source identity before the
# next restore can issue its first Docker mutation.
BACKUP_DIGEST=$(node - "$MANIFEST" "$SIGNATURE" "$INVENTORY" "$BACKUP_PUBLIC_KEY" "$BACKUP_TRUSTED_FINGERPRINT" "$RELEASE_ID" "$SOURCE_PROJECT" <<'NODE'
const fs = require('node:fs')
const { createHash, createPublicKey, verify } = require('node:crypto')
const [manifestPath, signaturePath, inventoryPath, publicPath, expectedFingerprint, releaseId, sourceProject] = process.argv.slice(2)
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : (value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value)
let manifest, signature, inventory, key
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); signature = JSON.parse(fs.readFileSync(signaturePath, 'utf8')); inventory = fs.readFileSync(inventoryPath, 'utf8'); key = createPublicKey(fs.readFileSync(publicPath)) } catch { process.exit(41) }
if (!manifest || manifest.operation !== 'backup' || manifest.dataClass !== 'synthetic' || manifest.releaseId !== releaseId || manifest.sourceProject !== sourceProject || manifest.sameHostRehearsal !== true || manifest.disasterRecovery !== false || typeof manifest.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.migrationTreeDigest) || typeof manifest.inventorySha !== 'string' || createHash('sha256').update(inventory).digest('hex') !== manifest.inventorySha) process.exit(42)
const fingerprint = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex')
if (fingerprint !== expectedFingerprint || signature.fingerprintSha256 !== expectedFingerprint || signature.algorithm !== 'Ed25519') process.exit(43)
const bytes = Buffer.from(JSON.stringify(canonical(manifest)))
if (signature.manifestSha256 !== createHash('sha256').update(bytes).digest('hex') || !verify(null, bytes, key, Buffer.from(signature.signatureBase64, 'base64'))) process.exit(44)
process.stdout.write(manifest.migrationTreeDigest)
NODE
) || die "signed backup verification failed"

COMPATIBILITY="$NEXT_BUNDLE_ROOT/evidence/migration-compatibility.json"
CURRENT_DIGEST=
NEXT_DIGEST=
COMPATIBILITY_OUTPUT=$(node - "$BUNDLE_ROOT/bundle-manifest.json" "$NEXT_BUNDLE_ROOT/bundle-manifest.json" "$COMPATIBILITY" "$RELEASE_ID" "$NEXT_RELEASE_ID" "$BACKUP_DIGEST" <<'NODE'
const fs = require('node:fs')
const [currentPath, nextPath, compatibilityPath, currentRelease, nextRelease, backupDigest] = process.argv.slice(2)
let current, next, value
try { current = JSON.parse(fs.readFileSync(currentPath, 'utf8')); next = JSON.parse(fs.readFileSync(nextPath, 'utf8')); value = JSON.parse(fs.readFileSync(compatibilityPath, 'utf8')) } catch { process.exit(41) }
if (!current || !next || current.releaseId !== currentRelease || next.releaseId !== nextRelease || !value || value.schemaVersion !== 1 || value.releaseId !== nextRelease || value.upgradeCompatible !== true || typeof value.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.migrationTreeDigest) || !Array.isArray(value.compatibleFrom)) process.exit(42)
const entries = value.compatibleFrom.filter((item) => item && item.sourceReleaseId === currentRelease)
if (entries.length !== 1 || entries[0].sourceMigrationTreeDigest !== backupDigest) process.exit(43)
process.stdout.write(`${entries[0].sourceMigrationTreeDigest}|${value.migrationTreeDigest}`)
NODE
) || die "forward_repair_or_database_restore_required"
IFS='|' read -r CURRENT_DIGEST NEXT_DIGEST <<EOF
$COMPATIBILITY_OUTPUT
EOF
printf '%s%s' "$CURRENT_DIGEST" "$NEXT_DIGEST" | grep -Eq '^[0-9a-f]{128}$' || die "forward_repair_or_database_restore_required"

# A disposable target must be proven fresh before importing any target image.
# Image loading is the first mutator; all trust, backup, compatibility, and
# exact-name collision checks therefore precede it.
for volume_name in "${TARGET_PROJECT}_postgres_data" "${TARGET_PROJECT}_redis_data" "${TARGET_PROJECT}_keycloak_data" "${TARGET_PROJECT}_keycloak_bootstrap_state" "${TARGET_PROJECT}_object_storage_data"; do
  if docker volume inspect "$volume_name" >/dev/null 2>&1; then die "exact target volume already exists: $volume_name"; fi
done
for network_name in "${TARGET_PROJECT}_edge" "${TARGET_PROJECT}_proxy" "${TARGET_PROJECT}_app" "${TARGET_PROJECT}_data"; do
  if docker network inspect "$network_name" >/dev/null 2>&1; then die "exact target network already exists: $network_name"; fi
done
for service_name in caddy frontend api worker keycloak redis postgres object-storage migrator synthetic-seed keycloak-bootstrap identity-binder; do
  if docker container inspect "${TARGET_PROJECT}-${service_name}-1" >/dev/null 2>&1; then die "exact target container already exists: $service_name"; fi
done
TARGET_CONTAINERS=$(docker ps -aq --filter "label=com.docker.compose.project=$TARGET_PROJECT" 2>/dev/null) || die "target container inventory could not be inspected"
for id in $TARGET_CONTAINERS; do
  meta=$(docker inspect "$id" --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{index .Config.Labels "com.hr-axis.release-id"}}' 2>/dev/null) || die "target container identity could not be inspected"
  IFS='|' read -r compose_project project data_class release <<EOF
$meta
EOF
  [ "$compose_project" = "$TARGET_PROJECT" ] && [ "$project" = "$TARGET_PROJECT" ] && [ "$data_class" = synthetic ] && [ "$release" = "$NEXT_RELEASE_ID" ] || die "target container label collision detected"
  die "target container label collision detected"
done
TARGET_VOLUMES=$(docker volume ls -q --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null) || die "target volume inventory could not be inspected"
for id in $TARGET_VOLUMES; do
  meta=$(docker volume inspect "$id" --format '{{.Name}}|{{index .Labels "com.hr-axis.project"}}|{{index .Labels "com.hr-axis.data-class"}}|{{index .Labels "com.hr-axis.release-id"}}' 2>/dev/null) || die "target volume identity could not be inspected"
  IFS='|' read -r name project data_class release <<EOF
$meta
EOF
  die "target volume label collision detected: $name"
done
TARGET_NETWORKS=$(docker network ls -q --filter "label=com.hr-axis.project=$TARGET_PROJECT" 2>/dev/null) || die "target network inventory could not be inspected"
for id in $TARGET_NETWORKS; do die "target network label collision detected: $id"; done

TARGET_IMAGE_LINES=$(node - "$NEXT_BUNDLE_ROOT/bundle-manifest.json" <<'NODE'
const fs = require('node:fs')
let manifest
try { manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) } catch { process.exit(41) }
const names = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
if (!manifest?.images || Object.keys(manifest.images).length !== names.length) process.exit(42)
const seenIds = new Set(); const seenArchives = new Set()
for (const name of names) {
  const image = manifest.images[name]
  if (!image || image.name !== name || typeof image.archive !== 'string' || image.archive.startsWith('/') || image.archive.includes('\\') || image.archive.split('/').some((part) => part === '..' || part === '') || typeof image.repoTag !== 'string' || typeof image.archiveSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(image.archiveSha256) || !/^sha256:[0-9a-f]{64}$/.test(image.configImageId)) process.exit(43)
  if (seenIds.has(image.configImageId) || seenArchives.has(image.archive)) process.exit(44)
  seenIds.add(image.configImageId); seenArchives.add(image.archive)
  process.stdout.write(`${name}|${image.archive}|${image.configImageId}\n`)
}
NODE
) || die "signed target image manifest is invalid"
revalidate_receipt_parent
TARGET_ENV_FILE=$(mktemp "$RECEIPT_PARENT/.upgrade-target-env.tmp.XXXXXX") || die "target env could not be created"
chmod 600 "$TARGET_ENV_FILE"
cleanup_target_env() { status=$?; rm -f "$TARGET_ENV_FILE" 2>/dev/null || status=1; exit "$status"; }
trap cleanup_target_env EXIT HUP INT TERM
TARGET_IMAGE_ENV=$(printf '%s\n' "$TARGET_IMAGE_LINES" | awk -F'|' 'BEGIN { env["backend"]="HR_AXIS_BACKEND_IMAGE"; env["frontend"]="HR_AXIS_FRONTEND_IMAGE"; env["keycloak"]="KEYCLOAK_IMAGE"; env["caddy"]="CADDY_IMAGE"; env["postgres"]="POSTGRES_IMAGE"; env["redis"]="REDIS_IMAGE"; env["seaweedfs"]="SEAWEEDFS_IMAGE" } { if ($1 in env) print env[$1] "=" $3 }')
{
  printf '%s\n' "HR_AXIS_RELEASE_ID=$NEXT_RELEASE_ID" "COMPOSE_PROJECT_NAME=$TARGET_PROJECT" "HR_AXIS_PROJECT_ID=$TARGET_PROJECT"
  printf '%s\n' "OFFLINE_RESTORE_POSTGRES_VOLUME=${TARGET_PROJECT}_postgres_data" "OFFLINE_RESTORE_REDIS_VOLUME=${TARGET_PROJECT}_redis_data" "OFFLINE_RESTORE_KEYCLOAK_VOLUME=${TARGET_PROJECT}_keycloak_data" "OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME=${TARGET_PROJECT}_keycloak_bootstrap_state" "OFFLINE_RESTORE_PHOTO_VOLUME=${TARGET_PROJECT}_object_storage_data"
  printf '%s\n' "REDIS_VOLUME=${TARGET_PROJECT}_redis_data" "KEYCLOAK_VOLUME=${TARGET_PROJECT}_keycloak_data" "KEYCLOAK_BOOTSTRAP_VOLUME=${TARGET_PROJECT}_keycloak_bootstrap_state" "PHOTO_VOLUME=${TARGET_PROJECT}_object_storage_data"
  printf '%s\n' "$TARGET_IMAGE_ENV"
  awk -F= '$0 !~ /^[[:space:]]*#/ && $1 !~ /^(HR_AXIS_RELEASE_ID|COMPOSE_PROJECT_NAME|HR_AXIS_PROJECT_ID|OFFLINE_RESTORE_POSTGRES_VOLUME|OFFLINE_RESTORE_REDIS_VOLUME|OFFLINE_RESTORE_KEYCLOAK_VOLUME|OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME|OFFLINE_RESTORE_PHOTO_VOLUME|REDIS_VOLUME|KEYCLOAK_VOLUME|KEYCLOAK_BOOTSTRAP_VOLUME|PHOTO_VOLUME|HR_AXIS_BACKEND_IMAGE|HR_AXIS_FRONTEND_IMAGE|KEYCLOAK_IMAGE|CADDY_IMAGE|POSTGRES_IMAGE|REDIS_IMAGE|SEAWEEDFS_IMAGE)$/ { print }' "$ENV_FILE"
} >"$TARGET_ENV_FILE" || die "target env could not be derived"
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$NEXT_BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must match next signed bundle"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "next signed proof Compose overlay is missing or symlinked"
  "$NEXT_BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --proof-compose "$PROOF_COMPOSE" --allow-unloaded-images >/dev/null 2>&1 || die "next target preflight failed"
else
  "$NEXT_BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --allow-unloaded-images >/dev/null 2>&1 || die "next target preflight failed"
fi
revalidate_recovery_handle
revalidate_receipt_parent
target_image_count=0
while IFS='|' read -r image_name image_archive expected_image_id; do
  [ -n "$image_name" ] || continue
  target_image_count=$((target_image_count + 1))
  archive_path="$NEXT_BUNDLE_ROOT/$image_archive"
  require_file "$archive_path" "target image archive $image_name"
  docker load -i "$archive_path" >/dev/null || die "target image import failed: $image_name"
  actual_image_id=$(docker image inspect --format '{{.Id}}' "$expected_image_id" 2>/dev/null || true)
  [ "$actual_image_id" = "$expected_image_id" ] || die "target image config id mismatch: $image_name"
done <<EOF
$TARGET_IMAGE_LINES
EOF
[ "$target_image_count" -eq 7 ] || die "exactly seven signed target image archives are required"

if [ -n "$PROOF_RECEIPT" ]; then
  revalidate_recovery_handle
  revalidate_receipt_parent
  if [ -n "$PROOF_COMPOSE" ]; then
    run_target_restore next "$NEXT_BUNDLE_ROOT/operations/restore.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --backup-public-key "$BACKUP_PUBLIC_KEY" --backup-trusted-fingerprint "$BACKUP_TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --backup-dir "$BACKUP_DIR" --source-project "$SOURCE_PROJECT" --source-release-id "$RELEASE_ID" --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$RECEIPT" --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256" --proof-receipt "$PROOF_RECEIPT" --proof-compose "$PROOF_COMPOSE"
  else
    run_target_restore next "$NEXT_BUNDLE_ROOT/operations/restore.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --backup-public-key "$BACKUP_PUBLIC_KEY" --backup-trusted-fingerprint "$BACKUP_TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --backup-dir "$BACKUP_DIR" --source-project "$SOURCE_PROJECT" --source-release-id "$RELEASE_ID" --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$RECEIPT" --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256" --proof-receipt "$PROOF_RECEIPT"
  fi
  proof_digest=$(sha256_file "$PROOF_RECEIPT") || die "target proof receipt digest is unavailable"
  node - "$RECEIPT" "$proof_digest" <<'NODE' >/dev/null 2>&1 || die "target proof receipt digest does not match restore receipt"
const fs = require('node:fs')
const [pathname, expected] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(pathname, 'utf8')) } catch { process.exit(41) }
if (value.targetProofReceiptSha256 !== expected) process.exit(42)
NODE
else
  revalidate_recovery_handle
  revalidate_receipt_parent
  if [ -n "$PROOF_COMPOSE" ]; then
    run_target_restore next "$NEXT_BUNDLE_ROOT/operations/restore.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --backup-public-key "$BACKUP_PUBLIC_KEY" --backup-trusted-fingerprint "$BACKUP_TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --backup-dir "$BACKUP_DIR" --source-project "$SOURCE_PROJECT" --source-release-id "$RELEASE_ID" --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$RECEIPT" --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256" --proof-compose "$PROOF_COMPOSE"
  else
    run_target_restore next "$NEXT_BUNDLE_ROOT/operations/restore.sh" --bundle-root "$NEXT_BUNDLE_ROOT" --release-id "$NEXT_RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --backup-public-key "$BACKUP_PUBLIC_KEY" --backup-trusted-fingerprint "$BACKUP_TRUSTED_FINGERPRINT" --env-file "$TARGET_ENV_FILE" --backup-dir "$BACKUP_DIR" --source-project "$SOURCE_PROJECT" --source-release-id "$RELEASE_ID" --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE_FILE" --receipt "$RECEIPT" --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_SHA256"
  fi
fi
node - "$RECEIPT" "$NEXT_RELEASE_ID" "$SOURCE_PROJECT" "$TARGET_PROJECT" "$BACKUP_TRUSTED_FINGERPRINT" "$PHOTO_RECOVERY_HANDLE_SHA256" <<'NODE' >/dev/null 2>&1 || die "target-bound complete proof receipt is invalid"
const fs = require('node:fs')
const [path, releaseId, sourceProject, targetProject, backupFingerprint, handleSha256] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(path, 'utf8')) } catch { process.exit(41) }
const digest = (item) => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item)
if (!value || value.operation !== 'restore' || value.status !== 'passed' || value.dataClass !== 'synthetic' || value.releaseId !== releaseId || value.sourceProject !== sourceProject || value.targetProject !== targetProject || value.sameHostRehearsal !== true || value.disasterRecovery !== false || value.targetFresh !== true || value.cleanupVerified !== true || value.recoveredPreBackupPhoto !== true || value.queueProbeStateReset !== true || value.photoRecoveryHandleSha256 !== handleSha256 || typeof value.sourceMigrationTreeDigest !== 'string' || typeof value.targetMigrationTreeDigest !== 'string' || typeof value.backupManifestSha256 !== 'string' || value.backupFingerprintSha256 !== backupFingerprint || !digest(value.targetProofReceiptSha256) || !digest(value.authReceiptSha256) || value.targetProof?.queue !== true || value.targetProof?.photo !== true || value.targetProof?.auth !== true) process.exit(42)
NODE
say "PASS source=$SOURCE_PROJECT target=$TARGET_PROJECT current=$RELEASE_ID next=$NEXT_RELEASE_ID compatibility=approved"
