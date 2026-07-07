# Incentive June Close Readback - 2026-07-07

Status: applied  
Finding IDs: PRA-20260707-03, PRA-20260707-09  
Scope: data-source correction and existing close-flow rebuild  
Secrets policy: no database URLs, tokens, cookies, OTPs, passwords, or private credentials recorded.

## Problem

Haziran 2026 Bolge Muduru `Primler` yuzeyinde bazi magaza paketleri `Ay kapanisi bekliyor` durumunda kaliyordu. Bu nedenle personel duzeltme drawer'i beklenen sekilde duzenlenebilir olmuyordu.

## Root Cause

Haziran kapanis readiness kontrolu `blocked_by_calculation` durumundaydi. Kapanisi bloke eden kaynak veri eksigi iki sirket magazasinda Haziran store-level hedef kaydinin olmamasiydi:

| Store | Source status | Imported sales present | Store target before |
| --- | --- | --- | --- |
| Duzce Dmall Avm | missing store target | yes | none |
| Istanbul Viaport Bedesten | missing store target | yes | none |

Final snapshot elle patchlenmedi. Eksik kaynak hedefler tamamlandi ve mevcut backend close flow yeniden calistirildi.

## Source Target Evidence

Haziran personel hedef Excel kaynaginda bulunan satirlar magaza hedef toplamlarini verdi:

| Store | Personnel target rows | Store target total |
| --- | ---: | ---: |
| Duzce Dmall Avm | 3 | 3,000,000 TL |
| Istanbul Viaport Bedesten | 3 | 2,800,000 TL |

## Data Mutation

Mutation target: `ops.kpi_target`  
KPI: `TARGET_ACHIEVEMENT`  
Period: `2026-06-01` to `2026-06-30`  
Scope: `store`  
Period type: `monthly`

Dry-run/readback result:

| Store | Existing target rows before | Inserted | Target | Yellow threshold | Red threshold |
| --- | ---: | ---: | ---: | ---: | ---: |
| Duzce Dmall Avm | 0 | 1 | 3,000,000 | 2,550,000 | 2,250,000 |
| Istanbul Viaport Bedesten | 0 | 1 | 2,800,000 | 2,380,000 | 2,100,000 |

Inserted/updated/skipped/review_required:

| Inserted | Updated | Skipped | Review required |
| ---: | ---: | ---: | ---: |
| 2 | 0 | 0 | 0 |

## Close Flow

Existing application service was used:

- `SalesTargetIncentiveApiService.getAdminCloseStatus`
- `SalesTargetIncentiveApiService.runAdminClose`

No direct write was made to final snapshot tables.

Readiness before rerun after source target fix:

| canClose | status | blocking imports | blocking target revisions |
| --- | --- | ---: | ---: |
| true | ready | 0 | 0 |

Close rerun result:

| Period | Status | Final store snapshots | Final rows |
| --- | --- | ---: | ---: |
| 2026-06 | succeeded | 33 | 127 |

Previous latest successful June close had 14 store snapshots and 58 rows, so the rerun expanded the closed period to the current finalizable source set.

## Region Manager Readback

Pilot Bolge Muduru scope for the demo region now returns closed review state for all four company stores in scope:

| Store | Final snapshot | Store target | Store net sales | Achievement | Final rows | Review state |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Balikesir 10 Burda AVM | yes | 2,600,000 | 2,051,005.22 | 78.8848% | 3 | closed |
| Bursa Downtown Avm | yes | 1,200,000 | 705,276.71 | 58.7730% | 2 | closed |
| Canakkale 17 Burda Avm | yes | 3,750,000 | 3,403,229.22 | 90.7527% | 5 | closed |
| Istanbul Marmara forum Avm | yes | 6,500,000 | 5,678,404.45 | 87.3600% | 4 | closed |

API model readback:

| Store count | `periodCloseStatus` | `workflowLockedReason` |
| ---: | --- | --- |
| 4 | closed | null |

## Expected Product Impact

- Haziran `Primler` Bolge Muduru gorunumunde bu dort magaza artik `Ay kapanisi bekliyor` kilidine dusmemeli.
- Personel correction drawer'i allowed workflow state icin duzenlenebilir olmali.
- Eger UI hala eski state gosterirse siradaki root-cause frontend cache/query invalidation veya stale deployment olacaktir; veri/kapanis root cause giderildi.

## Remaining Risks

| Risk | Status | Next action |
| --- | --- | --- |
| First load still feels slow | open | Measure frontend/backend waterfall separately before changing code. |
| Row separator/header/metric icon polish | open | Handle as UI-only PR if still visible after data fix. |
| Other regions' June close completeness | not audited here | Covered by broader PR2 data reconciliation readback, not this targeted fix. |
