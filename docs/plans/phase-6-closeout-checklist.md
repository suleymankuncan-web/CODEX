# Phase 6 Closeout Checklist

## Anchor Plan
This checklist is derived from [next-phase-plan.md](./next-phase-plan.md).

According to that plan:
- `Phase 1` through `Phase 5` are largely in place
- current focus should now be the clean closeout of `Phase 6: Quality Gate`

This document exists to turn that phase into an execution checklist instead of a vague intention.

## Current Position

### Already Strong
- NestJS backend runtime is active
- PostgreSQL-backed module structure exists
- auth and scoped RBAC are implemented
- import and snapshot async flows are operational
- reporting APIs exist
- admin frontend shell exists with:
  - integrations
  - snapshots
  - reports
  - auth
  - audit center
  - session readiness

### Still Not Fully Closed
- performance validation is not yet systematized
- production auth path is prepared but not fully activated end-to-end
- security hardening is not yet formally reviewed
- data isolation verification needs explicit signoff
- a final operational verification pass is still needed

## Phase 6 Goal
Prove that the current system is safe, observable, and supportable enough before we expand into new business modules such as incentive management and richer KPI packs.

## Exit Criteria
Phase 6 is considered closed only when all of the following are true:
- critical flows have repeatable test coverage
- scope isolation has been explicitly verified
- auth can move from mock mode toward real bearer/JWT mode without frontend rework
- operational failure states are observable and understandable
- basic performance limits are measured, not assumed

## Checklist

### 1. Auth Productionization
Status: Ready to start

- verify backend auth mode configuration paths:
  - `mock`
  - `jwt`
- document required environment values for JWT mode
- define the expected token claims contract:
  - user id claim
  - role claims
  - scope/company claims
- test one real bearer-token request flow from `admin-web`
- confirm frontend behavior in:
  - mock mode
  - bearer mode
- decide whether admin and future store app will share the same IdP contract

Definition of done:
- bearer mode works for at least one protected route
- session switching in frontend is no longer theoretical

### 2. Scope Isolation Verification
Status: Ready to start

- verify `company` scoped users only see their allowed company data
- verify `region` scoped users cannot access other regions
- verify `store` scoped users cannot access other stores
- verify reporting endpoints enforce the same scope rules as operational endpoints
- verify auth admin mutations reject invalid scope combinations
- capture known edge cases and required follow-up fixes

Definition of done:
- one explicit verification matrix exists for company / region / store
- at least one automated test exists for each critical scope boundary

### 3. Performance Baseline
Status: Not started

- define target batch sizes for import testing
- define target snapshot sizes for reporting generation
- measure:
  - import batch ingestion time
  - materialization time
  - snapshot rerun time
  - reporting query latency for main summary and drill-downs
- identify top slow endpoints or queries
- record current baseline in a short benchmark note

Definition of done:
- we have numbers for critical flows
- we know current bottlenecks before adding new domains

### 4. Operational Observability Review
Status: Partially complete

- verify correlation id visibility across request and audit flows
- verify import retry actions leave readable trace
- verify snapshot rerun actions leave readable trace
- verify audit center is sufficient for operator entry points
- identify missing audit surfaces that still require direct API usage
- decide whether a global audit feed endpoint is needed in the next phase

Definition of done:
- operator can answer:
  - what happened
  - who triggered it
  - what changed
  - what should happen next

### 5. Test Coverage Closeout
Status: In progress

- review current unit and integration coverage for:
  - auth guards
  - scope checks
  - import flows
  - snapshot rerun flows
  - reporting read flows
- fill obvious missing tests on:
  - bearer auth path
  - permission mutation flows
  - queue retry/rerun side effects
- confirm frontend production build passes
- confirm backend build and targeted tests pass

Definition of done:
- no critical admin workflow depends only on manual verification

### 6. Security Review Pass
Status: Not started

- review audit completeness for auth mutations
- review permission grant/revoke flows for abuse or privilege escalation gaps
- verify no frontend route exposes admin capability without backend enforcement
- confirm mock mode is clearly development-only in documentation
- verify secrets/token handling expectations for bearer mode

Definition of done:
- no obvious privilege escalation path remains unreviewed

## Recommended Execution Order
1. Auth productionization
2. Scope isolation verification
3. Test coverage closeout
4. Operational observability review
5. Performance baseline
6. Security review pass

## Why This Order
- real auth affects how we validate everything else
- scope isolation is the highest-risk correctness boundary
- tests should lock in behavior before deeper hardening
- observability helps debug the remaining steps
- performance measurement is more useful once auth and flows are stable
- security review should happen after the concrete behavior is visible and testable

## What Comes After Phase 6
Once this checklist is closed, the project can safely open the next product-facing phase:
- `Phase 7: Production UX and Real Auth`
- `Phase 8: New Domain Modules`

Likely first candidates:
- incentive / prim module
- richer KPI families
- approval workflows
- store-user application shell
