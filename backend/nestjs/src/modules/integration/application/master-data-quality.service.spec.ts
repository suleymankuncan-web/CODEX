import { ForbiddenException } from "@nestjs/common";
import { MasterDataQualityService } from "./master-data-quality.service";

describe("MasterDataQualityService", () => {
  function createService(repositoryOverrides: Partial<{
    listIssues: jest.Mock;
    listAudit: jest.Mock;
  }> = {}) {
    const repository = {
      listIssues: jest.fn(),
      listAudit: jest.fn(),
      ...repositoryOverrides,
    };

    return {
      repository,
      service: new MasterDataQualityService(repository as never),
    };
  }

  it("maps backend-projected quality issues with total projection summary", async () => {
    const { repository, service } = createService({
      listIssues: jest.fn().mockResolvedValue({
        rows: [
          {
            issue_id: "store_missing_region_assignment:store-1",
            issue_code: "store_missing_region_assignment",
            severity: "critical",
            entity_type: "store",
            entity_id: "store-1",
            entity_label: "Marmara Park",
            secondary_label: "SM140",
            problem_label: "Bolge baglantisi eksik",
            recommended_action: "Aktif bolge secin",
            affected_modules: ["KPI", "Hedefler"],
            last_seen_at: "2026-06-30T10:00:00.000Z",
            source: "store",
            total_count: "3",
            critical_count: "1",
            warning_count: "2",
            info_count: "0",
            store_count: "1",
            personnel_count: "1",
            assignment_count: "0",
            import_count: "1",
          },
        ],
        total: 3,
        summary: {
          severity: { critical: 1, warning: 2, info: 0 },
          entityType: { store: 1, personnel: 1, assignment: 0, import: 1 },
        },
      }),
    });

    await expect(
      service.listIssues({
        actorCompanyIds: ["company-1"],
        q: "marmara",
        entityType: "store",
        limit: 25,
        offset: 0,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: "store_missing_region_assignment:store-1",
          issueCode: "store_missing_region_assignment",
          severity: "critical",
          entityType: "store",
          entityId: "store-1",
          entityLabel: "Marmara Park",
          secondaryLabel: "SM140",
          problemLabel: "Bolge baglantisi eksik",
          recommendedAction: "Aktif bolge secin",
          affectedModules: ["KPI", "Hedefler"],
          lastSeenAt: "2026-06-30T10:00:00.000Z",
          source: "store",
        },
      ],
      meta: { count: 1, total: 3, limit: 25, offset: 0 },
      summary: {
        severity: { critical: 1, warning: 2, info: 0 },
        entityType: { store: 1, personnel: 1, assignment: 0, import: 1 },
      },
    });
    expect(repository.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorCompanyIds: ["company-1"],
        q: "marmara",
        entityType: "store",
        limit: 25,
        offset: 0,
      }),
    );
  });

  it("maps audit events into safe read models", async () => {
    const { service } = createService({
      listAudit: jest.fn().mockResolvedValue({
        rows: [
          {
            event_id: "event-1",
            event_type: "store_master_data.updated",
            entity_type: "store",
            entity_id: "store-1",
            entity_label: "Marmara Park",
            actor_label: "Admin User",
            occurred_at: "2026-06-30T10:00:00.000Z",
            metadata_json: { changedFields: ["regionId"] },
            total_count: "1",
          },
        ],
        total: 1,
      }),
    });

    const result = await service.listAudit({
      actorCompanyIds: ["company-1"],
      entityType: "store",
      entityId: "store-1",
    });

    expect(result).toEqual({
      items: [
        {
          eventId: "event-1",
          eventType: "store_master_data.updated",
          entityType: "store",
          entityId: "store-1",
          entityLabel: "Marmara Park",
          actorLabel: "Admin User",
          occurredAt: "2026-06-30T10:00:00.000Z",
          summary: expect.stringContaining("Marmara Park"),
          metadata: { changedFields: ["regionId"] },
        },
      ],
      meta: { count: 1, total: 1, limit: 30, offset: 0 },
    });
  });

  it("keeps company-scope guard on quality reads", async () => {
    const { service } = createService();

    await expect(
      service.listIssues({ actorCompanyIds: [], limit: 25, offset: 0 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
