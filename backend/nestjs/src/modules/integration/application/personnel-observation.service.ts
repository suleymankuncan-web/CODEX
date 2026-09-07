import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PersonnelObservationRepository } from "../infrastructure/personnel-observation.repository";
import { buildListResponse } from "../../../shared/http/response-builders";
import { assertCompanyScope, normalizeCompanyScope } from "./integration-company-scope";
import { NeutralSalesLine, normalizeCompanyDailySales } from "./company-daily-kpi-pure-adapter";

export function assertObservationDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException("personnel_observation_invalid_date");
  }
}

@Injectable()
export class PersonnelObservationService {
  constructor(private readonly repository: PersonnelObservationRepository) {}

  // Allocate before obtaining a response, so a slow older fetch cannot win.
  beginAttempt(sourceId: string, businessDate: string) {
    assertObservationDate(businessDate);
    return this.repository.beginAttempt(sourceId, businessDate);
  }

  async acceptSales(input: {
    sourceId: string;
    businessDate: string;
    generation: string;
    rows: readonly NeutralSalesLine[];
  }) {
    assertObservationDate(input.businessDate);
    if (!Array.isArray(input.rows) || input.rows.length > 100_000) {
      throw new BadRequestException("personnel_observation_row_limit");
    }
    const normalized = normalizeCompanyDailySales({
      sourceCode: input.sourceId,
      businessDate: input.businessDate,
      retryCount: 0,
      rows: input.rows,
    });
    if (normalized.status !== "succeeded") {
      throw new BadRequestException("personnel_observation_invalid_sales_set");
    }
    const pairs = new Map<string, { storeCode: string; personnelCode: string }>();
    for (const row of normalized.aggregates) {
      if (!("personnelCode" in row)) continue;
      const pair = { storeCode: row.storeCode, personnelCode: row.personnelCode };
      pairs.set(JSON.stringify([pair.storeCode, pair.personnelCode]), pair);
    }
    const observations = [...pairs.entries()]
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([, pair]) => pair);
    // Names and ephemeral invoice identities never enter the roster digest.
    const digest = createHash("sha256").update(JSON.stringify({
      sourceId: input.sourceId, businessDate: input.businessDate, observations,
    })).digest("hex");
    return this.repository.replace({
      sourceId: input.sourceId, businessDate: input.businessDate,
      generation: input.generation, digest, observations,
    });
  }

  async list(input: {
    actorCompanyIds: string[]; fromDate: string; toDate: string;
    storeId?: string; q?: string; limit?: number; offset?: number;
  }) {
    const actorCompanyIds = normalizeCompanyScope(input.actorCompanyIds);
    assertCompanyScope(actorCompanyIds);
    assertObservationDate(input.fromDate);
    assertObservationDate(input.toDate);
    const days = (Date.parse(input.toDate) - Date.parse(input.fromDate)) / 86_400_000;
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    if (days < 0 || days > 365 || !Number.isInteger(limit) || limit < 1 || limit > 200
      || !Number.isInteger(offset) || offset < 0 || offset > 1_000_000
      || (input.q?.length ?? 0) > 80) {
      throw new BadRequestException("personnel_observation_invalid_query");
    }
    const result = await this.repository.list({ ...input, actorCompanyIds, limit, offset });
    return buildListResponse(result.rows.map(row => ({
      sourceId: row.source_id, businessDate: row.business_date,
      storeId: row.store_id, storeCode: row.store_code,
      storeName: row.store_name, personnelCode: row.personnel_code,
    })), { total: result.total, limit, offset });
  }
}
