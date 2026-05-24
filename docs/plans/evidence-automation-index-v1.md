# Evidence Automation Index V1

Status: active_index
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, release operator, pilot moderator, or engineer choosing which
  verification command proves a claim.

After reading, they should know the right command for common evidence classes,
which inputs are required, and which claims remain blocked when real tokens,
provider panels, or restore targets are missing.

## Sokrates Decision

Claim:

- Evidence commands are now repeated often enough that the project benefits
  from a small index.

Assumptions:

- Controlled pilot is the active operating mode.
- UI/content redesign remains parked.
- Provider-backed and protected-user evidence must not be faked.

Repo evidence:

- `package.json`, `admin-web/package.json`, and `backend/nestjs/package.json`
  expose repeatable release, smoke, script-test, API, frontend, and backend
  gates.
- `docs/plans/runbook-registry-v1.md` already maps operator runbooks.
- `docs/plans/p3-operating-triggers-v1.md` says evidence automation should open
  only after repeated evidence-command use or command confusion.

Counterargument:

- More docs can become shelf noise. This index is useful only if it maps
  commands to claims and blockers, not if it repeats every runbook.

Decision:

- Add this as a command-to-claim index.
- Do not convert local or mock checks into provider, protected-user, production, or restore proof.
- Keep detailed steps in the linked runbooks.

## Command Matrix

| Evidence class | Command | Required input | Proves | Does not prove |
| --- | --- | --- | --- | --- |
| Docs-only hygiene | `git diff --check` | Current branch diff | No whitespace/error marker issues in tracked diff | Runtime behavior, provider delivery, protected auth |
| Root script contracts | `npm.cmd run test:scripts` | Repository source | Docs/contracts/generator guards pass | Browser UI, backend Jest, provider delivery |
| Release gate wrapper | `npm.cmd run check:release` | Clean local install | Root script contracts plus release checker | Vercel/Render deploy, protected persona evidence |
| System flow refresh | `npm.cmd run system-flow:generate` then `node --test scripts/system-flow-generator-contract.test.mjs` | Current repo source | Flow JSON/HTML matches source-derived routes/API/backend map | Live traffic, auth runtime, API latency |
| Frontend static gate | `npm.cmd --prefix admin-web run lint` and `npm.cmd --prefix admin-web run build` | Frontend source | Type/lint/build health | Playwright behavior, backend contracts |
| Frontend script contracts | `npm.cmd --prefix admin-web run test:scripts` | Frontend scripts and fixtures | Admin-web local script contracts pass | Full browser routes or production deploy |
| Frontend browser gate | `npm.cmd --prefix admin-web run test:e2e -- <spec>` | Local app/test setup | Targeted Playwright behavior for scoped route/spec | Provider panel delivery, unrelated routes |
| Frontend pilot smoke | `npm.cmd --prefix admin-web run smoke:pilot` | Local app/test setup | Pilot route/API-contract smoke subset | Live staging, protected Clerk session |
| API contract generation | `npm.cmd --prefix backend/nestjs run openapi:generate` then `npm.cmd --prefix admin-web run api:generate` and `npm.cmd --prefix admin-web run api:check` | Backend buildable OpenAPI source | OpenAPI and generated frontend client/types are current | Response behavior unless paired with tests |
| Backend targeted tests | `npm.cmd --prefix backend/nestjs run test -- <pattern> --runInBand` | Backend source | Targeted Jest coverage for selected backend behavior | Full backend blast radius |
| Backend release gate | `npm.cmd --prefix backend/nestjs run check:release` | Backend source and install | Backend lint, Jest, build, audit | Frontend, Vercel, protected staging |
| Deployed readiness smoke | `npm.cmd run smoke:deployed-readiness` | `READINESS_FRONTEND_URL`, `READINESS_BACKEND_URL`, optional bearer token | Public staging health/security/assets; protected checks only if token is supplied | Protected persona proof without token |
| Backend readiness/load smoke | `npm.cmd run smoke:backend-readiness-load` | Backend URL, optional role-specific tokens | Public backend health/load; protected groups only with matching tokens | Broad production performance if token/profile inputs are missing |
| Public performance baseline | `npm.cmd run perf:public` | Public frontend/backend URLs | Public latency/bundle baseline | Protected route performance |
| Protected performance baseline | `npm.cmd run perf:protected` | Role-specific bearer tokens | Protected route latency when tokens are present | Any protected claim if tokens are absent |
| Alert routing smoke | `npm.cmd run smoke:alert-routing` | Backend URL and optional provider metadata | Health/metadata routing checks and provider metadata shape | Real email/Slack delivery unless provider delivery is observed |
| Fresh migration smoke | `npm.cmd run smoke:migration:fresh-db` | Disposable local DB target | Migrations apply to a fresh disposable DB | Managed Supabase restore/PITR proof |
| Pilot stabilization gate | `npm.cmd run check:pilot-stabilization` | Local frontend test setup | Pilot route-role and release-smoke guard subset | New pilot approval or external provider proof |
| Supabase boundary guard | `npm.cmd run check:supabase-boundary` | Repository source | Frontend does not contain direct Supabase/service-role boundary violations | Supabase backup/restore readiness |

## Blocker Rules

Record a blocker instead of pretending proof exists when:

- a protected route claim needs a bearer token but none is available,
- a provider-delivery claim needs Render, Better Stack, Sentry, email, Slack, or
  another panel proof but only local output exists,
- a restore/PITR claim needs a managed Supabase target but only local migration
  smoke exists,
- a broad-production claim needs owner acceptance and the owner decision is
  missing,
- a command output would include raw tokens, cookies, provider subjects, database URLs, Redis URLs, or private payloads.

## Evidence Output Rules

Evidence notes should include:

1. command name,
2. environment class: local, public staging, protected staging, provider panel,
   restore target, or production,
3. sanitized result,
4. skipped/blocked checks,
5. exact reason skipped checks are not promoted to pass,
6. follow-up owner when external input is required.

Evidence notes must not include:

- raw bearer tokens,
- cookies,
- passwords,
- auth codes,
- provider subjects,
- database URLs,
- Redis URLs,
- private request/response payloads,
- personal data beyond approved role/scope/session facts.

## Update Rule

Add a command here only when:

- it exists in repository scripts or a stable documented runbook,
- it is expected to be reused,
- the evidence class and blockers are clear.

Do not add one-off terminal commands, provider-panel clicks, or speculative
future automation as if they were repeatable project gates.
