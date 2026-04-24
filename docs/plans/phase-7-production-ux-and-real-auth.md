# Phase 7: Production UX And Real Auth

## Anchor Plan
This phase begins after the practical closeout of `Phase 6` from:
- [next-phase-plan.md](./next-phase-plan.md)
- [phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md)

## Why This Phase Exists
The backend platform, reporting surface, and admin frontend shell are now strong enough that the next bottleneck is no longer raw backend capability.

The next real product risks are:
- development-only auth patterns staying around too long
- admin UX and future store-user UX getting mixed together
- new modules landing before user-facing product boundaries are stable

This phase exists to convert the current admin shell from a strong internal tool into a production-ready foundation that can later support:
- admin operators
- regional/company users
- store-level users
- future domain modules such as `prim`, richer KPI packs, and approval workflows

## Phase 7 Goal
Move from development-friendly admin tooling to a production-oriented product shell with real authentication, cleaner user-surface separation, and predictable role-aware UX.

## Current Starting Point

### Already In Place
- protected NestJS backend with scoped RBAC
- admin frontend shell with:
  - integrations
  - snapshots
  - reports
  - auth
  - audit center
  - session readiness
- bearer-token verification path exists
- mock auth is now explicitly gated for production safety
- first performance baseline has been captured

### Not Yet Production-Complete
- no real IdP login acquisition flow yet
- frontend route experience is not yet role-aware enough
- admin shell and future store app are not yet separated at the UX level
- current session flow is still operator-oriented, not end-user-oriented

## Phase 7 Workstreams

### 1. Real Auth Integration
Goal:
- move from manual bearer token entry to real login/session acquisition

Tasks:
- define the chosen IdP contract
- finalize token claim mapping
- add frontend login/session bootstrap path
- add logout/session expiry handling
- confirm admin shell works without mock mode

Definition of done:
- an authenticated user can enter the app through a real auth flow
- manual token pasting is no longer the primary intended path

### 2. Role-Aware UX Shell
Goal:
- make the frontend behave differently based on authenticated role and scope

Tasks:
- hide or disable routes the user should not navigate to
- shape nav and landing pages around role intent
- make scope visibility readable in the UI
- prevent admin-heavy surfaces from being the default experience for narrower users

Definition of done:
- navigation and landing state meaningfully reflect role/scope
- a store-level user is not dropped into an admin-style experience by default

### 3. Product Surface Separation
Goal:
- separate the admin operations shell from the future store-user surface before new domains expand the product

Tasks:
- define admin shell boundaries
- define store-user shell boundaries
- decide whether this becomes:
  - one app with multiple shells
  - or separate frontend applications
- document which modules belong to which shell

Definition of done:
- we know where future `prim`, KPI, and checklist UX will live
- admin and store-user concerns are no longer blended conceptually

### 4. UX Quality Pass
Goal:
- make the current frontend easier to trust and operate in production

Tasks:
- normalize loading / empty / error states across all main routes
- improve route transitions and deep-link readability
- make session/auth errors actionable
- verify mobile and narrow-width usability for core admin pages

Definition of done:
- the shell feels deliberate and supportable, not just technically functional

## Recommended Execution Order
1. decide auth contract and IdP shape
2. implement real auth bootstrap
3. add role-aware routing and shell logic
4. define admin shell vs store-user shell split
5. run UX quality pass

## What Should Wait Until Phase 8
These should not lead Phase 7:
- `prim` / incentive module
- richer KPI families
- approval workflows
- broader store-user business features

Reason:
- if we add those before the auth and UX shell stabilizes, the product surface will become harder to separate later

## Recommended First Move
Start with a short auth contract document that answers:
- which IdP will be used
- what claims are required
- whether admin and store-user apps share the same token contract
- what the frontend should do on:
  - login
  - token expiry
  - forbidden access
  - logout

## Exit Signal
Phase 7 is in a healthy place when:
- the admin shell no longer depends on development-only auth behavior
- role-aware navigation is real
- product surface separation is explicit
- the project is ready to add new domain modules without mixing admin and store-user UX
