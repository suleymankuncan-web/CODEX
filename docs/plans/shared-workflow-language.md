# Shared Workflow Language

## Purpose
Freeze the minimum workflow vocabulary before the shared inbox work expands.

This document exists so future flows do not invent their own language for the same concepts.

## Workflow Types

### Approval
- requires a decision
- has a submitter side and an approver side
- example:
  - target distribution request
  - future target revision request

### Acknowledgement
- confirms receipt, visibility, or acceptance of an outcome
- does not imply negotiation or rejection by default
- example:
  - completed checklist receipt

### Task
- an actionable queue item shown to a user
- may originate from approval or acknowledgement flows
- may later originate from KPI exceptions or people-lifecycle events

### Notification
- informative only
- not a decision
- not a required acknowledgement unless explicitly promoted into one

## Inbox Item Contract
The shared inbox should evolve around this common shape:

- `itemType`
- `sourceType`
- `sourceId`
- `title`
- `summary`
- `companyId`
- `regionId`
- `storeId`
- `storeName`
- `workflowStatus`
- `inboxStatus`
- `urgency`
- `createdAt`
- `needsAttentionAt`
- `actorRole`
- `primaryActionLabel`
- `secondaryActionLabel`
- `deepLink`
- `historyPreview`

## Status Language

### Workflow-specific status
Lives inside the source flow.

Examples:
- `pending_region_approval`
- `approved`
- `completed`

### Inbox-level status
Normalizes what the queue should communicate.

Allowed values:
- `needs_attention`
- `completed`
- `informational`

Rule:
- workflows may keep their own internal status language
- inboxes should map that language into one of the shared inbox-level statuses

## Mobile-First Inbox Rules
Any future inbox implementation should assume phone usage is primary for store and field action surfaces.

Required behavior:
- one clear primary action per item
- status readable without table columns
- urgency visible without hover
- summary visible before detail drill-in
- card or stacked row structure beats wide grid dependency

Anti-patterns:
- action logic that only works in desktop tables
- multiple equal-weight actions in one row
- layouts that require horizontal scanning to understand urgency

## Runtime Boundary Reminder
Local demo support exists today, but it must not define the permanent workflow contract.

Current local/demo examples:
- seeded checklist and target request records
- local-only auth tolerance for rehearsal flows

Local Keycloak demo role/scope inference has been removed from backend auth. Local users must receive explicit role, read-scope, and assigned-store claims from Keycloak.

These are acceptable for local progress.
They are not the source of truth for production workflow semantics.
