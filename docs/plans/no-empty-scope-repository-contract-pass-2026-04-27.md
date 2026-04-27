# No-Empty-Scope Repository Contract Pass - 2026-04-27

## Purpose

This pass closes the next access-control debt after the project-wide scan: an authenticated actor with no effective company, region, or store read scope must never receive broad operational data by accident.

## Contract

Actor-scoped repository methods must fail closed when all scope arrays are empty:

- list methods return `[]`
- paged report methods return `{ rows: [], total: 0 }`
- single lookup methods return `null`
- no database query should be emitted for the empty-scope branch

For store-owned operational data, scope priority is:

1. store scope
2. region scope
3. company scope
4. no access

This keeps narrow assignments from being widened by broader or empty filters.

## Surfaces Hardened

### Reporting

Hardened:

- workforce report
- KPI report
- checklist report
- turnover report
- employee KPI latest-period lookup
- employee KPI period list
- external employee reference resolution

Behavior:

- empty actor scope returns no rows/null without querying
- helper predicates now also append `FALSE` defensively if used without the early guard
- external employee reference resolution now requires company scope

### Checklist Acknowledgement

Hardened:

- completed checklist acknowledgement list

Behavior:

- empty actor scope returns `[]` without querying
- scope filter now uses narrowest available store > region > company priority

### Competition Read Surfaces

Hardened:

- competition list
- competition detail
- store contribution rows
- warning rows attached to competition detail

Behavior:

- empty actor scope returns no data without querying
- company-scope competition reads now filter through `store.company_id` instead of treating any company scope as a global bypass
- unassigned team/warning rows remain visible only to company-scoped actors

### Operational Feed

Hardened:

- visible feed list

Behavior:

- empty actor scope returns `[]` without querying
- company feed posts remain visible to scoped actors
- company visibility no longer acts as a broad `OR` that opens every region/store post

## Verification

Red phase:

- targeted repository tests failed against the old behavior
- failures proved reporting, checklist acknowledgement, competition, and feed could still query or return data with empty actor scope

Green phase:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand
```

Result:

- 4 suites passed
- 43 tests passed

Backend release gate:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd run check:release
```

Result:

- lint passed
- 41 suites / 288 tests passed
- build passed
- `npm audit --omit=dev` reported 0 vulnerabilities

## Boundaries

This pass did not change:

- auth role assignment admin listing
- user/admin catalog listing
- integration import-batch admin listing
- snapshot operations admin listing
- score math
- KPI weights
- DB schema
- frontend UI

Those are admin/operator surfaces or separate product workflows, not actor-scoped store/region/company read lists.

## CODEX Durust Yorum

Bu iyi bir borc kapatma adimi oldu. Bir onceki scan iki somut acik yakalamisti; bu adim ise ayni sinif hatanin baska repository'lerde sessizce kalmasini azaltti.

Benim gozumde proje icin anlami su:

- scope kurali artik daha cok yerde "guard'da var zaten" varsayimina yaslanmiyor
- repository seviyesi de fail-closed davranmaya basladi
- testler bos scope'u ozel bir guvenlik durumu olarak belgeliyor
- gelecekte yeni listeleme yazilirken ornek alinacak daha net bir pattern var

Hala geriye kalan buyuk konu ayni: real IdP ve real source/Nebim evidence olmadan production guveni tamamlanmis sayilmaz.

## Next Logical Step

Official root release gate'i kosup bu pass'i commit etmek.

Sonraki adim icin iki mantikli yol var:

- Nebim/source bilgisi geldiyse source mapping specification.
- Dis kaynak bilgisi hala yoksa production environment readiness checklist: required env, secrets, IdP, DB migration, audit retention, backup, and smoke evidence checklist.
