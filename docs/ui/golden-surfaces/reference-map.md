# Golden Surface Reference Map

This catalog is the authoritative list of HR Axis UI golden references. It
prevents vague instructions such as "make it premium" or "copy the good page"
from becoming implementation decisions.

## How A Surface Becomes Golden

A surface is promoted only when:

- its production route and source component are named,
- its archetype and persona are explicit,
- loading, empty, error, access, populated, and overlay states are verified when
  applicable,
- `1440x900`, `1024x768`, `390x844`, and `360x800` evidence exists,
- keyboard and mobile interaction checks pass,
- the reference contains no technical identity copy, raw route palette, nested
  overlay flash, or horizontal overflow,
- its data, auth, API, workflow, and scoring contracts are unchanged by visual
  approval.

Golden status means the named decisions may be reused. It does not authorize
copying the entire page into a different archetype.

## Active References

| Reference | Archetype | Route and source | Reuse | Do not copy |
| --- | --- | --- | --- | --- |
| Mağaza ve personel | List and management | `/admin/master-data`; `admin-web/src/pages/MasterDataManagementPage.tsx` | compact header, unified toolbar, desktop rows, mobile records, searchable assignments, human-readable identities | master-data fields, permissions, or personnel workflow |

## Promotion Queue

| Candidate | Intended archetype | Promotion requirement |
| --- | --- | --- |
| Region manager incentive workspace | Operational workbench | Add the exact `360x800` production-route evidence and re-check overlay close and mobile action reachability. |
| Checklist execution | Long form or checklist | Add the exact `360x800` production-route evidence and verify 50-item section and sticky-action behavior. |
| Checklist result | Result or report | Add the four exact viewports and verify long evidence, score semantics, and overlay close behavior. |
| Record history drawer | Detail or audit | One production drawer must prove fixed header/footer, body-only scroll, clean route-state close, and mobile full-width behavior. |

## Evidence Naming

When screenshot evidence is committed, use:

```text
admin-web/e2e/<surface>.spec.ts-snapshots/
  <reference>-1440x900-<browser>-<platform>.png
  <reference>-1024x768-<browser>-<platform>.png
  <reference>-390x844-<browser>-<platform>.png
  <reference>-360x800-<browser>-<platform>.png
```

The Playwright test owns the screenshot. Do not paste screenshots into a docs
folder without a reproducible route fixture and assertion path.

## Review Use

For every UI PR, state:

- selected archetype,
- matching golden reference,
- decisions reused,
- intentional deviations,
- four viewport evidence locations,
- unchanged product contracts.
