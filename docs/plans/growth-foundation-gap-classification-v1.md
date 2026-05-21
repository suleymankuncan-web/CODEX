# Growth Foundation Gap Classification V1

## Reader And Action

Reader:

- A future engineer or agent deciding what to do after the project-flow review
  captured in the local `x.md` conversation record.

After reading, they should be able to:

- separate mandatory growth-foundation work from attractive but premature work,
- avoid turning the project into a speculative rules-engine rewrite,
- choose the first code or product slice after the docs-only planning pass.

## Sokrates Decision

Claim:

- The project has a strong operational foundation, but long-term growth needs
  clearer rules/config, operations, authorization, data-quality, and TypeScript
  guardrails before more modules are added.

Assumptions:

- Growth risk is now more about rule drift, data trust, authorization drift, and
  operator visibility than about missing basic architecture.
- Existing docs, tests, and schemas are a better starting point than a new
  generic platform layer.
- The right first move is docs-only classification and specs, not production
  code or DB changes.

Repo evidence:

- Existing readiness docs already separate local work from live/provider
  evidence blockers.
- Existing workflow docs define approval, acknowledgement, task, and
  notification language.
- Existing auth docs and tests already protect role, scope, and assigned-store
  action semantics.
- Existing data-quality work already classifies import row failures and batch
  summaries.
- Existing config docs already decide against premature `dm` or `config`
  schemas.
- Frontend TypeScript build passes today; stricter candidate flags can be
  measured before being enabled.

Counterargument:

- A single generic rules engine or control tower could look cleaner than several
  domain-owned boundaries. In this repo, that would add a new abstraction before
  product evidence proves which rules must be independently versioned, audited,
  simulated, or business-edited.

Risk:

- LOW for this docs-only classification.
- HIGH if the classification is misread as approval to change rules,
  authorization, DB schema, provider config, or API response shape.

Door:

- This document is a two-way door.
- The implementation paths it protects, especially auth, DB, provider,
  workflow, and rules-engine work, are near one-way-door unless scoped later.

Stop rule:

- Stop if the next slice requires business logic, API response, auth,
  permission, DB migration, CSS, or user-facing behavior changes. That work
  needs its own implementation plan and verification ladder.

Verification ladder:

1. Read current handoff and Sokrates rules.
2. Re-check repo evidence.
3. Keep this PR docs-only.
4. Run `git diff --check`.
5. Open one coherent docs-only PR.

## Classification

### Really Required

These are required because they reduce likely future failure modes without
forcing implementation now.

| Gap | Why Required | Current Evidence | First Safe Output |
| --- | --- | --- | --- |
| External evidence blocker refresh | Broad readiness cannot be honestly closed from local code. | Readiness decision and external input check already list missing bearer, restore, alert, Redis, and upload inputs. | Presence-only blocker refresh. |
| Rules/config boundary decision | KPI thresholds, checklist weights, approvals, competitions, incentives, and workflow routing can drift if every feature invents its own rule home. | KPI config governance, DM/config boundary, score/versioning, workflow language, and competition specs already exist in fragments. | One boundary decision saying where each rule family lives now and what is not being built yet. |
| Operations Control Tower V1 spec | Health, readiness, import, queue, snapshot, and alert signals are scattered; operators need a single read-only mental model before code grows. | Health/readiness, operational monitoring, import quality, snapshot, queue, and alert docs exist separately. | Read-only control tower backlog/spec. |
| Authorization matrix drift guard plan | Role + read scope + action-store scope is powerful but easy to drift as routes/endpoints grow. | Scope/auth regression matrix and pilot route role matrix exist, but the route/endpoint/action drift guard is not yet a live maintenance plan. | Plan for matrix ownership and tests. |
| Cross-domain data quality inventory | Data trust depends on import quality, external ID mapping, snapshot freshness, KPI source trust, and materialization status together. | Data quality guards and import detail surfaces exist, but cross-domain readiness signals are not mapped as one operator picture. | Inventory that connects existing signals and gaps. |
| Frontend TypeScript strictness inventory | Strictness can improve developer experience, but only if enabled in measured steps. | Current build passes; strict candidate flags need impact counts before config changes. | Measurement-only inventory and first safe strictness slice recommendation. |

### Useful But Later

These are good ideas, but they should wait for a concrete product trigger or
the first read-only control surface.

| Idea | Why Later |
| --- | --- |
| Notification / attention routing implementation | Inbox language exists, but a notification service needs channel, priority, owner, and escalation decisions. Start with workflow/control-tower signals first. |
| Domain ownership map expansion | Useful for onboarding, but less urgent than rule/config and authorization drift guardrails. Can be added when a domain is touched. |
| Frontend information architecture guard | Admin/store separation is healthy. Add a route IA guard only if future routes start blurring operator vs store user tasks. |
| Control tower UI implementation | Valuable after the read-only signal contract is agreed. Do not invent APIs just to fill a dashboard. |

### Parked Or High Risk

These should not be started from this goal.

| Work | Park Reason |
| --- | --- |
| Generic rules engine | Too broad. It risks moving business rules before versioning, audit, simulation, and ownership triggers are proven. |
| New `dm` or `config` DB schemas | Existing boundary decision says not yet. New schemas need stronger reuse/versioning/audit evidence. |
| DB migrations for rules/config/control tower | This goal is docs-only. Migrations are high risk and need a separate plan. |
| Auth model or permission behavior changes | Authorization drift guard is a plan, not approval to change access. |
| API Gateway or service decomposition | Existing backend/frontend separation is healthy; gateway work is outside this scope. |
| Provider config, restore, Redis/BullMQ, alert delivery | Requires real external inputs and approved targets. |
| Data-quality dashboard with new workflows | Inventory first; implementation later only if existing signals are enough. |

## Batch Decision

Decision:

- Batch the docs-only growth foundation artifacts into one PR.

Why:

- They share one review story: classify `x.md` growth recommendations and turn
  the mandatory ones into executable docs/specs.
- They share one risk class: docs-only/inventory/spec.
- Rollback is one squash revert.

Change-my-mind triggers:

- Split if code/config changes enter the diff.
- Split if the PR starts implementing a UI, API, DB schema, or auth behavior.
- Stop if any document claims external evidence without real tokens/provider
  inputs.
