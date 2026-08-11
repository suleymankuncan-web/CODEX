import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../shared/app-config.service";
import { DatabaseService } from "../shared/database/database.service";

const SCHEMA_VERSION = "onprem-keycloak-subjects-v1";
const PROVIDER = "oidc";
const REALM = "store-ops";
const CLIENT_ID = "store-ops-admin-web";

const SYNTHETIC_PERSONAS = {
  "onprem.store-manager": {
    roleCode: "STORE_MANAGER",
    username: "onprem.store-manager",
  },
  "onprem.region-manager": {
    roleCode: "REGION_MANAGER",
    username: "onprem.region-manager",
  },
  "onprem.report-viewer": {
    roleCode: "REPORT_VIEWER",
    username: "onprem.report-viewer",
  },
  "onprem.store-personnel": {
    roleCode: "STORE_PERSONNEL",
    username: "onprem.store-personnel",
  },
  "onprem.visual-merchandiser": {
    roleCode: "VISUAL_MERCHANDISER",
    username: "onprem.visual-merchandiser",
  },
} as const;

type AccountKey = keyof typeof SYNTHETIC_PERSONAS;

type SubjectBinding = {
  accountKey: AccountKey;
  roleCodes: string[];
  subject: string;
};

type SubjectManifest = {
  schemaVersion: typeof SCHEMA_VERSION;
  dataClass: "synthetic";
  provider: typeof PROVIDER;
  realm: typeof REALM;
  clientId: typeof CLIENT_ID;
  subjects: SubjectBinding[];
};

type AccountRow = {
  auth_provider: string;
  is_active: boolean;
  provider_subject: string | null;
  role_codes: string[] | null;
  username: string;
};

@Injectable()
export class KeycloakIdentityBinderService {
  constructor(
    private readonly config: AppConfigService,
    private readonly database: DatabaseService,
  ) {}

  async run(): Promise<{
    alreadyBoundCount: number;
    bindingCount: number;
    clientId: string;
    provider: string;
    realm: string;
    schemaVersion: string;
  }> {
    if (!this.config.isStrictLocal || this.config.dataClass !== "synthetic") {
      throw new Error("Keycloak identity binding requires strict-local synthetic mode");
    }

    const manifest = parseManifest(this.config.keycloakSyntheticSubjectManifest);

    const alreadyBoundCount = await this.database.withTransaction(async (client) => {
      const usernames = Object.values(SYNTHETIC_PERSONAS).map(({ username }) => username);
      const result = await client.query<AccountRow>(
        `
          SELECT
            ua.username,
            ua.auth_provider,
            ua.provider_subject,
            ua.is_active,
            COALESCE(
              array_agg(DISTINCT role.role_code ORDER BY role.role_code)
                FILTER (WHERE role.role_code IS NOT NULL),
              ARRAY[]::text[]
            ) AS role_codes
          FROM ops.user_account ua
          LEFT JOIN ops.user_role_assignment assignment
            ON assignment.user_id = ua.user_id
           AND assignment.start_at <= NOW()
           AND (assignment.end_at IS NULL OR assignment.end_at > NOW())
          LEFT JOIN ops.role role ON role.role_id = assignment.role_id
          WHERE ua.username = ANY($1::text[])
          GROUP BY
            ua.username,
            ua.auth_provider,
            ua.provider_subject,
            ua.is_active
          ORDER BY ua.username
        `,
        [usernames],
      );

      const rowsByUsername = new Map(result.rows.map((row) => [row.username, row]));
      let existingCount = 0;

      for (const binding of manifest.subjects) {
        const persona = SYNTHETIC_PERSONAS[binding.accountKey];
        const row = rowsByUsername.get(persona.username);
        const roleCodes = [...(row?.role_codes ?? [])].sort();
        if (
          !row ||
          !row.is_active ||
          roleCodes.length !== 1 ||
          roleCodes[0] !== persona.roleCode ||
          (row.auth_provider !== "local" && row.auth_provider !== PROVIDER) ||
          (row.provider_subject !== null &&
            (row.auth_provider !== PROVIDER || row.provider_subject !== binding.subject))
        ) {
          throw new Error("Synthetic identity database contract mismatch");
        }
        if (row.auth_provider === PROVIDER && row.provider_subject === binding.subject) {
          existingCount += 1;
        }
      }

      for (const binding of manifest.subjects) {
        const persona = SYNTHETIC_PERSONAS[binding.accountKey];
        const update = await client.query(
          `
            UPDATE ops.user_account
            SET
              auth_provider = $1,
              provider_subject = $2,
              updated_at = NOW()
            WHERE username = $3
              AND is_active = TRUE
              AND (
                (auth_provider = 'local' AND provider_subject IS NULL)
                OR (auth_provider = $1 AND provider_subject = $2)
              )
            RETURNING user_id
          `,
          [PROVIDER, binding.subject, persona.username],
        );
        if (update.rowCount !== 1) {
          throw new Error("Synthetic identity binding update failed");
        }
      }

      return existingCount;
    });

    return {
      alreadyBoundCount,
      bindingCount: manifest.subjects.length,
      clientId: manifest.clientId,
      provider: manifest.provider,
      realm: manifest.realm,
      schemaVersion: manifest.schemaVersion,
    };
  }
}

function parseManifest(raw: string | undefined): SubjectManifest {
  let input: unknown;
  try {
    input = JSON.parse(raw ?? "");
  } catch {
    throw new Error("Invalid Keycloak synthetic subject manifest");
  }

  if (!isRecord(input)) {
    throw new Error("Invalid Keycloak synthetic subject manifest");
  }
  const subjects = input.subjects;
  if (
    input.schemaVersion !== SCHEMA_VERSION ||
    input.dataClass !== "synthetic" ||
    input.provider !== PROVIDER ||
    input.realm !== REALM ||
    input.clientId !== CLIENT_ID ||
    !Array.isArray(subjects) ||
    subjects.length !== Object.keys(SYNTHETIC_PERSONAS).length
  ) {
    throw new Error("Invalid Keycloak synthetic subject manifest");
  }

  const parsed: SubjectBinding[] = [];
  const accountKeys = new Set<string>();
  const subjectValues = new Set<string>();

  for (const entry of subjects) {
    if (!isRecord(entry) || !isAccountKey(entry.accountKey)) {
      throw new Error("Invalid Keycloak synthetic subject manifest");
    }
    const subject = typeof entry.subject === "string" ? entry.subject.trim() : "";
    const expectedRole = SYNTHETIC_PERSONAS[entry.accountKey].roleCode;
    if (
      !/^[A-Za-z0-9._:-]{1,255}$/.test(subject) ||
      !Array.isArray(entry.roleCodes) ||
      entry.roleCodes.length !== 1 ||
      entry.roleCodes[0] !== expectedRole ||
      accountKeys.has(entry.accountKey) ||
      subjectValues.has(subject)
    ) {
      throw new Error("Invalid Keycloak synthetic subject manifest");
    }
    accountKeys.add(entry.accountKey);
    subjectValues.add(subject);
    parsed.push({
      accountKey: entry.accountKey,
      roleCodes: [expectedRole],
      subject,
    });
  }

  if (Object.keys(SYNTHETIC_PERSONAS).some((key) => !accountKeys.has(key))) {
    throw new Error("Invalid Keycloak synthetic subject manifest");
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    dataClass: "synthetic",
    provider: PROVIDER,
    realm: REALM,
    clientId: CLIENT_ID,
    subjects: parsed,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAccountKey(value: unknown): value is AccountKey {
  return typeof value === "string" && value in SYNTHETIC_PERSONAS;
}
