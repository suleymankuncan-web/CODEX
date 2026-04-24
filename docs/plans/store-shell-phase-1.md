# Store Shell Phase 1

## Anchor
This plan follows:
- [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md)
- [phase-7-shell-boundaries.md](./phase-7-shell-boundaries.md)

## Goal
Turn `/store` from a boundary marker into a first real store-user home surface.

The point is not to ship full store workflows yet.
The point is to define what the store shell is for before new domain modules start landing.

## Phase 1 Scope

### 1. Store Home
Create a task-first landing page for store users that answers:
- what needs action now
- what store-level visibility matters today
- where checklist, KPI, approval, and incentive work will eventually land

### 2. Store Navigation Skeleton
Define the first route families even if they are still preview-only:
- `/store`
- `/store/tasks`
- `/store/checklists`
- `/store/kpis`
- `/store/approvals`
- `/store/incentives`

### 3. Role And Scope Framing
Make it obvious that store users should not inherit admin-style navigation.

The store shell should feel:
- narrower
- task-oriented
- store-scoped
- action-first

## What Phase 1 Does Not Do
- full checklist execution flow
- real approval workflow
- incentive calculations
- detailed KPI drill-down implementation

Those come later after the shell shape is stable.

## UX Intent
The home screen should prioritize:
1. today's tasks
2. pending approvals
3. KPI and incentive highlights
4. store-scope context

It should not look like:
- an admin operations cockpit
- a reporting back office
- a generic dashboard with no action hierarchy

## Definition Of Done
Phase 1 is successful when:
- `/store` feels clearly different from `/admin`
- the main store route families are visible
- future domain modules have an obvious home
- store-facing work no longer needs to be imagined inside the admin shell
