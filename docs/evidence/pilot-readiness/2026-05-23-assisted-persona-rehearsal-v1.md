# Assisted Persona Rehearsal V1 - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding whether the controlled pilot persona route journey remains
  usable after the latest staging deploy.

After reading, they should be able to:

- see which personas were manually exercised in staging,
- distinguish browser route evidence from backend token/load evidence,
- know which issues remain follow-up items rather than blockers.

## Scope

Mode:

- assisted protected browser route rehearsal

Environment:

- frontend staging: `https://staging.hr-axis.com`
- backend staging API: `https://api-staging.hr-axis.com/api`
- repo baseline before evidence: `c8507a89`

This pass records user-observed browser route behavior while signed in as the
active controlled-pilot personas. It does not record passwords, raw tokens,
cookies, full JWTs, provider subject IDs, private IDs, screenshots, direct DB
data, or private personal data.

This pass does not approve broad production, add a module, add a role, change
UI, change API responses, change auth behavior, change DB schema, change
provider configuration, mutate staging data, or claim backend protected load
proof.

## Sokrates Decision

Claim:

- The next useful proof after the autonomous local/public preflight is a
  protected browser route rehearsal with real pilot personas.

Assumptions:

- Controlled pilot remains `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- The browser results were gathered through real staging sign-in as the listed
  personas.
- This is a read-only route rehearsal; Store Action command-mode proof remains
  out of scope.

Evidence:

- All six active pilot personas were checked by route in staging:
  `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`,
  `STORE_PERSONNEL`, and `REPORT_VIEWER`.
- Required positive routes opened for each persona.
- Required forbidden routes showed "Bu rol icin rota kullanilamaz" or the
  equivalent forbidden route state.
- Read-only personas did not see Store Action create/status/close/cancel
  controls.
- No red error, infinite loading state, or blank screen was reported.

Counterargument:

- Browser route proof is not the same as role-specific backend load or direct
  `/auth/session` token smoke. Correct: the earlier preflight keeps protected
  load as a separate token-backed proof class.

Risk:

- LOW for sanitized docs-only evidence.
- MEDIUM for manual browser/session rehearsal.
- HIGH if this were used to claim backend load, provider proof, DB restore
  proof, command mutation proof, or broad production readiness.

Door:

- two-way-door. This rehearsal can be repeated after a deploy, role assignment
  change, or UI/auth routing change.

Stop rule:

- Stop and do not record evidence if the flow requires raw tokens, cookies,
  passwords, auth codes, full JWTs, provider subjects, private IDs, screenshots
  with private data, direct DB edits, or command-mode staging mutation without
  rollback.

## Decision

Assisted protected browser route rehearsal: `Conditional Go / Continue`.

Broad production: `No-Go`.

Reasoning:

- The six active pilot personas can access their intended route families.
- Forbidden admin/import/auth/master-data surfaces fail closed for scoped roles.
- Store Action command controls were not exposed to read-only or personnel
  personas.
- Two observations remain follow-up notes, not blockers:
  - `HR_ADMIN` and `REPORT_VIEWER` first landing appeared to reuse or land on
    a store route in the browser session, but direct route access/forbidden
    checks matched the role expectations.
  - Store Action create/status/close/cancel controls were not observed for
    `STORE_MANAGER`; this read-only rehearsal did not include a named active
    action plan command record or rollback note.

## Persona Results

### SUPER_ADMIN

Account alias:

- `pilot.admin+clerk_test@example.com`

Observed:

- `/admin/integrations`: opened
- `/admin/auth`: opened
- `/admin/session`: opened
- `/store/tasks`: opened
- `/store/tasks`: action plans were visible
- red error, infinite loading, blank screen: not observed

Notes:

- The user did not see a separate resolved-role field on `/admin/session`.
- The `Mock Headerlar` tab showed role codes:
  `SUPER_ADMIN`, `INTEGRATION_ADMIN`, `SNAPSHOT_OPERATOR`, `REPORT_VIEWER`,
  and `AUDITOR`.
- Store Action create/status/close/cancel controls were not observed. This is
  not a blocker in this read-only pass because super-admin Store Action command
  authority still depends on action-store scope.

Result:

- browser route visibility: pass
- command-mode Store Action proof: not claimed

### HR_ADMIN

Account alias:

- `pilot.hr+clerk_test@example.com`

Observed:

- first route: `/store/home`
- `/admin/competitions`: opened
- `/admin/master-data`: opened
- `/admin/checklists`: opened
- `/admin/auth`: forbidden route state
- `/admin/integrations`: forbidden route state
- `/admin/reports`: forbidden route state
- red error, infinite loading, blank screen: not observed

Notes:

- The first route was expected to be `/admin/competitions` in the route matrix,
  but direct route access and forbidden checks matched the HR admin role.
- Treat the first-route observation as a follow-up landing/return-state note,
  not a pilot blocker.

Result:

- browser route visibility: pass with landing follow-up note

### REGION_MANAGER

Account alias:

- `pilot.bm+clerk_test@example.com`

Observed:

- first route: `/store`
- `/admin/targets`: opened
- `/admin/competitions`: opened
- `/store/rankings`: opened
- `/admin/auth`: forbidden route state
- `/admin/master-data`: forbidden route state
- `/admin/integrations`: forbidden route state
- red error, infinite loading, blank screen: not observed

Result:

- browser route visibility: pass

### STORE_MANAGER

Account alias:

- `pilot.sm+clerk_test@example.com`

Observed:

- first route: `/store/home`
- `/store`: opened
- `/store/me`: opened
- `/store/tasks`: opened
- `/store/approvals`: opened
- `/store/kpis`: opened
- `/store/rankings`: opened
- `/admin/auth`: forbidden route state
- `/store/tasks`: action plans were visible
- checklist acknowledgement action was visible
- red error, infinite loading, blank screen: not observed

Notes:

- Store Action create/status/close/cancel controls were not observed.
- The user expected this may be because there was no active/requested Store
  Action command target in the current data state.
- This pass does not claim command-mode Store Action proof.

Result:

- browser route visibility: pass
- command-mode Store Action proof: not claimed

### STORE_PERSONNEL

Account alias:

- `pilot.personel+clerk_test@example.com`

Observed:

- first route: `/store/home`
- `/store`: opened
- `/store/me`: opened
- `/store/rankings`: opened
- `/store/tasks`: opened with no visible information or command controls
- `/store/approvals`: forbidden route state
- `/admin/auth`: forbidden route state
- Store Action create/status/close/cancel controls: not visible
- red error, infinite loading, blank screen: not observed

Result:

- browser route visibility: pass
- command-control absence: pass

### REPORT_VIEWER

Account alias:

- `pilot.report-viewer+clerk_test@example.com`

Observed:

- first route: `/store/me`, showing "Performans yuzeyi kullanilamiyor"
- `/admin/reports`: opened
- `/admin/targets`: opened
- `/admin/inbox`: opened
- `/store/tasks`: opened as read-only
- `/admin/auth`: forbidden route state
- `/admin/master-data`: forbidden route state
- `/admin/integrations`: forbidden route state
- Store Action create/status/close/cancel controls: not visible
- red error, infinite loading, blank screen: not observed

Notes:

- The first route likely came from prior browser return state. Direct allowed
  and forbidden route checks matched the report-viewer expectations.

Result:

- browser route visibility: pass with landing/return-state note
- command-control absence: pass

## Follow-Up Notes

### Landing / Return State

Observation:

- `HR_ADMIN` first landed on `/store/home`.
- `REPORT_VIEWER` first landed on `/store/me`, where the performance surface
  was unavailable.

Assessment:

- Not a blocker for controlled pilot because direct route allow/deny checks
  matched the expected role behavior.
- Worth rechecking in a clean browser context if pilot participants report
  confusing first landing behavior.

### Store Action Command Proof

Observation:

- Store Action plans were visible for `SUPER_ADMIN` and `STORE_MANAGER`.
- Store Action create/status/close/cancel controls were not observed in this
  rehearsal.

Assessment:

- Not a blocker for this read-only persona rehearsal.
- Command-mode proof still needs:
  - a named staging action plan or candidate,
  - expected command result,
  - rollback or cleanup note,
  - assigned-store positive and foreign-store negative proof.

## Redaction Check

- Raw tokens/cookies/JWTs included: no
- Passwords/auth codes included: no
- Provider subject/private IDs included: no
- Screenshots or private personal data included: no
- Direct DB data included: no

## Next Action

Controlled pilot can continue to the next assisted session or targeted feedback
triage.

Recommended next step:

- Do not add a new module yet.
- Do not start broad UI redesign until the user begins that track.
- If Store Action command proof is required next, first select one disposable or
  approved staging action plan/candidate and document rollback before clicking
  command controls.
