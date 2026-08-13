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

const photoProofPersona = {
  accountKey: "onprem.photo-proof-admin",
  username: "onprem.photo-proof-admin",
  roleCode: "SUPER_ADMIN",
  userId: "80000000-0000-0000-0000-000000000016",
  subject: "photo-proof-subject-1",
  companyId: "00000000-0000-0000-0000-000000000001",
  regionId: "00000000-0000-0000-0000-000000000010",
  storeId: "00000000-0000-0000-0000-000000000100",
} as const;

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

function allAccountRows(overrides: Record<string, unknown> = {}): Array<Record<string, unknown>> {
  return [...accountRows(), photoProofRow(overrides)];
}

function photoProofManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: "onprem-keycloak-photo-proof-subject-v1",
    dataClass: "synthetic",
    provider: "oidc",
    realm: "store-ops",
    clientId: "store-ops-admin-web",
    accountKey: photoProofPersona.accountKey,
    username: photoProofPersona.username,
    subject: photoProofPersona.subject,
    roleCodes: [photoProofPersona.roleCode],
    readScope: {
      companies: [photoProofPersona.companyId],
      regions: [photoProofPersona.regionId],
      stores: [photoProofPersona.storeId],
    },
    actionScope: { assignedStores: [photoProofPersona.storeId] },
    ...overrides,
  });
}

function photoProofRow(overrides: Record<string, unknown> = {}) {
  return {
    account_key: photoProofPersona.accountKey,
    username: photoProofPersona.username,
    auth_provider: "local",
    provider_subject: null as string | null,
    is_active: false,
    user_id: photoProofPersona.userId,
    role_codes: [photoProofPersona.roleCode],
    scope_type: "company",
    company_id: photoProofPersona.companyId,
    region_id: null,
    store_id: null,
    action_store_ids: [photoProofPersona.storeId],
    ...overrides,
  };
}

describe("KeycloakIdentityBinderService", () => {
  afterEach(() => {
    delete process.env.KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED;
    delete process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED;
    delete process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST;
    delete process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE;
  });

  it("binds the exact five synthetic personas transactionally and returns aggregate evidence", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return { rows: allAccountRows(), rowCount: 6 };
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
    expect(query).toHaveBeenCalledTimes(7);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("synthetic-subject");
    expect(serialized).not.toContain("onprem.store");
  });

  it("is retry-safe when all five accounts already carry the same subjects", async () => {
    const subjects = personas.map((_, index) => `synthetic-subject-${index + 1}`);
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return {
          rows: [
            ...accountRows().map((row, index) => ({
            ...row,
            auth_provider: "oidc",
            provider_subject: subjects[index],
            })),
            photoProofRow(),
          ],
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
        const rows = allAccountRows();
        rows[0] = { ...rows[0], role_codes: ["REPORT_VIEWER"] };
        rows[1] = {
          ...rows[1],
          auth_provider: "oidc",
          provider_subject: "different-subject",
        };
        return { rows, rowCount: 6 };
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

  it("does not bind the photo proof account while synthetic accounts are disabled", async () => {
    const query = jest.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT")) {
        expect(values?.[0]).toEqual([
          ...personas.map(([, username]) => username),
          photoProofPersona.username,
        ]);
        return { rows: allAccountRows(), rowCount: 6 };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: false,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).resolves.toMatchObject({ bindingCount: 5 });
    expect(query).toHaveBeenCalledTimes(7);
  });

  it("rejects a stale photo-proof manifest while the dedicated gate is disabled", async () => {
    process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST = photoProofManifest();
    const withTransaction = jest.fn();
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: false,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction } as never,
    );

    await expect(service.run()).rejects.toThrow(
      "Synthetic photo proof subject manifest is present while photo proof is disabled",
    );
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("binds the separately supplied sixth photo proof subject only behind the explicit synthetic gate", async () => {
    process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED = "true";
    process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST = photoProofManifest();
    const query = jest.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT")) {
        expect(values?.[0]).toEqual([
          ...personas.map(([, username]) => username),
          photoProofPersona.username,
        ]);
        return { rows: [...accountRows(), photoProofRow()], rowCount: 6 };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).resolves.toMatchObject({ bindingCount: 6 });
    expect(query).toHaveBeenCalledTimes(7);
  });

  it("groups the selected fixed user id in the real PostgreSQL reconciliation query", async () => {
    process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED = "true";
    process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST = photoProofManifest();
    let reconciliationSql = "";
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account")) {
        reconciliationSql = sql;
        return { rows: [...accountRows(), photoProofRow()], rowCount: 6 };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      { dataClass: "synthetic", isStrictLocal: true, keycloakSyntheticPhotoProofEnabled: true, keycloakSyntheticSubjectManifest: writeManifest() } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await service.run();

    expect(reconciliationSql).toMatch(/GROUP BY\s+ua\.user_id,\s+ua\.username,/);
  });

  it("is retry-safe when the sixth photo proof account already carries its subject", async () => {
    process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED = "true";
    process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST = photoProofManifest();
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return {
          rows: [
            ...accountRows().map((row, index) => ({
              ...row,
              auth_provider: "oidc",
              provider_subject: `synthetic-subject-${index + 1}`,
            })),
            photoProofRow({
              auth_provider: "oidc",
              provider_subject: photoProofPersona.subject,
            }),
          ],
          rowCount: 6,
        };
      }
      return { rows: [{ user_id: "redacted-in-runtime" }], rowCount: 1 };
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).resolves.toMatchObject({
      alreadyBoundCount: 6,
      bindingCount: 6,
    });
  });

  it.each([
    ["stale managed role", { role_codes: ["SUPER_ADMIN", "REPORT_VIEWER"] }],
    ["fixed user identity drift", { user_id: "80000000-0000-0000-0000-000000000099" }],
    ["scope drift", { company_id: "00000000-0000-0000-0000-000000000099" }],
    ["action scope drift", { action_store_ids: ["00000000-0000-0000-0000-000000000099"] }],
  ])("rejects photo proof database %s before provider binding", async (_label, overrides) => {
    process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED = "true";
    process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST = photoProofManifest();
    const updateQuery = jest.fn();
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT")) {
        return { rows: [...accountRows(), photoProofRow(overrides)], rowCount: 6 };
      }
      return updateQuery(sql);
    });
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction: jest.fn(async (work) => work({ query })) } as never,
    );

    await expect(service.run()).rejects.toThrow(
      "Synthetic photo proof database contract mismatch",
    );
    expect(updateQuery).not.toHaveBeenCalled();
  });

  it("rejects a missing separately supplied photo proof subject when the gate is enabled", async () => {
    process.env.KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED = "true";
    const withTransaction = jest.fn();
    const service = new KeycloakIdentityBinderService(
      {
        dataClass: "synthetic",
        isStrictLocal: true,
        keycloakSyntheticPhotoProofEnabled: true,
        keycloakSyntheticSubjectManifest: writeManifest(),
      } as never,
      { withTransaction } as never,
    );

    await expect(service.run()).rejects.toThrow(
      "Invalid Keycloak photo proof subject manifest",
    );
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
