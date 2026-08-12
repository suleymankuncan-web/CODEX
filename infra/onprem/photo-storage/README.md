# ONP-4B private synthetic photo storage

Status: conditional synthetic evidence; production activation remains **No-Go**.

This overlay is for an operator or release engineer who needs to verify the
local S3-compatible photo contract without enabling real photos. The action
after reading this page is to run the static contract and, when Docker is
available, the self-contained executable synthetic proof.

## Boundary

The base core Compose model stays storage-disabled. Loading the storage overlay
with the base model keeps one Compose project and adds `object-storage` only on
the internal `data` network. Production publishes no object-storage host port.
The proof-only overlay is separate and maps an ephemeral port only to
`127.0.0.1`; never include that mapping in a production profile. API and worker
browser-facing behavior remains same-origin through the existing application
surface; `http://object-storage:8333` is an internal server endpoint, not a URL
for a browser.

The overlay is synthetic-only: real VM/photo pilot flags and visual-AI enqueue,
advisory, review, and worker flags remain `false`. Hosted R2 is preserved as the
rollback path.

## Pinned engine and hardening

- Image: `chrislusf/seaweedfs:4.41@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d`
  (OCI version `4.41`, revision `de34a1a87c02893507f961cda9574172ee5064e9`,
  Linux `amd64`).
- License: upstream `seaweedfs/seaweedfs@4.41:LICENSE`, Apache-2.0,
  SHA-256 `d789d433cc11da163273d1e39be2e8fa67642f9a58ef220d3f258fa9c14ef613`.
- Runtime: read-only root filesystem, all capabilities dropped except
  `CHOWN`, `SETGID`, and `SETUID`, `no-new-privileges`, bounded CPU/memory/PID
  and log rotation, labelled persistent storage, and `volume.max=32`.
- SeaweedFS telemetry, embedded IAM, directory-data exposure, and recursive
  non-empty bucket deletion are explicitly disabled. The bootstrap writes a
  private S3 config under `/run`, fixes its directory/file ownership and mode,
  clears credential variables, and then invokes the official entrypoint.

## Credentials and buckets

The service reads four Docker secret files: primary access-key ID and secret,
and recovery access-key ID and secret. The identities and bucket names must be
distinct; each identity is scoped to its own `Admin:<bucket>` action. Unsafe
characters, empty values, equal identities, or equal buckets fail closed.
Credentials never belong in Compose YAML, env templates, source, logs, or
receipts.

`secret-files/` under this directory is ignored by Git. Do not add fixture
files. For a production-shaped run, provision the four non-empty values in an
IT/owner-controlled directory and set `PHOTO_STORAGE_SECRET_ROOT` in the
private Compose env file. Use the approved secret ownership, mode, rotation,
and recovery policy; never use the template placeholder or an empty file.
The executable synthetic proof creates temporary credentials outside the
repository and removes them at the end.

## Static verification

Run these checks before Docker execution:

```powershell
npm.cmd run test:onprem:photo-storage
npm.cmd run check:affected-verification
```

The static contract rejects tag-only or wrong-digest images, production host
ports, non-internal networks, missing telemetry/IAM disablement, anonymous or
shared credentials, same buckets, unsafe backup/volume identities, excessive
capabilities, missing resource/read-only controls, and any real-photo or
visual-AI enablement.

## Synthetic runtime proof

The proof creates and uses its own temporary synthetic Compose env, storage
secrets, and binary fixture. It does not consume production env or photo
credentials. It pulls the exact image and writes a sanitized receipt with mode
`0600`:

```sh
sudo node scripts/onprem-photo-storage-runtime-proof.mjs --execute \
  --core-compose infra/onprem/core/compose.yaml \
  --compose infra/onprem/photo-storage/compose.yaml \
  --proof-compose infra/onprem/photo-storage/compose.proof.yaml \
  --project hr-axis-onprem-photo-storage \
  --release-id '<exact-signed-release-id>' \
  --receipt /approved/sanitized-onprem-photo-storage-receipt.json
```

The proof must pass all of these checks:

- exact image/config identity, private service reachability, and no production
  host port;
- primary/recovery authorization, cross-bucket denial, unsigned denial, and
  wrong-credential denial;
- versioning plus per-object 30-day COMPLIANCE retention only for `locked/`
  objects in both primary and recovery; there is no whole-bucket default lock;
- binary-safe byte SHA-256, metadata SHA-256, HEAD/GET/list, and exact
  VersionId observation;
- presigned GET success and expiry denial;
- transient and derived exact-version deletion;
- locked exact `DeleteObject` denial and locked non-empty `DeleteBucket` denial,
  followed by a readable/hash-correct locked version;
- restart preservation; and
- a stopped-volume tar snapshot into a labelled synthetic backup volume,
  restore into a fresh labelled volume, and exact VersionId/hash/lock recovery.

The receipt is evidence, not activation authority. It contains synthetic status
and digest facts but no credentials, raw object keys, or VersionIds. Cleanup
revalidates exact project, release, synthetic data-class, and allowed volume
class labels before removing anything. Do not run the proof cleanup against a
production volume.

## Production stop gates

This overlay does not complete ONP-5 or production recovery. Stop until the
owner and IT provide and verify company-server capacity and storage topology,
a separate backup destination/failure domain, backup frequency/retention/
encryption ownership, accepted RPO/RTO, secret provisioning and rotation, host
firewall/egress/DNS/TLS controls, a named restore operator and recurring restore
drill, Nebim connectivity/credentials, and authorization for real data and
real photos. Two buckets or a
second folder on one disk are not independent disaster recovery. The same-host
labelled backup volume used by this proof is only a synthetic consistency
rehearsal. Keep real-photo, VM-pilot, visual-AI, and hosted-cutover flags off
until those gates are separately accepted.

See the [private core runbook](../../../docs/runbooks/onprem-core-data-plane-v1.md)
and [deployment plan](../../../docs/plans/on-premise-private-container-deployment-plan-v1.md)
for the broader ONP-4/ONP-5 and IT activation boundaries.
