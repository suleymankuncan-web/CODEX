import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { SalesTargetIncentiveParticipationRepository } from "../infrastructure/sales-target-incentive-participation.repository";

@Injectable()
export class SalesTargetIncentiveParticipationService {
  constructor(private readonly repository: SalesTargetIncentiveParticipationRepository) {}

  async setParticipation(input: {
    actor: AuthenticatedUser; period: string; storeId: string; employeeId: string; included: boolean;
    reasonNote?: string; expectedRevision: number; expectedSnapshotId: string;
  }) {
    const storeId = input.storeId.toLowerCase();
    if (!input.actor.roleCodes.includes("REGION_MANAGER") || !input.actor.actionScope?.assignedStoreIds.includes(storeId)) {
      throw new ForbiddenException("Assigned Region Manager store is required");
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period) || typeof input.included !== "boolean" ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= 2147483647 ||
      (input.reasonNote !== undefined && typeof input.reasonNote !== "string") ||
      (!input.included && (!input.reasonNote?.trim() || input.reasonNote.trim().length < 3)) || (input.reasonNote?.length ?? 0) > 1000) {
      throw new BadRequestException("A valid participation revision and exclusion reason are required");
    }
    return { data: await this.repository.setParticipation({
      period: input.period, storeId, employeeId: input.employeeId, included: input.included,
      reasonNote: input.reasonNote?.trim(), expectedRevision: input.expectedRevision,
      expectedSnapshotId: input.expectedSnapshotId, actorUserId: input.actor.userId,
    }) };
  }
}
