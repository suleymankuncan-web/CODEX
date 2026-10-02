# Compact Turkish admin KPI settings

Surface: `/admin/kpi-config`, existing admin shell and settings editor.
Persona: existing authorized admin users; route and action permissions stay intact.
Primary task: find one KPI rule, edit it, save the draft and review publication.
Density: compact, because the current all-open forms bury the editing task.
Archetype: long form with section navigation and a persistent action boundary.
Visual direction: existing Azure Radiance semantic tokens, flat header, one work
area, quiet dividers, readable row names and weight totals. Geist stays inherited
from the application. Palette reference only: background #f2f5ff, foreground
#06142d, card #ffffff, primary #325daf, border #dce4ff; code consumes tokens.
Primary action: publish the saved draft, with save as the prerequisite secondary
command. Existing eligibility and pending guards remain unchanged.
Data shape: existing configuration grouped into five tabs. Individual editor rows
expand on demand; publication comparison, version details and audit stay reachable.
Mobile behavior: tabs wrap without horizontal scrolling, fields stack, and save /
publish remain reachable in a sticky boundary with 44px targets.
Unchanged contract: config values, all editable fields, add/remove actions,
profile weight validation, draft / published separation, versions, query keys,
publish cache invalidation, routes, authorization, API, database and scoring.
Golden reference: none for this archetype. Reuse the compact flat header and
semantic token discipline of the promoted master-data surface only.

```text
KPI ayarları                          published / draft state
[Mağaza] [Personel] [Sorumlular] [Puan aralıkları] [Yayın]
Profile name                              total 100%
Metric name / owner                            weight
  expanded editor only when requested
Metric name / owner                            weight
                                      Add metric
Draft state                   Save draft | Publish saved draft
```

The Claude frontend-design skill was read from
`/tmp/hr-axis-claude-frontend-design-SKILL.md`. Its plan/build/critique sequence
and subject-specific content guidance apply under the project UI contract.
The initial card-summary idea was rejected: it would repeat the current long
surface. Section navigation and compact rows address the user's actual problem.
No marketing typography, route palette or decorative metrics are introduced.

Risk: R1 UI-only, reversible with one revert. The strongest failure case is hidden
fields or edits lost across tabs. Targeted tests must exercise section switching,
row edits, add/remove, weight validation, exact draft save payload and publication
cache behavior. Four viewport screenshots and keyboard checks establish bounded
local UI evidence. Any API, permission or scoring change stops this slice.

Implementation: five shared Tabs, compact expandable rows and a sticky save /
publish boundary. No configuration is split into local tab state. The parent owns
the whole draft, so edits survive tab unmounts. Blank added rows open immediately.
All metric fields (code, label, weight, owner, score behavior, notes, aliases),
ownership fields (code, label, visible roles, operational owner, contributing
profiles, task candidate) and grading fields (code, label, emoji, tone, minimum)
remain editable. Add/remove exists in all four editor sections. Optional metric
metadata stays in the exact save payload. Profile title, summary and future rule
were read-only before this change and remain read-only under Profile details.

Readable checkboxes preserve the complete KpiOwnerRole union: DEPUTY_GM,
REGION_MANAGER, STORE_MANAGER, STORE_PERSONNEL and VISUAL_TEAM. Contributions
preserve the exact store / personnel values. Known display defaults are localized
without rewriting persisted strings. Canonical gsm_approval and legacy GSM_ONAY
show GSM Onayı for their known default labels; custom labels stay verbatim. The
editable name/notes/aliases can therefore still contain configured English text:
translating those values silently would change the user's saved configuration.
Unknown custom profile text also stays verbatim. Audit event names are localized;
opaque actor IDs are omitted because the response provides no human display name.
Event dates, metric counts and diffs remain available.

R1 classifies this reversible presentation slice, not the importance of publishing.
The existing critical publish guards are unchanged: both profile weight totals
must be exactly 100, no save/publish request may already be pending, and the server
must report an unpublished saved draft. Publish still uses that saved draft and
invalidates ranking cache; saving does not. Version metadata, comparison, historical
report explanation, audit, and the existing unavailable rollback affordance remain
in Publication and history. SUPER_ADMIN route authorization is unchanged.

Targeted validation (Node 24.21.0; no full local gate by owner instruction):

```sh
export PATH=/home/lfn-admin/.local/node-v24.21.0-linux-x64/bin:$PATH
# worktree root
npm --prefix admin-web run build:e2e
node --test scripts/admin-ui-refactor-guard.test.mjs scripts/ui-surface-standard-guard.test.mjs scripts/file-size-guard.test.mjs scripts/current-state-handoff-contract.test.mjs admin-web/scripts/localization-contract.test.mjs admin-web/scripts/active-surface-localization-contract.test.mjs
git diff --check
# admin-web
node_modules/.bin/eslint src/pages/AdminKpiConfigPage.tsx src/pages/admin-kpi-config-surface-primitives.tsx src/features/reports/kpi-config-display.ts src/features/reports/kpi-config-display.unit.test.ts src/features/localization/messages/admin-kpi-config.ts
npm exec vitest run -- src/features/reports/kpi-config-display.unit.test.ts
PLAYWRIGHT_PREVIEW_PORT=4186 PLAYWRIGHT_REUSE_EXISTING_SERVER=1 npm exec playwright test -- e2e/admin-kpi-config.spec.ts e2e/kpi-config-surfaces.spec.ts e2e/kpi-config-versioning.spec.ts --grep 'admin KPI|seven KPI|publishing refreshes' --workers=1
```

Build and affected lint pass; 34 guard cases, four display unit cases and sixteen
scoped browser cases pass.
The source-file budget is tightened from 1363 to 1251 lines, not relaxed. The
sixteen scoped browser cases cover governance, editable fields, invalid totals,
row context, exact payload and state across tabs, add/remove, keyboard / retry,
loading / empty / audit failure, negative HR_ADMIN access, ranking invalidation,
version metadata, shared primitive migration and four dense seven-KPI viewports.
Dense checks assert no horizontal overflow, bounded page height, 44px mobile
targets, controls in the first viewport, complete role choices and notifications
above the action bar. The toast assertion polls its unchanged geometry threshold
through Sonner's entry animation rather than inspecting the moving initial frame.

Before screenshots are in ignored `outputs/admin-kpi-settings-before/`, named
`kpi-settings-{1440x900,1024x768,390x844,360x800}.png`.
For the same two-KPI fixture, full-page image heights change from 4354 to 900px
at 1440px, 4588 to 768px at 1024px, 8399 to 968px at 390px and 8263 to 968px
at 360px. These compare the initial collapsed editor with the previous all-open
page; expanded fields and publication history remain scrollable on demand.
Final screenshots are generated by the scoped tests under `admin-web/test-results/`:

- `kpi-config-surfaces-admin--88785-ves-without-legacy-remnants-chromium/`:
  `kpi-settings-{1440x900,1024x768,390x844,360x800}.png` (same fixture as before).
- `kpi-config-surfaces-seven--d5f38-nded-and-usable-at-1440x900-chromium/`
- `kpi-config-surfaces-seven--1a52e-nded-and-usable-at-1024x768-chromium/`
- `kpi-config-surfaces-seven--119af-unded-and-usable-at-390x844-chromium/`
- `kpi-config-surfaces-seven--66c39-unded-and-usable-at-360x800-chromium/`

Each dense directory contains `kpi-settings-dense-{viewport}.png`,
`kpi-settings-editor-{viewport}.png`, `kpi-settings-publication-{viewport}.png`
and `kpi-settings-toast-{viewport}.png`. Final captures include the feedback
control moved away from publish and the corrected inherited row typography.
Finite CSS animations are disabled for screenshot capture so shell transitions
during viewport resizing do not become misleading final evidence. Loading, empty
and audit error captures are under
`admin-kpi-config-admin-KPI-85f44-ty-and-audit-failure-states-chromium/`, named
`kpi-settings-{loading,empty,audit-error}-390x844.png`.

Self-review: GO after final targeted browser evidence. No remaining actionable
finding in the slice. No backend, schema, package, route, role boundary, API or
scoring change. Integration review and canonical required CI remain the parent's
publication gates; this local result makes no deployment or production claim.
