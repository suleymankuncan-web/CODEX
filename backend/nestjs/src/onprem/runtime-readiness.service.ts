import { Inject, Injectable } from "@nestjs/common";
import IORedis from "ioredis";
import { AppConfigService } from "../shared/app-config.service";
import { DatabaseService } from "../shared/database/database.service";
import { MigrationService } from "../shared/database/migration.service";

export const ONPREM_REDIS_PROBE = Symbol("ONPREM_REDIS_PROBE");

export interface OnPremRedisProbe {
  assertReady(): Promise<void>;
}

type RuntimeRoleCapabilities = {
  role_name: string;
  can_assume_role: boolean;
  database_create: boolean;
  owns_relation: boolean;
  owns_schema: boolean;
  role_can_create_database: boolean;
  role_can_create_role: boolean;
  role_inherits: boolean;
  role_is_superuser: boolean;
  schema_create: boolean;
};

const RUNTIME_ROLE_CAPABILITY_QUERY = `
SELECT
  CURRENT_USER AS role_name,
  role.rolsuper AS role_is_superuser,
  role.rolcreatedb AS role_can_create_database,
  role.rolcreaterole AS role_can_create_role,
  role.rolinherit AS role_inherits,
  has_database_privilege(CURRENT_USER, CURRENT_DATABASE(), 'CREATE') AS database_create,
  EXISTS (
    SELECT 1
    FROM pg_namespace namespace
    WHERE namespace.nspname NOT LIKE 'pg_%'
      AND namespace.nspname <> 'information_schema'
      AND has_schema_privilege(CURRENT_USER, namespace.oid, 'CREATE')
  ) AS schema_create,
  EXISTS (
    SELECT 1
    FROM pg_namespace namespace
    WHERE namespace.nspname NOT LIKE 'pg_%'
      AND namespace.nspname <> 'information_schema'
      AND namespace.nspowner = role.oid
  ) AS owns_schema,
  EXISTS (
    SELECT 1
    FROM pg_class relation
    INNER JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname NOT LIKE 'pg_%'
      AND namespace.nspname <> 'information_schema'
      AND relation.relowner = role.oid
  ) AS owns_relation,
  EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE candidate.oid <> role.oid
      AND pg_has_role(CURRENT_USER, candidate.oid, 'MEMBER')
  ) AS can_assume_role
FROM pg_roles role
WHERE role.rolname = CURRENT_USER
`;

@Injectable()
export class RedisRuntimeProbe implements OnPremRedisProbe {
  constructor(private readonly config: AppConfigService) {}

  async assertReady(): Promise<void> {
    const redis = new IORedis(this.config.redisUrl, {
      connectTimeout: 5_000,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    try {
      await redis.connect();
      if ((await redis.ping()) !== "PONG") {
        throw new Error("unexpected response");
      }
    } finally {
      redis.disconnect(false);
    }
  }
}

@Injectable()
export class RuntimeReadinessService {
  private readonly readiness = new Map<"api" | "worker", Promise<{
    migrationCount: number;
    mode: "strict-local";
    status: "ready";
  }>>();
  constructor(
    private readonly config: AppConfigService,
    private readonly database: DatabaseService,
    private readonly migrations: MigrationService,
    @Inject(ONPREM_REDIS_PROBE) private readonly redis: OnPremRedisProbe,
  ) {}

  async assertReady(component: "api" | "worker" | "health") {
    if (!this.config.isStrictLocal) {
      return { mode: "hosted" as const, status: "ready" as const };
    }

    const processRole = component === "api" ? "api" : "worker";
    const existing = this.readiness.get(processRole);
    if (existing) return existing;
    const readiness = this.assertStrictLocalReady(processRole);
    this.readiness.set(processRole, readiness);
    return readiness;
  }

  private async assertStrictLocalReady(processRole: "api" | "worker") {
    const migrationStatus = await this.migrations.getMigrationStatus(
      process.cwd(),
      { requireMigrationTree: true },
    );
    this.assertMigrationStatus(migrationStatus);
    await this.assertRuntimeRoleIsRestricted(processRole);

    try {
      await this.redis.assertReady();
    } catch {
      throw new Error("strict-local Redis readiness failed");
    }

    return {
      migrationCount: migrationStatus.totalFiles,
      mode: "strict-local" as const,
      status: "ready" as const,
    };
  }

  private assertMigrationStatus(status: Awaited<ReturnType<MigrationService["getMigrationStatus"]>>): void {
    if (status.trackingTable !== "present") {
      throw new Error("strict-local migration tracking table is missing");
    }
    if (status.totalFiles === 0) {
      throw new Error("strict-local migration tree is missing");
    }
    if (status.pending.length > 0 || status.appliedCount !== status.totalFiles) {
      throw new Error("strict-local startup rejected pending migrations");
    }
    if (status.failed.length > 0) {
      throw new Error("strict-local startup rejected failed migrations");
    }
    if (status.checksumMismatches.length > 0) {
      throw new Error("strict-local startup rejected migration checksum mismatch");
    }
    if (status.unknownApplied.length > 0) {
      throw new Error("strict-local startup rejected unknown applied migrations");
    }
    if (status.unexpectedTracked.length > 0) {
      throw new Error("strict-local startup rejected unexpected tracked migrations");
    }
  }

  private async assertRuntimeRoleIsRestricted(processRole: "api" | "worker"): Promise<void> {
    const result = await this.database.query<RuntimeRoleCapabilities>(
      RUNTIME_ROLE_CAPABILITY_QUERY,
    );
    const capabilities = result.rows[0];
    const expectedRole = processRole === "api" ? "hr_axis_api" : "hr_axis_worker";
    if (!capabilities || capabilities.role_name !== expectedRole) {
      throw new Error("strict-local runtime database role identity mismatch");
    }
    const { role_name: _roleName, ...restrictedCapabilities } = capabilities;
    if (Object.values(restrictedCapabilities).some(Boolean)) {
      throw new Error("strict-local runtime database role has schema DDL capability");
    }
  }
}
