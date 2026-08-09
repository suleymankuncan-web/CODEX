import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KeycloakIdentityBinderService } from "./keycloak-identity-binder.service";

const personas = [
  ["onprem.store-manager", "onprem.store-manager", "STORE_MANAGER"],
  ["onprem.region-manager", "onprem.region-manager", "REGION_MANAGER"],
  ["onprem.report-viewer", "onprem.report-viewer", "REPORT_VIEWER"],
  ["onprem.store-personnel", "onprem.store-personnel", "STORE_PERSONNEL"],
  ["onprem.visual-merchandiser", "onprem.visual-merchandiser", "VISUAL_MERCHANDISER"],
] as const;

function writeManifest(
  mutate: (manifest: Record<string, unknown>) => void = () => undefined,
): string {
  const manifest: Record<string, unknown> = {
    schemaVersion: "onprem-keycloak-subjects-v1",
    dataClass: "synthetic",
    provider: "oidc",
    realm: "store-ops",
    clientId: "store-ops-admin-web",
    subjects: personas.map(([accountKey, , roleCode], index) => ({
      accountKey,
      subject: `synthetic-subject-${index + 1}`,
      roleCodes: [roleCode],
    })),
  };
  mutate(manifest);
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-keycloak-binding-"));
  const filePath = join(directory, "subjects.v1.json");
  writeFileSync(filePath, JSON.stringify(manifest), { encoding: "utf8", mode: 0o600 });
  chmodSync(filePath, 0o600);
  return readFileSync(filePath, "utf8");
}

function accountRows(overrides: Record<string, unknown> = {}) {
  return personas.map(([accountKey, username, roleCode]) => ({
    account_key: accountKey,
    username,
    auth_provider: "local",
    provider_subject: null as string | null,
    is_active: true,
    role_codes: [roleCode],
    ...overrides,
  }));
}

describe("KeycloakIdentityBinderService", () => {
  it("binds the exact five synthetic personas transactionally and returns aggregate evidence", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return { rows: accountRows(), rowCount: 5 };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    const result = await service.run();

    expect(result).toEqual({
      alreadyBoundCount: 0,
      bindingCount: 5,
      clientId: "store-ops-admin-web",
      provider: "oidc",
      realm: "store-ops",
      schemaVersion: "onprem-keycloak-subjects-v1",
    });
    expect(query).toHaveBeenCalledTimes(6);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("synthetic-subject");
    expect(serialized).not.toContain("onprem.store");
  });

  it("is retry-safe when all five accounts already carry the same subjects", async () => {
    const subjects = personas.map((_, index) => `synthetic-subject-${index + 1}`);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return {
          rows: accountRows().map((row, index) => ({
            ...row,
            auth_provider: "oidc",
            provider_subject: subjects[index],
          })),
          rowCount: 5,
        };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).resolves.toMatchObject({
      alreadyBoundCount: 5,
      bindingCount: 5,
    });
  });

  it("fails closed for non-synthetic mode before opening a transaction", async () => {
    const withTransaction = jest.fn();
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "company",
        isStrictLocal: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction } as never,
    );

    await expect(service.run()).rejects.toThrow(
      "Keycloak identity binding requires strict-local synthetic mode",
    );
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate account", (manifest: Record<string, unknown>) => {
      const subjects = manifest.subjects as Array<Record<string, unknown>>;
      subjects[1].accountKey = subjects[0].accountKey;
    }],
    ["duplicate subject", (manifest: Record<string, unknown>) => {
      const subjects = manifest.subjects as Array<Record<string, unknown>>;
      subjects[1].subject = subjects[0].subject;
    }],
    ["wrong provider", (manifest: Record<string, unknown>) => {
      manifest.provider = "clerk";
    }],
    ["missing persona", (manifest: Record<string, unknown>) => {
      (manifest.subjects as unknown[]).pop();
    }],
  ])("rejects a %s manifest without database mutation", async (_label, mutate) => {
    const withTransaction = jest.fn();
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticSubjectManifest: writeManifest(mutate),
      } as never,
      { withTransaction } as never,
    );

    await expect(service.run()).rejects.toThrow("Invalid Keycloak synthetic subject manifest");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects role drift and conflicting provider bindings without updating accounts", async () => {
    const updateQuery = jest.fn();
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        const rows = accountRows();
        rows[0] = { ...rows[0], role_codes: ["REPORT_VIEWER"] };
        rows[1] = {
          ...rows[1],
          auth_provider: "oidc",
          provider_subject: "different-subject",
        };
        return { rows, rowCount: 5 };
      }
      return updateQuery(sql);
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).rejects.toThrow("Synthetic identity database contract mismatch");
    expect(updateQuery).not.toHaveBeenCalled();
  });
});
