import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  CloneCompetitionTeamTemplateInput,
  CompetitionTeamTemplate,
  CreateCompetitionTeamTemplateInput,
  DeactivateCompetitionTeamTemplateInput,
  UpdateCompetitionTeamTemplateInput,
} from "../application/competition.contract";
import { writeCompetitionAudit } from "./competition.repository.audit";
import { mapTeamTemplates } from "./competition.repository.mapper";
import { queryTeamTemplateRows } from "./competition.repository.team-template-queries";

@Injectable()
export class CompetitionTeamTemplateCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTeamTemplate(
    input: CreateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.databaseService.withTransaction(async (client) => {
      const templateResult = await client.query<{
        competition_team_template_id: string;
        template_code: string;
        template_name: string;
        description: string | null;
        is_active: boolean;
      }>(
        `
          INSERT INTO ops.competition_team_template (
            template_code,
            template_name,
            description,
            is_active
          )
          VALUES ($1, $2, $3, TRUE)
          RETURNING
            competition_team_template_id,
            template_code,
            template_name,
            description,
            is_active
        `,
        [input.templateCode, input.templateName, input.description ?? null],
      );

      const templateRow = templateResult.rows[0];

      await client.query(
        `
          INSERT INTO ops.competition_team_template_store (
            competition_team_template_id,
            store_id
          )
          SELECT $1::uuid, unnest($2::uuid[])
          ON CONFLICT DO NOTHING
        `,
        [templateRow.competition_team_template_id, input.storeIds],
      );

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_team_template.created",
        entityName: "ops.competition_team_template",
        entityId: templateRow.competition_team_template_id,
        metadata: {
          templateCode: input.templateCode,
          storeCount: input.storeIds.length,
        },
      });

      const rows = await queryTeamTemplateRows(client, {
        templateId: templateRow.competition_team_template_id,
        activeOnly: false,
      });

      return mapTeamTemplates(rows)[0];
    });
  }

  async deactivateTeamTemplate(
    input: DeactivateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        competition_team_template_id: string;
      }>(
        `
          UPDATE ops.competition_team_template
          SET
            is_active = FALSE,
            updated_at = NOW()
          WHERE competition_team_template_id = $1::uuid
          RETURNING competition_team_template_id
        `,
        [input.templateId],
      );

      const templateId = result.rows[0]?.competition_team_template_id;

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_team_template.deactivated",
        entityName: "ops.competition_team_template",
        entityId: input.templateId,
        metadata: {
          templateId: input.templateId,
          changedFields: ["is_active"],
        },
      });

      const rows = await queryTeamTemplateRows(client, {
        templateId: templateId ?? input.templateId,
        activeOnly: false,
      });

      return mapTeamTemplates(rows)[0];
    });
  }

  async updateTeamTemplate(
    input: UpdateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        competition_team_template_id: string;
      }>(
        `
          UPDATE ops.competition_team_template
          SET
            template_code = $2,
            template_name = $3,
            description = $4,
            updated_at = NOW()
          WHERE competition_team_template_id = $1::uuid
          RETURNING competition_team_template_id
        `,
        [
          input.templateId,
          input.templateCode,
          input.templateName,
          input.description ?? null,
        ],
      );

      const templateId = result.rows[0]?.competition_team_template_id ?? input.templateId;

      await client.query(
        `
          DELETE FROM ops.competition_team_template_store
          WHERE competition_team_template_id = $1::uuid
        `,
        [templateId],
      );

      await client.query(
        `
          INSERT INTO ops.competition_team_template_store (
            competition_team_template_id,
            store_id
          )
          SELECT $1::uuid, unnest($2::uuid[])
          ON CONFLICT DO NOTHING
        `,
        [templateId, input.storeIds],
      );

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_team_template.updated",
        entityName: "ops.competition_team_template",
        entityId: templateId,
        metadata: {
          templateId,
          templateCode: input.templateCode,
          storeCount: input.storeIds.length,
          changedFields: ["template_code", "template_name", "description", "store_ids"],
        },
      });

      const rows = await queryTeamTemplateRows(client, {
        templateId,
        activeOnly: false,
      });

      return mapTeamTemplates(rows)[0];
    });
  }

  async cloneTeamTemplate(
    input: CloneCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.databaseService.withTransaction(async (client) => {
      const templateResult = await client.query<{
        competition_team_template_id: string;
        template_code: string;
        template_name: string;
        description: string | null;
        is_active: boolean;
      }>(
        `
          INSERT INTO ops.competition_team_template (
            template_code,
            template_name,
            description,
            is_active
          )
          VALUES ($1, $2, $3, TRUE)
          RETURNING
            competition_team_template_id,
            template_code,
            template_name,
            description,
            is_active
        `,
        [input.templateCode, input.templateName, input.description ?? null],
      );

      const templateRow = templateResult.rows[0];

      await client.query(
        `
          INSERT INTO ops.competition_team_template_store (
            competition_team_template_id,
            store_id
          )
          SELECT $1::uuid, source_store.store_id
          FROM ops.competition_team_template_store source_store
          WHERE source_store.competition_team_template_id = $2::uuid
          ON CONFLICT DO NOTHING
        `,
        [templateRow.competition_team_template_id, input.sourceTemplateId],
      );

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_team_template.cloned",
        entityName: "ops.competition_team_template",
        entityId: templateRow.competition_team_template_id,
        metadata: {
          sourceTemplateId: input.sourceTemplateId,
          templateCode: input.templateCode,
        },
      });

      const rows = await queryTeamTemplateRows(client, {
        templateId: templateRow.competition_team_template_id,
        activeOnly: false,
      });

      return mapTeamTemplates(rows)[0];
    });
  }
}
