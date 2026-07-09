# Mobile App Discovery V1

## Reader And Action

Reader: HR Axis product owner, engineering lead, and future implementation agent planning the separate mobile application.

Action: use this document to decide the first mobile app scope, avoid web-page cloning, and start mobile prototype/scaffold work with clear persona order and offline checklist expectations.

## Status

Active discovery. This is not an implementation plan yet. It defines the product direction, scope boundaries, and first prototype sequence for HR Axis Mobile V1.

## Current Decisions

- HR Axis mobile will be a separate mobile app, not a resized copy of the admin web.
- Screens can and should be different from web screens.
- Current target is internal company usage.
- Later target is multi-company commercial sales.
- App Store and Play Store distribution is expected later.
- Push notifications are not a V1 blocker.
- Offline checklist is high value because some stores have weak internet coverage.
- Admin mobile is out of scope.
- Persona priority is: Personnel first, Store Manager second, Region Manager third.

## Product Direction

The mobile app should be an operational companion, not a full admin console.

The app should answer:

- What do I need to do today?
- How am I performing this month?
- Which store or task needs attention?
- Can I complete store work even if internet is weak?

The app should not replicate desktop tables, admin configuration, master-data maintenance, imports, or broad reporting.

## Existing Foundation

The project already has early mobile groundwork around mobile auth/session and mobile API/BFF inventory. That foundation should be reused before inventing a new backend shape.

Broad mobile BFF expansion should stay closed until a screen contract proves the need. Each new mobile endpoint should be justified by a real mobile screen and a real payload problem.

## V1 Persona Order

### 1. Personnel

Personnel is the first mobile persona because the mobile app is most naturally used by people on the floor.

V1 candidate screens:

- Home
- My Performance
- KPI detail
- Turkiye Siralamasi read-only
- Performance Card creation
- Feed read-only
- Profile and session

Personnel should not navigate into other employees' private profile details unless the product explicitly opens a safe public profile surface.

### 2. Store Manager

Store Manager is the second mobile persona because they need operational status, store actions, and checklist/task follow-up.

V1 candidate screens:

- Home
- Tasks
- Checklist status and acceptance-related work
- Targets summary
- Store KPI summary
- Feed read-only
- Profile and session

Store Manager mobile should focus on doing and confirming work, not configuring the system.

### 3. Region Manager

Region Manager is the third mobile persona because their work is more oversight-heavy and can remain web-first longer.

V1 or V1.2 candidate screens:

- Region home
- Store list
- Checklist operations
- Store KPI summary
- Feed posting if mobile publishing becomes necessary
- Profile and session

Region Manager mobile should emphasize quick triage, store drilldown, and field visibility.

## Explicitly Out Of Scope

- Admin screens
- Master data editing
- Integration uploads
- Excel import/export management
- Full reporting center
- Incentive admin package approval
- Dense desktop-style tables
- Desktop drawers copied directly into mobile
- Full web route parity

## Recommended Technical Direction

Default recommendation: Expo React Native.

Reasoning:

- It supports a real mobile app path for App Store and Play Store later.
- It can share TypeScript models and API clients where useful.
- It keeps the door open for push notifications later.
- It is a better fit for offline checklist storage and native mobile interaction than a pure web wrapper.

Do not choose a web wrapper as the default direction unless the goal is only a temporary demo. A wrapper will preserve too many desktop assumptions and make offline checklist harder to treat properly.

## Offline Checklist Direction

Offline checklist should be designed from the start even if it ships after the first prototype.

Offline-capable actions:

- Start an assigned checklist session.
- Resume an in-progress checklist session.
- Score checklist items.
- Add notes.
- Save local draft.
- Mark completion as pending sync.
- Retry sync when connection returns.

Not offline in the first version:

- Admin configuration
- Imports
- Incentive package approval
- Target approval workflows
- Reporting exports

Minimum offline safety contract:

- The user always sees whether the checklist is local draft, syncing, synced, or failed.
- The app never silently loses item scores or notes.
- A completed checklist cannot be submitted twice.
- Pending sync count is visible.
- Failed sync has retry and clear error text.
- Conflict behavior is explicit before implementation.

## Navigation Draft

Personnel:

- Home
- Performance
- Rankings
- Feed
- Profile

Store Manager:

- Home
- Tasks
- Checklist
- Targets
- Feed
- Profile

Region Manager:

- Home
- Stores
- Checklist
- KPI
- Feed
- Profile

Navigation should be role-aware. Admin navigation should not exist in mobile V1.

## Mobile UX Principles

- No desktop tables on mobile.
- Use cards, bottom sheets, compact lists, segmented controls, and full-screen detail flows.
- One primary action per screen.
- Keep visible copy short and Turkish.
- Avoid internal words such as API, DB, scope, mock, or gercek veri.
- Date/month selection should be mobile-native in feel.
- Desktop drawer patterns become bottom sheet or full-screen detail on mobile.
- Dense data should summarize first, then reveal details one level deeper.
- Buttons must be thumb-friendly.
- Offline/sync state must be visible where it affects trust.

## First Prototype Sequence

1. Personnel Home and My Performance.
2. Personnel Rankings with privacy-safe detail behavior.
3. Store Manager Home and Tasks.
4. Offline Checklist Session prototype.
5. Region Manager Stores and Checklist overview.

This order follows the agreed persona priority and validates the highest-frequency mobile use cases first.

## Data And API Expectations

The mobile app should reuse existing business rules:

- Auth and role scope remain server-controlled.
- Personnel, Store Manager, and Region Manager permissions remain distinct.
- KPI, ranking, checklist, target, task, and feed calculations should not be reimplemented on the client.
- Mobile endpoints should return mobile-shaped payloads only when existing web payloads are too large or too desktop-specific.
- Offline checklist needs a local draft model and a server sync contract.

## Risks

- Copying web screens directly will produce a heavy and uncomfortable app.
- Offline checklist is a real product commitment, not just a UI state.
- Store personas can become overloaded if admin features leak into mobile.
- App Store and Play Store readiness will introduce hidden work around signing, privacy, release process, crash reporting, and account setup.
- Multi-company sales later will require tenant branding, data isolation, and permission confidence.

## Open Questions

- Is offline checklist required in V1, or can it be V1.1 after the first app release?
- Which mobile screens must be ready for the first internal pilot?
- Will Store Manager ever create feed posts from mobile, or stay read-only?
- Which push notification provider will be used later?
- Should tenant branding be designed now or postponed until multi-company sales becomes active?
- What is the minimum App Store and Play Store launch timeline?

## Go / No-Go Criteria

Go:

- Mobile screens are designed mobile-first.
- Personnel-first scope is respected.
- Admin is excluded.
- Offline checklist behavior is documented before implementation.
- Backend remains the source of truth for role, scope, and calculations.

No-go:

- The mobile app is only a wrapped desktop web app.
- Dense admin tables are copied into mobile.
- Offline checklist is promised without sync and conflict rules.
- Other employees' private profiles become navigable without a privacy decision.
- New mobile APIs duplicate business logic already owned by the backend.

## Next Action

Create the first mobile prototype for Personnel Home and My Performance, using this document as the product boundary. Do not start with admin, imports, reports, or region-heavy oversight screens.
