---
name: hr-axis-ui
description: Apply HR Axis operational web UI standards to Store/Admin fixes, components and approved prototypes.
---

# HR Axis operational UI

Use for Store/Admin web surfaces, not marketing pages. Follow AGENTS.md authority,
scope and reading rules. Reuse already-read rules until they change.

## Start from the existing product

Identify the route, role, component, real data source and user action. Use React
web, project shadcn/ui, Tailwind v4 `tw:` classes, lucide and AdminSurface/Store
primitives. Do not introduce React Native, a new design system, decorative heroes,
fake metrics or demo-only controls. Preserve workflow, permissions and data meaning.

## Read only the applicable standards

- Small copy/spacing/interaction fix: the relevant section of
  [UI Surface Standard](../../../docs/process/ui-surface-standard-v1.md), plus
  existing component/nearby tests. Do not regenerate a design system.
- New page/layout/redesign: [product principles](../../../docs/process/product-experience-principles.md),
  [UI execution](../../../docs/process/execution-ui.md), and the applicable
  [Store/Admin standard](../../../docs/process/store-admin-surface-standardization-v1.md).
- Prototype implementation: the full
  [prototype parity contract](../../../docs/process/execution-ui.md#prototype-to-product).
  Require approved artifact, real-data mapping, role/state matrix and desktop/mobile
  comparison. Document justified deviations; missing evidence blocks parity claims.
- Calendar: [shared calendar](../../../docs/ui/calendar-standard-v1.md).
- API/permission/workflow changes: load Sokrates and domain risk rules before acting.

## Quality pass

Check operational density, hierarchy, consistent tokens/shapes, Turkish product
copy, readable numbers and a clear primary action. Preserve loading, empty, error,
partial-data and access-denied states. Check keyboard/focus/labels/contrast, mobile
overflow, touch usability and reduced motion. Remove touched legacy/debug UI.
Use scope-appropriate visual/functional evidence; final review is self-review.
Marketing taste libraries are optional only when the user scopes marketing work.
