import { Injectable } from "@nestjs/common";
import { StoreOpsRepository } from "../infrastructure/store-ops.repository";
import { buildListResponse } from "../../../shared/http/response-builders";

@Injectable()
export class OrgService {
  constructor(private readonly storeOpsRepository: StoreOpsRepository) {}

  async listStoresByScope(scope: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    companyId?: string;
    regionId?: string;
    storeId?: string;
  }) {
    const items = await this.storeOpsRepository.listStoresByScope({
        companyIds: scope.companyIds,
        regionIds: scope.regionIds,
        storeIds: scope.storeIds,
        requestedCompanyId: scope.companyId,
        requestedRegionId: scope.regionId,
        requestedStoreId: scope.storeId,
      });

    return buildListResponse(items, { total: items.length });
  }
}
