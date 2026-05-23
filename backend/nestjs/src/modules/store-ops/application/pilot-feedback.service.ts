import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import {
  PilotFeedbackClassification,
  PilotFeedbackSeveritySuggestion,
  PilotFeedbackStatus,
  PilotFeedbackType,
} from "./pilot-feedback.contract";
import { PilotFeedbackRepository } from "../infrastructure/pilot-feedback.repository";

type PilotFeedbackActorInput = {
  actorUserId: string;
  actorRoles: readonly string[];
};

@Injectable()
export class PilotFeedbackService {
  constructor(private readonly pilotFeedbackRepository: PilotFeedbackRepository) {}

  async createFeedback(input: PilotFeedbackActorInput & {
    feedbackType: PilotFeedbackType;
    severitySuggestion: PilotFeedbackSeveritySuggestion;
    routePath: string;
    pageTitle?: string;
    title: string;
    description: string;
  }) {
    const routePath = this.requireInternalRoute(input.routePath);
    const title = this.requireText(input.title, "title", 160);
    const description = this.requireText(input.description, "description", 4000);
    const pageTitle = this.normalizeOptionalText(input.pageTitle, 160);

    const feedback = await this.pilotFeedbackRepository.createFeedback({
      actorUserId: input.actorUserId,
      actorRoles: [...input.actorRoles],
      feedbackType: input.feedbackType,
      severitySuggestion: input.severitySuggestion,
      routePath,
      pageTitle,
      title,
      description,
    });

    return buildCommandResponse({
      status: "created",
      message: "Pilot feedback recorded",
      data: { feedback },
    });
  }

  async listFeedback(input: {
    status?: PilotFeedbackStatus;
    classification?: PilotFeedbackClassification;
    limit?: number;
    offset?: number;
  }) {
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const result = await this.pilotFeedbackRepository.listFeedback({
      status: input.status,
      classification: input.classification,
      limit,
      offset,
    });

    return buildListResponse(result.items, {
      total: result.total,
      limit,
      offset,
    });
  }

  async classifyFeedback(input: PilotFeedbackActorInput & {
    feedbackId: string;
    classification: PilotFeedbackClassification;
    note?: string;
  }) {
    const note = this.normalizeOptionalText(input.note, 2000);
    const feedback = await this.pilotFeedbackRepository.classifyFeedback({
      feedbackId: input.feedbackId,
      actorUserId: input.actorUserId,
      classification: input.classification,
      note,
    });

    if (!feedback) {
      throw new NotFoundException("Pilot feedback was not found");
    }

    return buildCommandResponse({
      status: "triaged",
      message: "Pilot feedback classified",
      data: { feedback },
    });
  }

  private requireInternalRoute(value: string) {
    const routePath = this.requireText(value, "routePath", 300);
    if (!routePath.startsWith("/") || routePath.startsWith("//")) {
      throw new BadRequestException("routePath must be an internal route");
    }

    return routePath;
  }

  private requireText(value: string | undefined, fieldName: string, maxLength: number) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`${fieldName} is too long`);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException("Optional text is too long");
    }

    return normalized;
  }

  private normalizeLimit(limit?: number) {
    if (!limit || Number.isNaN(limit)) {
      return 50;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 100);
  }

  private normalizeOffset(offset?: number) {
    if (!offset || Number.isNaN(offset)) {
      return 0;
    }

    return Math.max(Math.trunc(offset), 0);
  }
}
