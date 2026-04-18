import { Injectable } from "@nestjs/common";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
import { buildCommandResponse } from "../../../shared/http/response-builders";

@Injectable()
export class ChecklistService {
  constructor(private readonly storeOpsRepository: StoreOpsRepository) {}

  async createChecklistInstance(input: {
    templateId: string;
    storeId: string;
    assignedEmployeeId?: string;
    actorUserId: string;
  }) {
    return buildCommandResponse({
      status: "created",
      message: "Checklist instance created",
      data: {
        checklistInstance: await this.storeOpsRepository.createChecklistInstance(input),
      },
    });
  }

  async addChecklistResponse(input: {
    checklistInstanceId: string;
    templateItemId: string;
    responseValue?: string;
    scoreValue?: number;
    isNonCompliant?: boolean;
    commentText?: string;
    actorUserId: string;
  }) {
    return buildCommandResponse({
      status: "saved",
      message: "Checklist response saved",
      data: {
        checklistResponse: await this.storeOpsRepository.addChecklistResponse(input),
      },
    });
  }

  async completeChecklistInstance(input: {
    checklistInstanceId: string;
    auditorEmployeeId: string;
    actorUserId: string;
  }) {
    return buildCommandResponse({
      status: "completed",
      message: "Checklist instance completed",
      data: {
        checklistInstance: await this.storeOpsRepository.completeChecklistInstance(input),
      },
    });
  }
}
