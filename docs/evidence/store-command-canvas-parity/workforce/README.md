# Norm Kadro Command Canvas parity evidence

Status: prototype parity PASS

This directory records deterministic production `/store/workforce` parity
evidence for the approved Norm Kadro Command Canvas cutover.

## Locked reference

- Prototype:
  `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1`
- Desktop reference:
  `screenshots/decision-rail/workforce-employment-1440.png`
- Mobile reference:
  `screenshots/decision-rail/workforce-employment-390.png`
- Reference identity:
  `docs/evidence/store-operational-surfaces-command-canvas/prototype-digest-manifest-v1.json`

The reference manifest binds the desktop capture to SHA-256
`562825f8b64874ee71d99e6210d960c07af9daee4daa1f9ed4e526e46a78d223`
and the mobile capture to SHA-256
`4c3728565797ae3a0288983b565165e5b70b7e9ca7ef395d77a212a20f175608`.

## Production component map

| Approved surface | Production owner |
| --- | --- |
| Store shell and navigation | existing Store shell |
| Compact page header | `CommandCanvasPageHeader` |
| Four decision metrics | `CommandCanvasMetricRail` and `CommandCanvasMetricFilter` |
| Search and filters | `CommandCanvasFilterBar`, shadcn `Input` and `Select` controls |
| Sortable personnel/store headings | `CommandCanvasSortableHeading` |
| Main bounded list | `CommandCanvasDataList` |
| Store drill-in and history | shadcn `Sheet` with `CommandCanvasOperationalDrawerContent` |
| Store Manager requests | existing seller-code/offboarding endpoints through `WorkforceRequestDialogs` |

## Role and data boundary

- Store Manager opens directly on the assigned store and retains only the
  existing seller-code/offboarding mutations.
- Region Manager sees only the assigned region/stores.
- Report Viewer reads the company → region manager → store hierarchy and has
  no mutation control.
- Active rows contain employment facts only.
- Store history contains entry date, exit date and total working duration only.
- Fixture values exist only in the deterministic Playwright evidence harness;
  production values come from the bounded workforce workspace endpoint.

## Deliberate production-only boundaries

- The real Store shell and navigation replace the Labs prototype chrome.
- The returned-request shortcut remains available to Store Managers because
  correction and resubmission of the same persisted request identity is an
  existing required workflow. It does not create a parallel request path.
- The fixed Pilot Feedback control remains available. Mobile list rows reserve
  its viewport lane so it does not cover personnel or status content.
- Labels, hierarchy, counts and actions are driven by the authenticated API
  scope; deterministic sample values and the Labs role switcher are absent.

## Verification

`admin-web/e2e/store-workforce-parity-evidence.spec.ts` verifies:

- 1440x900, 1024x768, 390x844 and 320x844 Store Manager frames;
- Region Manager and Report Viewer hierarchy/read-only behavior;
- entry/exit-only history on desktop and mobile;
- no role switcher, Labs chrome, old Workforce owner or duplicate page owner;
- no horizontal page or drawer overflow.

The generated desktop, compact, 390px and 320px production captures were
visually compared with both locked prototype captures. The production surface
preserves the approved hierarchy, density, metric/filter behavior, employment
data model, drawer pattern and responsive composition without retaining an old
Workforce page owner.
