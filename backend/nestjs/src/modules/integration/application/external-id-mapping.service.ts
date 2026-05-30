import { Injectable } from "@nestjs/common";
import { ExternalIdMappingCommandRepository } from "../infrastructure/external-id-mapping-command.repository";

@Injectable()
export class ExternalIdMappingService {
  constructor(
    private readonly externalIdMappingCommandRepository: ExternalIdMappingCommandRepository,
  ) {}

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
    const exactMatch = await this.externalIdMappingCommandRepository.findActiveMapping({
      integrationSourceId,
      entityType,
      externalId,
    });
    if (exactMatch) {
      return exactMatch.internalId;
    }

    const normalizedExternalId = normalizeExternalMappingKey(externalId);
    if (!normalizedExternalId) {
      return null;
    }

    const normalizedMatches =
      await this.externalIdMappingCommandRepository.findActiveMappingsByNormalizedExternalId({
        integrationSourceId,
        entityType,
        normalizedExternalId,
      });

    if (normalizedMatches.length > 1) {
      throw new Error(
        `Ambiguous external id mapping for ${entityType}: ${externalId}`,
      );
    }

    return normalizedMatches[0]?.internalId ?? null;
  }

  async upsertMapping(input: {
    integrationSourceId: string;
    entityType: string;
    externalId: string;
    internalId: string;
    internalTableName: string;
  }): Promise<void> {
    await this.externalIdMappingCommandRepository.upsertMapping(input);
  }
}

function normalizeExternalMappingKey(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}
