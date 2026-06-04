# Store KPIs Prototype Parity PR-3 Evidence

Date: 2026-06-04

Scope: Store Manager `/store/kpis` command deck surface.

Approved prototype:

- `docs/prototypes/store-kpis-command-deck-v3.html`

Screenshots:

- Prototype desktop: `docs/evidence/store-kpis-pr3-prototype-desktop-2026-06-04.png`
- Production desktop: `docs/evidence/store-kpis-pr3-production-desktop-2026-06-04.png`
- Prototype mobile: `docs/evidence/store-kpis-pr3-prototype-mobile-2026-06-04.png`
- Production mobile: `docs/evidence/store-kpis-pr3-production-mobile-2026-06-04.png`

## Parity Checklist

- Palette/status tones: matched for purple/cyan score language, green strong state,
  orange follow-up state, pink problem/passive state, and white elevated surfaces.
- Score ring/dots: matched score-ring layout and hover/tap contribution dot model;
  production dots are generated only from real scored contributions.
- Row height/table density: matched compact contribution table rhythm while replacing
  prototype demo rows with real KPI rows or honest empty values.
- Tab layout: matched `Mağaza KPI` / `Personel KPI` command tabs.
- Action placement: `Profil` actions remain in the personnel tab and only appear
  for backend-returned personnel rows with profile access.
- Empty/access/loading states: no fake data was introduced; missing metric/checklist
  values render as honest `Veri yok`, `Yapılmadı`, or `Pasif` states.

## Intentional Deviations

- Production keeps the real Store shell/sidebar instead of the prototype local
  sidebar. This is the allowed shell deviation in the plan.
- Production keeps the existing live/closed period controls because closed/snapshot
  behavior is protected legacy behavior.
- Prototype demo values are replaced by the E2E production fixtures and real API
  model shape. Example: score, KPI count, personnel count, and monthly trend use
  returned data; absent months/metrics are not synthesized.

## Verification

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store KPI"`:
  pass, 4/4
- `npm.cmd --prefix admin-web run api:check`: pass
- `npm.cmd run test:scripts`: pass, 406/406
- `git diff --check`: pass
- `git diff --cached --check`: pass
