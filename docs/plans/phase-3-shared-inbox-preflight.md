# Phase 3 Shared Inbox Preflight

## Purpose
Define the minimum alignment work that must be true before `Phase 3. Shared Inbox Shape` starts implementation.

This is not a large refactor plan.
It is a short preflight checklist so Phase 3 does not accidentally merge unrelated concepts or lock the UI into a desktop-only queue model.

## Why This Exists
Phase 1 and Phase 2 already proved two different workflow types:
- `targets + approval`
- `checklists + acknowledgement`

That is good progress, but it also creates a risk:
- if Phase 3 starts too fast, inbox work may collapse `approval`, `acknowledgement`, `task`, and `notification` into one blurry concept

Phase 3 should only start after the shared language is explicit.

## Preflight Rule
Do not design the shared inbox from page layouts first.

Design it from workflow semantics first.

## Required Before Phase 3

### 1. Workflow vocabulary must be frozen
The team must treat these terms as distinct:

Reference:
- [shared-workflow-language.md](./shared-workflow-language.md)

- `approval`
  - a workflow that requires a decision
  - examples: target distribution, target revision

- `acknowledgement`
  - a workflow that confirms receipt, visibility, or acceptance of outcome
  - example: completed checklist receipt

- `task`
  - an actionable item shown to a user in their work queue
  - tasks may originate from approvals, acknowledgements, or future KPI exceptions

- `notification`
  - informational only
  - not a decision and not a required acknowledgement by default

If a new request cannot be placed clearly into one of these, it needs product clarification before coding.

### 2. Shared workflow fields must be normalized
Before Phase 3 implementation, these fields should be treated as the common minimum shape:

- `itemType`
- `title`
- `summary`
- `storeId`
- `regionId`
- `companyId`
- `status`
- `urgency`
- `createdAt`
- `dueAt` or `needsAttentionAt`
- `actorRole`
- `historyPreview`
- `primaryActionLabel`
- `secondaryActionLabel`
- `deepLink`

Not every source workflow must expose every field immediately, but the inbox should be designed against this shared contract.

### 3. Desktop assumptions must not drive the model
Phase 3 must be mobile-first in behavior.

That means:
- one primary action per item
- readable status without needing large table columns
- urgency visible without hover states
- detail drill-in available without dense grid dependency

If an inbox concept only works as a wide desktop table, it is not ready.

### 4. Demo/runtime boundaries must stay visible
Phase 3 must not depend on local-only auth or seed shortcuts as if they are permanent product rules.

Examples:
- Keycloak local role fallbacks
- local demo scope assumptions
- seeded sample records

These can support development, but the inbox contract must be valid without them.

### 5. Phase 1 and Phase 2 patterns must be referenced explicitly
Phase 3 should reuse proven lessons:

From Phase 1:
- action requires approval
- action has submitter and approver perspectives
- action history matters

From Phase 2:
- not all workflow items are approvals
- acknowledgement needs a lighter interaction
- store inbox work is often confirmation, not negotiation

## What Must Be True In Code Thinking

### Good Phase 3 framing
- "show all actionable work in one shared queue language"
- "keep approval and acknowledgement distinct while sharing presentation patterns"
- "allow future KPI exception items to plug in"

### Bad Phase 3 framing
- "put all store/admin pages into one inbox"
- "rename everything to tasks and decide later"
- "flatten every workflow into the same status machine"

## Minimum Deliverable For Phase 3 Planning
Before implementation starts, we should be able to answer:

1. What makes an inbox item an approval versus an acknowledgement?
2. Which statuses are workflow-specific, and which statuses are inbox-level?
3. What is the mobile-first item layout?
4. Which future source types are expected after targets and checklists?
5. What is the smallest shared inbox item contract?

If these answers are not written down, Phase 3 should not begin coding yet.

## Recommendation
Do not pause the project.

Do this instead:
- freeze the shared vocabulary
- define the inbox item contract
- treat mobile as a hard constraint
- then open Phase 3

This is a small preparation cost that prevents a much larger inbox refactor later.
