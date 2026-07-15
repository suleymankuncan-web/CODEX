---
name: hr-axis-prototype-standard
description: Build or review HR Axis / Store Ops operational prototypes using the approved Command Canvas visual and interaction standard. Use whenever the user asks for an HR Axis prototype, visual direction, SaaS panel, dashboard or workbench, checklist or visit-planning surface, Living Store Record timeline, role-specific Report Viewer, Region Manager, or Store Manager UI, or asks future prototypes to match the accepted Command Canvas typography, colors, density, responsive behavior, and hierarchy. This skill does not authorize business, auth, API, database, scoring, provider, deployment, or production changes.
---

<objective>
Make future HR Axis operational prototypes feel like one product family without
copying the checklist workflow into unrelated domains.

Treat the approved Command Canvas as the canonical visual and interaction
grammar. Preserve the target workflow, data truth, and role contract.
</objective>

<required_reads>
Before designing:

1. Read `current-state.md` and the UI/UX section of `discipline.md`.
2. Read `.agents/skills/hr-axis-ui-refactor/SKILL.md` for prototype/production
   boundaries.
3. Read `docs/process/product-experience-principles.md` and
   `docs/process/ui-surface-standard-v1.md`.
4. Read every reference in this skill:
   - `references/visual-contract.md`
   - `references/interaction-responsive-contract.md`
   - `references/role-hierarchy-contract.md`
   - `references/verification-contract.md`
5. Inspect the target workflow, current page, data model, and mobile behavior.
</required_reads>

<authority>
Apply this precedence:

1. Explicit user direction and business/auth/API/DB/workflow truth.
2. `sokrates.md`, `discipline.md`, and product-experience principles.
3. This Command Canvas prototype standard.
4. `hr-axis-ui-refactor` production/refactor orchestration.
5. Production shadcn/Tailwind/semantic-token rules.
6. Taste-skill as an anti-slop quality pass.

Never let visual consistency override role, permission, data, or workflow truth.
</authority>

<workflow>
1. **Classify the artifact.** Mark it as free visual exploration,
   production-bound prototype, or approved-prototype translation.
2. **Lock the user decision.** State persona, primary decision, primary action,
   operational density, and what must not change.
3. **Map real states.** Inventory metrics, statuses, filters, table/list fields,
   actions, loading, empty, error, access, and partial-data states. Do not invent
   production claims or business values.
4. **Apply the visual contract.** Use the canonical typography, semantic color,
   spacing, radius, surface, metric, table, and overlay rhythm. Adapt the page
   shape to the workflow; do not clone checklist content.
5. **Apply role hierarchy.** Derive every metric, row, filter count, plan,
   audit record, and drawer from the same role-scoped source.
6. **Apply interaction rules.** Use compact commands, text-integrated sorting,
   responsive filters, drawers/dialogs, clear focus, outside-click/Escape, and
   honest action feedback.
7. **Design mobile as a first-class surface.** Convert dense tables to readable
   operational cards or controlled layouts. Do not accept horizontal page
   overflow as the default solution.
8. **Run the taste pass.** Reject hero marketing language, decorative orbs,
   generic AI-purple dashboards, filler cards, fake metrics, and excessive
   animation.
9. **Verify mechanically and visually.** Follow
   `references/verification-contract.md` before calling the prototype ready.
10. **Translate intentionally.** For production, remove demo role switchers and
    fixtures, map visible values/actions to real contracts, and preserve the
    accepted surface through project components and semantic tokens.
</workflow>

<prototype_boundary>
Free-design prototypes may use isolated React/CSS and custom compositions.
They must still follow this visual and interaction grammar.

Production-bound prototypes must declare the component/token mapping before
implementation. Production uses project shadcn components, Tailwind `tw:`
utilities, semantic tokens, lucide icons, and Store/Admin primitives where
applicable. Do not copy raw prototype hex values into route TSX.

The external reference implementation may exist at
`D:\hr-axis-external-lab\prototypes\store-checklists-three-concepts-v1`, but
the skill references are authoritative and self-contained. Do not depend on
that lab being present.
</prototype_boundary>

<non_negotiables>
- Use DM Sans for body/control copy and Manrope for page titles and key values.
- Keep typography upright; do not use decorative italic copy.
- Keep the first viewport compact, decision-oriented, and operational.
- Give each metric one small meaningful lucide icon.
- Keep plum/blue/cyan as restrained brand emphasis; reserve semantic state
  colors for success, warning, danger, and information.
- Keep visible values data-backed or show an honest empty/partial state.
- Keep Report Viewer read-only, Region Manager operational within its region,
  and Store Manager limited to its own store when those roles apply.
- Keep desktop and mobile product hierarchy equivalent.
- Keep product copy short, Turkish, concrete, and free of implementation terms.
</non_negotiables>

<done_criteria>
- Target workflow and persona are explicit.
- Visual, interaction, responsive, and role contracts are satisfied.
- Loading, empty, error, access, and partial-data states are represented.
- Required viewport and overflow checks pass.
- Keyboard focus, Escape, outside-click, and focus restoration work where used.
- Demo-only role switching and fixture data are identified before production.
- Production translation reports prototype parity only after desktop/mobile
  visual inspection.
</done_criteria>
