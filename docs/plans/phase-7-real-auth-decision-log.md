# Phase 7 Real Auth Decision Log

## Purpose
This document exists to capture the few decisions that must be explicit before real auth implementation begins.

## Decision 1
### Question
Will admin and store shells share the same auth contract?

### Decision
Yes.

### Why
- backend auth and scope model are already shared
- shell difference is a UX concern, not a token-format concern
- keeping one contract reduces integration complexity

## Decision 2
### Question
Should the next step be deeper store-domain work or real auth shaping?

### Decision
Real auth shaping comes first.

### Why
- current store shell is enough to prevent surface confusion for now
- deeper store features should not stack on top of a manual-token workflow
- login acquisition affects every future shell

## Decision 3
### Question
Should the project implement a vendor-specific auth flow immediately?

### Decision
No.

### Why
- first lock protocol shape and shell entry behavior
- keep vendor choice flexible until implementation details are clearer

## Decision 4
### Question
What is the next coding target after this shaping step?

### Decision
A concrete `real auth entry flow` implementation note:
- login entry route
- callback route
- session restore flow
- logout flow

## Current Recommendation
Do not jump directly into store checklist or incentive implementation yet.

Use the next step to make real auth concrete enough that both:
- `/admin`
- `/store`

can later operate on a stable production session model.
