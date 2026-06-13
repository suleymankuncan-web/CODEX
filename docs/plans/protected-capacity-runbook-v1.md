# Protected Capacity Runbook V1

## Purpose

This runbook defines the only accepted procedure for proving protected
read-route capacity for the controlled pilot capacity gate. It separates public
health evidence from protected role evidence and never upgrades a blocked run
into a pass.

This runbook does not approve broad launch. It records either a clean protected
read ladder through concurrency 25 or a precise blocked state.

## Inputs

Use fresh role-specific bearer tokens from the current staging login session.
Never paste token values into GitHub, docs, terminal transcripts, screenshots, or
PR comments.

Required token environment variables:

```powershell
$env:CAPACITY_STORE_MANAGER_TOKEN='<redacted-store-manager-bearer-token>'
$env:CAPACITY_REGION_MANAGER_TOKEN='<redacted-region-manager-bearer-token>'
$env:CAPACITY_SUPER_ADMIN_TOKEN='<redacted-super-admin-bearer-token>'
```

`CAPACITY_ALLOW_SHARED_TOKEN` must not be used for this acceptance run. A shared
diagnostic token can make local debugging easier, but it cannot prove separate
store manager, region manager, and super-admin protected capacity.

## Preflight

Before running, check presence without printing values:

```powershell
$names = @('CAPACITY_STORE_MANAGER_TOKEN','CAPACITY_REGION_MANAGER_TOKEN','CAPACITY_SUPER_ADMIN_TOKEN')
foreach ($name in $names) {
  $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  "$name=" + [bool]$item
}
```

If any required token is missing, do not run the acceptance ladder. Record the
result as `blocked`, with zero protected endpoint calls.

## Acceptance Command

```powershell
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

Do not set `CAPACITY_ALLOW_SHARED_TOKEN`. Do not set
`CAPACITY_ALLOW_HIGH_CONCURRENCY`; the accepted ladder stops at 25.

## Pass Criteria

The protected capacity gate passes only when all of these are true:

- Script exits `0`.
- Result status is `ok`.
- Max measured concurrency is `25`.
- Requested profiles are exactly `store-manager`, `region-manager`, and `admin`.
- All requested profiles are runnable.
- Blocked profile count is `0`.
- Failed level count is `0`.
- Availability is `100%` at every measured level.
- `429`, `5xx`, request errors, non-JSON responses, and HTML responses are all `0`.
- Store manager p95 stays `<=2000ms`.
- Region manager and admin p95 stay `<=2500ms`.

## Blocked Criteria

Record the run as blocked when any of these are true:

- Any required token env var is absent.
- Result status is `blocked`.
- Any requested profile is not runnable.
- Endpoint calls for blocked profiles are `0`.
- The output does not reach concurrency `25`.

Blocked means protected capacity remains unproven. It is not a failed load test
and it is not a pass.

## Stop Criteria

Stop and keep the gate blocked if any measured level reports:

- `429`.
- Any `5xx`.
- Timeout or request error.
- Non-JSON API response.
- HTML fallback response.
- p95 above the profile budget.

Do not continue to a higher concurrency level after a stop criterion appears.

## Evidence Rules

Allowed evidence:

- Evidence date.
- Environment name.
- API origin without credentials.
- Requested profiles.
- Level summary table.
- Profile pass/block status.
- Sanitized p50/p95/max, availability, and error counters.

Forbidden evidence:

- Raw bearer tokens, cookies, passwords, OTP values, authorization codes, private
  keys, provider secrets, database URLs, Redis URLs, or private payloads.
- Full JSON output if it contains private payload samples.
- Any statement that converts public health evidence into protected capacity
  proof.

## Evidence Destination

Append the sanitized result to:

```text
docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md
```

Use `ok` only when the acceptance command really returned `ok`. If tokens are
missing, append a blocked note instead.
