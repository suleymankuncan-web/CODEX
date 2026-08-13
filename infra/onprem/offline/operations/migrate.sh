#!/bin/sh
set -eu

# Explicit database migration only.  Runtime services must never run schema
# changes on startup; an incompatible ledger stops this command before the
# one-shot migrator is invoked.

die() { printf '%s\n' "migrate: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "migrate: $*"; }
BUNDLE_ROOT=
RELEASE_ID=
TARGET_PROJECT=
PUBLIC_KEY=
TRUSTED_FINGERPRINT=
ENV_FILE=
PROOF_COMPOSE=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -ge 2 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2 ;;
    --release-id) [ "$#" -ge 2 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2 ;;
    --target-project|--project) [ "$#" -ge 2 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2 ;;
    --public-key|--trusted-public-key) [ "$#" -ge 2 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2 ;;
    --trusted-fingerprint) [ "$#" -ge 2 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2 ;;
    --env-file|--approved-env) [ "$#" -ge 2 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2 ;;
    --proof-compose) [ "$#" -ge 2 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2 ;;
    --help) printf '%s\n' 'usage: migrate.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --env-file PATH'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] || die "bundle root, release id, target project, public key, trusted fingerprint, and approved env are required"
case "$BUNDLE_ROOT:$PUBLIC_KEY:$ENV_FILE" in /*:*:/*) ;; *) die "bundle, public-key, and env paths must be absolute" ;; esac
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
fi
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"

VERIFIER="$BUNDLE_ROOT/operations/onprem-offline-bundle.mjs"
[ -f "$VERIFIER" ] || VERIFIER="$BUNDLE_ROOT/onprem-offline-bundle.mjs"
[ -f "$VERIFIER" ] || die "bundled offline verifier is missing"
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
run_preflight() {
  if [ -n "$PROOF_COMPOSE" ]; then
    "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --proof-compose "$PROOF_COMPOSE" --allow-missing-ledger
  else
    "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --allow-missing-ledger
  fi
}
run_preflight >/dev/null || die "preflight failed"

COMPATIBILITY_FILE="$BUNDLE_ROOT/evidence/migration-compatibility.json"
[ -f "$COMPATIBILITY_FILE" ] && [ ! -L "$COMPATIBILITY_FILE" ] || die "signed migration compatibility evidence is missing or symlinked"
SIGNED_DIGEST=$(node - "$COMPATIBILITY_FILE" "$RELEASE_ID" <<'NODE'
const fs = require('node:fs')
const [path, releaseId] = process.argv.slice(2)
let value
try { value = JSON.parse(fs.readFileSync(path, 'utf8')) } catch { process.exit(41) }
const required = ['schemaVersion', 'releaseId', 'migrationTreeDigest', 'compatibleFrom', 'upgradeCompatible', 'rollbackCompatible']
const keys = Object.keys(value).sort(); if (keys.length !== required.length || keys.some((key, index) => key !== required.slice().sort()[index])) process.exit(42)
if (value.schemaVersion !== 1 || value.releaseId !== releaseId || typeof value.migrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/i.test(value.migrationTreeDigest)) process.exit(43)
if (!Array.isArray(value.compatibleFrom) || typeof value.upgradeCompatible !== 'boolean' || typeof value.rollbackCompatible !== 'boolean') process.exit(44)
const seen = new Set()
for (const entry of value.compatibleFrom) {
  if (!entry || Object.keys(entry).sort().join('|') !== 'sourceMigrationTreeDigest|sourceReleaseId' || typeof entry.sourceReleaseId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(entry.sourceReleaseId) || seen.has(entry.sourceReleaseId) || typeof entry.sourceMigrationTreeDigest !== 'string' || !/^[0-9a-f]{64}$/i.test(entry.sourceMigrationTreeDigest)) process.exit(45)
  seen.add(entry.sourceReleaseId)
}
process.stdout.write(value.migrationTreeDigest.toLowerCase())
NODE
) || die "signed migration compatibility evidence is invalid or release-mismatched"

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"
PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"
PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
[ -f "$CORE_COMPOSE" ] || die "bundled core Compose file is missing"
[ -f "$PHOTO_PROOF_COMPOSE" ] || die "bundled photo-proof Compose overlay is missing"
[ -f "$PHOTO_COMPOSE" ] || die "bundled photo Compose file is missing"
compose() {
  if [ -n "$PROOF_COMPOSE" ]; then
    docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"
  else
    docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"
  fi
}

env_value() {
  awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

read_status() {
  status_output=$(compose --profile migrate run --pull never --rm --no-deps migrator dist/src/onprem/migration-status.js 2>&1) || die "read-only migration status failed"
  printf '%s\n' "$status_output" | node -e '
const fs = require("node:fs")
const expectedDigest = process.argv[1]
const lines = fs.readFileSync(0, "utf8").trim().split(/\r?\n/).filter(Boolean)
let value
try { value = JSON.parse(lines.at(-1) ?? "") } catch { process.exit(41) }
const keys = Object.keys(value ?? {}).sort()
const expected = ["applied", "checksum", "dataClass", "failed", "migrationTreeDigest", "orphan", "pending", "schemaVersion", "status", "total", "trackingTable"]
if (JSON.stringify(keys) !== JSON.stringify(expected)) process.exit(42)
if (value.schemaVersion !== 1 || value.dataClass !== "synthetic" || typeof value.migrationTreeDigest !== "string" || !/^[0-9a-f]{64}$/.test(value.migrationTreeDigest) || value.migrationTreeDigest !== expectedDigest) process.exit(43)
for (const key of ["total", "applied", "pending", "failed", "orphan"]) if (!Number.isInteger(value[key]) || value[key] < 0) process.exit(44)
if (!["fresh", "clean", "pending", "failed", "incompatible"].includes(value.status) || !["present", "missing"].includes(value.trackingTable) || !["valid", "invalid"].includes(value.checksum)) process.exit(45)
if (value.trackingTable === "missing") {
  if (value.status !== "fresh" || value.total <= 0 || value.applied !== 0 || value.pending !== value.total || value.failed !== 0 || value.orphan !== 0 || value.checksum !== "valid") process.exit(46)
} else if (!["clean", "pending"].includes(value.status) || value.orphan !== 0 || value.failed !== 0 || value.checksum !== "valid") {
  process.exit(47)
}
process.stdout.write(JSON.stringify(value))
' "$SIGNED_DIGEST"
}

# The precondition is derived from the target database through the packaged
# read-only CLI.  No caller-supplied ledger is trusted here.
PRE_STATUS=$(read_status) || die "target database migration status is not clean-compatible"

# One and only one migrator invocation.  There is deliberately no `up` and no
# runtime auto-migration path in this script.
MIGRATOR_OUTPUT=$(compose --profile migrate run --pull never --rm --no-deps migrator 2>&1) || die "explicit migrator failed"
MIGRATION_DIGESTS=$(printf '%s\n' "$MIGRATOR_OUTPUT" | sed -n 's/.*migrationTreeDigest[^0-9a-fA-F]*\([0-9a-fA-F]\{64\}\).*/\1/p' | tr 'A-F' 'a-f')
MIGRATION_DIGEST_COUNT=$(printf '%s\n' "$MIGRATION_DIGESTS" | awk 'NF { count += 1 } END { print count + 0 }')
[ "$MIGRATION_DIGEST_COUNT" -eq 1 ] || die "migrator must emit exactly one migration tree digest"
RESULT_DIGEST=$(printf '%s\n' "$MIGRATION_DIGESTS" | sed -n '1p')
[ "$RESULT_DIGEST" = "$SIGNED_DIGEST" ] || die "migrator tree digest does not match signed evidence"

POST_STATUS=$(read_status) || die "post-migration status read failed"
if ! printf '%s\n' "$POST_STATUS" | node -e '
const fs = require("node:fs")
const expectedDigest = process.argv[1]
let value
try { value = JSON.parse(fs.readFileSync(0, "utf8")) } catch { process.exit(41) }
if (value.status !== "clean" || value.trackingTable !== "present" || value.applied !== value.total || value.pending !== 0 || value.failed !== 0 || value.orphan !== 0 || value.checksum !== "valid" || value.migrationTreeDigest !== expectedDigest) process.exit(42)
' "$SIGNED_DIGEST"; then
  die "post-migration status is not clean or digest-compatible"
fi

LEDGER_FILE=$(env_value MIGRATION_LEDGER_FILE || true)
if [ -n "$LEDGER_FILE" ]; then
  case "$LEDGER_FILE" in /*) ;; *) die "migration ledger path must be absolute" ;; esac
  [ ! -L "$LEDGER_FILE" ] || die "migration ledger path is a symlink"
  ledger_directory=$(dirname "$LEDGER_FILE")
  [ -d "$ledger_directory" ] || die "migration ledger directory is missing"
  ledger_tmp=$(mktemp "$ledger_directory/.migration-ledger.XXXXXX") || die "unable to create migration ledger temporary file"
  trap 'rm -f "$ledger_tmp"' EXIT HUP INT TERM
  umask 077
  node - "$POST_STATUS" "$TARGET_PROJECT" "$RELEASE_ID" > "$ledger_tmp" <<'NODE'
const [serialized, project, releaseId] = process.argv.slice(2)
const status = JSON.parse(serialized)
process.stdout.write(JSON.stringify({
  project,
  releaseId,
  ...status,
  dirty: status.status !== 'clean',
  orphanCount: status.orphan,
  checksumValid: status.checksum === 'valid',
  migrationTreeDigest: status.migrationTreeDigest,
}) + '\n')
NODE
  chmod 600 "$ledger_tmp"
  mv -f "$ledger_tmp" "$LEDGER_FILE"
  trap - EXIT HUP INT TERM
fi

say "PASS project=$TARGET_PROJECT release=$RELEASE_ID migrationDigest=$RESULT_DIGEST"
