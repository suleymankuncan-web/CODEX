# ONP-5 Offline Install V1

This runbook describes a synthetic-data rehearsal of an HR Axis offline
release. It is not a production approval, disaster-recovery claim, or source
delivery mechanism. The signed bundle is built in the owner-controlled build
environment; the install host receives only images, deployment material,
audited operation tools, sanitized evidence, and these runbooks.

## Before the host is touched

The release owner must provide the exact bundle directory, the owner-trusted
Ed25519 public key and its out-of-band SHA-256 fingerprint, and an approved
release ID. The owner must also provide the self-contained bootstrap verifier
in an independently trusted host path and its SHA-256 digest through a separate
approved channel. Treat downloaded or removable media as untrusted input. Do not
execute, source, `cd` into, or run Node/Docker/Compose against that media.
Copy it once into a fresh sealed path using only trusted OS tools:

```sh
SOURCE=/media/operator/hr-axis-release
SEAL_PARENT=/var/lib/hr-axis/releases
BOOTSTRAP_PARENT=/var/lib/hr-axis/bootstrap-tools
RELEASE_ID=approved-release-id
SEALED_ROOT="$SEAL_PARENT/$RELEASE_ID"
BOOTSTRAP_ROOT="$BOOTSTRAP_PARENT/$RELEASE_ID"

require_root_private_ancestors() {
  current=$1
  while :; do
    sudo test -d "$current" && sudo test ! -L "$current" || exit 1
    sudo find -P "$current" -maxdepth 0 -type d -uid 0 ! -perm /022 -print -quit |
      grep -Fx "$current" >/dev/null || exit 1
    test "$current" = / && break
    current=$(dirname -- "$current") || exit 1
  done
}

require_root_private_ancestors "$SEAL_PARENT"
require_root_private_ancestors "$BOOTSTRAP_PARENT"
sudo test ! -e "$SEALED_ROOT" && sudo test ! -L "$SEALED_ROOT" || exit 1
sudo test ! -e "$BOOTSTRAP_ROOT" && sudo test ! -L "$BOOTSTRAP_ROOT" || exit 1
sudo install -d -o root -g root -m 0700 "$SEALED_ROOT"
sudo cp -a --no-preserve=ownership "$SOURCE/." "$SEALED_ROOT/"
sudo chown -R root:root "$SEALED_ROOT"
sudo find "$SEALED_ROOT" -type d -exec chmod go-w {} +
sudo find "$SEALED_ROOT" -type f -exec chmod go-w {} +
sudo chmod 0700 "$SEALED_ROOT"
require_root_private_ancestors "$SEALED_ROOT"
```

The target must be absent before copying; reject a pre-existing or symlinked
target and stop if any copy or ownership/mode command fails. The sealed root
must remain under the root-owned `/var/lib` delivery tree. Never operate
directly from removable or user-writable media. All later commands use the
absolute sealed path; the verifier and preflight also re-check every existing
ancestor, exact bundle-tree directory, and signed file for real-directory or
regular-file type, root ownership, non-group/world-writable modes, single-link
identity, and required executable bits. Image archives are checked by metadata
and signed digest; preflight does not read an image tar into memory.

Verify the independently provisioned bootstrap verifier with trusted OS tools,
then use it to authenticate the exact sealed bundle before any bundled code or
image is used:

```sh
BOOTSTRAP_SOURCE=/approved-delivery/onprem-offline-bootstrap-verify.mjs
PUBLIC_KEY_SOURCE=/approved-delivery/release-public.pem
TRUSTED_BOOTSTRAP="$BOOTSTRAP_ROOT/onprem-offline-bootstrap-verify.mjs"
TRUSTED_PUBLIC_KEY="$BOOTSTRAP_ROOT/release-public.pem"
BOOTSTRAP_SHA256=owner-approved-lowercase-sha256

sudo install -d -o root -g root -m 0700 "$BOOTSTRAP_ROOT"
sudo install -o root -g root -m 0500 "$BOOTSTRAP_SOURCE" "$TRUSTED_BOOTSTRAP"
sudo install -o root -g root -m 0400 "$PUBLIC_KEY_SOURCE" "$TRUSTED_PUBLIC_KEY"
require_root_private_ancestors "$BOOTSTRAP_ROOT"
test "$(sudo sha256sum "$TRUSTED_BOOTSTRAP" | awk '{print $1}')" = "$BOOTSTRAP_SHA256" || exit 1
sudo node "$TRUSTED_BOOTSTRAP" verify \
  --bundle-dir "$SEALED_ROOT" \
  --release-id "$RELEASE_ID" \
  --public-key "$TRUSTED_PUBLIC_KEY" \
  --trusted-fingerprint "$RELEASE_KEY_FINGERPRINT"
```

The bootstrap verifier is not copied from, imported from, or executed out of
the delivered bundle. Its source may be delivery input, but only the fresh,
root-owned protected copy is hashed and executed; its trust-key fingerprint is
still checked against the independent owner value. Only after it succeeds may the authenticated bundled
verifier and operation scripts run. Do not continue when verification fails, a digest is unexpected, the bundle
contains an extra path, or the release ID does not match the approved change
record. The host must be a supported Linux machine with Docker Engine and the
Compose plugin already installed. No network access, repository checkout,
package install, image pull, or build is part of installation.

## External gates

IT must separately approve the Linux host, private DNS name, firewall and
egress policy, TLS certificate/CA delivery, storage capacity, secret-file
creation and rotation, service account ownership, and backup destination. The
operator first creates a fresh root-owned `0700` operator-input root below a
root-owned, non-group/world-writable `/var/lib/hr-axis` ancestor, then copies
the approved env, release key, migration-ledger parent, photo fixture, and both
secret trees into that root using trusted OS tools. Every path component must
be canonical, non-symlinked, root-owned, and non-group/world-writable; passing
an env or secret path below `/tmp`, a home directory, removable media, or an
operator-writable drop directory is a pre-mutation failure. Secret files use
mode `0600` (public certificates may use `0644` inside the protected root); secret
values, private keys, certificates, and real account data never enter the
bundle, logs, receipts, or support artifacts. A certificate that is missing,
expired, or not trusted by the intended clients is a stop condition.

## Synthetic installation sequence

Use one approved release ID, image digest set, public-key fingerprint, and
environment file for every command below. The sequence is intentionally
ordered: prerequisites first, one explicit migration, then activation and
smoke verification.

The signed deployment closure includes `deployment/compose.yaml`, then the
opt-in `deployment/compose.photo-proof.yaml`, then
`deployment/photo-compose.yaml` in that exact order. This synthetic rehearsal
also passes the signed `deployment/proof.compose.yaml` through each operation's
`--proof-compose` option so no service publishes a host port. The external environment
must explicitly set both `KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true` and
`KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true`, and the separate root-owned
photo-proof account file must exist below `HR_AXIS_SECRET_ROOT`. Omitting the
overlay, either flag, or that separate credential is a pre-mutation failure.

1. Run `sudo "$SEALED_ROOT/operations/preflight.sh"` with `--bundle-root
   "$SEALED_ROOT"`, the approved release ID, target Compose project, public
   key, fingerprint, and external env file.
2. Run `sudo "$SEALED_ROOT/operations/install.sh"` with the same
   `--bundle-root "$SEALED_ROOT"`. It verifies the signed bundle, loads all seven
   pinned image archives without pulling, and starts the private prerequisites:
   PostgreSQL, Redis, Keycloak, and the local object-storage service. Wait for
   their health checks before continuing.
3. Run `sudo "$SEALED_ROOT/operations/migrate.sh"` exactly once for this signed release digest.
   It invokes only the explicit migrator profile; application startup must not
   perform an implicit schema migration. Confirm its migration ledger digest
   matches the signed `evidence/migration-compatibility.json` receipt.
4. Run `sudo "$SEALED_ROOT/operations/activate.sh"` with the same release ID and trust arguments.
   Activation re-verifies the bundle and ledger, then runs the Keycloak
   bootstrap reconcile, identity binder, and synthetic seed in that order. It
   finally starts the runtime/public services (PostgreSQL, Redis, Keycloak,
   object storage, Caddy, frontend, API, and worker) and checks their signed
   project/release/data-class labels and health.
5. Run `sudo "$SEALED_ROOT/operations/smoke.sh"` and retain only its sanitized synthetic receipt.
   The Keycloak proof uses the five synthetic personas and does not create or
   migrate real users.

## Prepare the pre-backup photo recovery handle

After smoke succeeds and before the first backup, create one canonical
synthetic photo through the protected Keycloak/HTTP path. The handle must be
absent before preparation and must live below the same canonical root-owned
`0700` operator-input tree used by the env and secret files:

```sh
OPERATOR_ROOT=/var/lib/hr-axis/operator-inputs/$RELEASE_ID
PHOTO_RECOVERY_HANDLE="$OPERATOR_ROOT/photo-recovery.json"
PHOTO_PREPARE_RECEIPT=/var/lib/hr-axis/receipts/$RELEASE_ID/photo-prebackup.json

require_root_private_ancestors "$OPERATOR_ROOT"
sudo test ! -e "$PHOTO_RECOVERY_HANDLE" && sudo test ! -L "$PHOTO_RECOVERY_HANDLE" || exit 1
sudo node "$SEALED_ROOT/operations/onprem-offline-target-proof.mjs" \
  --execute --require-complete \
  --compose "$SEALED_ROOT/deployment/compose.yaml" \
  --compose "$SEALED_ROOT/deployment/compose.photo-proof.yaml" \
  --compose "$SEALED_ROOT/deployment/photo-compose.yaml" \
  --compose "$SEALED_ROOT/deployment/proof.compose.yaml" \
  --env-file "$ENV_FILE" --project "$TARGET_PROJECT" --release-id "$RELEASE_ID" \
  --host "$HR_AXIS_PUBLIC_HOST" \
  --accounts-file "$HR_AXIS_SECRET_ROOT/keycloak/synthetic-accounts" \
  --photo-account-file "$HR_AXIS_SECRET_ROOT/keycloak/photo-proof-account" \
  --ca-file "$HR_AXIS_SECRET_ROOT/caddy/ca.crt" \
  --photo-auth-image "$BACKEND_CONFIG_IMAGE_ID" \
  --photo-fixture "$PHOTO_FIXTURE" --photo-sha256 "$PHOTO_FIXTURE_SHA256" \
  --photo-mode prepare \
  --photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE" \
  --receipt "$PHOTO_PREPARE_RECEIPT"
test "$(sudo stat -c '%u:%a:%h' "$PHOTO_RECOVERY_HANDLE")" = "0:600:1" || exit 1
```

`BACKEND_CONFIG_IMAGE_ID` is the exact `sha256:` config image ID from the
authenticated bundle manifest; the other values come from the sealed operator
inputs. The raw handle contains the synthetic media identity. It is root-owned
`0600` evidence input and is never a receipt, artifact, upload, or log. Keep it
only for the matching backup/restore/upgrade/rollback rehearsal and follow the
retention and deletion rules in the backup/restore runbook.

The operation scripts are fail-closed and idempotence is conditional: a
non-matching project, release, image ID, migration ledger, certificate,
secret permission, or runtime identity stops before mutation. Do not use
destructive Compose volume flags or remove an unverified project.

## Decision and rollback

Record Go, Conditional Go, or No-Go with the release ID and digest references;
never record credentials or private user data. A failed rehearsal remains
No-Go. Rollback uses the previously signed bundle and the separate rollback
script only after migration compatibility is verified. If compatibility is
false, use forward repair or a separately approved database restore; do not
pretend that replacing application images reverses a schema change.

The repository workflow may exercise upgrade and rollback command mechanics
with separately signed release IDs that still contain the same source revision,
image IDs, archive hashes, and migration tree. Such receipts are explicitly
`same-build-lifecycle-mechanics`; they are not evidence of a real version
transition or incompatible-migration recovery. Production acceptance requires
independently built current/next/previous bundles and the owner-approved
incompatibility branch on a clean supported Linux host.

This V1 proves only repository/synthetic mechanics. It does not authorize
company-server activation, real data, real photos, hosted-provider retirement,
or broad production.
