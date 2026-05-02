# Store Checklist Surface

## Anchor
This slice follows:
- [store-shell-phase-1.md](./store-shell-phase-1.md)
- [phase-7-next-steps-roadmap.md](./phase-7-next-steps-roadmap.md)

## Goal
Make checklist work the first real store-facing flow in the `/store` shell.

## First Slice
The first slice should:
- live under `/store/checklists`
- feel task-first rather than admin-report-first
- consume existing reporting checklist data where current role/scope allows it
- remain useful as a preview shell even when the current session lacks store-ready reporting access

## Why This Shape
Current backend state:
- real checklist write endpoints exist
- reporting checklist reads exist
- store-user-specific checklist task APIs do not yet exist as a separate shell-oriented contract

Because of that, the safest first slice is:
- a store checklist home that can show current snapshot checklist visibility
- while clearly preparing for later execution workflows

## What This Slice Should Show
- current checklist focus area
- store-scope context
- latest snapshot checklist rows if available
- clear next evolution:
  - checklist execution
  - response capture
  - completion flow

## What It Should Not Pretend Yet
- it should not fake full checklist completion behavior
- it should not claim that store execution workflow is already fully implemented
- it should not overload admin reporting semantics into a store UX

## Follow-Up After This Slice
1. checklist task list
2. checklist instance detail / response form
3. completion flow
