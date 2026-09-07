# Operating cost optimization: two PRs

Status: active
Shelf: plan
Last verified: 2026-09-07

## Owner scope

Deliver two sequential PRs. Review and verify each, merge only when its required
gates pass, then refresh the next branch from main. Stop after both are aligned.
The current model works directly; no subagent delegation is authorized.

## PR 1: operating context

- Consolidate operating-document ownership and remove worker-specific routing.
- Remove repository worker roles, inherit the selected root model, retain Medium
  default effort and High Plan Mode; do not change personal settings.
- Version concise project closeout and handoff skills so another checkout gets
  the same instructions. Other local/vendor skills remain untouched.
- Preserve scope, privacy, negative tests, fail-closed release, on-prem proof,
  exact-input reuse and explicit external-action authority.
- Correct only verification portability blockers needed to certify this slice.

Acceptance: no configured worker roles, explicit-only delegation, live canonical
links, concise skills with valid metadata, and the selected verification gates.
Rollback: revert this operating-policy slice; no application or data migration.

## PR 2: verification and artifact cost

Use measured bottlenecks, not fewer tests. Inspect repeated Windows fixture
process setup, the existing change selector and exact-input proof reuse, and
large image/offline artifact lifecycle. Prefer a narrow test-only optimization
and a fail-closed artifact retention plan over another cache or proof authority.

Baseline evidence: the previous Windows script run took 731,877 ms; its longest
single restore test took 146,054 ms. These are observed runs, not portable SLAs.
An owner-approved cleanup removed 111.19 GiB of failed/cancelled historical
offline bundles while retaining successful packages, open-PR and rollback proof.
That cleanup does not establish a permanent retention policy or fresh CI PASS.

Acceptance: all existing cases and two-worker isolation remain; record measured
before/after results and uncertainty. Preserve successful release/rollback
packages and open-PR proof. Unknown retention identity is protected by default.
Do not delete external artifacts merely because a new planner identifies them.

## Boundaries and stop conditions

No application refactor, live company API, credentials, production deployment,
branch/stash deletion, audit suppression or narrower Playwright selection.
Unknown/stale proof falls back fresh. No new worker/shard expansion. A quota or
provider failure is a blocker, not permission to weaken the merge gate.
