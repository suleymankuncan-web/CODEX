# Master Data Bootstrap Promotion Safety Guard V1

Date: 30 April 2026

## Purpose

Master data bootstrap promotion should never write partial live master data when a batch still contains non-promotable rows.

This guard protects `ops.store`, `ops.employee`, and `ops.employee_assignment_history` from stale or inconsistent batch counters.

## Locked Behavior

- Store promotion still requires a scoped `store` batch with status `ready_to_promote`.
- Personnel promotion still requires a scoped `personnel` batch with status `ready_to_promote`.
- Promotion may include:
  - `ready` rows, which are sent to the repository promotion command.
  - `already_promoted` rows, which stay skipped and keep evidence.
- Promotion is rejected before any repository live-write command when any non-promoted row is:
  - `needs_validation`
  - `needs_review`
  - `blocked`
  - `waiting_batch`
- The rejection includes the first blocking row id, row number, readiness state, and block reason.

## Why This Exists

Normal validation should keep batch counters consistent, but production systems must also defend against stale counters, manual DB edits, failed partial operations, or unexpected status drift.

Without this guard, a stale `ready_to_promote` batch could promote valid rows while silently leaving bad rows behind. That would make master-data baseline evidence harder to trust.

## Non-Goals

- No schema change.
- No migration.
- No endpoint change.
- No new promotion decision engine.
- No change to idempotent already-promoted row skipping.
- No user-account or Keycloak provisioning.

## Verification

- TDD red test proved stale store promotion resolved instead of rejecting.
- TDD red test proved stale personnel promotion resolved instead of rejecting.
- Targeted service test passes after the guard:
  - `npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand`
- Targeted master-data bootstrap tests pass:
  - `npm.cmd test -- master-data-bootstrap --runInBand`
- Root release gate passes:
  - `npm.cmd run check:release`
