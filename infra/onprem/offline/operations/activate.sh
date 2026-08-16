#!/bin/sh
set -eu

# Post-migration activation: reconcile synthetic identities, seed synthetic data,
# then start the application and public services. Never migrates implicitly.
die() { printf '%s\n' "activate: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "activate: $*"; }
BUNDLE_ROOT=; RELEASE_ID=; TARGET_PROJECT=; PUBLIC_KEY=; TRUSTED_FINGERPRINT=; ENV_FILE=; PROOF_COMPOSE=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle-root) [ "$#" -gt 1 ] || die "--bundle-root requires a value"; BUNDLE_ROOT=$2; shift 2;;
    --release-id) [ "$#" -gt 1 ] || die "--release-id requires a value"; RELEASE_ID=$2; shift 2;;
    --target-project|--project) [ "$#" -gt 1 ] || die "--target-project requires a value"; TARGET_PROJECT=$2; shift 2;;
    --public-key|--trusted-public-key) [ "$#" -gt 1 ] || die "--public-key requires a value"; PUBLIC_KEY=$2; shift 2;;
    --trusted-fingerprint) [ "$#" -gt 1 ] || die "--trusted-fingerprint requires a value"; TRUSTED_FINGERPRINT=$2; shift 2;;
    --env-file|--approved-env) [ "$#" -gt 1 ] || die "--env-file requires a value"; ENV_FILE=$2; shift 2;;
    --proof-compose) [ "$#" -gt 1 ] || die "--proof-compose requires a value"; PROOF_COMPOSE=$2; shift 2;;
    --help) printf '%s\n' 'usage: activate.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --env-file PATH'; exit 0;;
    *) die "unknown argument: $1";;
  esac
done
[ -n "$BUNDLE_ROOT" ] && [ -n "$RELEASE_ID" ] && [ -n "$TARGET_PROJECT" ] && [ -n "$PUBLIC_KEY" ] && [ -n "$TRUSTED_FINGERPRINT" ] && [ -n "$ENV_FILE" ] || die "bundle root, release id, target project, public key, trusted fingerprint, and approved env are required"
case "$BUNDLE_ROOT:$PUBLIC_KEY:$ENV_FILE" in /*:*:/*) ;; *) die "bundle, public-key, and env paths must be absolute";; esac
if [ -n "$PROOF_COMPOSE" ]; then
  [ "$PROOF_COMPOSE" = "$BUNDLE_ROOT/deployment/proof.compose.yaml" ] || die "proof Compose path must be the exact signed deployment/proof.compose.yaml"
  [ -f "$PROOF_COMPOSE" ] && [ ! -L "$PROOF_COMPOSE" ] || die "signed proof Compose overlay is missing or symlinked"
fi
printf '%s' "$TRUSTED_FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$' || die "trusted fingerprint must be 64 lowercase hex characters"
VERIFIER="$BUNDLE_ROOT/operations/onprem-offline-bundle.mjs"; [ -f "$VERIFIER" ] || VERIFIER="$BUNDLE_ROOT/onprem-offline-bundle.mjs"; [ -f "$VERIFIER" ] || die "bundled offline verifier is missing"
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
if [ -n "$PROOF_COMPOSE" ]; then
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --proof-compose "$PROOF_COMPOSE" >/dev/null || die "preflight failed"
else
  "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" >/dev/null || die "preflight failed"
fi

env_value() { awk -F= -v wanted="$1" '$0 !~ /^[[:space:]]*#/ && $1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"; }
[ "$(env_value HR_AXIS_DATA_CLASS)" = synthetic ] || die "activation requires synthetic data class"
[ "$(env_value HR_AXIS_STRICT_LOCAL)" = true ] || die "activation requires strict-local mode"
COMPATIBILITY_FILE="$BUNDLE_ROOT/evidence/migration-compatibility.json"
[ -f "$COMPATIBILITY_FILE" ] && [ ! -L "$COMPATIBILITY_FILE" ] || die "signed migration compatibility evidence is missing or symlinked"
SIGNED_DIGEST=$(node - "$COMPATIBILITY_FILE" "$RELEASE_ID" <<'NODE'
const fs=require('node:fs'); const [path,release]=process.argv.slice(2); let value
try { value=JSON.parse(fs.readFileSync(path,'utf8')) } catch { process.exit(41) }
const expected=['compatibleFrom','migrationTreeDigest','releaseId','rollbackCompatible','schemaVersion','upgradeCompatible']
if (JSON.stringify(Object.keys(value).sort())!==JSON.stringify(expected)) process.exit(42)
if (value.schemaVersion!==1||value.releaseId!==release||typeof value.migrationTreeDigest!=='string'||!/^[0-9a-f]{64}$/i.test(value.migrationTreeDigest)||!Array.isArray(value.compatibleFrom)||typeof value.upgradeCompatible!=='boolean'||typeof value.rollbackCompatible!=='boolean') process.exit(43)
for (const entry of value.compatibleFrom) if (!entry||JSON.stringify(Object.keys(entry).sort())!==JSON.stringify(['sourceMigrationTreeDigest','sourceReleaseId'])||typeof entry.sourceReleaseId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(entry.sourceReleaseId)||typeof entry.sourceMigrationTreeDigest!=='string'||!/^[0-9a-f]{64}$/i.test(entry.sourceMigrationTreeDigest)) process.exit(44)
process.stdout.write(value.migrationTreeDigest.toLowerCase())
NODE
) || die "signed migration compatibility evidence is invalid or release-mismatched"

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"; PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"; PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
[ -f "$CORE_COMPOSE" ] && [ -f "$PHOTO_PROOF_COMPOSE" ] && [ -f "$PHOTO_COMPOSE" ] || die "merged Compose files are missing"
compose() {
  if [ -n "$PROOF_COMPOSE" ]; then docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"; else docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"; fi
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
if (value.schemaVersion !== 1 || value.dataClass !== "synthetic" || value.status !== "clean" || value.trackingTable !== "present" || value.applied !== value.total || value.pending !== 0 || value.failed !== 0 || value.orphan !== 0 || value.checksum !== "valid" || typeof value.migrationTreeDigest !== "string" || !/^[0-9a-f]{64}$/.test(value.migrationTreeDigest) || value.migrationTreeDigest !== expectedDigest) process.exit(43)
process.stdout.write(JSON.stringify(value))
' "$SIGNED_DIGEST"
}

# A failed Compose wait otherwise leaves only a generic "unhealthy" line in the
# hosted log. Emit a bounded, non-secret state snapshot so the next failure can
# distinguish an exited/OOM'd process from a healthcheck-only failure without
# relaxing the fail-closed activation gate.
diagnose_service_state() {
  service_name="$1"
  container_id=$(compose ps -aq "$service_name" 2>/dev/null || true)
  if [ -z "$container_id" ]; then
    say "diagnostic service=$service_name state=missing"
    return 0
  fi
  case "$container_id" in
    *[!0-9a-f]*|'')
      say "diagnostic service=$service_name state=invalid-container-id"
      return 0
      ;;
  esac
  state=$(docker inspect "$container_id" --format '{{.State.Status}}|{{.State.ExitCode}}|{{.State.OOMKilled}}|{{.State.Restarting}}' 2>/dev/null || true)
  health=$(docker inspect "$container_id" --format '{{if .State.Health}}{{.State.Health.Status}}|{{.State.Health.FailingStreak}}{{else}}none|0{{end}}' 2>/dev/null || true)
  case "$state" in
    *[!A-Za-z0-9_.:|-]*|'') state=invalid ;;
  esac
  case "$health" in
    *[!A-Za-z0-9_.:|-]*|'') health=invalid ;;
  esac
  say "diagnostic service=$service_name container=$container_id state=$state health=$health"
}

diagnose_application_startup_failure() {
  say 'diagnostic phase=application-startup-failure'
  for service_name in postgres redis keycloak object-storage caddy frontend api worker; do
    diagnose_service_state "$service_name"
  done
}

# Activation re-reads the target database. A caller-provided ledger is never a
# trust input; migrate.sh may have written one as post-run evidence only.
POST_STATUS=$(read_status) || die "activation requires a clean target migration status"

compose --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d postgres redis keycloak object-storage >/dev/null || die "private prerequisite startup failed"
KEYCLOAK_ID=$(compose ps -q keycloak 2>/dev/null || true); [ -n "$KEYCLOAK_ID" ] || die "Keycloak prerequisite is not running"
[ "$(docker inspect "$KEYCLOAK_ID" --format '{{.State.Health.Status}}' 2>/dev/null || true)" = healthy ] || die "Keycloak prerequisite is not healthy"
compose --profile infra --profile keycloak-bootstrap run --pull never --rm --no-deps keycloak-bootstrap >/dev/null || die "Keycloak bootstrap reconcile failed"
compose --profile seed run --pull never --rm --no-deps synthetic-seed >/dev/null || die "synthetic seed failed"
compose --profile infra --profile keycloak-bootstrap --profile identity-binder run --pull never --rm --no-deps identity-binder >/dev/null || die "identity binder failed"
compose --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d postgres redis keycloak object-storage caddy frontend api worker >/dev/null || { diagnose_application_startup_failure; die "application service startup failed"; }
check_service() { service=$1; id=$(compose ps -q "$service" 2>/dev/null || true); [ -n "$id" ] || die "activated service is not running: $service"; labels=$(docker inspect "$id" --format '{{index .Config.Labels "com.hr-axis.project"}}|{{index .Config.Labels "com.hr-axis.release-id"}}|{{index .Config.Labels "com.hr-axis.data-class"}}|{{.State.Health.Status}}' 2>/dev/null || true); [ "$labels" = "$TARGET_PROJECT|$RELEASE_ID|synthetic|healthy" ] || die "activated service labels/health mismatch: $service"; }
for service in postgres redis keycloak object-storage caddy frontend api worker; do check_service "$service"; done
say "PASS project=$TARGET_PROJECT release=$RELEASE_ID activation=synthetic"
