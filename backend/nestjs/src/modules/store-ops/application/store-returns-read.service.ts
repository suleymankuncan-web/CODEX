import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { StoreReturnsReadRepository } from "../infrastructure/store-returns-read.repository";
import { resolveRankingDateRange } from "./ranking-date-range";
import { resolveStoreReturnsScope } from "./store-returns-scope";

@Injectable()
export class StoreReturnsReadService {
  constructor(private readonly repository: StoreReturnsReadRepository) {}

  async getLedger(input: {
    actor: AuthenticatedUser; storeId: string; periodStart: string; periodEnd: string;
    category?: "inside" | "other"; limit?: number; offset?: number;
  }) {
    const range = resolveRankingDateRange({ ...input, periodType: "daily" });
    if (!range) throw new BadRequestException("Return dates are required");
    const scope = resolveStoreReturnsScope(input.actor);
    if (!await this.repository.canReadStore({ storeId: input.storeId, scope }))
      throw new NotFoundException("Store not found");
    return this.repository.getLedger({
      storeId: input.storeId, scope, periodStart: range.period_start, periodEnd: range.period_end,
      category: input.category ?? "inside", limit: input.limit ?? 50, offset: input.offset ?? 0,
    });
  }
}
