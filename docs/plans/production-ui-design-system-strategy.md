# Production UI / Design-System Strategy

Date: 26 April 2026

## Purpose

This note records the current UI decision before any broad visual redesign starts.

The product owner is comfortable with the current UI remaining a working draft while the backend, data, scope, KPI, and workflow foundations mature. UI should improve through controlled pilots, not a one-shot redesign.

## Product Decision

UI is important, but it is not the immediate priority.

Current priority order:

1. Keep the product usable and coherent enough for testing.
2. Protect backend, auth/scope, data, KPI, snapshot, audit, and workflow foundations.
3. Improve UI through reversible pilots.
4. Start broad production visual polish only after the design direction is proven.

## UI Direction When It Starts

Recommended direction:

- operational SaaS / corporate field-operations panel
- admin shell: dense, calm, desktop-first, decision and audit oriented
- store shell: mobile-first, task-first, fewer choices, clearer actions
- restrained color system, not decorative gradients or marketing-style hero pages
- consistent component behavior before expressive styling
- correct Turkish characters and full EN/TR localization boundaries

## Pilot Rule

Any future UI improvement should start as a small pilot.

Good pilot candidates:

- `/store` shell and home
- `/store/tasks`
- `/store/me`
- shared cards, pills, key-value rows, table/list rows

Pilot requirements:

- easy to reject or revise after product review
- no backend contract change unless separately approved
- no broad component rewrite before the pilot direction is accepted
- keep release gate passing
- use browser screenshot/visual inspection when real UI changes land

## What Not To Do Yet

- Do not redesign every page at once.
- Do not replace the component system before a pilot proves the direction.
- Do not spend heavy time on final colors/typography while backend data contracts are still evolving.
- Do not mix admin and store UI density rules.
- Do not treat current draft UI as final production design.

## Backend Priority After This Note

Because the product owner currently cares more about backend solidity than UI polish, the next local product/backend candidate should be:

1. Real ingest connector and real payload contract intake.
2. If real external payload details are not available, KPI config governance implementation planning.

Reason:

- Real data ingestion will eventually feed KPI, ranking, store score, personnel score, snapshot, and reporting trust.
- If the external payload is unknown, implementing a fake connector too early would create avoidable debt.
- KPI config governance is the strongest backend-owned work that can proceed locally if external ingest details are still missing.

## CODEX DÜRÜST YORUM

This is the right call.

The UI should not be ignored, but it should not pull the project into visual churn right now. The current product risk is not that colors are imperfect; the larger risk would be weak data contracts, unclear ingestion ownership, or scoring/config changes that cannot be audited later.

Keep UI as a controlled draft, run small pilots when needed, and spend the next serious energy on backend/data foundations.

## Next Logical Step

Run the feature intake interview for the next backend item:

- preferred first: real ingest connector and payload contract
- fallback if external data is unavailable: KPI config governance implementation plan
