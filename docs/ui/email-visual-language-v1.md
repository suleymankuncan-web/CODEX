# HR Axis mail visual language

Status: active
Shelf: UI reference
Last verified: 2026-10-01

The existing HR Axis logo, application background `#f2f5ff`, navy `#06142d`,
primary blue `#325daf` and border `#dce4ff` anchor the identity. The approved
mail reference adds a restrained violet `#7367cf` accent and soft circular
illustrations. Keep one white card, one heading and at most one primary action.
This is the shared mail presentation system. Approval content has one heading, a large illustration, an emoji and one detail action; financial content stays in the authorized application and the final HR attachment.

Use Segoe UI with Arial fallback: account heading 26/32, operational heading
22/28, body 15/23, supporting text 13/20. Cards are at most 600px wide with 20px inner padding, rounded corners
and a light border. Tables and inline styles preserve readable Outlook fallback.
Keep the logo/header, title/illustration, short content, optional facts/action,
one notice and a small footer in that order. Account and approval mails center a 96px icon
above the title; operational data mails place a 48px icon beside the title and use two-column
facts to reduce scrolling. Both densities use the same shell and tokens. Short messages fit
within one mobile screen; long real personnel lists remain complete and scroll.
Never hide actual rows to meet a height target. Money/dates use supplied values.

Canonical sources are `backend/nestjs/src/shared/mail/visual-language.ts` and
`base.template.ts`. Content renderers supply plain text and typed fields; raw
HTML is not accepted. Icons form one vector family (security, approval, people,
sync), rendered as PNG. SMTP mails attach logo/illustration with CID; Keycloak
uses its provider resource URLs. Blocked images leave meaningful text and actions.
The solid blue button remains readable when gradients are unsupported.

Run `npm --prefix backend/nestjs run mail:theme` after changing tokens, shell,
auth copy or artwork. Commit the generated PNG/FreeMarker outputs. Run the same
command with `-- --check` to detect drift. Keycloak inherits upstream plaintext,
subjects and other account messages; generated HTML preserves real links,
required actions and provider-formatted expiry. Setup means VERIFY_EMAIL plus
UPDATE_PASSWORD; other action sets retain the provider's own content.

Contract Impact: intentionally changed for shared mail rendering and exact SMTP
recipient acceptance checks. Approval order, financial calculations, API response shapes,
user account actions and live role/capability boundaries remain unchanged.
Approval-event outboxes, automatic final delivery and operational schedules are
separate follow-up work. This slice provides their content renderers only.
No preview disclaimer or fabricated expiry is added to real mail content.
The private daily supervisor needs a separate rollout to consume the failure template.

Risk: R5 for provider rendering, recipient privacy and durable delivery. Verify
escaping/HTTPS actions, SMTP outcomes and attachments, generated-theme drift,
transaction rollback, exact final seals, recipient routing and revocation, targeted
backend/frontend lint/build, real PostgreSQL/FreeMarker and responsive layouts.
No local full run. Code changes alone do not update live mails. Backend/frontend/
Keycloak image publication and realm reconciliation are rollout steps. No new
schema migration, recurring mail activation or live realm update is in this slice.

Local self-review GO:32 targeted rendering/SMTP cases,7 month-link unit cases,
103 on-prem/Keycloak/content contract cases and39 architecture/size/handoff cases
passed. Backend/frontend builds, affected-file ESLint and generated-theme drift
passed. Actual FreeMarker setup/reset/other-action/missing-context cases ran in an
air-gapped temporary container using the existing runtime, with no image build
or live provider mutation. Required GitHub CI remains the merge gate.
