import { BadRequestException } from "@nestjs/common";
import { PilotRosterReconciliationService } from "./pilot-roster-reconciliation.service";
import { type RawRosterReconciliationInput } from "./pilot-roster-reconciliation.contract";

const baseRosterRows: RawRosterReconciliationInput[] = [
  {
    sourceFile: "yeni.xlsx",
    sourceSheet: "Sheet1",
    sourceKind: "current_roster",
    rowNumber: 1,
    rawStoreName: "Balikesir 10 Burda AVM",
    rawStoreCode: "SM001",
    rawEmployeeCode: "4139",
    rawEmployeeName: "Ayse Demir",
    rawPositionName: "Moda Danismani",
  },
  {
    sourceFile: "yeni.xlsx",
    sourceSheet: "Sheet1",
    sourceKind: "current_roster",
    rowNumber: 2,
    rawStoreName: "Balikesir 10 Burda AVM",
    rawStoreCode: "SM001",
    rawEmployeeCode: "4140",
    rawEmployeeName: "Mert Alcan",
    rawPositionName: "Magaza Muduru",
  },
  {
    sourceFile: "yeni.xlsx",
    sourceSheet: "Sheet1",
    sourceKind: "current_roster",
    rowNumber: 3,
    rawStoreName: "Balikesir 10 Burda AVM",
    rawStoreCode: "SM001",
    rawEmployeeCode: "4141",
    rawEmployeeName: "Aylin Demir",
    rawPositionName: "Kasiyer",
  },
];

describe("PilotRosterReconciliationService", () => {
  it("keeps active roster candidates but excludes store managers and cashiers from target references", () => {
    const service = new PilotRosterReconciliationService();

    const plan = service.buildApplyPlan({
      rows: [
        ...baseRosterRows,
        {
          sourceFile: "Haziran hedef.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "target",
          rowNumber: 2,
          sourcePeriod: "2026-06",
          rawStoreName: "Balikesir 10 Burda AVM",
          rawEmployeeName: "Ayse Demir",
          targetAmount: 100000,
        },
        {
          sourceFile: "Haziran hedef.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "target",
          rowNumber: 3,
          sourcePeriod: "2026-06",
          rawStoreName: "Balikesir 10 Burda AVM",
          rawEmployeeName: "Mert Alcan",
          targetAmount: 200000,
        },
        {
          sourceFile: "Haziran hedef.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "target",
          rowNumber: 4,
          sourcePeriod: "2026-06",
          rawStoreName: "Balikesir 10 Burda AVM",
          rawEmployeeName: "Aylin Demir",
          targetAmount: 300000,
        },
      ],
    });

    expect(plan.activeAssignments).toHaveLength(3);
    expect(plan.targetReferences).toEqual([
      expect.objectContaining({
        rawEmployeeName: "Ayse Demir",
        targetAmount: 100000,
      }),
    ]);
    expect(plan.excludedTargets.map((item) => item.reason)).toEqual([
      "target_excluded_role:store_manager",
      "target_excluded_role:cashier",
    ]);
  });

  it("blocks target rows when the active store differs from the target file store", () => {
    const service = new PilotRosterReconciliationService();

    const plan = service.buildApplyPlan({
      rows: [
        ...baseRosterRows,
        {
          sourceFile: "Haziran hedef.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "target",
          rowNumber: 2,
          sourcePeriod: "2026-06",
          rawStoreName: "Bursa Downtown",
          rawEmployeeName: "Ayse Demir",
          targetAmount: 100000,
        },
      ],
    });

    expect(plan.targetReferences).toHaveLength(0);
    expect(plan.reviewItems).toEqual([
      expect.objectContaining({
        reason: "target_store_differs_from_active_assignment",
        severity: "blocked",
      }),
    ]);
    expect(() => service.assertPlanCanApply({ plan })).toThrow(BadRequestException);
  });

  it("creates turnover candidates only from sales KPI rows absent from the June active roster", () => {
    const service = new PilotRosterReconciliationService();

    const plan = service.buildApplyPlan({
      rows: [
        ...baseRosterRows,
        {
          sourceFile: "Mayis satis.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "sales_kpi",
          rowNumber: 9,
          sourcePeriod: "2026-05",
          rawStoreName: "Balikesir 10 Burda AVM",
          rawEmployeeCode: "9999",
          rawEmployeeName: "Eski Personel",
          netSalesAmount: 50000,
        },
        {
          sourceFile: "Mayis hedef.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "target",
          rowNumber: 10,
          sourcePeriod: "2026-05",
          rawStoreName: "Balikesir 10 Burda AVM",
          rawEmployeeName: "Hedefte Var Satis Yok",
          targetAmount: 75000,
        },
        {
          sourceFile: "Mayis satis.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "sales_kpi",
          rowNumber: 11,
          sourcePeriod: "2026-05",
          rawStoreName: "Dis Magaza",
          rawEmployeeCode: "8888",
          rawEmployeeName: "Dis Magaza Personeli",
          netSalesAmount: 50000,
        },
      ],
    });

    expect(plan.turnoverEvents).toEqual([
      expect.objectContaining({
        sourcePeriod: "2026-05",
        rawEmployeeName: "Eski Personel",
      }),
    ]);
    expect(plan.reviewItems).toEqual([
      expect.objectContaining({
        reason: "target_employee_not_in_june_active_roster",
      }),
      expect.objectContaining({
        reason: "sales_kpi_store_not_in_june_active_roster",
      }),
    ]);
  });

  it("allows explicit review override while keeping review evidence visible", () => {
    const service = new PilotRosterReconciliationService();
    const plan = service.buildApplyPlan({
      rows: [
        {
          sourceFile: "yeni.xlsx",
          sourceSheet: "Sheet1",
          sourceKind: "current_roster",
          rowNumber: 1,
          rawStoreName: "Eyup Axis Pop Up",
          rawEmployeeCode: "5000",
          rawEmployeeName: "Review Personel",
          rawPositionName: "Moda Danismani",
        },
      ],
    });

    expect(plan.reviewItems).toEqual([
      expect.objectContaining({
        reason: expect.stringContaining("active_roster_review_required"),
      }),
      expect.objectContaining({
        reason: expect.stringContaining("temporary_store:pop_up"),
      }),
    ]);
    expect(() =>
      service.assertPlanCanApply({
        plan,
        approvalToken: "APPROVE_SAFE_ROWS_WITH_REVIEW_ITEMS",
      }),
    ).not.toThrow();
  });
});
