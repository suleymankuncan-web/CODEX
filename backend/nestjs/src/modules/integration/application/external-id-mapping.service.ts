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

    const externalValues = this.getExternalValues(input.payload, input.externalKeys);

    if (externalValues.length === 0) {
      throw new Error(input.missingMessage);
    }

    const mappedId = await this.resolveFirstMappedInternalId(
      input.integrationSourceId,
      input.entityType,
      externalValues,
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

    const externalValues = this.getExternalValues(input.payload, input.externalKeys);

    if (externalValues.length === 0) {
      return null;
    }

    return this.resolveFirstMappedInternalId(
      input.integrationSourceId,
      input.entityType,
      externalValues,
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

  private getExternalValues(payload: Record<string, unknown>, keys: string[]): string[] {
    return keys
      .map((key) => payload[key])
      .filter((value): value is NonNullable<unknown> => value !== undefined && value !== null)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
  }

  private async resolveFirstMappedInternalId(
    integrationSourceId: string,
    entityType: string,
    externalIds: string[],
  ): Promise<string | null> {
    for (const externalId of externalIds) {
      const mappedId = await this.resolveMappedInternalId(
        integrationSourceId,
        entityType,
        externalId,
      );
      if (mappedId) {
        return mappedId;
      }
    }

    return null;
  }
}

function normalizeExternalMappingKey(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}
