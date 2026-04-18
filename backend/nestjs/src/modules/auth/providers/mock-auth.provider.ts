import { Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth-context.service";
import { AuthProvider } from "../interfaces/auth-provider.interface";

@Injectable()
export class MockAuthProvider implements AuthProvider {
  async resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    const storeIdHeader = request.headers["x-store-ids"];
    const regionIdHeader = request.headers["x-region-ids"];
    const companyIdHeader = request.headers["x-company-ids"];

    const parseHeader = (value: string | string[] | undefined): string[] => {
      if (!value) return [];
      const raw = Array.isArray(value) ? value.join(",") : value;
      return raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    };
    const roleCodes = parseHeader(request.headers["x-role-codes"]);

    return {
      userId: (request.headers["x-user-id"] as string | undefined) ??
        "80000000-0000-0000-0000-000000000001",
      employeeId: request.headers["x-employee-id"] as string | undefined,
      roleCodes: roleCodes.length ? roleCodes : ["SUPER_ADMIN"],
      scope: {
        companyIds: parseHeader(companyIdHeader).length
          ? parseHeader(companyIdHeader)
          : ["00000000-0000-0000-0000-000000000001"],
        regionIds: parseHeader(regionIdHeader),
        storeIds: parseHeader(storeIdHeader),
      },
    };
  }
}
