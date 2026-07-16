# Request Center SLA Policy V1

Status: owner-approved and locked on 16 July 2026.

This decision authorizes the read-only `dueAt` and `isOverdue` projection used
by `/api/workflow/request-center`. It does not add escalation, notification,
mutation, pause, or production-operation authority.

## Locked windows

| Request state | Next owner | Window |
| --- | --- | --- |
| Target `pending_region_approval` | Region Manager | 2 calendar days |
| Seller-code/offboarding `pending_hr_approval` | HR | 3 calendar days |
| Seller-code/offboarding `rejected` | Store | 2 calendar days |

## Clock contract

- Timezone: `Europe/Istanbul`.
- The clock starts at the authoritative state-transition timestamp.
- Initial target waiting starts at request creation.
- Workforce resubmission starts a new HR clock.
- A return starts a new Store clock.
- Terminal approval closes the clock and produces no due/overdue value.
- V1 has no pause semantics.
- `updatedAt` is never a waiting-age source.

The backend policy and database summary must implement the same matrix. The
frontend may display the server result but must not recompute a different SLA.
