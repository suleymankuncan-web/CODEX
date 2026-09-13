import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import {
  resolveStoreReportViewerRole,
  storeReportViewerCompanyIds,
} from "./store-report-viewer-role";

@Injectable()
export class RegionManagerDirectoryService {
  constructor(private readonly repository: RankingReportingReadRepository) {}

  async list(actor: AuthenticatedUser) {
    const role = resolveStoreReportViewerRole(actor.roleCodes);
    if (!role) {
      throw new ForbiddenException(
        "Company manager directory is unavailable for this role",
      );
    }
    const companyIds = storeReportViewerCompanyIds(
      {
        actorRoleCodes: actor.roleCodes,
        actorReadScope: actor.readScope,
        roleScopes: actor.roleScopes,
      },
      role,
    );
    if (!companyIds.length) return { items: [] };
    const entries = await this.repository.listCompanyRegionManagerDirectory({ companyIds });
    return {
      items: entries.map((entry) => ({
        userId: entry.id,
        displayName: entry.label,
        storeIds: entry.storeIds,
      })),
    };
  }
}
