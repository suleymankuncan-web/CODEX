import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const expectedRoleScopes: Record<string, string> = {
  AUDITOR: "region",
  INTEGRATION_ADMIN: "company",
  REGION_MANAGER: "region",
  REPORT_VIEWER: "company",
  SNAPSHOT_OPERATOR: "company",
  STORE_MANAGER: "store",
  STORE_PERSONNEL: "store",
  SUPER_ADMIN: "company",
};

const expectedRoleCodes = Object.keys(expectedRoleScopes).sort();
const expectedKeycloakScopeClaims = [
  "employee_id",
  "company_ids",
  "region_ids",
  "store_ids",
  "read_company_ids",
  "read_region_ids",
  "read_store_ids",
  "assigned_store_ids",
].sort();
const demoPerformanceStoreId = "00000000-0000-0000-0000-000000000100";
const expectedDemoUserBindings = [
  {
    username: "store.manager",
    employeeId: "DEMO-EMP-201",
    storeIds: [demoPerformanceStoreId],
    readStoreIds: [demoPerformanceStoreId],
    assignedStoreIds: [demoPerformanceStoreId],
  },
  {
    username: "store.personnel",
    employeeId: "DEMO-EMP-202",
    storeIds: [demoPerformanceStoreId],
    readStoreIds: [demoPerformanceStoreId],
    assignedStoreIds: [demoPerformanceStoreId],
  },
  {
    username: "region.manager",
    employeeId: "DEMO-EMP-203",
    storeIds: [],
    readStoreIds: [],
    assignedStoreIds: [demoPerformanceStoreId],
  },
  {
    username: "admin.operator",
    employeeId: "DEMO-EMP-201",
    storeIds: [demoPerformanceStoreId],
    readStoreIds: [demoPerformanceStoreId],
    assignedStoreIds: [demoPerformanceStoreId],
  },
];

function collectFiles(root: string, predicate: (path: string) => boolean) {
  const files: string[] = [];

  for (const item of readdirSync(root)) {
    const path = join(root, item);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...collectFiles(path, predicate));
      continue;
    }

    if (predicate(path)) {
      files.push(path);
    }
  }

  return files;
}

function collectRequiredRoles() {
  const srcRoot = join(process.cwd(), "src");
  const controllerFiles = collectFiles(srcRoot, (path) => path.endsWith(".controller.ts"));
  const roles = new Set<string>();

  for (const file of controllerFiles) {
    const source = readFileSync(file, "utf8");
    const matches = source.matchAll(/@RequireRoles\(([^)]*)\)/g);

    for (const match of matches) {
      for (const roleMatch of match[1].matchAll(/"([A-Z_]+)"/g)) {
        roles.add(roleMatch[1]);
      }
    }
  }

  return [...roles].sort();
}

function collectCatalogRoles() {
  const dbRoot = join(process.cwd(), "..", "..", "db");
  const sqlFiles = collectFiles(dbRoot, (path) => path.endsWith(".sql"));
  const roles = new Map<string, string>();

  for (const file of sqlFiles) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    let inRoleInsert = false;

    for (const line of lines) {
      if (line.includes("INSERT INTO ops.role")) {
        inRoleInsert = true;
        continue;
      }

      if (!inRoleInsert) {
        continue;
      }

      const row = line.match(/^\s*\('[^']+'\s*,\s*'([A-Z_]+)'\s*,\s*'[^']+'\s*,\s*'([a-z]+)'/);
      if (row) {
        roles.set(row[1], row[2]);
      }

      if (line.includes("ON CONFLICT") || line.trim().endsWith(";")) {
        inRoleInsert = false;
      }
    }
  }

  return roles;
}

function collectKeycloakRealmRoles() {
  const realmPath = join(process.cwd(), "..", "..", "infra", "keycloak", "store-ops-realm.json");
  const realm = JSON.parse(readFileSync(realmPath, "utf8")) as {
    roles?: { realm?: Array<{ name?: string }> };
  };

  return new Set((realm.roles?.realm ?? []).map((role) => role.name).filter(Boolean));
}

function readKeycloakRealm() {
  const realmPath = join(process.cwd(), "..", "..", "infra", "keycloak", "store-ops-realm.json");

  return JSON.parse(readFileSync(realmPath, "utf8")) as {
    roles?: { realm?: Array<{ name?: string }> };
    clients?: Array<{
      clientId?: string;
      publicClient?: boolean;
      standardFlowEnabled?: boolean;
      implicitFlowEnabled?: boolean;
      attributes?: Record<string, string>;
      protocolMappers?: Array<{ name?: string }>;
    }>;
    users?: Array<{
      username?: string;
      attributes?: Record<string, string[]>;
    }>;
  };
}

function readKeycloakSetupScript() {
  const setupScriptPath = join(process.cwd(), "..", "..", "infra", "scripts", "setup-keycloak.ps1");

  return readFileSync(setupScriptPath, "utf8");
}

function collectSetupScriptRoleTokens() {
  const setupScript = readKeycloakSetupScript();

  return new Set(
    [...setupScript.matchAll(/(?:name=|--rolename\s+|")([A-Z][A-Z_]+)(?:"|\s|$)/g)].map(
      (match) => match[1],
    ),
  );
}

function collectSetupScriptMapperTokens() {
  const setupScript = readKeycloakSetupScript();

  return new Set(
    [...setupScript.matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)].map((match) => match[1]),
  );
}

describe("role catalog contract", () => {
  it("keeps every controller role in the persisted role catalog with the expected scope", () => {
    const requiredRoles = collectRequiredRoles();
    const catalogRoles = collectCatalogRoles();

    expect(requiredRoles).toEqual(expectedRoleCodes);

    for (const [roleCode, expectedScope] of Object.entries(expectedRoleScopes)) {
      expect(catalogRoles.get(roleCode)).toBe(expectedScope);
    }
  });

  it("keeps Keycloak local bootstrap roles aligned with the persisted role catalog", () => {
    const keycloakRealmRoles = collectKeycloakRealmRoles();
    const setupScriptRoleTokens = collectSetupScriptRoleTokens();

    for (const roleCode of expectedRoleCodes) {
      expect(keycloakRealmRoles.has(roleCode)).toBe(true);
      expect(setupScriptRoleTokens.has(roleCode)).toBe(true);
    }
  });

  it("keeps Keycloak local bootstrap scope claims aligned with the read/action scope model", () => {
    const realm = readKeycloakRealm();
    const adminClient = realm.clients?.find((client) => client.clientId === "store-ops-admin-web");
    const realmMapperNames = new Set(
      (adminClient?.protocolMappers ?? []).map((mapper) => mapper.name).filter(Boolean),
    );
    const setupScriptMapperTokens = collectSetupScriptMapperTokens();

    for (const claimName of expectedKeycloakScopeClaims) {
      expect(realmMapperNames.has(claimName)).toBe(true);
      expect(setupScriptMapperTokens.has(claimName)).toBe(true);
    }
  });

  it("keeps Keycloak local bootstrap users aligned with seeded demo performance identities", () => {
    const realm = readKeycloakRealm();
    const setupScript = readKeycloakSetupScript();

    expect(setupScript).toContain(`$storeId = "${demoPerformanceStoreId}"`);

    for (const binding of expectedDemoUserBindings) {
      const realmUser = realm.users?.find((user) => user.username === binding.username);

      expect(realmUser?.attributes?.employee_id).toEqual([binding.employeeId]);
      expect(realmUser?.attributes?.store_ids ?? []).toEqual(binding.storeIds);
      expect(realmUser?.attributes?.read_store_ids ?? []).toEqual(binding.readStoreIds);
      expect(realmUser?.attributes?.assigned_store_ids ?? []).toEqual(binding.assignedStoreIds);
      expect(setupScript).toContain(`Username = "${binding.username}"`);
      expect(setupScript).toContain(`EmployeeId = "${binding.employeeId}"`);
    }
  });

  it("keeps Keycloak local bootstrap aligned with authorization code + PKCE", () => {
    const realm = readKeycloakRealm();
    const adminClient = realm.clients?.find((client) => client.clientId === "store-ops-admin-web");
    const setupScript = readKeycloakSetupScript();

    expect(adminClient?.publicClient).toBe(true);
    expect(adminClient?.standardFlowEnabled).toBe(true);
    expect(adminClient?.implicitFlowEnabled).toBe(false);
    expect(adminClient?.attributes?.["pkce.code.challenge.method"]).toBe("S256");
    expect(setupScript).toContain('"standardFlowEnabled": true');
    expect(setupScript).toContain('"implicitFlowEnabled": false');
    expect(setupScript).toContain('"pkce.code.challenge.method": "S256"');
  });
});
