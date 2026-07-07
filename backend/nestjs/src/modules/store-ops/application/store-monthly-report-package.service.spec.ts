import { BadRequestException } from "@nestjs/common";
import * as XLSX from "@e965/xlsx";
import {
  resolveMonthlyRange,
  STORE_MONTHLY_REPORT_PACKAGE_HEADERS,
  StoreMonthlyReportPackageService,
} from "./store-monthly-report-package.service";
import { RankingService } from "./ranking.service";
import { StoreMonthlyReportPackageRepository } from "../infrastructure/store-monthly-report-package.repository";
import { StoreMonthlyReportPackageRow } from "../infrastructure/store-monthly-report-package.types";

describe("StoreMonthlyReportPackageService", () => {
  function createService(
    rows: StoreMonthlyReportPackageRow[] = [],
    rankingService?: Pick<RankingService, "getRankings">,
  ) {
    const repository = {
      getStoreMonthlyReportPackageRows: jest.fn(async () => rows),
    } as unknown as jest.Mocked<StoreMonthlyReportPackageRepository>;
    const service = new StoreMonthlyReportPackageService(
      repository,
      rankingService as RankingService | undefined,
    );

    return { repository, service };
  }

  const scope = {
    companyIds: ["00000000-0000-4000-8000-000000000001"],
    regionIds: [],
    storeIds: [],
  };

  it("rejects invalid periods before querying", async () => {
    const { repository, service } = createService();

    await expect(
      service.getSummary({
        period: "2026-6",
        today: "2026-06-14",
        ...scope,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.getStoreMonthlyReportPackageRows).not.toHaveBeenCalled();
  });

  it("rejects future months", async () => {
    expect(() => resolveMonthlyRange("2026-07", "2026-06-14")).toThrow(
      "Gelecek dönem raporu indirilemez",
    );
  });

  it("uses Istanbul today as current month end", async () => {
    const { repository, service } = createService();

    await service.getSummary({
      period: "2026-06",
      today: "2026-06-14",
      ...scope,
    });

    expect(repository.getStoreMonthlyReportPackageRows).toHaveBeenCalledWith({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-14",
      companyIds: scope.companyIds,
      regionIds: [],
      storeIds: [],
      regionManagerUserId: undefined,
    });
  });

  it("uses the full month for past periods", async () => {
    const range = resolveMonthlyRange("2026-05", "2026-06-14");

    expect(range).toEqual({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      isCurrentPeriod: false,
    });
  });

  it("normalizes missing module data as Veri yok", async () => {
    const { service } = createService([
      {
        region_manager_name: null,
        store_id: "00000000-0000-4000-8000-000000000100",
        store_name: "Balıkesir 10 Burda AVM",
        store_type: "company",
        region_name: null,
        score_value: null,
        upt_value: null,
        atv_value: null,
        cr_value: null,
        hg_value: null,
        gsm_value: null,
        bm_checklist_score: null,
        vm_checklist_score: null,
        pending_ack_count: "0",
        open_action_count: "0",
        closed_action_count: "0",
        target_status: null,
        incentive_status: null,
        incentive_total_amount: null,
        planned_headcount: null,
        active_headcount: "4",
        leaver_count: "0",
        turnover_rate: null,
        last_visit_date: null,
        days_since_visit: null,
      },
    ]);

    const summary = await service.getSummary({
      period: "2026-05",
      today: "2026-06-14",
      ...scope,
    });

    expect(summary.periodLabel).toBe("Mayıs 2026");
    expect(summary.coverageLabel).toBe("1-31 Mayıs");
    expect(summary.storeCount).toBe(1);
    expect(summary.sections).toContainEqual({
      code: "scope",
      label: "Kapsam",
      value: "1 mağaza",
      status: "ready",
    });
    expect(summary.items[0]).toMatchObject({
      regionManager: "Veri yok",
      score: "Veri yok",
      targetStatus: "Veri yok",
      normFiili: "Veri yok",
      turnover: "Veri yok",
      daysSinceVisit: "Veri yok",
      dataNote: "Skor kaynağı yok; Turnover kaynağı yok; Norm kaynağı yok",
    });
  });

  it("uses ranking store scores when the report row has no stored score", async () => {
    const storeId = "00000000-0000-4000-8000-000000000100";
    const rankingService = {
      getRankings: jest.fn(async () => ({
        storeLeaderboard: {
          items: [
            {
              storeId,
              scoreValue: 88.42,
            },
            {
              storeId: "00000000-0000-4000-8000-000000000999",
              scoreValue: 12,
            },
          ],
        },
      })),
    } as unknown as Pick<RankingService, "getRankings">;
    const { service } = createService(
      [
        {
          region_manager_name: "Onur Kaytan",
          store_id: storeId,
          store_name: "Balıkesir 10 Burda AVM",
          store_type: "company",
          region_name: "Onur Kaytan Bölgesi",
          score_value: null,
          upt_value: "3.09",
          atv_value: "3628.54",
          cr_value: "0.2232",
          hg_value: "1.2355",
          gsm_value: "0.95",
          bm_checklist_score: null,
          vm_checklist_score: null,
          pending_ack_count: "0",
          open_action_count: "0",
          closed_action_count: "0",
          target_status: null,
          incentive_status: null,
          incentive_total_amount: null,
          planned_headcount: "4",
          active_headcount: "4",
          leaver_count: "0",
          turnover_rate: null,
          last_visit_date: null,
          days_since_visit: null,
        },
      ],
      rankingService,
    );

    const summary = await service.getSummary({
      period: "2026-06",
      today: "2026-06-14",
      ...scope,
      rankingContext: {
        userId: "00000000-0000-4000-8000-000000000900",
        roleCodes: ["REGION_MANAGER"],
        companyIds: scope.companyIds,
        regionIds: [],
        storeIds: [],
        assignedStoreIds: [storeId],
      },
    });

    expect(rankingService.getRankings).toHaveBeenCalledWith(
      expect.objectContaining({
        periodType: "monthly",
        periodStart: "2026-06-01",
        limit: 500,
      }),
    );
    expect(summary.items[0]).toMatchObject({
      score: "88,42",
      dataNote: "Turnover kaynağı yok",
    });
  });

  it("builds the expected worksheet, headers, and row values", async () => {
    const { service } = createService([
      {
        region_manager_name: "Onur Kaytan",
        store_id: "00000000-0000-4000-8000-000000000100",
        store_name: "Bağdat Caddesi",
        store_type: "company",
        region_name: "Onur Kaytan Bölgesi",
        score_value: "102.96",
        upt_value: "3.09",
        atv_value: "3628.54",
        cr_value: "0.2232",
        hg_value: "1.2355",
        gsm_value: "0.95",
        bm_checklist_score: "91",
        vm_checklist_score: null,
        pending_ack_count: "0",
        open_action_count: "1",
        closed_action_count: "0",
        target_status: "approved",
        incentive_status: "succeeded",
        incentive_total_amount: "1286450.75",
        planned_headcount: "6",
        active_headcount: "5",
        leaver_count: "2",
        turnover_rate: "12.50",
        last_visit_date: "2026-05-30",
        days_since_visit: "15",
      },
      {
        region_manager_name: "Eda Doğanay",
        store_id: "00000000-0000-4000-8000-000000000101",
        store_name: "Düzce Dmall AVM",
        store_type: "company",
        region_name: "Eda Doğanay Bölgesi",
        score_value: null,
        upt_value: null,
        atv_value: null,
        cr_value: null,
        hg_value: null,
        gsm_value: null,
        bm_checklist_score: null,
        vm_checklist_score: null,
        pending_ack_count: "0",
        open_action_count: "0",
        closed_action_count: "0",
        target_status: null,
        incentive_status: null,
        incentive_total_amount: null,
        planned_headcount: null,
        active_headcount: "0",
        leaver_count: "0",
        turnover_rate: null,
        last_visit_date: null,
        days_since_visit: null,
      },
    ]);

    const workbookResult = await service.buildWorkbook({
      period: "2026-06",
      today: "2026-06-14",
      ...scope,
    });
    const workbook = XLSX.read(workbookResult.buffer, { cellStyles: true, type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Mağaza İzleyiş"], {
      header: 1,
    }) as string[][];
    const worksheet = workbook.Sheets["Mağaza İzleyiş"];

    expect(workbookResult.fileName).toBe("magaza-izleyis-2026-06.xlsx");
    expect(workbook.SheetNames).toContain("Mağaza İzleyiş");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(STORE_MONTHLY_REPORT_PACKAGE_HEADERS);
    expect(rows[1]).toContain("Onur Kaytan");
    expect(rows[1]).toContain("Onur Kaytan Bölgesi");
    expect(rows[1]).toContain("%22,32");
    expect(rows[1]).toContain("%12,50 / 2 ayrılan");
    expect(rows[1]).toContain("15 gün");
    expect(rows[1]).toContain("Devam ediyor");
    expect(rows[1]).toContain("Tamam");
    expect(rows[2]).toContain("Veri yok");
    expect(worksheet["A1"].s).toMatchObject({
      fgColor: { rgb: "3F2A8C" },
      patternType: "solid",
    });
    expect(worksheet["N2"].s).toMatchObject({
      fgColor: { rgb: "FFF3D6" },
      patternType: "solid",
    });
  });
});
