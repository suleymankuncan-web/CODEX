# Phase 7 Next Steps Roadmap

## Anchor
This roadmap continues from:
- [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md)
- [store-shell-phase-1.md](./store-shell-phase-1.md)

## Current Position
Already completed:
- auth contract direction
- admin shell role-aware routing
- session expiry / `401` handling
- admin vs store shell boundary
- first `/store` shell entry
- local JWT validation path
- local Keycloak validation path

## Recommended Next Sequence

### Step 1. Architecture Alignment Pass
Target:
- convert route-first momentum into domain-first direction
- formalize:
  - approval
  - acknowledgement
  - task
  - notification
- record what stays stable versus what is temporary

Reason:
- the product direction is now broader than a single store-shell preview
- future modules will include people lifecycle, targets, incentives, and challenges
- we should align before domain-heavy write flows start

### Step 2. Store Shell Phase 1
Target:
- store home
- route skeleton
- task-first information architecture

Status:
- completed

### Step 3. Real Login Acquisition
Target:
- replace manual bearer-token entry as the intended production path
- define how real login lands users in the correct shell

Questions to settle:
- IdP choice
- redirect flow
- session bootstrap behavior
- logout behavior

Status:
- local JWT path verified
- local Keycloak path verified
- production hardening still pending

### Step 4. First Real Workflow Surface
Target:
- first real write/action flow after alignment

Reason:
- the next surface should follow formal domain/workflow rules, not just route order
- likely candidates:
  - target distribution approval
  - acknowledgement-backed checklist flow

Status:
- selected and implemented as `target distribution + approval`
- store shell now submits target distribution requests
- admin shell now exposes `/admin/targets` approval queue

### Step 5. Store KPI Highlights
Target:
- summary-level KPI visibility for store users

Reason:
- KPI visibility belongs in store experience, but it should start as scoped highlights rather than admin-style reporting tables

### Step 6. Approval Foundation
Target:
- prepare inbox and action surface for future approvals

Reason:
- approval work is likely to touch both admin and store shells
- boundary decisions should happen before incentive workflow grows

### Step 7. Incentive / Prim Shaping
Target:
- define domain boundary and shell placement before implementation

Reason:
- incentive work is likely cross-module
- it should not start until auth, shell placement, and store/user workflow intent are clearer

## Recommended Order From Current Position
1. architecture alignment pass
2. production auth hardening plan capture
3. validate target distribution workflow with live migration data
4. acknowledgement-backed checklist flow
5. shared approval and task inbox shaping
6. incentive / prim shaping

## Why This Order
- the product is now clearly multi-actor and workflow-heavy
- alignment reduces future rework more than one more route-first screen would
- auth is locally verified, so the biggest current risk is domain drift rather than login feasibility
- first write flow was chosen after workflow language was formalized
- the next risk is no longer "which flow first", but keeping future flows aligned with approval vs acknowledgement boundaries
