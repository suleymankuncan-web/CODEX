import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PilotFeedbackService } from "./pilot-feedback.service";
import type { PilotFeedback } from "../infrastructure/pilot-feedback.repository";

const actorUserId = "00000000-0000-4000-8000-000000000901";

function createRepositoryMock() {
  return {
    createFeedback: jest.fn(),
    listFeedback: jest.fn(),
    classifyFeedback: jest.fn(),
  };
}

function createFeedback(overrides?: Partial<PilotFeedback>): PilotFeedback {
  return {
    feedbackId: "00000000-0000-4000-8000-000000000501",
    actorUserId,
    actorRoleCodes: ["STORE_MANAGER"],
    feedbackType: "friction",
    severitySuggestion: "p2",
    routePath: "/store/tasks",
    pageTitle: "Tasks",
    title: "Action plan copy is unclear",
    description: "The next step after closing an action plan is unclear.",
    status: "new",
    classification: null,
    classifiedByUserId: null,
    classifiedAt: null,
    classificationNote: null,
    createdAt: "2026-05-23T12:00:00.000Z",
    updatedAt: "2026-05-23T12:00:00.000Z",
    ...overrides,
  };
}

describe("PilotFeedbackService", () => {
  it("creates sanitized internal-route pilot feedback", async () => {
    const repository = createRepositoryMock();
    repository.createFeedback.mockResolvedValue(createFeedback());
    const service = new PilotFeedbackService(repository as never);

    const result = await service.createFeedback({
      actorUserId,
      actorRoles: ["STORE_MANAGER"],
      feedbackType: "friction",
      severitySuggestion: "p2",
      routePath: " /store/tasks ",
      pageTitle: " Tasks ",
      title: " Action plan copy is unclear ",
      description: " The next step after closing an action plan is unclear. ",
    });

    expect(result.command.status).toBe("created");
    expect(repository.createFeedback).toHaveBeenCalledWith({
      actorUserId,
      actorRoles: ["STORE_MANAGER"],
      feedbackType: "friction",
      severitySuggestion: "p2",
      routePath: "/store/tasks",
      pageTitle: "Tasks",
      title: "Action plan copy is unclear",
      description: "The next step after closing an action plan is unclear.",
    });
  });

  it("rejects external route paths before persistence", async () => {
    const repository = createRepositoryMock();
    const service = new PilotFeedbackService(repository as never);

    for (const routePath of ["https://example.com", "//example.com"]) {
      await expect(
        service.createFeedback({
          actorUserId,
          actorRoles: ["STORE_MANAGER"],
          feedbackType: "bug",
          severitySuggestion: "p1",
          routePath,
          title: "External",
          description: "Should not be accepted",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.createFeedback).not.toHaveBeenCalled();
  });

  it("lists feedback with normalized pagination", async () => {
    const repository = createRepositoryMock();
    repository.listFeedback.mockResolvedValue({
      items: [createFeedback()],
      total: 1,
    });
    const service = new PilotFeedbackService(repository as never);

    const result = await service.listFeedback({
      status: "new",
      limit: 500,
      offset: -10,
    });

    expect(result.meta).toEqual({
      count: 1,
      total: 1,
      limit: 100,
      offset: 0,
    });
    expect(repository.listFeedback).toHaveBeenCalledWith({
      status: "new",
      classification: undefined,
      limit: 100,
      offset: 0,
    });
  });

  it("classifies feedback as triaged without changing pilot go no-go semantics", async () => {
    const repository = createRepositoryMock();
    repository.classifyFeedback.mockResolvedValue(
      createFeedback({
        status: "triaged",
        classification: "p1_pilot_blocker",
        classificationNote: "Needs next pilot blocker fix.",
      }),
    );
    const service = new PilotFeedbackService(repository as never);

    const result = await service.classifyFeedback({
      actorUserId,
      actorRoles: ["SUPER_ADMIN"],
      feedbackId: "00000000-0000-4000-8000-000000000501",
      classification: "p1_pilot_blocker",
      note: " Needs next pilot blocker fix. ",
    });

    expect(result.command.status).toBe("triaged");
    expect(repository.classifyFeedback).toHaveBeenCalledWith({
      feedbackId: "00000000-0000-4000-8000-000000000501",
      actorUserId,
      classification: "p1_pilot_blocker",
      note: "Needs next pilot blocker fix.",
    });
  });

  it("throws not found when classification target is missing", async () => {
    const repository = createRepositoryMock();
    repository.classifyFeedback.mockResolvedValue(null);
    const service = new PilotFeedbackService(repository as never);

    await expect(
      service.classifyFeedback({
        actorUserId,
        actorRoles: ["SUPER_ADMIN"],
        feedbackId: "00000000-0000-4000-8000-000000000999",
        classification: "p3_backlog",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
