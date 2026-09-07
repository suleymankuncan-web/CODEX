# Verification cost evidence

Status: active
Shelf: evidence
Last verified: 2026-09-07

## Preserved boundaries

No test cases, negative security assertions, audits, image/runtime proof, worker
isolation or Playwright selection are removed. The shared documentation scope
only names reviewed operating guards and two project SKILL.md entries; unknown
scripts and operational tests still select the full release. Local advice now
agrees with that gate and lists one canonical run instead of repeating its
broad child commands. Detailed command metadata remains available to callers.
The canonical local fresh run now checks npm dependency-tree health before the
long root suite. This catches missing/invalid installations, including the stale
qs override found during PR 1 verification. It is not a package-content integrity
receipt; npm ci remains the clean-install authority and audits remain unchanged.

## Windows path-conversion microbenchmark

On this workstation, 30 lexical conversions across three distinct absolute
fixture paths used 30 cygpath processes and 1,113.4 ms before the test-only
memoization helper. Afterward they used three processes and 112.7 ms.
This measures converter setup only, not complete-suite speedup. Relative paths,
failed conversions, command outcomes, filesystem checks and permission evidence
are not cached. Separate fixtures remain separate and operator processes still
execute all original behavior checks.

## Artifact lifecycle

The previous owner-approved cleanup removed 111.19 GiB of old failed/cancelled
bundles. The new planner makes the protection rules repeatable, with read-only
default and exact-list approval before deletion. No new external deletion is
claimed by this code change. Successful package retention is not shortened.

Canonical release results and exact-head CI remain required in the PR closeout;
microbenchmarks and synthetic planner tests cannot replace them. Existing
exact-input receipts, native failed-job reuse and production build mechanisms
remain the only proof-reuse authorities; no second cache is introduced.

## Inline risk review

The retention review traced workflow inputs through plan identity and the exact
GitHub DELETE sink. Default execution is read-only, write permission is isolated
to an explicitly reviewed-plan job, PR-head code is not executed, and missing
inventory or changed protection stops deletion. Unexpected DELETE acknowledgement
is rejected. Rerun artifacts remain protected when attempt provenance is absent;
a regression test reproduces the earlier-success/later-failure ambiguity. This was root self-review, not independent-agent review. The
documented API check/delete race requires a controlled cleanup window.

Clean dependency installation also exposed existing development-only advisories:
backend 7 (5 high), frontend 10 (7 high) on the current main lockfiles. Production
audits use the unchanged --omit=dev gate and reported zero. No dependency upgrade
or suppression is included here; do not describe all development dependencies
as vulnerability-free.
