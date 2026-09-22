# Strict-local company data mode V1

Owner authorization: 7 September 2026 — create a separate company, replace
the demo dataset and enable real store master data on the private server.

## Runtime contract

The base Compose and synthetic proof paths retain their synthetic defaults.
Company runtime requires the explicit combination `HR_AXIS_STRICT_LOCAL=true`,
`HR_AXIS_DATA_CLASS=company`, and `HR_AXIS_COMPANY_DATA_ENABLED=true`.
Use `infra/onprem/core/compose.company-data.yaml` as the final overlay from the
repository, or the signed `deployment/compose.company-data.yaml` copy from the
offline bundle.
All services, networks and volumes carry the company data-class label. Deploy
into a distinct project with fresh company-labeled volumes and non-overlapping
networks; existing synthetic volume labels are immutable and must not be reused.
This keeps company storage outside synthetic cleanup eligibility.
An opt-in with a synthetic/unknown class or with strict-local disabled fails.

Company API/worker processes require local OIDC JWKS and browser cookie sessions.
On same-origin cookie reload, a persisted non-secret cache key triggers CSRF
recovery from the signed cookie. Shell readiness still requires the recovered
in-memory nonce and fresh server authorization. Rejected cookies stay signed
out; cancelled or superseded recovery cannot overwrite a new session.
Known HR Axis admin SPA deep links are routed only to the frontend before the
Keycloak admin deny rule; `/admin/realms` and `/admin/master/console` remain 404.
Existing verified PostgreSQL TLS, file-backed credentials, Redis queue and rate
limits, local provider allowlists, mock-auth denial, container hardening and
network restrictions still apply. Migrators require their existing DB-only
credential/TLS contract. This change does not add a provider HTTP client,
automatic daily pull, scoring projection or external telemetry.

Synthetic seed and identity-binder processes reject company mode. The overlay
also sets the Keycloak synthetic bootstrap's data class to company so its
existing synthetic-only guard rejects accidental execution. Synthetic media
and photo-proof activation are disallowed. Company accounts must be provisioned
and bound independently, without inventing employee hire dates or granting
regional-manager access from a name alone.

The synthetic seed additionally locks the company table and rejects any company
outside the fixed synthetic identity before executing seed SQL. Thus stale
synthetic process settings cannot repopulate a company database after its
connection file has changed. This guard does not delete or modify company data.

## Dataset replacement procedure

1. Preserve a private backup of the original application and identity databases,
   secrets/configuration and relevant runtime state. Verify restore separately.
2. Create an empty company database with existing restricted migrator/API/worker
   roles and default grants. Apply the complete canonical migration tree without
   either synthetic seed. Verify ledger/checksums and restricted runtime roles.
3. Populate only the owner-provided company, store codes/types and approved
   grouping. Retain no demo employees, business observations, scores, targets or
   fabricated operational history. Keep personal/company data outside Git.
4. Provision a new operator identity using the owner-provided email and a private
   generated credential. Bind its application account to the new company and
   verify OIDC login, company scope and store administration before removing old
   demo access. Manager names in the source list do not create login accounts.
5. Stop application writers for final backup/cutover, switch the file-backed DB
   connections and activate the explicit company overlay using verified images.
   Prevent stale synthetic queue/session state from crossing the cutover.
6. Verify the exact store count/codes/types, absence of demo business data,
   authentication and access denial, health/readiness and frontend readback.
   Retire the old demo database/identities only after successful replacement and
   a retained restore path. Do not use `down -v` or unbounded cascading cleanup.

These are execution requirements, not a claim that a particular deployment has
completed. Private deployment receipts own the actual target and result.

## Recovery and verification

If company startup or validation fails, stop writers and restore the previous
image/configuration/database and identity state as one consistent set. Never
relax strict-local controls to make a failed company deployment start.

Test both successful explicit opt-in and denied default/contradictory inputs;
exercise verified TLS, file-only secrets, provider and mock-auth restrictions,
cookie/JWKS requirements, and synthetic-seed/binder rejection. Before deployment,
run the canonical release gate and a separate company-database/login rehearsal.
