import { Injectable } from "@nestjs/common";
import { AuthenticatedUser, buildAuthenticatedUser } from "../auth-context.service";
import { AuthProvider } from "../interfaces/auth-provider.interface";

@Injectable()
export class MockAuthProvider implements AuthProvider {
  async resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    const storeIdHeader = request.headers["x-store-ids"];
    const regionIdHeader = request.headers["x-region-ids"];
    const companyIdHeader = request.headers["x-company-ids"];
    const readStoreIdHeader = request.headers["x-read-store-ids"];
    const readRegionIdHeader = request.headers["x-read-region-ids"];
    const readCompanyIdHeader = request.headers["x-read-company-ids"];
    const assignedStoreIdHeader = request.headers["x-assigned-store-ids"];

    const parseHeader = (value: string | string[] | undefined): string[] => {
      if (!value) return [];
      const raw = Array.isArray(value) ? value.join(",") : value;
      return raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    };
    const roleCodes = parseHeader(request.headers["x-role-codes"]);
    const legacyStoreIds = parseHeader(storeIdHeader);
    const readStoreIds =
      readStoreIdHeader === undefined ? legacyStoreIds : parseHeader(readStoreIdHeader);
    const readRegionIds =
      readRegionIdHeader === undefined ? parseHeader(regionIdHeader) : parseHeader(readRegionIdHeader);
    const readCompanyIds =
      readCompanyIdHeader === undefined ? parseHeader(companyIdHeader) : parseHeader(readCompanyIdHeader);
    const assignedStoreIds =
      assignedStoreIdHeader === undefined ? legacyStoreIds : parseHeader(assignedStoreIdHeader);
    const scopedCompanyIds = readCompanyIds.length
      ? readCompanyIds
      : ["00000000-0000-0000-0000-000000000001"];

    // Mock sessions intentionally carry their scope in explicit headers. Mirror
    // that scope into each declared role's roleScopes entry so role-scoped read
    // services (for example Region Manager visit-plan options) exercise the same
    // authorization shape as a mapped JWT session in local development.
    const roleScopes = Object.fromEntries(
      roleCodes.map((roleCode) => [roleCode, {
        companyIds: scopedCompanyIds,
        regionIds: readRegionIds,
        storeIds: readStoreIds,
      }]),
    );

    return buildAuthenticatedUser({
      userId: (request.headers["x-user-id"] as string | undefined) ??
        "80000000-0000-0000-0000-000000000001",
      employeeId: request.headers["x-employee-id"] as string | undefined,
      displayName: request.headers["x-display-name"] as string | undefined,
      username: request.headers["x-username"] as string | undefined,
      email: request.headers["x-email"] as string | undefined,
      roleCodes: roleCodes.length ? roleCodes : ["SUPER_ADMIN"],
      readScope: {
        companyIds: scopedCompanyIds,
        regionIds: readRegionIds,
        storeIds: readStoreIds,
      },
      actionScope: {
        assignedStoreIds,
      },
      roleScopes,
    });
  }
}
