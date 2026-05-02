# Project Forward Preview - 26 April 2026

## Purpose

This note gives the near-future map for the project: where the system is now, what is strong, what is still missing, which order we should follow, and where the project can realistically land if we keep the current discipline.

## Current Position

The project is no longer a loose dashboard prototype. It has become a controlled store operations platform with real foundations:

- auth/session shape, role filtering, read scope, and assigned-store action scope are guarded
- backend and frontend have release checks behind one root `check:release` gate
- local Keycloak PKCE login/logout and assigned/unassigned action smoke evidence exists
- staging auth smoke is prepared, but correctly blocked until real staging values exist
- Operational Feed V1 exists without creating a second ranking/scoring engine
- competition package planning has draft, edit, cancel, history, submit, approve, return, clone, and approved-only execute behavior
- Daily Closure / Historical Ranking V1 already exists for daily/monthly closed leaderboard reads
- Turkish-default localization foundation exists, but the app is not fully localized yet
- DM/CONFIG boundaries are documented without opening unnecessary new schemas
- debt ledger is explicit and currently reports zero silent untracked release-quality debt

## What Is Good

The best thing about the project right now is not any single screen. The best thing is control.

We are not casually adding modules anymore. Feed and competitions are separated. Challenges can be announced without creating a duplicate ranking engine. Auth evidence cannot be called staging-complete without real staging proof. Release checks are not scattered between frontend and backend. KPI, snapshot, audit, and scope boundaries are becoming visible instead of living only in memory.

This is the kind of foundation that lets a project grow for months without turning into a pile of exceptions.

## What Is Still Missing

The project is not production-ready yet. It is foundation-healthy.

Missing pieces:

- real KPI ingest connector and real payload contract from source systems
- real staging IdP registration evidence and seeded staging positive/negative action proof
- clearer score meaning: grade bands, threshold language, and business interpretation
- Daily Closure Ranking V2 explainability: official vs preview-only vs not-closed vs no-data language
- KPI source semantics: imported, derived, checklist-fed, presentation-only
- config governance: effective dates, rollback, impact comparison, version explanation
- broader Turkish-first copy rollout
- store UX polish across rankings, profile, tasks, feed, checklist, and competition views
- final production visual design system pass

## Timeline Estimate

This estimate assumes focused work sessions and continued small verified slices. Real staging and real source data can change the timeline because they depend on outside systems.

### Next 1-2 work sessions

- Daily Closure Ranking V2 explainability
- root gate stays green
- current-state and active-next-actions stay synchronized

Expected result: users understand why a ranking is official, preview-only, not closed, or empty.

### Next 2-4 work sessions

- score meaning / grade language
- metric-specific trust copy for UPT, ATV, CR, HG%, checklist-fed fields
- ranking screen copy becomes more product-like and less technical

Expected result: the app does not only show a score; it explains what the score means.

### Next 1-2 focused weeks, if real sample data is available

- real ingest contract
- one real source integration path through staging/import, validation, and snapshot
- row-level error handling and idempotency proof

Expected result: the platform starts proving itself against real operational data instead of demo-shaped data.

### Next 2-4 focused weeks

- staging IdP/action evidence when credentials and seeded DB are available
- store user surfaces become more complete
- admin governance around KPI/config becomes more serious
- shared inbox can mature if real operator workflow proves need

Expected result: the system can move from "strong internal build" toward "pilot-ready candidate".

### Visual production pass

The visual/UI design should not be finalized today, but it should also not be left to the last week.

Correct timing:

1. Finish the core store flows: `/store`, `/store/me`, `/store/rankings`, `/store/tasks`, `/store/feed`, checklist/competition read surfaces.
2. Do a design-system pass: colors, spacing, typography, component states, table/list density, mobile field usage.
3. After real data and staging evidence, do the final production visual polish.

This means current screens are allowed to be draft-quality structurally. Later color, tone, layout, density, and page composition changes are safe as long as we keep contracts and component boundaries clean.

## Risk Forecast

### Low risk if we continue current discipline

- auth/scope drift
- release process drift
- feed vs competition confusion
- duplicate ranking engine
- hidden local-only assumptions

### Medium risk

- UI copy and visual design lagging behind backend quality
- ranking/score surfaces becoming hard to understand for normal users
- config rules staying too technical for HR/admin ownership

### High risk if ignored

- building too many exciting modules before real data proves the core
- treating demo snapshots as production truth
- marking staging auth complete without real staging evidence
- adding new scoring formulas without versioned rule/config governance

## Recommended Route

1. Daily Closure Ranking V2 Explainability
2. Score meaning / grade interpretation
3. Real KPI ingest contract and one real import path
4. Real staging IdP and seeded action evidence when available
5. Store UX polish and broader Turkish-first copy rollout
6. Admin config governance only where real editing workflow exists
7. Design-system and production visual pass

## CODEX DURUST YORUM

I see light in this project, but not because it is already finished. I see light because the project is learning to say "not yet" to the wrong work.

The project is genuinely promising. The architecture is healthier than it was because we stopped chasing every feature as a new module. The strongest move was not overbuilding the tournament/ranking idea; turning simple UPT/ATV challenges into feed announcements while keeping score truth in existing ranking/profile surfaces was the right call.

The biggest danger is real data. Until real source payloads and real staging auth are proven, the project is a strong controlled build, not a production system. The second danger is UX polish arriving too late. The backend is becoming disciplined; the frontend must now start becoming equally clear for normal store users.

My honest recommendation: keep moving, but keep the gate strict. One feature in, one proof out. No feature should enter unless we can say what data it owns, who can see it, what audit trace it leaves, how it affects reports, and how it is verified.

This project can succeed if we continue exactly like this: small, tested, documented, and allergic to silent debt.

