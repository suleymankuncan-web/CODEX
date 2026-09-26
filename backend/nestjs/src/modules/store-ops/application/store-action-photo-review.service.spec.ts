import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { StoreActionPhotoReviewService } from "./store-action-photo-review.service";

const plan = {
  actionPlanId: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000002",
  regionId: "00000000-0000-4000-8000-000000000003",
  ownerUserId: "00000000-0000-4000-8000-000000000004",
  resolutionWorkflowVersion: 2,
};
const actor = {
  actorUserId: plan.ownerUserId,
  actorRoleCodes: ["STORE_MANAGER"],
  actorScope: { companyIds: ["00000000-0000-4000-8000-000000000005"], regionIds: [], storeIds: [plan.storeId] },
  actorActionScope: { assignedStoreIds: [plan.storeId] },
  actorRoleScopes: {
    STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [plan.storeId] },
    REGION_MANAGER: { companyIds: [], regionIds: [plan.regionId], storeIds: [plan.storeId] },
  },
};

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    createUploadIntent: jest.fn(), submit: jest.fn().mockResolvedValue({ status: "solution_review_pending" }),
    review: jest.fn().mockResolvedValue({ status: "closed" }), getProjection: jest.fn(),
    hasUploadIntent: jest.fn().mockResolvedValue(true), isAssetLinkedToPlan: jest.fn().mockResolvedValue(true),
  };
  const plans = { getPlanById: jest.fn().mockResolvedValue(plan) };
  const media = { initiateApprovedSyntheticFixtureUpload: jest.fn(), finalizeSyntheticUpload: jest.fn(), readContent: jest.fn() };
  const config = {
    storeActionPhotoResolutionEnabled: true, regionManagerSolutionReviewEnabled: true,
    photoMediaStorageEnabled: true, checklistEvidenceStorageHealthy: true,
    ...overrides,
  };
  return { service: new StoreActionPhotoReviewService(repository as never, plans as never, media as never, config as never), repository, plans, media };
}

describe("StoreActionPhotoReviewService", () => {
  it("[FR-05][AC-05] submits a ready bound solution as review pending", async () => {
    const { service, repository } = build();
    await expect(service.submit({ ...actor, actionPlanId: plan.actionPlanId,
      resolutionNote: "  Düzen düzeltildi.  ", mediaAssetId: "00000000-0000-4000-8000-000000000006",
      expectedVersion: 0, idempotencyKey: "00000000-0000-4000-8000-000000000007",
    })).resolves.toEqual({ status: "solution_review_pending" });
    expect(repository.submit).toHaveBeenCalledWith(expect.objectContaining({ resolutionNote: "Düzen düzeltildi." }));
  });

  it("[AC-02][EC-03] rejects a revoked or different current owner", async () => {
    const { service } = build();
    await expect(service.submit({ ...actor, actorUserId: "00000000-0000-4000-8000-000000000099",
      actionPlanId: plan.actionPlanId, resolutionNote: "Düzeltildi",
      mediaAssetId: "00000000-0000-4000-8000-000000000006", expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000007",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("[AC-14] keeps submission fail-closed while the V2 flag is disabled", async () => {
    const { service } = build({ storeActionPhotoResolutionEnabled: false });
    await expect(service.submit({ ...actor, actionPlanId: plan.actionPlanId, resolutionNote: "Düzeltildi",
      mediaAssetId: "00000000-0000-4000-8000-000000000006", expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000007",
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("[FR-06][AC-06] admits review only for Region Manager role and scope", async () => {
    const { service, repository } = build();
    const regionActor = { ...actor, actorRoleCodes: ["REGION_MANAGER"],
      actorScope: { ...actor.actorScope, regionIds: [plan.regionId] } };
    await service.review({ ...regionActor, actionPlanId: plan.actionPlanId,
      solutionAttemptId: "00000000-0000-4000-8000-000000000008", decision: "approve",
      expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000009",
    });
    expect(repository.review).toHaveBeenCalledWith(expect.objectContaining({ actorStoreIds: [plan.storeId], decision: "approve" }));
    await expect(service.review({ ...actor, actionPlanId: plan.actionPlanId,
      solutionAttemptId: "00000000-0000-4000-8000-000000000008", decision: "approve",
      expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000010",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("[AC-02][EC-03] binds finalization to the exact plan, asset and actor intent", async () => {
    const { service, repository, media } = build();
    repository.hasUploadIntent.mockResolvedValue(false);
    await expect(service.finalize({ ...actor, actionPlanId: plan.actionPlanId,
      mediaAssetId: "00000000-0000-4000-8000-000000000006",
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(media.finalizeSyntheticUpload).not.toHaveBeenCalled();
  });

  it("[AC-02][EC-03] keeps mixed-role review inside the Region Manager role scope", async () => {
    const { service, repository } = build();
    const mixed = {
      ...actor,
      actorRoleCodes: ["STORE_MANAGER", "REGION_MANAGER"],
      actorRoleScopes: {
        STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [plan.storeId] },
        REGION_MANAGER: { companyIds: [], regionIds: ["00000000-0000-4000-8000-000000000099"], storeIds: [] },
      },
    };
    await service.review({ ...mixed, actionPlanId: plan.actionPlanId,
      solutionAttemptId: "00000000-0000-4000-8000-000000000008", decision: "approve",
      expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000009",
    });
    expect(repository.review).toHaveBeenCalledWith(expect.objectContaining({
      actorStoreIds: [],
    }));
  });

  it("[AC-02][EC-03] evaluates mixed-role read branches independently", async () => {
    const denied = build();
    denied.plans.getPlanById.mockResolvedValue({ ...plan, ownerUserId: "00000000-0000-4000-8000-000000000088" });
    await expect(denied.service.get({ ...actor,
      actorRoleCodes: ["STORE_MANAGER", "REGION_MANAGER"],
      actorRoleScopes: {
        STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [plan.storeId] },
        REGION_MANAGER: { companyIds: [], regionIds: [plan.regionId], storeIds: [] },
      },
      actionPlanId: plan.actionPlanId,
    })).rejects.toBeInstanceOf(ForbiddenException);

    const allowed = build();
    allowed.plans.getPlanById.mockResolvedValue({ ...plan, ownerUserId: "00000000-0000-4000-8000-000000000088" });
    allowed.repository.getProjection.mockResolvedValue({ status: "solution_review_pending" });
    await expect(allowed.service.get({ ...actor,
      actorRoleCodes: ["STORE_MANAGER", "REGION_MANAGER"],
      actionPlanId: plan.actionPlanId,
    })).resolves.toEqual({ status: "solution_review_pending" });
  });
});
