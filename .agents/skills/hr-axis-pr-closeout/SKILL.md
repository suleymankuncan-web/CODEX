---
name: hr-axis-pr-closeout
description: Check and close HR Axis PRs using exact-head CI evidence, authorized merge and post-merge verification.
---

# HR Axis PR closeout

Read the repository AGENTS.md reading map and discipline.md PR, verification and
merge sections. They own execution and delegation policy; this skill grants no
additional mutation, deployment or subagent authority.

## Before merge

- Resolve the exact repository, base, head SHA and requested action. Preserve
  unrelated dirty work; never infer merge status from squash ancestry alone.
- Review the complete diff and select verification from the canonical ladder.
  Inspect the selector's reasons, not just its suggested commands.
- Refresh required checks, mergeability and existing actionable human/tool
  reviews on the current head. Check Cloudflare deployment evidence when
  applicable. Do not request or wait for owner-disabled GitHub Codex review.
- A passed test is not deployment, live-provider or production evidence.
  Missing, stale or failed required proof blocks merge; do not bypass gates.
- For approved-prototype UI work, also require the approved artifact, route and
  role matrix, real-data/component mapping, desktop and mobile comparisons, and
  explicit justified deviations. Demo controls and fake data must be absent.
  Missing evidence means `Prototype parity: BLOCKED`, not completion.

## Closeout

Merge only when authorized and the current head satisfies all required gates.
Use the canonical squash strategy; retain refs unless cleanup is separately
authorized. Fetch and verify the actual merged SHA, applicable post-merge checks,
and local main alignment without overwriting dirty work.

Report PR link, merge SHA, verification, unresolved gates and next safe action.
Update current-state only when durable facts or next actions changed; keep
detailed logs and historical narration out of the active handoff.
