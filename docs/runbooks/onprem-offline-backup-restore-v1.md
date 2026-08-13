# ONP-5 Offline Backup and Restore V1

This runbook is a synthetic, non-DR rehearsal for the signed offline release.
It does not establish a production recovery point/objective, an independent
failure domain, or permission to overwrite an active environment.

## Trust and external gates

The release owner supplies the exact bundle, an out-of-band Ed25519 trust
anchor, and a self-contained bootstrap verifier plus its SHA-256 digest through
an independent approved channel. IT supplies the approved backup destination, encryption and retention
policy, storage capacity, restore operator, maintenance window, TLS/CA trust,
secret provisioning and rotation procedure, and host firewall/egress policy.
The backup target must be disposable and distinct from the active project.
Two directories on one physical disk are not disaster recovery. Production
restore, company data, real photos, and live provider credentials remain
external owner/IT gates.

The approved env, release and backup trust material, secret trees, photo
fixture, receipt parent, ledger parent, and backup destination must all live
under fresh root-owned `0700` roots whose complete canonical ancestor chains
are root-owned and non-group/world-writable. Chowning only a leaf below
`/tmp`, a home directory, removable media, or an operator-writable drop path
does not satisfy this boundary. Preflight and backup reject such paths before
writer quiescence, image import, dump creation, or Compose mutation.

Every backup, restore, upgrade, and rollback rehearsal uses the signed Compose
order `deployment/compose.yaml`, `deployment/compose.photo-proof.yaml`,
`deployment/photo-compose.yaml`, with `deployment/restore.compose.yaml` last
for disposable targets. Synthetic proof rehearsals also pass the signed
`deployment/proof.compose.yaml` with `--proof-compose` before the restore
overlay so no target service publishes a host port. Both synthetic-account flags must be explicitly true
and the separate photo-proof credential must remain an external root-owned
secret; otherwise preflight stops before mutation.

Before any verifier, backup, restore, or other operation script is invoked,
seal the delivered bundle. Removable or user-writable media is input only:
never execute, source, or run Node/Docker/Compose from it. Use a fresh exact
root-owned 0700 target under the host's root-owned `/var/lib` delivery tree:

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

Reject a pre-existing or symlinked target and stop on any copy, ownership, or
mode failure. Invoke the verifier and preflight only with the absolute sealed
root; preflight re-checks every existing ancestor, exact bundle directory, and
signed file for real/regular type, root ownership, non-group/world-writable
modes, single-link identity, and required executable bits. It checks image
archives by metadata and signed digest without reading a tar into memory.

Before any bundled verifier or operation is invoked, authenticate the bootstrap
tool with trusted OS `sha256sum`, then authenticate the sealed bundle with that
external tool:

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
  --bundle-dir "$SEALED_ROOT" --release-id "$RELEASE_ID" \
  --public-key "$TRUSTED_PUBLIC_KEY" \
  --trusted-fingerprint "$RELEASE_KEY_FINGERPRINT"
```

The bootstrap verifier must never be loaded from the delivered bundle. Only
its fresh root-owned protected copy is hashed and executed; the external key's
fingerprint remains independently pinned. Because
the sealed root is `root:root` mode `0700`, all later operation invocations use
`sudo` and absolute paths.

## Backup

1. Verify the current sealed signed bundle and run
   `sudo "$SEALED_ROOT/operations/preflight.sh"` with `--bundle-root
   "$SEALED_ROOT"`.
2. Confirm the Compose project and release labels identify the intended
   synthetic environment; stop on any collision or unrelated container/volume.
3. After smoke and before quiescing writers, create the one pre-backup photo and
   its raw recovery handle through the protected private-network proof:

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

   The raw handle is root-owned `0600` evidence input and is never a receipt,
   artifact, upload, or log. Do not copy it into the sanitized receipt tree.
4. Run `sudo "$SEALED_ROOT/operations/backup.sh"` with the sealed bundle root, release ID,
   target project, public key, trusted fingerprint, external env file, and an
   owner-controlled signing key, including
   `--photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE"`. The script writes an atomic backup directory,
   per-component hashes, an inventory, and a signed `backup-signature.json`.
5. Store the encrypted backup outside the active data volumes. Receipts must
   contain aggregate counts/digests only; never retain passwords, TLS private
   keys, tokens, raw object keys, or business payloads.

## Disposable restore rehearsal

1. Confirm the restore project name and every target volume are disposable and
   do not already belong to an active or unrelated project.
2. Verify the backup signature and all component hashes before starting any
   Compose mutation.
3. Run `sudo "$SEALED_ROOT/operations/restore.sh"` against the explicitly named restore target with
   `--photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE"`.
   It restores PostgreSQL and Keycloak state, Redis persistence, bootstrap
   state, and the object-storage data required by the synthetic proof; it does
   not pull images or overwrite the active project.
4. Run the migration/readiness and authorization smoke checks against the
   restored project. Confirm migration checksum/ledger state, synthetic
   Keycloak login, assigned/unassigned authorization, queue startup, health,
   and object byte/hash verification. Keep only a sanitized restore receipt.
5. Stop and remove only the named disposable restore project/volumes after
   the receipt is copied to the approved evidence location.

## Upgrade and rollback rehearsals

Use the same unmodified raw handle for the backup source and every derived
recovery operation. Run `sudo "$SEALED_ROOT/operations/upgrade.sh"` with
`--photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE"`; run
`sudo "$SEALED_ROOT/operations/rollback.sh"` with
`--photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE"`. Each operation must
recover the pre-backup photo and match the signed handle SHA-256, canonical
content SHA-256, and byte length before it may publish a passed receipt.

Never edit or regenerate the handle after backup. Retain it only inside the
root-private operator tree for the approved recovery evidence window. Delete
`$PHOTO_RECOVERY_HANDLE` only after the approved restore, upgrade, and rollback
rehearsals and their sanitized receipts are complete; use an exact-path trusted
OS deletion and verify the pathname is absent. The raw handle is never a
receipt, artifact, upload, or log and must not enter support evidence.

Any signature, digest, target identity, certificate, secret permission,
migration, health, authorization, or storage mismatch is No-Go. Never repair a
failed restore by editing receipts or changing database state. If an upgrade
has no compatible rollback path, select forward repair or a separately
approved database restore and retain the previous signed release.

CI receipts produced from relabeled copies of one source revision are scoped
to `same-build-lifecycle-mechanics` and cannot be promoted to real upgrade or
rollback acceptance. A real transition claim requires independently produced
and signed prior/current/candidate bundles with distinct release provenance,
plus an exercised incompatible-migration decision (forward repair or approved
database restore).

## Recovery posture

This rehearsal demonstrates offline mechanics only. It does not prove an
independent backup failure domain, provider restore, RPO/RTO, host restart
readiness, or production continuity. Those claims require a separately
approved IT evidence package and a recurring restore schedule.
