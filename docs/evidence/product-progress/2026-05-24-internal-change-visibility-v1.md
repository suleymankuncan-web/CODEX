# Internal Change Visibility V1 Evidence

Status: docs_decision
Evidence class: docs_decision
Date: 2026-05-24

## Summary

Internal Change Visibility is now handled as curated operator/support evidence,
not as an in-app changelog. The operating model defines when a change deserves
an operator note, which fields it must carry, what stays private, and when a
future static read-only release-note surface may be considered.

Source:

- `docs/plans/internal-change-visibility-operating-model-v1.md`

## Seed Change Notes

| Date | Audience | Category | Plain summary | Operator action | Evidence | Not changed |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05-24 | engineering, product owner | product_intelligence | Store Performance Replay now has a pure event mapper for already-fetched rows. It creates sourced event candidates with strict timestamp, redaction, and no-causality guards. | Use as future source vocabulary only. Do not show a timeline UI yet. | PR #499, `admin-web/src/features/store-performance-replay/event-candidates.ts` | No UI, endpoint, auth, DB, scoring, or workflow behavior changed. |
| 2026-05-24 | engineering, product owner, pilot_moderator | product_intelligence | Store Performance Replay now has a read-only surface spec for future UI/content intake. It defines role/scope omission, source-route visibility, and no-causality copy rules. | Treat as future UI contract, not as shipped user-facing surface. | PR #500, `docs/plans/store-performance-replay-readonly-surface-spec-v1.md` | No visible Replay page or operator workflow changed. |
| 2026-05-24 | pilot_moderator, support_operator, store_manager, store_personnel | route_scope | `STORE_PERSONNEL` checklist route exposure is closed; checklist execution/result queues stay out of the personnel route set. | Use the route matrix when checking personnel access. | PR #492, `docs/plans/p2-product-intelligence-execution-v1.md` | Manager, region, VM, and reporting checklist access remains governed by the existing route matrix. |
| 2026-05-24 | pilot_moderator, store_manager | visible_behavior | Daily Command Brief V1 gives store users a source-linked first-screen operating brief on `/store/home`. | Use pilot feedback to decide whether it needs more source families. | `docs/evidence/product-progress/2026-05-24-daily-command-brief-v1.md` | No AI advice, scoring math, notification, or workflow behavior was added. |

## Rules Proven By This Slice

- Operator notes are curated from accepted PRs, evidence, plans, or runbooks.
- A docs-only note cannot claim runtime behavior by itself.
- Notes must include `Not changed` so future operators do not overread the work.
- Internal branch names, raw commit logs, provider details, tokens, cookies,
  database URLs, Redis URLs, and private payloads stay out of operator copy.
- Future in-app release notes remain parked until UI/content direction or pilot
  feedback asks for them.

## Verification

Local verification for this evidence slice:

```text
git diff --check
node --test scripts/internal-change-visibility-contract.test.mjs
npm.cmd run test:scripts
```

## Current Decision

Internal Change Visibility is ready as an operating/evidence discipline.
It is not a new module, not a notification system, and not a shipped in-app
release-note surface.
