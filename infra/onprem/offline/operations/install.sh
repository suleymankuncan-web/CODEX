#!/bin/sh
set -eu

# ONP-5 install is intentionally one-way only after all signed material has
# been checked.  It never builds, pulls, fetches, or deletes Docker data.

die() { printf '%s\n' "install: FAIL: $*" >&2; exit 1; }
say() { printf '%s\n' "install: $*"; }
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
    --help) printf '%s\n' 'usage: install.sh --bundle-root ROOT --release-id ID --target-project PROJECT --public-key PEM --trusted-fingerprint HEX64 --env-file PATH'; exit 0 ;;
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

# Signature and all static host checks precede the first Docker mutator.
node "$VERIFIER" verify --bundle-dir "$BUNDLE_ROOT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" >/dev/null 2>&1 || die "bundle signature/digest verification failed"
run_preflight() {
  if [ -n "$PROOF_COMPOSE" ]; then
    "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --proof-compose "$PROOF_COMPOSE" --allow-unloaded-images --allow-missing-ledger
  else
    "$BUNDLE_ROOT/operations/preflight.sh" --bundle-root "$BUNDLE_ROOT" --release-id "$RELEASE_ID" --target-project "$TARGET_PROJECT" --public-key "$PUBLIC_KEY" --trusted-fingerprint "$TRUSTED_FINGERPRINT" --env-file "$ENV_FILE" --allow-unloaded-images --allow-missing-ledger
  fi
}
run_preflight >/dev/null || die "preflight failed"

CORE_COMPOSE="$BUNDLE_ROOT/deployment/compose.yaml"
PHOTO_PROOF_COMPOSE="$BUNDLE_ROOT/deployment/compose.photo-proof.yaml"
PHOTO_COMPOSE="$BUNDLE_ROOT/deployment/photo-compose.yaml"
[ -f "$CORE_COMPOSE" ] || die "bundled core Compose file is missing"
[ -f "$PHOTO_PROOF_COMPOSE" ] || die "bundled photo-proof Compose overlay is missing"
[ -f "$PHOTO_COMPOSE" ] || die "bundled photo Compose file is missing"
MANIFEST="$BUNDLE_ROOT/bundle-manifest.json"
[ -f "$MANIFEST" ] || die "signed bundle manifest is missing"

IMAGE_LINES=$(node - "$MANIFEST" <<'NODE'
const fs = require('node:fs')
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const names = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
if (!manifest.images || Object.keys(manifest.images).length !== names.length) process.exit(41)
for (const name of names) {
  const image = manifest.images[name]
  const required = ['archive', 'archiveSha256', 'configImageId', 'name', 'registryDigestAttestedByOwner', 'repoTag']
  if (!image || Object.keys(image).some((key) => ![...required, 'registryManifestDigest'].includes(key)) || required.some((key) => !(key in image))) process.exit(42)
  if (image.name !== name || !/^sha256:[0-9a-f]{64}$/.test(image.configImageId) || !/^[0-9a-f]{64}$/.test(image.archiveSha256) || typeof image.repoTag !== 'string' || !image.repoTag.includes(':')) process.exit(43)
  process.stdout.write(`${name}|${image.archive}|${image.configImageId}\n`)
}
NODE
) || die "signed image manifest is invalid"

image_count=0
for image_record in $IMAGE_LINES; do
  image_count=$((image_count + 1))
  image_name=$(printf '%s' "$image_record" | cut -d'|' -f1)
  image_archive=$(printf '%s' "$image_record" | cut -d'|' -f2)
  expected_image_id=$(printf '%s' "$image_record" | cut -d'|' -f3)
  archive_path="$BUNDLE_ROOT/$image_archive"
  [ -f "$archive_path" ] && [ ! -L "$archive_path" ] || die "exact image archive is missing: $image_name"

  # docker load is the first permitted mutator.  It is followed immediately by
  # an immutable ID check; Compose is not touched until all seven archives have
  # passed. Registry digest attestation remains in the signed bundle manifest;
  # docker load is not required to restore RepoDigests locally.
  docker load -i "$archive_path" >/dev/null || die "docker load failed for $image_name"
  actual_image_id=$(docker image inspect --format '{{.Id}}' "$expected_image_id" 2>/dev/null || true)
  [ "$actual_image_id" = "$expected_image_id" ] || die "loaded image id mismatch for $image_name"
done
[ "$image_count" -eq 7 ] || die "exactly seven manifest image archives are required"

# Re-render config after imports and reject any accidental secret interpolation
# before Compose creates a network, volume, or container.
compose() {
  if [ -n "$PROOF_COMPOSE" ]; then
    docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" --file "$PROOF_COMPOSE" "$@"
  else
    docker compose --project-name "$TARGET_PROJECT" --env-file "$ENV_FILE" --file "$CORE_COMPOSE" --file "$PHOTO_PROOF_COMPOSE" --file "$PHOTO_COMPOSE" "$@"
  fi
}
CONFIG=$(compose --profile '*' config --format json 2>/dev/null) || die "Compose config rendering failed after image import"
case "$CONFIG" in *"$TARGET_PROJECT"*"$RELEASE_ID"*|*"$RELEASE_ID"*"$TARGET_PROJECT"*) ;; *) die "Compose project/release identity mismatch" ;; esac


# Install only imports immutable images and starts the private prerequisites.
# Database migration and application activation are separate operations.
compose --profile infra --profile runtime up --pull never -d postgres redis keycloak object-storage >/dev/null || die "private prerequisite startup failed"

say "PASS project=$TARGET_PROJECT release=$RELEASE_ID images=$image_count migration=separate-migrate.sh"
