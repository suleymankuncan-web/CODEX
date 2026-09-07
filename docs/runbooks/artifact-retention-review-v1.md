# Artifact retention review

Status: active
Shelf: runbook
Last verified: 2026-09-07

## Policy

Use the manual **Artifact retention review** workflow on main. An empty
`approved_plan_sha256` input is read-only: it prints the exact candidates,
bytes and plan digest. It does not delete files or change release proof.

Only failed/cancelled, completed, manually dispatched offline bundle artifacts
older than seven days are eligible. The run's latest update must also be older
than seven days. Protect all successful bundles, image/trust/receipt artifacts,
open-PR branches and head SHAs, the current default-branch SHA, all tag SHAs,
foreign repository artifacts and unknown/missing metadata. Expired artifacts
are not deletion candidates. No global retention shortening is performed.

## Applying a reviewed plan

1. Review exact artifact IDs, run/attempt identities, digests and size in the
   read-only job output. Obtain explicit approval for that exact list.
2. Dispatch the same workflow on main with its 64-character plan digest.
3. The write job reconstructs the inventory and requires an identical plan.
   It refreshes PR/tag/main protection and the exact artifact/run before each
   deletion. Any change stops the job; already deleted IDs remain in the log.
4. Verify the reported deleted IDs and retained release/rollback evidence.
   GitHub billing/quota may update later; do not use blind test reruns to probe it.

Deletion is irreversible. This workflow has no schedule, never runs PR-head
code with a write token, and does not grant blanket cleanup authority. Tags or
open branches must identify rollback candidates that were not successful runs.
The API has no atomic compare-and-delete operation; avoid rerunning affected
historical jobs during an approved cleanup window. A detected concurrent change
aborts further deletion rather than retrying it blindly.

Pagination is complete or fails closed, request timeouts are bounded, and
candidate lookup is by numeric ID on the fixed GitHub API host. Tokens are never
written to the plan. The default inventory job has read-only permissions; only
the explicit reviewed-plan job has Actions write permission.

References: [GitHub artifact API](https://docs.github.com/en/rest/actions/artifacts)
and [artifact retention behavior](https://github.com/actions/upload-artifact#retention-period).
