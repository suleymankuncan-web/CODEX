# Store return ledger and positive seller visibility

Status: active
Shelf: domain
Last verified: 2026-09-30
Use when: changing return reads, positive roster visibility or daily close coverage
Do not use when: inferring provider history, deployment or live-data repair authority

`GET /api/reports/store-returns` reads one authorized store and an explicit
inclusive date interval of at most 366 days. Prim passes monthly bounds; KPI
passes its selected interval. Default `category=inside` shows norm personnel's
same-store returns. `other` shows norm-outside, cross-store, unresolved and
external informational returns. Stable date/ID pagination is bounded to 100 rows.
The underlying facts are daily groups, not reconstructed invoice timestamps.

Report Viewer and Super Admin use their own company-role boundary. Regional
and store managers require their role's store scope and a current direct action
assignment. Aggregate roles, region IDs and request scope overrides cannot widen
access. Registered partner stores are readable here; franchise financial prim
eligibility is unchanged. Real historical code reservations resolve renamed
stores/personnel; unknown or unauthorized names remain null. No synthetic master
or employee UUID is created.

Cross-store status takes precedence. Same-store norm membership is evaluated on
the return day; a later assignment or positive sale cannot relabel that return.
After 15 covered days without a positive sale, a sufficiently old assignment is
outside active-sale norm. Incomplete activity evidence is a review status.
Positive sales on the selected day clear the inactivity warning immediately;
another store's sale cannot clear it. Neither returns nor warnings mutate HR
employment/assignment status.

Received totals and net use accepted V2 store facts with matching canonical
daily NET_SALES and completed same-source import lineage. Invoice count comes
from store facts, preserving distinctness across personnel groups. External
returns of this store's original sale are informational and never deducted from
its net. Missing dates, no data and unresolved categories remain explicit;
zero is accepted only when an authoritative store-day fact actually exists.
Today is readable but not a missing completed day. Total amounts are independent
of the category toggle; unknown financial totals are null.

The workspace unions selected-store/month positive sellers with existing norm,
manager, participation and frozen rows. Targetless/unassigned and negative-net
positive sellers stay visible without acquiring calculated payout. Real but
unmapped personnel codes remain a separate informational list. Personal net is
null for legacy, mismatched canonical or unresolved attribution evidence.
Optional positive/activity read failures preserve the core financial workspace
and advertise an unavailable section. Financial finals and exclusions retain
their existing authority.

Manual daily-source closes and automatic daily closes require every expected
company-store day, bounded by real opening/closing dates and date-effective
ownership, at the close cutoff. Readiness and the locked close transaction use
the same coverage query; missing first/middle/last days, V1 facts, late imports,
unresolved returns and mismatched canonical totals block the close. Explicit
verified monthly authority remains compatible when no daily source is selected.
Previously succeeded closes and sealed financial history are preserved.

The return owner has one controller, three providers and one export. A bounded
workspace data module combines participation and return-read dependencies;
existing architecture/file-size caps are unchanged. OpenAPI and the generated
frontend client publish the neutral fields. No provider payload, live replay,
deployment or data repair is part of this read contract.

## Shared presentation

KPI store detail and the incentive drawer share the dated return ledger. The
initial filter shows norm in-store returns; the toggle shows outside-norm,
cross-store, external information and unresolved records. Receiver invoice
totals are authoritative and independent of page/filter; grouped row counts
are never summed. Live KPI net uses the verified canonical ledger NET_SALES
for the exact selected highlight interval; closed results retain recorded
NET_SALES or an unavailable value, never a current-data replacement.
Personnel tables show net without duplicating ordinary return columns; managers
show their store net basis. Financial calculations, exclusion decisions and
sealed amounts remain authoritative. Unknown sellers have informational rows
without invented identity or payment actions. Cache keys bind authorization,
store, dates, category and page; protected errors hide stale ledger data.

The report-viewer visit calendar opens at the current Europe/Istanbul Monday,
independent of the parent reporting month. Manual week selection survives
manager changes; reopening restores the current week. The manager planner is
unchanged. Year-crossing week labels show both years.
