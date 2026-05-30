import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ExternalIdMappingCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findActiveMapping(input: {
    integrationSourceId: string;
    entityType: string;
    externalId: string;
  }): Promise<{ internalId: string } | null> {
    const result = await this.databaseService.query<{ internal_id: string }>(
      `
        SELECT internal_id
        FROM stg.external_id_map
        WHERE integration_source_id = $1::uuid
          AND entity_type = $2
          AND external_id = $3
          AND is_active = TRUE
        LIMIT 1
      `,
      [input.integrationSourceId, input.entityType, input.externalId],
    );

    const row = result.rows[0];
    return row ? { internalId: row.internal_id } : null;
  }

  async findActiveMappingsByNormalizedExternalId(input: {
    integrationSourceId: string;
    entityType: string;
    normalizedExternalId: string;
  }): Promise<Array<{ internalId: string }>> {
    const result = await this.databaseService.query<{ internal_id: string }>(
      `
        SELECT DISTINCT internal_id
        FROM stg.external_id_map
        WHERE integration_source_id = $1::uuid
          AND entity_type = $2
          AND UPPER(REGEXP_REPLACE(COALESCE(external_id, ''), '[\\s-]', '', 'g')) = $3
          AND is_active = TRUE
        LIMIT 2
      `,
      [input.integrationSourceId, input.entityType, input.normalizedExternalId],
    );

    return result.rows.map((row) => ({ internalId: row.internal_id }));
  }

  async upsertMapping(input: {
    integrationSourceId: string;
    entityType: string;
    externalId: string;
    internalId: string;
    internalTableName: string;
  }): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO stg.external_id_map (
          integration_source_id,
          entity_type,
          external_id,
          internal_id,
          internal_table_name,
          is_active
        )
        VALUES ($1::uuid, $2, $3, $4::uuid, $5, TRUE)
        ON CONFLICT (integration_source_id, entity_type, external_id) DO UPDATE
        SET
          internal_id = EXCLUDED.internal_id,
          internal_table_name = EXCLUDED.internal_table_name,
          is_active = TRUE
      `,
      [
        input.integrationSourceId,
        input.entityType,
        input.externalId,
        input.internalId,
        input.internalTableName,
      ],
    );
  }
}
