# Store Command Canvas parity evidence

This directory binds the production cutover to the exact approved Labs source
and captures without copying the Labs shell, fixtures or role controls into the
application.

- `prototype-digest-manifest-v1.json` is the immutable SHA-256 identity input.
- `admin-web/e2e/fixtures/command-canvas-parity-harness.ts` verifies the real
  Store shell, a single production presentation owner, horizontal overflow,
  accessibility and overlay focus restoration.
- PR 4 through PR 6 must use the harness against real production routes with
  deterministic network fixtures owned only by Playwright.
- PR 7 records separate `Prototype parity: PASS` results for Incentives and
  Targets at 1440x900, 1024x768, 390x844 and 320x844.

The manifest paths are evidence locations on the authorized development host;
they are not runtime dependencies and are never read by the production bundle.
