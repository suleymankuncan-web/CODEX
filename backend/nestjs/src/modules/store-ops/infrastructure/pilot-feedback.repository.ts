import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import {
  PilotFeedbackClassification,
  PilotFeedbackSeveritySuggestion,
  PilotFeedbackStatus,
  PilotFeedbackType,
  pilotFeedbackAuditEventTypes,
} from "../application/pilot-feedback.contract";

export type PilotFeedback = {
  feedbackId: string;
  actorUserId: string;
  actorRoleCodes: string[];
  feedbackType: PilotFeedbackType;
  severitySuggestion: PilotFeedbackSeveritySuggestion;
  routePath: string;
  pageTitle: string | null;
  title: string;
  description: string;
  status: PilotFeedbackStatus;
  classification: PilotFeedbackClassification | null;
  classifiedByUserId: string | null;
  classifiedAt: string | null;
  classificationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type PilotFeedbackRow = {
  pilot_feedback_id: string;
  actor_user_id: string;
  actor_role_codes: string[];
  feedback_type: PilotFeedbackType;
  severity_suggestion: PilotFeedbackSeveritySuggestion;
  route_path: string;
  page_title: string | null;
  title: string;
  description: string;
  status: PilotFeedbackStatus;
  classification: PilotFeedbackClassification | null;
  classified_by_user_id: string | null;
  classified_at: string | null;
  classification_note: string | null;
  created_at: string;
  updated_at: string;
};

type Queryable = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const PILOT_FEEDBACK_COLUMNS = `
  pilot_feedback_id,
  actor_user_id,
  actor_role_codes,
  feedback_type,
  severity_suggestion,
  route_path,
  page_title,
  title,
  description,
  status,
  classification,
  classified_by_user_id,
  classified_at,
  classification_note,
  created_at,
  updated_at
`;

@Injectable()
export class PilotFeedbackRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createFeedback(input: {
    actorUserId: string;
    actorRoles: string[];
    feedbackType: PilotFeedbackType;
    severitySuggestion: PilotFeedbackSeveritySuggestion;
    routePath: string;
    pageTitle: string | null;
    title: string;
    description: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<PilotFeedbackRow>(
        `
          INSERT INTO ops.pilot_feedback (
            actor_user_id,
            actor_role_codes,
            feedback_type,
            severity_suggestion,
            route_path,
            page_title,
            title,
            description
          )
          VALUES (
            $1::uuid,
            $2::text[],
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
          RETURNING ${PILOT_FEEDBACK_COLUMNS}
        `,
        [
          input.actorUserId,
          input.actorRoles,
          input.feedbackType,
          input.severitySuggestion,
          input.routePath,
          input.pageTitle,
          input.title,
          input.description,
        ],
      );

      const feedback = this.mapFeedback(result.rows[0]);
      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: pilotFeedbackAuditEventTypes.created,
        feedback,
        metadata: {
          feedbackType: input.feedbackType,
          severitySuggestion: input.severitySuggestion,
          routePath: input.routePath,
        },
      });

      return feedback;
    });
  }

  async listFeedback(input: {
    status?: PilotFeedbackStatus;
    classification?: PilotFeedbackClassification;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [];
    const filters: string[] = [];

    if (input.status) {
      params.push(input.status);
      filters.push(`status = $${params.length}`);
    }

    if (input.classification) {
      params.push(input.classification);
      filters.push(`classification = $${params.length}`);
    }

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const countResult = await this.databaseService.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM ops.pilot_feedback
        ${whereSql}
      `,
      params,
    );
    const listParams = [...params, input.limit, input.offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const result = await this.databaseService.query<PilotFeedbackRow>(
      `
        SELECT ${PILOT_FEEDBACK_COLUMNS}
        FROM ops.pilot_feedback
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapFeedback(row)),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async classifyFeedback(input: {
    feedbackId: string;
    actorUserId: string;
    classification: PilotFeedbackClassification;
    note: string | null;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<PilotFeedbackRow>(
        `
          UPDATE ops.pilot_feedback
          SET
            status = 'triaged',
            classification = $2,
            classified_by_user_id = $3::uuid,
            classified_at = now(),
            classification_note = $4,
            updated_at = now()
          WHERE pilot_feedback_id = $1::uuid
          RETURNING ${PILOT_FEEDBACK_COLUMNS}
        `,
        [input.feedbackId, input.classification, input.actorUserId, input.note],
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const feedback = this.mapFeedback(row);
      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: pilotFeedbackAuditEventTypes.classified,
        feedback,
        metadata: {
          classification: input.classification,
          note: input.note,
        },
      });

      return feedback;
    });
  }

  private async insertAuditEvent(
    client: Queryable,
    input: {
      actorUserId: string;
      eventType: string;
      feedback: PilotFeedback;
      metadata: Record<string, unknown>;
    },
  ) {
    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          metadata_json
        )
        VALUES (
          $1::uuid,
          $2,
          'ops.pilot_feedback',
          $3::uuid,
          'pilot',
          $4::jsonb
        )
      `,
      [
        input.actorUserId,
        input.eventType,
        input.feedback.feedbackId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          ...input.metadata,
        }),
      ],
    );
  }

  private mapFeedback(row: PilotFeedbackRow): PilotFeedback {
    return {
      feedbackId: row.pilot_feedback_id,
      actorUserId: row.actor_user_id,
      actorRoleCodes: row.actor_role_codes,
      feedbackType: row.feedback_type,
      severitySuggestion: row.severity_suggestion,
      routePath: row.route_path,
      pageTitle: row.page_title,
      title: row.title,
      description: row.description,
      status: row.status,
      classification: row.classification,
      classifiedByUserId: row.classified_by_user_id,
      classifiedAt: row.classified_at,
      classificationNote: row.classification_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
