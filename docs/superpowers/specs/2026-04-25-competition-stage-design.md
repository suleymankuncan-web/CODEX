# Competition + Stage Design

## Purpose

Define the first durable model for region challenges without locking the product into a simple one-off leaderboard.

The first product use case is a region challenge, but the model must later support:

- region leagues
- multi-stage competitions
- first-half qualifiers and second-half finals
- quarter finals, semi finals, and finals
- long-running projects such as 3-6 month competitions
- future rewards, badges, and seasonal winners

## Current Decision

Use a `Competition + Stage` model.

Do not build this as a single flat challenge table. A flat model would be fast at first, but it would become fragile when the user wants stages, finals, or longer campaigns.

Do not build a full tournament engine in the first implementation. Brackets, automatic fixture generation, rewards, and advanced season management are future layers.

## Core Concepts

### Competition

A competition is the parent container.

Examples:

- May Region Challenge
- Summer Region League
- Marmara vs Karadeniz Project
- First Half Regional Race

A competition owns:

- name
- description
- lifecycle state
- owner/admin metadata
- visibility rules
- one or more stages
- final result state

### Stage

A stage is one scoring period inside a competition.

Examples:

- first 15 days qualifier
- second 15 days final
- quarter final
- semi final
- final
- month one stage in a 6 month project

A stage owns:

- date range
- participant teams
- scoring rule
- live score state
- data quality state
- progression recommendation
- finalization state

### Challenge Team

A challenge team is a competition participant group.

Important rule:

Challenge teams are not the same thing as operational regions or region manager scopes.

Reason:

- Istanbul can have multiple region managers.
- Marmara can contain many stores and several operational territories.
- Competition fairness and operational authorization are different problems.

Challenge teams are formed from store groups.

Initial team creation rule:

- start from predefined templates such as Marmara, Karadeniz, Ege
- allow IK/Admin to manually add or remove stores before publishing

This supports future formats such as:

- Marmara vs Karadeniz
- Istanbul-1 vs Istanbul-2
- mall stores vs street stores
- new stores challenge
- high-volume stores league

## Roles And Permissions

### IK/Admin

The first version is controlled by IK/Admin.

IK/Admin can:

- create competitions
- select a template
- adjust team store membership
- create stages
- publish a competition
- review live scores
- review data quality warnings
- approve stage progression
- finalize results
- use a justified override when final data quality is incomplete

### Super Admin

Super Admin can see and manage all competitions.

### Region Manager

Region managers can see competition state and contribution details for stores inside their existing read scope.

They do not automatically own a challenge team just because the team is named like a geographic region.

### Store Manager

Store managers can see their own store's contribution and warnings.

### Store Personnel

Store personnel can see their own store or team context when exposed in the store shell, but they do not manage competitions.

## Scoring Model

### V1 Team Score

The V1 competition score is based on store performance.

Team score for a stage:

```text
average of valid daily store scores across the stage
```

Every closed day has equal weight in V1.

Reasons:

- avoids giving larger teams an automatic advantage
- works for 15 day stages, monthly stages, and long-running stages
- is easy to explain
- leaves room for future weighted formats

### Store Score Inputs

Store score combines daily sales metrics and monthly quality metrics.

Daily metrics:

- HG% / target achievement
- CR
- ATV
- UPT

Monthly or periodic quality metrics:

- BM checklist
- VM checklist

Checklist rule:

- a checklist belongs to the month in which it was performed
- April checklist contributes to April store score
- May checklist contributes to May store score
- if a stage crosses months, each day uses the checklist state for that day/month

## Missing Data And Data Quality

### Store Daily Data

Stores are expected to have daily data.

Missing store data is not treated like personnel leave or a non-working day. It is a data quality issue.

Rules:

- do not score missing data as zero
- show coverage and data quality warnings
- let live scores continue
- block or warn at finalization depending on severity

### Checklist Missing State

If BM or VM checklist is missing for the relevant month:

- the store remains visible in the live stage table
- the store row shows a warning such as `BM checklist yapılmadı` or `VM checklist yapılmadı`
- the score is marked partial or incomplete
- checklist weight is not redistributed to other metrics
- the previous month checklist is not reused

This prevents the system from hiding missing quality work or silently inflating scores.

## Live Scores And Finalization

### Live Scores

Competition and stage scores update automatically after daily closure data is available.

IK/Admin does not approve every daily score.

Users can see the live standing from the first closed day onward.

### Final Results

IK/Admin finalizes the result at the end of the stage or competition.

Before finalization, the system should show:

- final ranking
- store coverage
- missing daily data warnings
- missing checklist warnings
- progression recommendation
- finalization blockers or warnings

### Justified Override

If checklist or data quality warnings remain, IK/Admin can finalize with a written justification.

Override must be audited with:

- actor
- timestamp
- competition id
- stage id
- unresolved warnings
- justification text

This keeps real-world flexibility without losing accountability.

## Stage Progression

Progression is hybrid.

At stage end:

- system calculates the stage result
- system recommends which teams move forward
- IK/Admin reviews the recommendation
- IK/Admin approves the next stage activation

This supports:

- first 15 days qualifier
- second 15 days final
- top X teams advancing
- quarter finals and finals later

## Lifecycle States

Recommended initial states:

Competition:

- draft
- published
- active
- completed
- cancelled

Stage:

- draft
- scheduled
- active
- awaiting_review
- finalized
- cancelled

Finalization:

- clean
- warnings_present
- overridden

## UI Direction

### IK/Admin Surface

Admin should be able to:

- create a competition
- choose a team template
- adjust stores
- define stages and date ranges
- view live standings
- inspect team/store warnings
- approve stage progression
- finalize with or without override

### Region Manager Surface

Region manager should see:

- competition standing
- their scoped stores' contribution
- warnings for scoped stores
- no unauthorized store/person detail outside their read scope

### Store Surface

Store users should see:

- current competition standing where relevant
- their store/team status
- contribution summary
- warnings that affect their store

## Audit And Traceability

Audit is required for:

- competition creation
- team template selection
- manual store add/remove
- stage publication
- stage progression approval
- finalization
- finalization override

Competition scoring must be explainable by closed data, not mutable live rows.

## Out Of Scope For V1

The first implementation should not include:

- automatic bracket generation
- rewards or badges
- public winner certificates
- complex weighted day rules
- store-size weighted scoring
- personnel contribution scoring inside challenge score
- region manager proposal approval flow
- fully automatic stage advancement

These are supported later by the model, but not required for V1.

## Future Expansion Path

Recommended sequence:

1. Competition + Stage read/write foundation
2. Admin competition creation and stage setup
3. Store template selection with manual store adjustment
4. Live stage standings from closed store scores
5. Missing checklist warnings
6. Stage finalization and justified override audit
7. Hybrid progression recommendation
8. Store/personnel contribution breakdown
9. Rewards, badges, and season winner records
10. Bracket and fixture automation

## Verification Expectations

When implemented, the feature should verify:

- IK/Admin can create a draft competition
- IK/Admin can choose a template and adjust store membership
- stages can have independent date ranges
- live scores use closed daily store score averages
- every day has equal weight in V1
- monthly BM/VM checklist contributes only to its own month
- missing checklist creates store-level warning
- missing checklist does not zero the score
- missing checklist does not redistribute weight
- live score appears before finalization
- finalization warns when data quality is incomplete
- IK/Admin can finalize with a required justification override
- override writes audit metadata
- region manager cannot see unauthorized store details
- release checks and browser verification cover the first visible surface

## Open Implementation Notes

The likely backend ownership is a new competition-oriented bounded context rather than extending closed ranking directly.

Closed ranking and store score facts should remain input facts. Competition should consume those facts and add competition-specific lifecycle, grouping, stage, progression, and finalization semantics.

The exact schema should be designed in the implementation plan, but it will likely include:

- competition
- competition_stage
- competition_team_template
- competition_team
- competition_team_store
- competition_stage_score_snapshot
- competition_stage_warning
- competition_audit or shared audit events

## Approved Direction

The approved direction is:

- use Competition + Stage
- first implementation controlled by IK/Admin
- challenge teams are separate from operational regions
- use templates with manual store adjustment
- V1 score is average daily store score across the stage
- every day is equal weight
- daily metrics are HG%, CR, ATV, UPT
- monthly checklist metrics are BM and VM checklist
- checklist contributes to the month it belongs to
- missing checklist remains visible as a warning
- live scores update automatically after daily closure
- IK/Admin finalizes stage/competition results
- finalization supports audited justified override
- stage progression is system recommendation plus IK/Admin approval
