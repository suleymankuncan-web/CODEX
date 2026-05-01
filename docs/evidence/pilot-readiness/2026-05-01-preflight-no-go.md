# Pilot Readiness Preflight Evidence - No-Go

## Metadata

- Evidence status: Preflight No-Go.
- Date: 2026-05-01.
- Environment: local planning and evidence-preflight context.
- Commit observed before this note: `e201490e docs: add pilot readiness gate`.
- Related gate: `docs/plans/pilot-readiness-gate-v1.md`.
- Prepared by: Codex.
- Purpose: Record that the pilot gate is intentionally blocked because the required external evidence is not available yet.

This is not pilot approval.

Pilot remains blocked until real external evidence is recorded.

## Preflight Result

Final decision: No-Go.

Reason:

- real staging IdP evidence is missing.
- true baseline master data is missing.
- real KPI import smoke evidence is missing.
- pilot user and scope evidence is missing.

The local codebase release gate can be healthy while the pilot decision remains blocked. This note records that distinction.

## Evidence Sources Checked

Referenced required sources:

- `docs/plans/pilot-readiness-gate-v1.md`
- `docs/plans/phase-7-staging-auth-smoke-runbook.md`
- `docs/plans/phase-7-auth-evidence-template.md`
- `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`
- `docs/plans/excel-kpi-import-operator-runbook.md`
- `docs/plans/import-decision-evidence-v1.md`

Local shell preflight:

- `AUTH_SMOKE_*` environment variables were not present in the current shell.
- Staging frontend URL was not available in the current shell.
- Staging API URL was not available in the current shell.
- Staging provider issuer and JWKS URL were not available in the current shell.
- Seeded assigned and unassigned store IDs were not available in the current shell.

Master-data preflight:

- True pilot store/personnel baseline files are not recorded as available in this evidence note.
- KPI snapshot files must not be used as baseline master-data proof.
- Master-data promotion remains closed until the pilot smoke runbook is executed with a scoped true baseline.

KPI import preflight:

- Real pilot KPI import smoke evidence is not recorded in this note.
- No import batch id is recorded.
- No reconciliation evidence is recorded.

## Commands Not Run

The following commands were not run because their required external inputs are unavailable:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging
npm.cmd run smoke:auth:staging:action
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

## Safety Boundaries

- No production data was touched.
- No `ops.*` table was manually edited.
- No master-data promotion was run.
- No KPI import was run.
- No staging auth smoke was claimed as passed.
- No pilot user scope was widened.
- No JSON/source adapter work was opened.

No raw bearer token, id token, refresh token, authorization code, PKCE verifier, cookie, password, TC/national id, or private data is recorded here.

## Release Verification For This Evidence Note

- Targeted contract: `node --test scripts\pilot-evidence-preflight-contract.test.mjs` passed, 4/4.
- Root script guard: `node --test scripts\*.test.mjs` passed, 117/117.
- Root release gate: `npm.cmd run check:release` passed.
- Backend release check: 89/89 suites and 486/486 tests passed.
- Frontend Playwright: 47/47 tests passed.
- Production audit: 0 vulnerabilities.

## What Would Change This Decision

Move from No-Go to evidence collection only when these inputs exist:

- staging frontend URL,
- staging API URL,
- staging provider issuer and JWKS URL,
- staging smoke user through an approved secret channel,
- seeded assigned and unassigned store IDs,
- true scoped store/personnel baseline files with official codes,
- real pilot KPI file and approved pilot scope.

Move from evidence collection to Go only after the gate records passing staging auth, baseline, KPI import, user/scope, and release evidence.

## CODEX DURUST YORUM

This is the right kind of stop.

The project is not failing because this note says No-Go. The opposite is true: the pilot gate is working because it refuses to turn missing staging/data evidence into confidence. We can keep hardening the existing path, but we should not tell ourselves the pilot is approved until real-world auth, master data, KPI import, and user scope evidence exist.

## Next Logical Step

If staging IdP values arrive first, run `docs/plans/phase-7-staging-auth-smoke-runbook.md`.

If true baseline files arrive first, run `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`.

If neither is available, continue only with small guards that reduce risk in an already planned pilot path.
