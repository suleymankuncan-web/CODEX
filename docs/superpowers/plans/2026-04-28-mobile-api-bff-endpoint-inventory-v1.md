# Mobile API/BFF Endpoint Inventory V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the mobile endpoint reuse/BFF boundary before building mobile screens.

**Architecture:** No runtime code changes. This is an architecture decision record linked into the handoff docs, debt ledger, and root script tests.

**Tech Stack:** Markdown documentation, Node.js built-in test runner.

---

## Task 1: Inventory Existing Endpoint Surfaces

- [x] List auth/session, feed, workflow, reporting, checklist, competition, workforce, and target-distribution endpoints relevant to mobile.
- [x] Separate endpoint reuse candidates from mobile aggregate candidates.
- [x] Keep Mobile Auth/Session V1 P0 separate from Mobile BFF.

## Task 2: Define Mobile Screen Decisions

- [x] Create a screen-by-screen table for home, tasks, store performance, my performance, rankings, feed, competitions, approvals, checklists, and profile/session.
- [x] Mark each as reuse, BFF candidate, or not ready to code.
- [x] Identify high-value first aggregates: `GET /api/mobile/home`, `GET /api/mobile/store-performance`, and `GET /api/mobile/checklists/today`.

## Task 3: Add Guarded Documentation

- [x] Add `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`.
- [x] Update `current-state.md`.
- [x] Update `docs/plans/active-next-actions.md`.
- [x] Update `docs/plans/project-debt-ledger.md`.

## Task 4: Add Contract Coverage

- [x] Add a root script test that checks the inventory keeps the BFF/auth separation, endpoint decisions, and handoff links.
- [x] Run `npm.cmd run test:scripts`.

## Task 5: Commit

- [ ] Review `git diff`.
- [ ] Commit the documentation and guard test.
