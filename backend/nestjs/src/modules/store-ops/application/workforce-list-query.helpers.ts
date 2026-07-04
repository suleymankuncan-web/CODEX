import { ForbiddenException } from "@nestjs/common";

export type WorkforceRequestStoreScope = {
  storeIds: string[];
};

export function normalizeWorkforceListLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

export function normalizeWorkforceListOffset(offset?: number) {
  if (!offset || Number.isNaN(offset)) {
    return 0;
  }

  return Math.max(Math.trunc(offset), 0);
}

export async function resolveWorkforceRequestStoreIds(input: {
  requestedStoreId?: string;
  listScope: WorkforceRequestStoreScope;
  canReadStore: (storeId: string) => Promise<boolean>;
}) {
  if (!input.requestedStoreId) {
    return input.listScope.storeIds;
  }

  if (!(await input.canReadStore(input.requestedStoreId))) {
    throw new ForbiddenException("Bu mağazanın personel taleplerine erişemezsiniz.");
  }

  return [input.requestedStoreId];
}
