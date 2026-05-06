# Controlled Pilot Round 1 Outcome

Date: 6 Mayis 2026

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Operating source: Power BI/Excel outputs

Final decision: `Continue` for the current controlled staging/internal pilot scope.

Broad production rollout remains `No-Go`.

This note does not approve wider rollout or new pilot users by itself.

No active route blocker remains from Round 1.

## Evidence Sources

- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`
- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`
- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`

## Routes Reviewed

Admin/support routes:

- `/admin/integrations`
- `/admin/master-data`
- `/admin/targets`
- `/admin/competitions`
- `/admin/audit`

Store routes:

- `/store`
- `/store/me`
- `/store/kpis`
- `/store/rankings`
- `/store/approvals`

## Round 1 Findings

Closed route blockers:

- `PILOT-002`: Product owner confirmed `/store/me` opened after the return-path and live no-data fixes.
- `PILOT-003`: Product owner confirmed `/store/approvals` opened after the return-path fix.
- `PILOT-004`: Ranking visibility was clarified as expected low-role behavior.

Observed confirmations:

- Product owner confirmed `/store/me` opened.
- Product owner confirmed `/store/approvals` opened.
- Product owner confirmed `/store/kpis` opened.
- Product owner confirmed `/store/rankings` opened.
- Product owner confirmed managed-store personnel details are visible.
- No demo-data issue was reported during this pass.

## Constraints That Remain

- Controlled staging/internal pilot remains `Conditional Go`.
- Broad production rollout remains `No-Go`.
- Power BI/Excel outputs remain the active operating source.
- JSON source integration is suspended for the current pilot and Power BI/Excel operating path.
- Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.
- Current master data remains an accepted temporary pilot baseline, not the final HR/master-data source of truth.
- March 2026 Power BI import remains historical pilot validation data, not proof of future monthly operation.

## Next Operating Action

Continue collecting feedback in the controlled pilot feedback log.

Run `npm.cmd run check:pilot-stabilization` before a new invitation wave or deploy that can affect pilot routes.

Do not expand scope until the next invite list, roles, and store/action assignments are explicit.

If the next pilot round includes new personas, record the exact persona, role, store/region scope, and action-store assignment before the invite.

## Evidence Safety

Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data are not recorded.

Evidence in this note is limited to route names, product-owner confirmations, issue ids, and operating decisions.

## Outcome

Round 1 supports continuing the same controlled pilot scope. It does not support broad production rollout, unsafely widening the pilot roster, direct database access, JSON/source-specific adapter work, score-math changes, or manual live `ops.*` edits.
