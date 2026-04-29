# KPI Benchmark Source Policy V1 Design

Date: 29 April 2026

Status: `approved_decision`

## Goal

Define which source is authoritative for Turkey-average KPI benchmarks when an Excel or future JSON import also contains a PowerBI-provided summary or Turkey-average row.

This policy keeps scoring explainable and prevents imported summary rows from silently widening or changing the benchmark scope.

## Locked Decision

The system-calculated benchmark is the authoritative V1 scoring reference.

PowerBI-provided Turkey average or general-total rows may be imported as reconciliation evidence, but they must not become the default scoring source.

## Source Priority

1. System-calculated benchmark from active in-scope stores/personnel.
2. PowerBI-provided benchmark row as control evidence.
3. Manual investigation when the difference exceeds tolerance.

## Why System-Calculated Benchmark Wins

The platform already controls which stores are active and in scope.

If the score uses a PowerBI-provided Turkey average row directly, the system may not know whether that row included:

- garage stores
- tent/pop-up stores
- inactive stores
- stores outside the pilot scope
- a different date filter
- a different company or region filter

Those filters materially affect `CR`, `ATV`, and `UPT`. Therefore V1 benchmark scoring should use the same scoped fact set that feeds the entity KPI values.

## PowerBI Reference Row Behavior

If the uploaded Excel file includes a row such as:

```text
Turkiye ortalamasi
Genel toplam
Ortalama
```

or another operator-recognized summary row, the import flow should treat it as benchmark evidence, not as a store or employee row.

The row should be stored later as a provided benchmark reference with lineage:

- source batch id
- period start
- period end
- metric code
- provided benchmark value
- source row reference
- raw row hash

V1 does not need to use this row to score entities.

## Reconciliation Rule

After import, the system should compare:

```text
systemBenchmarkValue
providedBenchmarkValue
```

If both exist and the difference is above tolerance, the import summary should warn the operator.

Suggested V1 warning language:

```text
PowerBI referansi ile sistem hesaplamasi farkli. Skorlama sistem kapsamindaki aktif magazalardan hesaplanan benchmark ile yapildi.
```

The warning should not block import by default unless the difference is large enough to indicate a clear operator or source error. The block threshold can be decided during implementation.

## Scoring Rule

Default V1 scoring uses:

```text
benchmarkValue = systemBenchmarkValue
```

The UI may show provided reference evidence later, but it must label it as control evidence, not as the scoring source.

## Store Scope Rule

Only stores that are active and selected for platform KPI processing should feed the system-calculated Turkey benchmark.

Garaj, cadir, pop-up, test, or otherwise out-of-scope stores should not affect benchmark calculations unless they are explicitly activated in the platform scope.

## Personnel Scope Rule

Personnel benchmark calculations should use only mapped, active, in-scope personnel KPI facts.

Unmapped personnel rows remain identity-review or reconciliation evidence and should not affect personnel Turkey averages until resolved.

## Future JSON/API Source

The same policy applies when the source changes from Excel to JSON/API:

- raw facts feed system-calculated benchmarks
- provided summary rows remain evidence
- scoring does not depend on manually appended totals

This avoids rebuilding the scoring model when PowerBI export is replaced by a direct data source.

## Non-Goals

V1 does not implement:

- a new benchmark table
- manual benchmark override UI
- operator tolerance configuration
- approval workflow for benchmark discrepancies
- using PowerBI-provided averages as the primary scoring source

Those can be planned later if real import evidence shows the need.

## Acceptance Criteria For Future Implementation

- Summary/Turkey-average rows are not treated as store/personnel entities.
- System benchmark is calculated from active in-scope data.
- Provided benchmark evidence can be stored with lineage.
- Import summary can report system-vs-provided benchmark difference.
- Scoring keeps using system benchmark by default.
- If provided reference is missing, scoring still works from system facts.
- If system benchmark cannot be calculated, scoring returns `missing_reference` rather than falling back silently.

## CODEX Durust Yorum

Using the PowerBI row directly would be faster for a manual pilot, but it creates a quiet trust risk. Nobody wants to discover later that scores were benchmarked against a row with the wrong filter.

The stronger design is to let the platform calculate the benchmark from its own scoped facts and use the PowerBI row as a control. This gives us speed now without sacrificing future JSON/API readiness.
