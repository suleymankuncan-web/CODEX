import { KpiImportNormalizationService } from "./kpi-import-normalization.service";

describe("KpiImportNormalizationService", () => {
  const service = new KpiImportNormalizationService();

  it("keeps canonical KPI rows and fills missing period defaults", () => {
    const rows = service.normalize({
      sourceSystem: "manual",
      sourceCapturedAt: "2026-04-22T10:30:00.000Z",
      rows: [
        {
          kpiCode: "ATV",
          actualValue: 12.4,
          sourceEmployeeId: "SELLER-1",
          sourceStoreId: "STORE-1",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        kpiCode: "ATV",
        sourceMetricId: "ATV",
        actualValue: 12.4,
        employeeExternalRef: "SELLER-1",
        storeExternalRef: "STORE-1",
        periodType: "daily",
        periodStart: "2026-04-22",
        periodEnd: "2026-04-22",
      }),
    ]);
  });

  it("adds deterministic source lineage to canonical KPI rows", () => {
    const firstRows = service.normalize({
      sourceSystem: "other",
      sourceCapturedAt: "2026-04-22T10:30:00.000Z",
      rows: [
        {
          kpiCode: "UPT",
          actualValue: 3.2,
          storeExternalRef: "M-10",
          employeeExternalRef: "S-100",
          periodStart: "2026-04-22",
          periodEnd: "2026-04-22",
        },
      ],
    });
    const secondRows = service.normalize({
      sourceSystem: "other",
      sourceCapturedAt: "2026-04-22T10:30:00.000Z",
      rows: [
        {
          employeeExternalRef: "S-100",
          periodEnd: "2026-04-22",
          actualValue: 3.2,
          periodStart: "2026-04-22",
          storeExternalRef: "M-10",
          kpiCode: "UPT",
        },
      ],
    });

    expect(firstRows[0]).toEqual(
      expect.objectContaining({
        rowHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        rawRowReference: "other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100",
      }),
    );
    expect(firstRows[0]["rowHash"]).toBe(secondRows[0]["rowHash"]);
  });

  it("explodes Nebim-style KPI columns into multiple canonical metric rows", () => {
    const rows = service.normalize({
      sourceSystem: "nebim_v3",
      sourceWindowStartedAt: "2026-04-22T00:00:00.000Z",
      sourceWindowEndedAt: "2026-04-22T23:59:59.000Z",
      rows: [
        {
          saticiKodu: "S-100",
          magazaKodu: "M-10",
          atv: 5200,
          upt: 3.2,
          ticketCount: 14,
          itemCount: 45,
          ff: 120,
          netTutar: 30000,
        },
      ],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "ATV",
          sourceMetricId: "ATV",
          actualValue: 5200,
          scopeType: "employee",
          employeeExternalRef: "S-100",
          storeExternalRef: "M-10",
          periodStart: "2026-04-22",
          periodEnd: "2026-04-22",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          sourceMetricId: "UPT",
          actualValue: 3.2,
          scopeType: "employee",
          employeeExternalRef: "S-100",
          storeExternalRef: "M-10",
        }),
        expect.objectContaining({
          kpiCode: "NET_SALES",
          sourceMetricId: "NET_SALES",
          actualValue: 30000,
          scopeType: "employee",
          employeeExternalRef: "S-100",
          storeExternalRef: "M-10",
        }),
        expect.objectContaining({
          kpiCode: "TICKET_COUNT",
          sourceMetricId: "TICKET_COUNT",
          actualValue: 14,
          scopeType: "employee",
          rawRowReference: "nebim_v3:TICKET_COUNT:daily:2026-04-22:2026-04-22:M-10:S-100",
        }),
        expect.objectContaining({
          kpiCode: "ITEM_COUNT",
          sourceMetricId: "ITEM_COUNT",
          actualValue: 45,
          scopeType: "employee",
          rowHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          kpiCode: "FF",
          sourceMetricId: "FF",
          actualValue: 120,
          scopeType: "store",
          employeeExternalRef: null,
          storeExternalRef: "M-10",
        }),
      ]),
    );
  });

  it("keeps CR as a store-scoped metric even when a seller code is present", () => {
    const rows = service.normalize({
      sourceSystem: "power_bi",
      sourceCapturedAt: "2026-04-22T14:00:00.000Z",
      rows: [
        {
          sellerCode: "S-100",
          storeCode: "M-10",
          conversionRate: 0.15,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        kpiCode: "CR",
        scopeType: "store",
        employeeExternalRef: null,
        storeExternalRef: "M-10",
        actualValue: 0.15,
      }),
    ]);
  });
});
