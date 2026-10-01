# Incentive approval mail V1

Status: active
Shelf: contract
Last verified: 2026-10-01

Contract Impact: intentionally changed for approval notifications and automatic
GM-final HR delivery. Risk: R5 (recipient privacy, durable SMTP delivery).
The BM submission → SD → HR → GM workflow, company-month revision/seal,
money, net-sale/return rules, permission assignments and public API stay intact.

| Approval | Notification audience | Excel |
|---|---|---|
| Regional manager submits | Company sales director | None |
| Sales director approves | Company HR/payroll accounts and configured HR mailbox | None |
| HR approves | Company general manager | None |
| GM final approves | All active directly assigned company regional managers, sales directors and HR/payroll accounts | Configured HR recipients only |

The title names the actual approver for BM/SD, says “İnsan Kaynakları prim paketini
onayladı” for HR and names the month and actual GM for final. No money, sales,
returns, targets, personnel list or notes appear in the body. The shared shell
provides a 96px illustration, emoji and “Prim detayına git” action. The HTTPS
application link opens the approved month; current screen permissions still apply.

Migration 100 adds an outbox event within the existing approval transaction.
Failed/rolled-back approvals and returns emit nothing. It does not reconstruct
past approvals. Event keys prevent duplicate enqueues and event/recipient keys
prevent duplicate expansion. The API polls every 30 seconds when explicitly
enabled, rechecks current recipients and atomically claims pending deliveries.
Inactive users/companies, expired/revoked capabilities and changed email addresses
cannot claim notifications. Financial attachments have a separate delivery method.
BM authority requires a live role whose global/company/region/store scope covers
the assigned store, as well as a current direct store assignment. Migration102
applies the same predicate to the database responsibility invariant. Pending
events rotate by attempt time, including recipient-resolution failures.

GM-final HR attachment uses the existing sealed payroll workbook generator and
the existing company/month receipt and advisory lock. Manual HR delivery and the
automatic path share this receipt, preventing repeated attachments. The database
requires the exact GM final seal and live matching initiator authority. Automatic
delivery records the actual approving GM; it never impersonates an HR actor.
Final recipient sets/proof/origin are immutable. Known non-HR, inactive,
BM/SD/GM accounts cannot be final workbook recipients even if misconfigured.
An unregistered group mailbox is accepted only from trusted company HR mapping.

The payroll Excel has exactly one sheet, `Personel Primleri`, with columns in this owner-approved order:
Bölge Müdürü, Mağaza, İlgili Kişi, Pozisyon, Hedef, Toplam Satış, Toplam İade, Net Satış, HG%, Hakediş Oranı, Hesaplanan Tutar, Final Tutar, Yorum.
The comments cell combines archived row notes, package notes and the exact signed proposal change amount. Frozen excluded personnel are rows on the same sheet with zero payment and “Prime dahil değildir” plus their reason in Yorum. Missing archived per-person amounts stay blank. No extra manager/store/proof/notes sheets are emitted; approval provenance remains in immutable database records. HG and rates use Excel percentage formats.
Gross and signed return amounts reuse accepted V2 evidence sealed with the revision and appear only when their net matches the approved person/store net. This does not change approved payout or reseal legacy history.

SMTP verification runs before claims. A definite pre-DATA notification rejection
returns to pending. An ambiguous outcome or abandoned claim becomes uncertain
and is never automatically replayed. Final Excel ambiguity also stays uncertain;
manual mailbox/provider reconciliation is required before any resend. Logs avoid
recipient addresses, names, credentials and workbook content.

## Activation and rollback

Apply migrations100 and102 before the updated backend. Configure approved company HR
recipient mapping, SMTP host/port/from/user, and a mounted read-only password
file accessible to the API UID. The supplied core Compose exposes configuration
but does not provision or mount a new SMTP secret; an approved private overlay
must supply it. Enable `INCENTIVE_APPROVAL_EMAIL_ENABLED=true` only after routing
and SMTP are verified. Configure `INCENTIVE_APPROVAL_EMAIL_APP_ORIGIN` as the
approved HTTPS origin; a sole CORS origin is the fallback. Ambiguous/missing
origins leave notifications pending. Defaults remain disabled.

Publish backend/frontend/Keycloak images separately. Frontend deployment enables
the month deep link. Keycloak realm reconciliation selects the generated email
theme; real provider actions, links and expiry are preserved. No production
migration, new recipient mapping, realm update or deployment is established by
local checks or by sending owner-only sample mails.

Immediate rollback: disable approval email polling; preserve all delivery receipts
and uncertain claims. Reverting application/theme images restores prior rendering.
The additive migration may remain installed; do not drop audit/outbox/delivery
data or remove the final-recipient guard to undo presentation. Pending events need
explicit review before later reactivation; accepted/uncertain sends are not replayed.

Verification: targeted template/mailer/service/repository tests; actual PostgreSQL
rollback/routing/seal/privacy/concurrency and migration reapplication; month-link
unit tests; affected lint/build; generated theme drift; actual FreeMarker engine
with provider-shaped models; owner sample MIME and responsive layout checks.
