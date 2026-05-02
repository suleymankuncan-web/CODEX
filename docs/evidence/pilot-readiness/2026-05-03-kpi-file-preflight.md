# KPI File Preflight Evidence

Date: 2026-05-03 00:11 +03

Environment: Local file preflight only

Commit SHA at capture: `55f21dfd`

Files reviewed:

- `MAĞAZA TABLO.xlsx`
- `PERSONEL TABLO.xlsx`

Purpose:

- Confirm the supplied files are KPI snapshot exports, not master-data baseline files.
- Check whether the files contain the required store/personnel KPI columns before any official upload.
- Run a local reconciliation preflight without creating import batches or mutating official KPI data.

## File Shape

Store KPI file:

- Sheet: `Export`
- Rows read by the backend Excel parser: `271`
- Data rows with store names after summary/blank filtering: `268`
- Distinct store names: `266`
- Headers present:
  - `Mağaza Adı`
  - `Hedef`
  - `Ciro`
  - `Gerçekleşen %`
  - `Satış Adedi`
  - `FF`
  - `CR`
  - `ATV`
  - `Fatura Sayısı`
  - `UPT`
  - `OSF`
  - `Geçen Yıl Ciro`
  - `Ciro Artış`

Personnel KPI file:

- Sheet: `Export`
- Rows read by the backend Excel parser: `2940`
- Data rows with personnel and store names after summary/blank filtering: `2924`
- Distinct store names: `185`
- Positive personnel sales rows: `768`
- Negative personnel movement rows: `2017`
- E-store rows: `86`
- Personnel ATV/UPT denominator conflict rows: `0`
- Distinct positive employee references in the file preflight: `759`
- Headers present:
  - `Adı`
  - `Mağaza Adı`
  - `P. Satış Adeti`
  - `Satış Tutarı`
  - `Ciro Payı`
  - `Mağaza Cirosu`
  - `P.ATV`
  - `P.UPT`

## Derived Import Shape

If every distinct store in the supplied files were enabled for KPI import scope, the local parser preflight would produce an upper-bound shape of:

- Store metric rows: `2128`
- Employee metric rows upper bound: `3795`
- Total canonical rows upper bound: `5923`

Official staging counts can be lower because the backend only imports stores enabled in KPI import scope.

## Reconciliation Preflight

Matched store/personnel reconciliation was calculated for stores present in both files:

- Compared stores: `185`
- Balanced stores: `171`
- Warning stores: `14`
- Store net sales total across compared stores: `626147496.48`
- Personnel positive gross total across compared stores: `633690591.37`
- Personnel negative movement total across compared stores: `-7466810.41`
- Total reconciliation delta across compared stores: `-76284.48`

Largest review deltas:

| Store | Store net sales | Personnel net movement | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| Ankara Acity Avm | 5103855.93 | 5129495.81 | -25639.88 | warning |
| İstanbul Beylikdüzü Cadde | 3710884.57 | 3724745.32 | -13860.75 | warning |
| İzmir WestPark Avm | 1877659.45 | 1883790.68 | -6131.23 | warning |
| Balıkesir 10 Burda AVM | 3000760.02 | 3005760.02 | -5000.00 | warning |
| Alanya Akdenizpark Avm | 1477168.41 | 1482168.41 | -5000.00 | warning |

## Safety Boundaries

- No import batch was created.
- No official KPI data was materialized.
- No master-data bootstrap or promotion was run.
- No temporary stores or employees were created from the KPI files.
- No raw personnel names, TC/national id values, phone numbers, tokens, cookies, or credentials are recorded in this evidence note.
- Negative personnel rows remain reconciliation evidence and should not reduce employee KPI rows.
- Store net sales remains sourced from the store KPI file; personnel negative movement must not be subtracted from store net sales a second time.

## Blockers Before Official Upload

- The selected reporting period is not present in the workbook headers or filenames and must be supplied by the operator.
- Authenticated staging upload was not run in this capture.
- Staging KPI import store scope was not reviewed in this capture.
- Official import-batch id, source batch id, unmapped store/employee counts, and backend reconciliation evidence are still missing.

## Decision

File-format preflight: Conditional Go.

Official KPI import/materialization: No-Go until the operator confirms the period, staging KPI import scope is reviewed, and authenticated staging upload evidence is captured.
