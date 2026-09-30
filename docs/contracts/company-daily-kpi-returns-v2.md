# Company daily returns attribution V2

Approved: 30 September 2026, six-PR returns/auth implementation scope. Risk R5.
V1 remains the historical source/storage contract; this document replaces its
employee canonical key and return attribution rules at explicit V2 activation.

## Source and scope

The private decoder maps the provider's original selling-store field to
`originalStoreCode`. Native field names, private connection details, invoice IDs,
real company codes, names and payloads remain outside this repository. An invoice
ID is used only in memory for distinct counts, then discarded. The worker passes
`returnAttributionVersion: 2`, current eligible store codes and reserved aliases
to `normalizeCompanyDailySales`. Aliases resolve to the same stable store UUID;
changing a store code does not turn an internal return into a cross-store return.

A return at an eligible receiver reduces that store's net. It reduces the
original seller's net only when receiver and origin resolve to the same store.
Cross-store returns never create receiving-store employee KPI/norm records.
Registered partner/franchise stores follow the same attribution rule; incentive
eligibility remains governed separately by the existing store policy.

A return received externally but originally sold in scope is retained as an
external information row, anchored to its original store. It does not change
that store's sales or received-return totals. Unrelated external movements are
excluded. Missing return origin is `unresolved`, never inferred as same-store;
store net and the unresolved detail remain available, with a control reason.
The return's Europe/Istanbul business date determines its month.

## Sanitized persistence and projection

`ops.company_daily_kpi_return` stores daily grouped signed amount/quantity,
receiver/origin codes, original seller code, direction and relation. The unique
grain treats null codes consistently. The component outcome owns these rows via
a cascading composite foreign key. Replacement is atomic with employee/store
facts; failure restores the previously accepted component. Store/employee
eligibility validation occurs before replacement. No provider rows are retained.

`aggregateCount` counts the primary employee, unmapped-personnel and store sales
facts. Supplementary return groups are not added to that count. The sanitized
V2 digest includes the attribution version, sorted primary facts and sorted
return groups. Return invoice counts are distinct within each group; the store's
received-return count comes from its store fact, never a sum of personnel counts.

`buildCompanyDailySalesProjection` requires V2. After positive-sale personnel
bootstrap it maps the sanitized facts to the existing canonical KPI path. Both
personnel and store NET_SALES/ITEM_COUNT use their attributed net. Financial net
may be negative. Decimal strings remain exact through materialization; canonical
numeric(18,4) rounding uses half away from zero, with explicit overflow rejection.
ATV/UPT divide net totals by positive-sale invoices. No additional scoring KPI is
created. Footfall/GSM projection and existing scoring weights remain unchanged.

The canonical employee key is KPI + employee + store + period type/start/end.
Storeless legacy rows retain their separate partial key. Both canonical writers
use the new predicates. Ranking reads keep personnel totals store-specific and
read store net from store scope, allowing personnel totals to exceed store net.
Unchanged legacy normalized inputs retain V1 semantics; they cannot be used by
the new V2 projection or silently reclassified as origin-verified returns.

## Coordinated activation and recovery

Migration 096 retains existing rows and is reapplicable. Stop scheduled imports
before an independently authorized rollout. Apply preceding identity migrations
and 096 together with compatible API/canonical writers and the private decoder.
Never run an old writer after changing its ON CONFLICT index predicate. Verify
the approved store inventory and the private historical alias before activation.
Prepare the worker from the matching backend build; keep footfall/GSM, positive
bootstrap, historical replay restrictions and lineage checks. Include returns
and V2 in the worker's component/source digests and persist `returnFacts` in the
same transaction. Fail if store identities change between fetch and projection.
Pin the resulting private worker image only in the separately authorized rollout.

Recovery must use a compatible store-aware release or forward fix. Restoring the
old storeless unique index after multiple stores exist can destroy valid facts
or fail; no blind down migration or data deletion is permitted. Closed incentive
history is not replayed. Old snapshots without origins cannot supply V2 evidence;
a dated authoritative source is required for any separately authorized repair.
This PR prepares code/contracts only: no live migration, source pull, deployment,
manual proof, release package or production replay.

## Verification

Targeted tests cover three receivers for one seller, independent positive sales,
registered partner/external/unresolved returns, month boundaries, code aliases,
negative net, decimal precision and deterministic privacy-preserving digests.
Disposable PostgreSQL tests exercise migration reapplication, old-row retention,
store-bound/storeless upserts, component rollback, relation/uniqueness constraints
and ranking reads. Required GitHub checks retain their full existing coverage;
the new return persistence fixture joins the existing backend PostgreSQL service.
