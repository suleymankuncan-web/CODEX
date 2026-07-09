# Workspace Hygiene Inventory - 2026-07-09

Status: active
Shelf: operating
Use when: evaluating branch, worktree, remote-ref, or stash cleanup candidates
Do not use when: authorizing deletion or inferring squash-merge ancestry
Last verified: 2026-07-09
Source of truth: local git state plus live GitHub PR metadata

## Decision

This is a classification snapshot, not cleanup authorization. No branch,
worktree, remote ref, or stash was deleted, dropped, applied, moved, reset,
or rewritten while producing it.

Classification meanings:

- `merged`: a matching GitHub PR head ref has a merged PR.
- `superseded`: a closed PR has an explicit superseded/recreated explanation.
- `dirty`: an attached worktree contains uncommitted paths.
- `unknown`: GitHub/worktree evidence is insufficient for a safe decision.
- `preserve`: root/current work or stash state that must remain untouched.

A `merged` or `superseded` label means candidate for later owner review only.
Squash merges make branch ancestry insufficient as deletion proof. Cleanup
requires a separate explicit owner instruction.

## Snapshot Summary

| Item | Count | Note |
| --- | ---: | --- |
| Local branches at session start | 95 | Before creating the active alignment branch. |
| Local branches including active alignment branch | 96 | Current inventory table. |
| Remote `codex/*` branches | 48 | Live remote snapshot. |
| Worktrees | 37 | Root included. |
| Stashes | 8 | Every stash is `preserve`. |
| Pre-existing dirty non-root worktrees | 1 | Must not be removed or moved. |

Branch/ref classifications:

| Classification | Count |
| --- | ---: |
| `merged` | 83 |
| `superseded` | 1 |
| `dirty` | 1 |
| `unknown` | 10 |
| `preserve` | 2 |

## Branch And Remote Ref Inventory

| Branch | Location | Class | Worktree | Evidence |
| --- | --- | --- | --- | --- |
| `codex/store-command-surface-parity-root` | local + remote | `dirty` | `D:/store-ops-workspace-prototype-parity` | Attached worktree has 1 uncommitted path(s); preserve pending owner review. |
| `codex/admin-auth-workbench-pr2-model` | local | `merged` | - | [PR #832](https://github.com/suleymankuncan-web/CODEX/pull/832) merged; matching GitHub head ref. |
| `codex/admin-operational-pr6-auth-audit-feedback` | local | `merged` | - | [PR #827](https://github.com/suleymankuncan-web/CODEX/pull/827) merged; matching GitHub head ref. |
| `codex/admin-operational-pr7-feed` | local | `merged` | - | [PR #828](https://github.com/suleymankuncan-web/CODEX/pull/828) merged; matching GitHub head ref. |
| `codex/admin-operational-pr8-session-park` | local | `merged` | - | [PR #829](https://github.com/suleymankuncan-web/CODEX/pull/829) merged; matching GitHub head ref. |
| `codex/admin-ui-modernization-v1-closeout` | local + remote | `merged` | - | [PR #601](https://github.com/suleymankuncan-web/CODEX/pull/601) merged; matching GitHub head ref. |
| `codex/allow-incentive-close-unmatched-kpi-employees` | local + remote | `merged` | - | [PR #763](https://github.com/suleymankuncan-web/CODEX/pull/763) merged; matching GitHub head ref. |
| `codex/backend-multer-audit-override` | local + remote | `merged` | - | [PR #735](https://github.com/suleymankuncan-web/CODEX/pull/735) merged; matching GitHub head ref. |
| `codex/capacity-plan-closeout` | local + remote | `merged` | - | [PR #721](https://github.com/suleymankuncan-web/CODEX/pull/721) merged; matching GitHub head ref. |
| `codex/fix-csrf-upload-route-refresh` | local + remote | `merged` | - | [PR #722](https://github.com/suleymankuncan-web/CODEX/pull/722) merged; matching GitHub head ref. |
| `codex/fix-gsm-migration-checksum` | local | `merged` | - | [PR #782](https://github.com/suleymankuncan-web/CODEX/pull/782) merged; matching GitHub head ref. |
| `codex/fix-imported-personnel-final-rows` | local + remote | `merged` | - | [PR #761](https://github.com/suleymankuncan-web/CODEX/pull/761) merged; matching GitHub head ref. |
| `codex/fix-incentive-imported-targets` | local + remote | `merged` | - | [PR #760](https://github.com/suleymankuncan-web/CODEX/pull/760) merged; matching GitHub head ref. |
| `codex/fix-incentive-sales-read-import-metadata` | local + remote | `merged` | - | [PR #759](https://github.com/suleymankuncan-web/CODEX/pull/759) merged; matching GitHub head ref. |
| `codex/fix-kpi-definition-migration` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-gsm-migration-checksum` | [PR #783](https://github.com/suleymankuncan-web/CODEX/pull/783) merged; matching GitHub head ref. |
| `codex/fix-personnel-display-name-fallback` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-personnel-display-name-fallback` | [PR #818](https://github.com/suleymankuncan-web/CODEX/pull/818) merged; matching GitHub head ref. |
| `codex/fix-pilot-smoke-refresh-api-routing` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-pilot-smoke-refresh-api-routing` | [PR #739](https://github.com/suleymankuncan-web/CODEX/pull/739) merged; matching GitHub head ref. |
| `codex/fix-region-incentives-nav-late` | local + remote | `merged` | - | [PR #762](https://github.com/suleymankuncan-web/CODEX/pull/762) merged; matching GitHub head ref. |
| `codex/fix-region-targets-visibility` | local + remote | `merged` | - | [PR #764](https://github.com/suleymankuncan-web/CODEX/pull/764) merged; matching GitHub head ref. |
| `codex/fix-store-incentives-latest-period` | local + remote | `merged` | - | [PR #758](https://github.com/suleymankuncan-web/CODEX/pull/758) merged; matching GitHub head ref. |
| `codex/fix-target-request-month-normalization` | local + remote | `merged` | - | [PR #765](https://github.com/suleymankuncan-web/CODEX/pull/765) merged; matching GitHub head ref. |
| `codex/fix-worker-storeops-auth-import` | local + remote | `merged` | - | [PR #536](https://github.com/suleymankuncan-web/CODEX/pull/536) merged; matching GitHub head ref. |
| `codex/incentive-instant-review-feedback` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pr-766-incentive-instant-review-feedback` | [PR #766](https://github.com/suleymankuncan-web/CODEX/pull/766) merged; matching GitHub head ref. |
| `codex/incentive-rm-approval-pr1` | local | `merged` | - | [PR #749](https://github.com/suleymankuncan-web/CODEX/pull/749) merged; matching GitHub head ref. |
| `codex/incentive-rm-approval-pr2` | local | `merged` | - | [PR #750](https://github.com/suleymankuncan-web/CODEX/pull/750) merged; matching GitHub head ref. |
| `codex/incentive-rm-approval-pr3` | local | `merged` | - | [PR #751](https://github.com/suleymankuncan-web/CODEX/pull/751) merged; matching GitHub head ref. |
| `codex/incentive-rm-approval-pr4` | local + remote | `merged` | - | [PR #752](https://github.com/suleymankuncan-web/CODEX/pull/752) merged; matching GitHub head ref. |
| `codex/incentive-rm-approval-pr5` | local + remote | `merged` | - | [PR #753](https://github.com/suleymankuncan-web/CODEX/pull/753) merged; matching GitHub head ref. |
| `codex/incentives-reports-excel-fix` | local | `merged` | `D:/store-ops-workspace-incentives-reports-fix` | [PR #813](https://github.com/suleymankuncan-web/CODEX/pull/813) merged; matching GitHub head ref. |
| `codex/login-spacing-v1` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/login-spacing-v1` | [PR #507](https://github.com/suleymankuncan-web/CODEX/pull/507) merged; matching GitHub head ref. |
| `codex/personnel-profile-independent-date-scope-v1` | local | `merged` | - | [PR #109](https://github.com/suleymankuncan-web/CODEX/pull/109) merged; matching GitHub head ref. |
| `codex/personnel-sales-target-apply` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/personnel-sales-target-jan-jun` | [PR #888](https://github.com/suleymankuncan-web/CODEX/pull/888) merged; matching GitHub head ref. |
| `codex/personnel-sales-target-jan-jun` | local + remote | `merged` | - | [PR #887](https://github.com/suleymankuncan-web/CODEX/pull/887) merged; matching GitHub head ref. |
| `codex/pilot-admin-bm-preflight-evidence` | local + remote | `merged` | - | [PR #787](https://github.com/suleymankuncan-web/CODEX/pull/787) merged; matching GitHub head ref. |
| `codex/pilot-pr0-auth-session-redirect-stability` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr0-auth-session-redirect-stability` | [PR #880](https://github.com/suleymankuncan-web/CODEX/pull/880) merged; matching GitHub head ref. |
| `codex/pilot-pr1-roster-reconciliation-dry-run` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr1-roster-reconciliation-dry-run` | [PR #881](https://github.com/suleymankuncan-web/CODEX/pull/881) merged; matching GitHub head ref. |
| `codex/pilot-pr2-roster-target-snapshot-apply` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr2-roster-target-snapshot-apply` | [PR #882](https://github.com/suleymankuncan-web/CODEX/pull/882) merged; matching GitHub head ref. |
| `codex/pilot-pr3-ranking-eligibility-alignment` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr3-ranking-eligibility-alignment` | [PR #883](https://github.com/suleymankuncan-web/CODEX/pull/883) merged; matching GitHub head ref. |
| `codex/pilot-pr4-store-me-rankings-visual-polish` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr4-store-me-rankings-visual-polish` | [PR #884](https://github.com/suleymankuncan-web/CODEX/pull/884) merged; matching GitHub head ref. |
| `codex/pilot-preflight-checklist` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-preflight-checklist` | [PR #785](https://github.com/suleymankuncan-web/CODEX/pull/785) merged; matching GitHub head ref. |
| `codex/pilot-preflight-hygiene` | local + remote | `merged` | - | [PR #786](https://github.com/suleymankuncan-web/CODEX/pull/786) merged; matching GitHub head ref. |
| `codex/pilot-roster-live-apply-runner` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-roster-live-apply-runner` | [PR #889](https://github.com/suleymankuncan-web/CODEX/pull/889) merged; matching GitHub head ref. |
| `codex/project-wide-display-names` | local + remote | `merged` | - | [PR #806](https://github.com/suleymankuncan-web/CODEX/pull/806) merged; matching GitHub head ref. |
| `codex/rankings-correctness-v1` | local | `merged` | - | [PR #84](https://github.com/suleymankuncan-web/CODEX/pull/84) merged; matching GitHub head ref. |
| `codex/rankings-mobile-row-fix` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-mobile-row-fix` | [PR #780](https://github.com/suleymankuncan-web/CODEX/pull/780) merged; matching GitHub head ref. |
| `codex/rankings-short-headers` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-short-headers` | [PR #784](https://github.com/suleymankuncan-web/CODEX/pull/784) merged; matching GitHub head ref. |
| `codex/rankings-table-width-fix` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-table-width-fix` | [PR #781](https://github.com/suleymankuncan-web/CODEX/pull/781) merged; matching GitHub head ref. |
| `codex/render-bullmq-worker` | local + remote | `merged` | - | [PR #534](https://github.com/suleymankuncan-web/CODEX/pull/534) merged; matching GitHub head ref. |
| `codex/report-kpi-consistency-fix` | local | `merged` | `D:/store-ops-workspace-report-kpi-consistency-fix` | [PR #815](https://github.com/suleymankuncan-web/CODEX/pull/815) merged; matching GitHub head ref. |
| `codex/report-xlsx-stream-fix` | local | `merged` | `D:/store-ops-workspace-report-xlsx-stream-fix` | [PR #814](https://github.com/suleymankuncan-web/CODEX/pull/814) merged; matching GitHub head ref. |
| `codex/security-bug-hunt-v1` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/security-bug-hunt-v1` | [PR #506](https://github.com/suleymankuncan-web/CODEX/pull/506) merged; matching GitHub head ref. |
| `codex/store-action-cancel-reason-ui` | local | `merged` | - | [PR #445](https://github.com/suleymankuncan-web/CODEX/pull/445) merged; matching GitHub head ref. |
| `codex/store-action-close-resolution-ui` | local | `merged` | - | [PR #444](https://github.com/suleymankuncan-web/CODEX/pull/444) merged; matching GitHub head ref. |
| `codex/store-action-create-from-kpi-candidate` | local | `merged` | - | [PR #442](https://github.com/suleymankuncan-web/CODEX/pull/442) merged; matching GitHub head ref. |
| `codex/store-action-plan-store-tasks-list` | local | `merged` | - | [PR #440](https://github.com/suleymankuncan-web/CODEX/pull/440) merged; matching GitHub head ref. |
| `codex/store-action-status-update-ui` | local | `merged` | - | [PR #443](https://github.com/suleymankuncan-web/CODEX/pull/443) merged; matching GitHub head ref. |
| `codex/store-action-v1b-final-handoff` | local | `merged` | - | [PR #446](https://github.com/suleymankuncan-web/CODEX/pull/446) merged; matching GitHub head ref. |
| `codex/store-action-write-go-no-go` | local | `merged` | - | [PR #441](https://github.com/suleymankuncan-web/CODEX/pull/441) merged; matching GitHub head ref. |
| `codex/store-approvals-full-new-ui-v3` | local | `merged` | - | [PR #142](https://github.com/suleymankuncan-web/CODEX/pull/142) merged; matching GitHub head ref. |
| `codex/store-approvals-minimal-actions` | local | `merged` | - | [PR #140](https://github.com/suleymankuncan-web/CODEX/pull/140) merged; matching GitHub head ref. |
| `codex/store-checklist-flow-redesign` | local + remote | `merged` | - | [PR #535](https://github.com/suleymankuncan-web/CODEX/pull/535) merged; matching GitHub head ref. |
| `codex/store-checklist-page-polish` | local + remote | `merged` | - | [PR #537](https://github.com/suleymankuncan-web/CODEX/pull/537) merged; matching GitHub head ref. |
| `codex/store-checklist-revisions` | local + remote | `merged` | - | [PR #539](https://github.com/suleymankuncan-web/CODEX/pull/539) merged; matching GitHub head ref. |
| `codex/store-home-command-v1-production` | local + remote | `merged` | - | [PR #816](https://github.com/suleymankuncan-web/CODEX/pull/816) merged; matching GitHub head ref. |
| `codex/store-home-visit-priority-pending-fix` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-home-command-v1-production` | [PR #817](https://github.com/suleymankuncan-web/CODEX/pull/817) merged; matching GitHub head ref. |
| `codex/store-incentives-prototype-parity` | local + remote | `merged` | - | [PR #754](https://github.com/suleymankuncan-web/CODEX/pull/754) merged; matching GitHub head ref. |
| `codex/store-kpis-selected-store-contract` | local + remote | `merged` | - | [PR #650](https://github.com/suleymankuncan-web/CODEX/pull/650) merged; matching GitHub head ref. |
| `codex/store-rankings-premium-implementation` | local + remote | `merged` | - | [PR #615](https://github.com/suleymankuncan-web/CODEX/pull/615) merged; matching GitHub head ref. |
| `codex/store-reports-evidence-pr3` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-evidence-pr3` | [PR #811](https://github.com/suleymankuncan-web/CODEX/pull/811) merged; matching GitHub head ref. |
| `codex/store-reports-package-pr1` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-package-pr1` | [PR #809](https://github.com/suleymankuncan-web/CODEX/pull/809) merged; matching GitHub head ref. |
| `codex/store-reports-ui-pr2` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-ui-pr2` | [PR #810](https://github.com/suleymankuncan-web/CODEX/pull/810) merged; matching GitHub head ref. |
| `codex/store-surfaces-hygiene-pr4` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-hygiene-pr4` | [PR #812](https://github.com/suleymankuncan-web/CODEX/pull/812) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr1a-incentives-ux` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr1a-incentives-ux` | [PR #773](https://github.com/suleymankuncan-web/CODEX/pull/773) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr1b-workforce-rankings` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr1b-workforce-rankings` | [PR #774](https://github.com/suleymankuncan-web/CODEX/pull/774) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr2-route-state-contract` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr2-route-state-contract` | [PR #775](https://github.com/suleymankuncan-web/CODEX/pull/775) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr3-incentive-target-data` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr3-incentive-target-data` | [PR #776](https://github.com/suleymankuncan-web/CODEX/pull/776) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr4-gsm-approval-kpi` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr4-gsm-approval-kpi` | [PR #777](https://github.com/suleymankuncan-web/CODEX/pull/777) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr5-checklist-workflow-hub` | local + remote | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr5-checklist-workflow-hub` | [PR #778](https://github.com/suleymankuncan-web/CODEX/pull/778) merged; matching GitHub head ref. |
| `codex/store-surfaces-pr6-standardization` | local | `merged` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr6-standardization` | [PR #779](https://github.com/suleymankuncan-web/CODEX/pull/779) merged; matching GitHub head ref. |
| `codex/store-targets-contract-surface` | local + remote | `merged` | - | [PR #541](https://github.com/suleymankuncan-web/CODEX/pull/541) merged; matching GitHub head ref. |
| `codex/store-tasks-action-plan-names` | local + remote | `merged` | - | [PR #805](https://github.com/suleymankuncan-web/CODEX/pull/805) merged; matching GitHub head ref. |
| `codex/targets-width-density-fix` | local + remote | `merged` | - | [PR #802](https://github.com/suleymankuncan-web/CODEX/pull/802) merged; matching GitHub head ref. |
| `codex/update-current-state-worker-checklist` | remote | `merged` | - | [PR #538](https://github.com/suleymankuncan-web/CODEX/pull/538) merged; matching GitHub head ref. |
| `codex/v4-pr6-store-targets-e2e-split` | local + remote | `merged` | - | [PR #577](https://github.com/suleymankuncan-web/CODEX/pull/577) merged; matching GitHub head ref. |
| `codex/operating-truth-alignment-v1` | local | `preserve` | `D:/store-ops-workspace` | Active operating-truth alignment branch. |
| `main` | local | `preserve` | - | Canonical root branch; never a cleanup candidate. |
| `codex/require-ui-redesign-stack` | local + remote | `superseded` | - | [PR #526](https://github.com/suleymankuncan-web/CODEX/pull/526) closed with an explicit superseded/recreated explanation. |
| `codex/api-contract-prep-notes` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/app-wide-surface-load-audit-v1` | local + remote | `unknown` | - | [PR #133](https://github.com/suleymankuncan-web/CODEX/pull/133) closed without durable superseded evidence in this inventory. |
| `codex/checklist-command-prototype` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/fix-refresh-route-redirect` | local + remote | `unknown` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-refresh-route-redirect` | [PR #7](https://github.com/suleymankuncan-web/CODEX/pull/7) closed without durable superseded evidence in this inventory. |
| `codex/incentives-drawer-edit-fix` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/pilot-preflight-store-readiness-v1` | local | `unknown` | `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-preflight-store-readiness-v1` | No matching merged or explicitly superseded GitHub PR found. |
| `codex/sokrates-calibration-v2` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/store-checklist-session-modal` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/store-home-me-prototypes` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |
| `codex/technical-roadmap-v1` | local | `unknown` | - | No matching merged or explicitly superseded GitHub PR found. |

## Worktree Inventory

| Path | Branch | Class | Dirty paths | Evidence |
| --- | --- | --- | ---: | --- |
| `D:/store-ops-workspace-prototype-parity` | `codex/store-command-surface-parity-root` | `dirty` | 1 | 1 uncommitted path(s); do not move or remove. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-gsm-migration-checksum` | `codex/fix-kpi-definition-migration` | `merged` | 0 | [PR #783](https://github.com/suleymankuncan-web/CODEX/pull/783) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-personnel-display-name-fallback` | `codex/fix-personnel-display-name-fallback` | `merged` | 0 | [PR #818](https://github.com/suleymankuncan-web/CODEX/pull/818) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-pilot-smoke-refresh-api-routing` | `codex/fix-pilot-smoke-refresh-api-routing` | `merged` | 0 | [PR #739](https://github.com/suleymankuncan-web/CODEX/pull/739) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/login-spacing-v1` | `codex/login-spacing-v1` | `merged` | 0 | [PR #507](https://github.com/suleymankuncan-web/CODEX/pull/507) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/personnel-sales-target-jan-jun` | `codex/personnel-sales-target-apply` | `merged` | 0 | [PR #888](https://github.com/suleymankuncan-web/CODEX/pull/888) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr0-auth-session-redirect-stability` | `codex/pilot-pr0-auth-session-redirect-stability` | `merged` | 0 | [PR #880](https://github.com/suleymankuncan-web/CODEX/pull/880) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr1-roster-reconciliation-dry-run` | `codex/pilot-pr1-roster-reconciliation-dry-run` | `merged` | 0 | [PR #881](https://github.com/suleymankuncan-web/CODEX/pull/881) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr2-roster-target-snapshot-apply` | `codex/pilot-pr2-roster-target-snapshot-apply` | `merged` | 0 | [PR #882](https://github.com/suleymankuncan-web/CODEX/pull/882) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr3-ranking-eligibility-alignment` | `codex/pilot-pr3-ranking-eligibility-alignment` | `merged` | 0 | [PR #883](https://github.com/suleymankuncan-web/CODEX/pull/883) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-pr4-store-me-rankings-visual-polish` | `codex/pilot-pr4-store-me-rankings-visual-polish` | `merged` | 0 | [PR #884](https://github.com/suleymankuncan-web/CODEX/pull/884) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-preflight-checklist` | `codex/pilot-preflight-checklist` | `merged` | 0 | [PR #785](https://github.com/suleymankuncan-web/CODEX/pull/785) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-roster-live-apply-runner` | `codex/pilot-roster-live-apply-runner` | `merged` | 0 | [PR #889](https://github.com/suleymankuncan-web/CODEX/pull/889) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pr-766-incentive-instant-review-feedback` | `codex/incentive-instant-review-feedback` | `merged` | 0 | [PR #766](https://github.com/suleymankuncan-web/CODEX/pull/766) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-mobile-row-fix` | `codex/rankings-mobile-row-fix` | `merged` | 0 | [PR #780](https://github.com/suleymankuncan-web/CODEX/pull/780) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-short-headers` | `codex/rankings-short-headers` | `merged` | 0 | [PR #784](https://github.com/suleymankuncan-web/CODEX/pull/784) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/rankings-table-width-fix` | `codex/rankings-table-width-fix` | `merged` | 0 | [PR #781](https://github.com/suleymankuncan-web/CODEX/pull/781) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/security-bug-hunt-v1` | `codex/security-bug-hunt-v1` | `merged` | 0 | [PR #506](https://github.com/suleymankuncan-web/CODEX/pull/506) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-home-command-v1-production` | `codex/store-home-visit-priority-pending-fix` | `merged` | 0 | [PR #817](https://github.com/suleymankuncan-web/CODEX/pull/817) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-evidence-pr3` | `codex/store-reports-evidence-pr3` | `merged` | 0 | [PR #811](https://github.com/suleymankuncan-web/CODEX/pull/811) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-package-pr1` | `codex/store-reports-package-pr1` | `merged` | 0 | [PR #809](https://github.com/suleymankuncan-web/CODEX/pull/809) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-reports-ui-pr2` | `codex/store-reports-ui-pr2` | `merged` | 0 | [PR #810](https://github.com/suleymankuncan-web/CODEX/pull/810) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-hygiene-pr4` | `codex/store-surfaces-hygiene-pr4` | `merged` | 0 | [PR #812](https://github.com/suleymankuncan-web/CODEX/pull/812) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr1a-incentives-ux` | `codex/store-surfaces-pr1a-incentives-ux` | `merged` | 0 | [PR #773](https://github.com/suleymankuncan-web/CODEX/pull/773) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr1b-workforce-rankings` | `codex/store-surfaces-pr1b-workforce-rankings` | `merged` | 0 | [PR #774](https://github.com/suleymankuncan-web/CODEX/pull/774) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr2-route-state-contract` | `codex/store-surfaces-pr2-route-state-contract` | `merged` | 0 | [PR #775](https://github.com/suleymankuncan-web/CODEX/pull/775) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr3-incentive-target-data` | `codex/store-surfaces-pr3-incentive-target-data` | `merged` | 0 | [PR #776](https://github.com/suleymankuncan-web/CODEX/pull/776) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr4-gsm-approval-kpi` | `codex/store-surfaces-pr4-gsm-approval-kpi` | `merged` | 0 | [PR #777](https://github.com/suleymankuncan-web/CODEX/pull/777) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr5-checklist-workflow-hub` | `codex/store-surfaces-pr5-checklist-workflow-hub` | `merged` | 0 | [PR #778](https://github.com/suleymankuncan-web/CODEX/pull/778) merged; matching GitHub head ref. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/store-surfaces-pr6-standardization` | `codex/store-surfaces-pr6-standardization` | `merged` | 0 | [PR #779](https://github.com/suleymankuncan-web/CODEX/pull/779) merged; matching GitHub head ref. |
| `D:/store-ops-workspace-incentives-reports-fix` | `codex/incentives-reports-excel-fix` | `merged` | 0 | [PR #813](https://github.com/suleymankuncan-web/CODEX/pull/813) merged; matching GitHub head ref. |
| `D:/store-ops-workspace-report-kpi-consistency-fix` | `codex/report-kpi-consistency-fix` | `merged` | 0 | [PR #815](https://github.com/suleymankuncan-web/CODEX/pull/815) merged; matching GitHub head ref. |
| `D:/store-ops-workspace-report-xlsx-stream-fix` | `codex/report-xlsx-stream-fix` | `merged` | 0 | [PR #814](https://github.com/suleymankuncan-web/CODEX/pull/814) merged; matching GitHub head ref. |
| `D:/store-ops-workspace` | `codex/operating-truth-alignment-v1` | `preserve` | 2 | Root workspace for the active operating-truth alignment branch. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/fix-refresh-route-redirect` | `codex/fix-refresh-route-redirect` | `unknown` | 0 | [PR #7](https://github.com/suleymankuncan-web/CODEX/pull/7) closed without durable superseded evidence in this inventory. |
| `C:/Users/suley/.config/superpowers/worktrees/store-ops-workspace/pilot-preflight-store-readiness-v1` | `codex/pilot-preflight-store-readiness-v1` | `unknown` | 0 | No matching merged or explicitly superseded GitHub PR found. |
| `D:/store-ops-workspace-workforce-pr` | `(detached)` | `unknown` | 0 | Detached clean worktree; no branch-level PR classification is available. |

## Stash Inventory

| Stash | Date | Class | Message |
| --- | --- | --- | --- |
| `stash@{2026-07-06T09:08:48+03:00}` | 2026-07-06 09:08:48 +0300 | `preserve` | On main: pre-main-pull-docs-2026-07-06 |
| `stash@{2026-07-05T10:25:57+03:00}` | 2026-07-05 10:25:57 +0300 | `preserve` | On codex/store-me-share-card-production-v1: codex cleanup backup before current-state refresh 2026-07-05 |
| `stash@{2026-06-29T23:34:20+03:00}` | 2026-06-29 23:34:20 +0300 | `preserve` | On codex/store-home-me-prototypes: wip store prototype surfaces before pilot preflight hygiene |
| `stash@{2026-06-23T00:32:30+03:00}` | 2026-06-23 00:32:30 +0300 | `preserve` | On codex/checklist-command-prototype: dirty-hygiene-2026-06-23-park-old-prototypes |
| `stash@{2026-06-04T19:40:49+03:00}` | 2026-06-04 19:40:49 +0300 | `preserve` | On main: park unrelated Geist package changes during Store KPIs PR train |
| `stash@{2026-05-29T15:14:52+03:00}` | 2026-05-29 15:14:52 +0300 | `preserve` | On codex/store-checklist-revisions: codex-local-unmerged-checklist-autosave-refetch |
| `stash@{2026-05-28T18:55:22+03:00}` | 2026-05-28 18:55:22 +0300 | `preserve` | On codex/render-bullmq-worker: checklist-flow-redesign-wip |
| `stash@{2026-05-21T21:44:08+03:00}` | 2026-05-21 21:44:08 +0300 | `preserve` | On codex/upload-resource-guardrails: codex hygiene backup 2026-05-21 root dirty state |

## Safe Follow-Up

1. Owner reviews `dirty`, `unknown`, and `preserve` rows first.
2. For a merged or superseded candidate, verify the PR, branch tip, unique
   commits, worktree dirt, and stash relationship again on the cleanup day.
3. Produce an explicit proposed-delete list and obtain owner approval.
4. Remove worktrees, then local branches, then remote refs in separate,
   auditable steps. Stashes require separate approval.
5. Stop immediately if the live state differs from this snapshot.

The next approved project activity after this docs/process line is a separate
full project/code analysis, not workspace deletion and not a new feature train.
