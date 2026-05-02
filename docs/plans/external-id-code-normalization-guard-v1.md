# External ID Code Normalization Guard V1

Date: 30 April 2026

## Purpose

KPI/materialization imports should not fail mapping just because a source sends code formatting variants such as `SM-140` instead of `SM140`, or `fm8375` instead of `FM8375`.

This guard keeps exact external-id mapping precedence, then uses a normalized fallback only when exact lookup is missing.

## Locked Behavior

- Exact `stg.external_id_map.external_id` match is still the first lookup.
- If exact lookup fails, the resolver normalizes the source external id:
  - trim
  - uppercase
  - remove whitespace
  - remove hyphens
- The fallback compares that normalized source value against normalized stored `external_id` values for the same integration source and entity type.
- If fallback resolves to one distinct `internal_id`, that id is used.
- If fallback resolves to more than one distinct `internal_id`, the resolver rejects the row as ambiguous instead of choosing silently.
- Direct internal ids still bypass external mapping and are not normalized.

## Why This Exists

Master data bootstrap already normalizes store/seller codes, but generic materialization mapping used exact external-id equality.

Real exported data can vary by formatting. This guard reduces false `unmapped_store` / `unmapped_employee` failures while keeping ambiguous mappings blocked.

## Non-Goals

- No schema change.
- No migration.
- No new endpoint.
- No new UI.
- No automatic mapping approval.
- No source-specific adapter.

## Verification

- TDD red test proved `SM-140` returned `null` when only normalized fallback could match.
- TDD red test proved ambiguous normalized matches resolved as `null` instead of failing.
- Targeted resolver test passes:
  - `npm.cmd test -- src/modules/integration/application/external-id-mapping.service.spec.ts --runInBand`
- Targeted resolver + materialization test passes:
  - `npm.cmd test -- src/modules/integration/application/external-id-mapping.service.spec.ts src/modules/integration/application/materialization.service.spec.ts --runInBand`
- Root release gate passes:
  - `npm.cmd run check:release`
