# Store Command Canvas parity evidence

This directory binds the production cutover to the exact approved Labs source
and captures without copying the Labs shell, fixtures or role controls into the
application.

- `prototype-digest-manifest-v1.json` is the immutable SHA-256 identity input.
- `admin-web/e2e/fixtures/command-canvas-parity-harness.ts` verifies the real
  Store shell, a single production presentation owner, horizontal overflow,
  accessibility and overlay focus restoration.
- Incentives and Targets retain their completed cutover evidence in this
  directory.
- KPI Özetleri, Talep Merkezi, Norm Kadro and Görevler use the separately
  locked operational prototype manifest under
  `docs/evidence/store-operational-surfaces-command-canvas/`.
- Deterministic Playwright fixtures remain test-only and exercise the real
  production routes at 1440x900, 1024x768, 390x844 and 320x844.
- The operational closeout records a separate local parity result for each
  route. Final `Prototype parity: PASS` requires the repaired PR head's CI and
  protected staging recertification; see
  `store-operational-surfaces-command-canvas/parity-gap-audit-2026-07-17.md`.

The manifest paths are evidence locations on the authorized development host;
they are not runtime dependencies and are never read by the production bundle.
