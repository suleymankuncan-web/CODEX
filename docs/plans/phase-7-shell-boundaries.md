# Phase 7 Shell Boundaries

## Anchor
This note turns the `Product surface separation` workstream from [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md) into a concrete boundary model.

## Decision
Keep one shared backend and one shared auth contract, but separate frontend experience into distinct shells:
- `admin shell`
- `store-user shell`

This can still live inside one frontend application for now, but the route and UX boundaries should already be explicit.

## Why This Direction
- backend authorization and scope enforcement are already shared
- auth/session rules should stay consistent across all user types
- the UX goals of operators and store users are too different to keep blending into one navigation model

## Shell 1: Admin
Route family:
- `/admin/*`

Primary users:
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`
- `SNAPSHOT_OPERATOR`
- `REPORT_VIEWER`
- `AUDITOR`

Primary goals:
- operate imports and snapshots
- inspect reporting
- manage authorization
- review audit traces

Modules that belong here:
- integrations
- snapshots
- reporting drill-downs
- auth admin
- audit center
- session/admin diagnostics

## Shell 2: Store User
Route family:
- `/store/*`

Primary users:
- store-level managers
- store-level staff
- future approval participants

Primary goals:
- see only store-relevant work
- complete operational tasks
- review store-scoped KPIs and checklists
- act on approvals or assigned work

Modules likely to belong here later:
- store task home
- checklist execution and follow-up
- store KPI highlights
- future `prim` / incentive visibility
- approval inbox

## Shared Rules
- both shells use the same bearer-token contract
- backend remains the final authorization authority
- frontend shell only shapes navigation and default landing behavior
- store-user shell must never rely on hidden admin routes as a fallback UX

## Routing Rule
- `/admin/*` stays operations-first
- `/store/*` stays store-task-first
- `/` should eventually route to the correct shell based on resolved role and scope

## Immediate Implementation Direction
In the current frontend:
- keep the existing admin shell under `/admin`
- add a visible preview boundary for `/store`
- avoid placing future store-user pages under the admin navigation tree

## Practical Outcome
This means future domain work can be placed cleanly:
- if the feature is operational governance or system control, it belongs in `admin`
- if the feature is day-to-day store action or store visibility, it belongs in `store`

## Next Step
Create a `store shell preview` route and keep future store-facing work anchored there instead of extending the admin sidebar.
