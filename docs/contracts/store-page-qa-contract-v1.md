# Store Page QA Contract V1

## Purpose

Store pages must fail in tests before a user finds repeated route, data,
workflow or visual regressions manually.

## Required Contract Classes

1. Route access and navigation match `store-route-registry.ts`.
2. Persona scope is respected.
3. Page metrics agree with visible rows or mocked API totals.
4. No UUID, internal id, debug copy or mojibake is visible.
5. No horizontal overflow on desktop.
6. Primary actions open their modal, drawer or sheet.
7. Period controls use compact month/year behavior where the product has standardized it.

## High-Risk Pages

- Checklistler
- Türkiye Sıralaması
- KPI Özetleri
- Primler
- Hedefler
- Norm Kadro
- Görevler
- Raporlar
- Duyurular
- Store Me
- Personel

## PR Rule

Before opening a PR that touches a store page, run:

```bash
npm.cmd run test:scripts
npm.cmd run test:e2e:store-contracts
```

If local dependencies are incomplete, record the exact dependency failure in
the PR notes and do not claim the contract passed.

## Evidence

Coverage mode, mocked/live boundaries, and intentionally deferred checks are
tracked in `docs/evidence/store-page-qa-contract-v1/README.md`.
