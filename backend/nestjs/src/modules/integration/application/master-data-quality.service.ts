import { Injectable } from "@nestjs/common";
import { buildListResponse } from "../../../shared/http/response-builders";
import {
  MasterDataQualityRepository,
  type MasterDataQualityEntityType,
  type MasterDataQualitySeverity,
} from "../infrastructure/master-data-quality.repository";
import { summarizeMasterDataAuditEvent } from "./master-data-quality.rules";
import {
  assertCompanyScope,
  normalizeCompanyScope,
} from "./integration-company-scope";

@Injectable()
export class MasterDataQualityService {
  constructor(private readonly repository: MasterDataQualityRepository) {}

  async listIssues(input: {
    actorCompanyIds: string[];
    q?: string;
    entityType?: MasterDataQualityEntityType;
    severity?: MasterDataQualitySeverity;
    issueCode?: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = normalizeCompanyScope(input.actorCompanyIds);
    assertCompanyScope(actorCompanyIds);
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const result = await this.repository.listIssues({
      actorCompanyIds,
      q: input.q,
      entityType: input.entityType,
      severity: input.severity,
      issueCode: input.issueCode,
      limit,
      offset,
    });

    const items = result.rows.map((item) => ({
      id: item.issue_id,
      issueCode: item.issue_code,
      severity: item.severity,
      entityType: item.entity_type,
      entityId: item.entity_id,
      entityLabel: item.entity_label,
      secondaryLabel: item.secondary_label,
      problemLabel: item.problem_label,
      recommendedAction: item.recommended_action,
      affectedModules: item.affected_modules,
      lastSeenAt: item.last_seen_at,
      source: item.source,
    }));

    return {
      ...buildListResponse(items, { total: result.total, limit, offset }),
      summary: result.summary,
    };
  }

  async listAudit(input: {
    actorCompanyIds: string[];
    entityType?: "store" | "personnel" | "import";
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const actorCompanyIds = normalizeCompanyScope(input.actorCompanyIds);
    assertCompanyScope(actorCompanyIds);
    const limit = input.limit ?? 30;
    const offset = input.offset ?? 0;
    const result = await this.repository.listAudit({
      actorCompanyIds,
      entityType: input.entityType,
      entityId: input.entityId,
      limit,
      offset,
    });

    const items = result.rows.map((item) => ({
      eventId: item.event_id,
      eventType: item.event_type,
      entityType: item.entity_type,
      entityId: item.entity_id,
      entityLabel: item.entity_label,
      actorLabel: item.actor_label,
      occurredAt: item.occurred_at,
      summary: summarizeMasterDataAuditEvent({
        eventType: item.event_type,
        entityLabel: item.entity_label,
      }),
      metadata: item.metadata_json,
    }));

    return buildListResponse(items, { total: result.total, limit, offset });
  }
}
