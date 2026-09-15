import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { ChecklistOperationalHistoryRepository } from "../infrastructure/checklist-operational-history.repository";
import {
  type ChecklistOperationalHistoryRange,
  type ChecklistOperationalHistoryResult,
} from "./checklist-operational-history.contract";
import {
  decodeOperationalHistoryCursor,
  encodeOperationalHistoryCursor,
  normalizeHistoryKinds,
} from "./checklist-operational-history-cursor";
import { resolveChecklistOperationalHistoryScope } from "./checklist-operational-history-scope";

type ReadInput = {
  actorRoleCodes: string[];
  actorReadScope: AuthReadScope;
  roleScopes?: Record<string, AuthReadScope>;
  storeId: string;
  range?: ChecklistOperationalHistoryRange;
  kinds?: string;
  cursor?: string;
};

@Injectable()
export class ChecklistOperationalHistoryService {
  constructor(private readonly repository: ChecklistOperationalHistoryRepository) {}

  async read(input: ReadInput): Promise<ChecklistOperationalHistoryResult> {
    const scope = resolveChecklistOperationalHistoryScope({
      actorRoleCodes: input.actorRoleCodes,
      actorReadScope: input.actorReadScope,
      roleScopes: input.roleScopes,
    });
    if (!scope) throw new ForbiddenException("Operational history is not available for this role");
    if (scope.companyIds.length + scope.regionIds.length + scope.storeIds.length === 0) {
      throw missingStore();
    }

    const range = input.range ?? "12m";
    const kinds = normalizeHistoryKinds(input.kinds);
    const cursor = decodeOperationalHistoryCursor({
      value: input.cursor,
      storeId: input.storeId,
      range,
      kinds,
    });
    const result = await this.repository.read({
      companyIds: scope.companyIds,
      regionIds: scope.regionIds,
      storeIds: scope.storeIds,
      storeId: input.storeId,
      range,
      kinds,
      cursor,
      limit: 21,
    });
    if (!result) throw missingStore();

    const hasMore = result.items.length === 21;
    const visible = result.items.slice(0, 20);
    const last = visible.at(-1);
    return {
      store: result.store,
      summary: result.summary,
      items: visible.map((item) => item.event),
      page: {
        hasMore,
        nextCursor: hasMore && last
          ? encodeOperationalHistoryCursor({ storeId: input.storeId, range, kinds, cursor: last.cursor })
          : null,
      },
    };
  }
}

function missingStore() {
  return new NotFoundException("Operational history store was not found");
}
