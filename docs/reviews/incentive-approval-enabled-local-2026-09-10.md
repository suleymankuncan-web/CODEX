# Local incentive approval enablement — 2026-09-10

Owner request: enable the approval workflow and grant the user on localhost:5183 final incentive approval. Root self-review; no PR, production deployment or schema change.

## Changes

- Enabled the existing company REPORT_VIEWER assignment's individual `incentiveApproval` flag for local user `80000000-0000-0000-0000-000000000013` through the audited admin API. Fresh auth/session confirms `INCENTIVE_FINAL_APPROVAL` for the intended company. No global role permission was added.
- Prepared Ayşe Demir's two explicitly synthetic Ege stores as reviewed and submitted through the existing regional APIs. The September example remains `submitted` for the user to approve.
- Marked the ten local 5181 synthetic stores reviewed; their regional package remains editable and ready to submit.
- A real submission attempt exposed a PostgreSQL type error in the correction update: `CASE ... THEN $1 ELSE NULL` resolved to text for a UUID column. Explicit UUID casts on package and submitter parameters fix the 500 response. Existing transaction, store scope, snapshot and permission gates remain intact. Earlier unrelated edits to this repository file were preserved.

## Verification

- Backend: four targeted suites / 36 tests, lint and build passed. Submission SQL regression assertions cover both UUID parameters.
- Frontend: five final-approval browser tests passed, including unauthorized/revoked permission and exact selected package behavior. No frontend source change in this task.
- Real local API: grant, store reviews and regional submission succeeded after the fix; the API container is healthy.
- Real PostgreSQL final approval succeeded inside a rolled-back transaction using the enabled viewer. Verified afterward that the example remains `submitted`; no final approval was committed.
- Live browser: select Ayşe Demir, see `2/2 mağaza` and `Final onay ver`, open the `Prim final onayı` dialog. Cancelled the dialog to leave the example awaiting the user's action.
- Scoped `git diff --check` passed. This is local evidence, not production/provider or full release proof.

Private recovery folder: `C:/Users/suley/.codex/tmp/prim-approval-enable-20260910/` contains a pre-change DB dump, original repository file, setup script and test logs. The grant can be revoked via the same audited API with `enabled:false`; do not restore the full dump over later local work without checking its scope.

User path: `http://localhost:5183/store/incentives` → Ayşe Demir → Prim Onayı → Final onay ver → confirmation. The region manager uses `http://localhost:5181/store/incentives` → Onaya gönder.
