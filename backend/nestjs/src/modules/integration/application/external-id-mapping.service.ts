import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ExternalIdMappingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async resolveRequiredInternalId(input: {
    payload: Record<string, unknown>;
    integrationSourceId: string;
    entityType: string;
    directKeys: string[];
    externalKeys: string[];
    missingMessage: string;
    unresolvedMessage: string;
  }): Promise<string> {
    const directValue = input.directKeys
      .map((key) => input.payload[key])
      .find((value) => value !== undefined && value !== null);

    if (directValue) {
      return String(directValue);
    }

    const externalValue = input.externalKeys
      .map((key) => input.payload[key])
      .find((value) => value !== undefined && value !== null);

    if (!externalValue) {
      throw new Error(input.missingMessage);
    }

    const mappedId = await this.resolveMappedInternalId(
      input.integrationSourceId,
      input.entityType,
      String(externalValue),
    );

    if (!mappedId) {
      throw new Error(input.unresolvedMessage);
    }

    return mappedId;
  }

  async resolveOptionalInternalId(input: {
    payload: Record<string, unknown>;
    integrationSourceId: string;
    entityType: string;
    directKeys: string[];
    externalKeys: string[];
  }): Promise<string | null> {
    const directValue = input.directKeys
      .map((key) => input.payload[key])
      .find((value) => value !== undefined && value !== null);

    if (directValue) {
      return String(directValue);
    }

    const externalValue = input.externalKeys
      .map((key) => input.payload[key])
      .find((value) => value !== undefined && value !== null);

    if (!externalValue) {
      return null;
    }

    return this.resolveMappedInternalId(
      input.integrationSourceId,
      input.entityType,
      String(externalValue),
    );
  }

  async resolveMappedInternalId(
    integrationSourceId: string,
    entityType: string,
    externalId: string,
  ): Promise<string | null> {
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
      [integrationSourceId, entityType, externalId],
    );

    return result.rows[0]?.internal_id ?? null;
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
        SET internal_id = EXCLUDED.internal_id, is_active = TRUE
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
