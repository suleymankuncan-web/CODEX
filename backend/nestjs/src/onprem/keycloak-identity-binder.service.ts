import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
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

const PHOTO_PROOF_ACCOUNT_KEY = "onprem.photo-proof-admin" as const;
const PHOTO_PROOF_USERNAME = PHOTO_PROOF_ACCOUNT_KEY;
const PHOTO_PROOF_ROLE = "SUPER_ADMIN" as const;
const PHOTO_PROOF_USER_ID = "80000000-0000-0000-0000-000000000016" as const;
const SYNTHETIC_COMPANY_ID = "00000000-0000-0000-0000-000000000001" as const;
const SYNTHETIC_REGION_ID = "00000000-0000-0000-0000-000000000010" as const;
const SYNTHETIC_STORE_ID = "00000000-0000-0000-0000-000000000100" as const;

type PhotoProofBinding = {
  accountKey: typeof PHOTO_PROOF_ACCOUNT_KEY;
  roleCodes: [typeof PHOTO_PROOF_ROLE];
  subject: string;
};

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
  action_store_ids: string[] | null;
  company_id: string | null;
  is_active: boolean;
  user_id: string;
  provider_subject: string | null;
  role_codes: string[] | null;
  region_id: string | null;
  scope_type: string | null;
  store_id: string | null;
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
    const photoProofEnabled = this.config.keycloakSyntheticPhotoProofEnabled;
    const photoProofManifest = readPhotoProofManifest(this.config);
    if (!photoProofEnabled && photoProofManifest) {
      throw new Error("Synthetic photo proof subject manifest is present while photo proof is disabled");
    }
    const photoProof = photoProofEnabled
      ? parsePhotoProofManifest(photoProofManifest, manifest.subjects)
      : undefined;
    const bindings = photoProof
      ? [...manifest.subjects, photoProof]
      : manifest.subjects;

    const alreadyBoundCount = await this.database.withTransaction(async (client) => {
      const usernames = [
        ...Object.values(SYNTHETIC_PERSONAS).map(({ username }) => username),
        PHOTO_PROOF_USERNAME,
      ];
      const result = await client.query<AccountRow>(
        `
          SELECT
            ua.user_id::text AS user_id,
            ua.username,
            ua.auth_provider,
            ua.provider_subject,
            ua.is_active,
            MAX(assignment.scope_type) AS scope_type,
            MAX(assignment.company_id::text) AS company_id,
            MAX(assignment.region_id::text) AS region_id,
            MAX(assignment.store_id::text) AS store_id,
            COALESCE(
              array_agg(DISTINCT role.role_code ORDER BY role.role_code)
                FILTER (WHERE role.role_code IS NOT NULL),
              ARRAY[]::text[]
            ) AS role_codes,
            COALESCE(
              array_agg(DISTINCT action_assignment.store_id::text ORDER BY action_assignment.store_id::text)
                FILTER (WHERE action_assignment.store_id IS NOT NULL
                  AND action_assignment.start_at <= NOW()
                  AND (action_assignment.end_at IS NULL OR action_assignment.end_at > NOW())),
              ARRAY[]::text[]
            ) AS action_store_ids
          FROM ops.user_account ua
          LEFT JOIN ops.user_role_assignment assignment
            ON assignment.user_id = ua.user_id
           AND assignment.start_at <= NOW()
           AND (assignment.end_at IS NULL OR assignment.end_at > NOW())
          LEFT JOIN ops.role role ON role.role_id = assignment.role_id
          LEFT JOIN ops.user_action_store_assignment action_assignment
            ON action_assignment.user_id = ua.user_id
          WHERE ua.username = ANY($1::text[])
          GROUP BY
            ua.user_id,
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

      for (const binding of bindings) {
        const persona =
          binding.accountKey === PHOTO_PROOF_ACCOUNT_KEY
            ? { roleCode: PHOTO_PROOF_ROLE, username: PHOTO_PROOF_USERNAME }
            : SYNTHETIC_PERSONAS[binding.accountKey];
        const row = rowsByUsername.get(persona.username);
        const roleCodes = [...(row?.role_codes ?? [])].sort();
        if (
          !row ||
          (!isPhotoProofBinding(binding) && !row.is_active) ||
          roleCodes.length !== 1 ||
          roleCodes[0] !== persona.roleCode ||
          (row.auth_provider !== "local" && row.auth_provider !== PROVIDER) ||
          (row.provider_subject !== null &&
            (row.auth_provider !== PROVIDER || row.provider_subject !== binding.subject))
        ) {
          throw new Error(
            binding.accountKey === PHOTO_PROOF_ACCOUNT_KEY
              ? "Synthetic photo proof database contract mismatch"
              : "Synthetic identity database contract mismatch",
          );
        }
        if (
          isPhotoProofBinding(binding) &&
          !isPhotoProofDatabaseRow(row)
        ) {
          throw new Error("Synthetic photo proof database contract mismatch");
        }
        if (row.auth_provider === PROVIDER && row.provider_subject === binding.subject) {
          existingCount += 1;
        }
      }

      const photoRow = rowsByUsername.get(PHOTO_PROOF_USERNAME);
      if (!isPhotoProofDatabaseRow(photoRow)) {
        throw new Error("Synthetic photo proof database contract mismatch");
      }
      if (
        photoProofEnabled &&
        photoRow.provider_subject !== null &&
        (photoRow.auth_provider !== PROVIDER || photoRow.provider_subject !== photoProof?.subject)
      ) {
        throw new Error("Synthetic photo proof database contract mismatch");
      }
      if (!photoProofEnabled && photoRow.provider_subject !== null && photoRow.auth_provider !== PROVIDER) {
        throw new Error("Synthetic photo proof database contract mismatch");
      }

      for (const binding of bindings) {
        const persona =
          binding.accountKey === PHOTO_PROOF_ACCOUNT_KEY
            ? { roleCode: PHOTO_PROOF_ROLE, username: PHOTO_PROOF_USERNAME }
            : SYNTHETIC_PERSONAS[binding.accountKey];
        const update = isPhotoProofBinding(binding)
          ? await client.query(
              `
                UPDATE ops.user_account
                SET
                  auth_provider = $1,
                  provider_subject = $2,
                  is_active = TRUE,
                  updated_at = NOW()
                WHERE user_id = $4::uuid
                  AND username = $3
                  AND (
                    (auth_provider = 'local' AND provider_subject IS NULL)
                    OR (auth_provider = $1 AND provider_subject = $2)
                  )
                RETURNING user_id
              `,
              [PROVIDER, binding.subject, persona.username, PHOTO_PROOF_USER_ID],
            )
          : await client.query(
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

      if (!photoProofEnabled) {
        const deactivate = await client.query(
          `
            UPDATE ops.user_account
            SET
              auth_provider = 'local',
              provider_subject = NULL,
              is_active = FALSE,
              updated_at = NOW()
            WHERE user_id = $1::uuid
              AND username = $2
            RETURNING user_id
          `,
          [PHOTO_PROOF_USER_ID, PHOTO_PROOF_USERNAME],
        );
        if (deactivate.rowCount !== 1) {
          throw new Error("Synthetic photo proof account deactivation failed");
        }
      }

      return existingCount;
    });

    return {
      alreadyBoundCount,
      bindingCount: bindings.length,
      clientId: manifest.clientId,
      provider: manifest.provider,
      realm: manifest.realm,
      schemaVersion: manifest.schemaVersion,
    };
  }
}

function readPhotoProofManifest(config: AppConfigService): string | undefined {
  const configured = (config as AppConfigService & {
    keycloakPhotoProofSubjectManifest?: unknown;
  }).keycloakPhotoProofSubjectManifest;
  if (typeof configured === "string") {
    return configured;
  }
  const direct = process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST;
  if (direct) return direct;
  const filePath = process.env.KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE
    ?? "/var/lib/keycloak-bootstrap/photo-proof-subject.v1.json";
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function isPhotoProofBinding(
  binding: SubjectBinding | PhotoProofBinding,
): binding is PhotoProofBinding {
  return binding.accountKey === PHOTO_PROOF_ACCOUNT_KEY;
}

function isPhotoProofDatabaseRow(row: AccountRow | undefined): row is AccountRow {
  if (!row) return false;
  return (
    row.user_id === PHOTO_PROOF_USER_ID &&
    row.username === PHOTO_PROOF_USERNAME &&
    row.role_codes?.length === 1 &&
    row.role_codes[0] === PHOTO_PROOF_ROLE &&
    row.scope_type === "company" &&
    row.company_id === SYNTHETIC_COMPANY_ID &&
    row.region_id === null &&
    row.store_id === null &&
    sameValues(row.action_store_ids ?? [], [SYNTHETIC_STORE_ID]) &&
    (row.auth_provider === "local" || row.auth_provider === PROVIDER) &&
    (row.provider_subject === null || row.auth_provider === PROVIDER)
  );
}

function parsePhotoProofManifest(
  raw: string | undefined,
  existingSubjects: readonly SubjectBinding[],
): PhotoProofBinding {
  let input: unknown;
  try {
    input = JSON.parse(raw ?? "");
  } catch {
    throw new Error("Invalid Keycloak photo proof subject manifest");
  }
  if (!isRecord(input)) {
    throw new Error("Invalid Keycloak photo proof subject manifest");
  }
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const readScope = input.readScope;
  const actionScope = input.actionScope;
  const roleCodes = input.roleCodes;
  if (
    input.schemaVersion !== "onprem-keycloak-photo-proof-subject-v1" ||
    input.dataClass !== "synthetic" ||
    input.provider !== PROVIDER ||
    input.realm !== REALM ||
    input.clientId !== CLIENT_ID ||
    input.accountKey !== PHOTO_PROOF_ACCOUNT_KEY ||
    input.username !== PHOTO_PROOF_USERNAME ||
    !/^[A-Za-z0-9._:-]{1,255}$/.test(subject) ||
    !Array.isArray(roleCodes) ||
    roleCodes.length !== 1 ||
    roleCodes[0] !== PHOTO_PROOF_ROLE ||
    !isRecord(readScope) ||
    !sameValues(readScope.companies, [SYNTHETIC_COMPANY_ID]) ||
    !sameValues(readScope.regions, [SYNTHETIC_REGION_ID]) ||
    !sameValues(readScope.stores, [SYNTHETIC_STORE_ID]) ||
    !isRecord(actionScope) ||
    !sameValues(actionScope.assignedStores, [SYNTHETIC_STORE_ID]) ||
    existingSubjects.some((binding) => binding.subject === subject)
  ) {
    throw new Error("Invalid Keycloak photo proof subject manifest");
  }
  return { accountKey: PHOTO_PROOF_ACCOUNT_KEY, roleCodes: [PHOTO_PROOF_ROLE], subject };
}

function sameValues(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
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
