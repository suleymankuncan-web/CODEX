import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { AppConfigService } from "../shared/app-config.service";
import {
  MigrationService,
  resolveMigrationSql,
  type MigrationStatusResult,
} from "../shared/database/migration.service";

/** The schema is intentionally aggregate-only: no migration names, checksums, or URLs. */
export const ONPREM_MIGRATION_STATUS_SCHEMA_VERSION = 1 as const;

export type OnPremMigrationStatus =
  | "fresh"
  | "clean"
  | "pending"
  | "failed"
  | "incompatible";

export type OnPremMigrationStatusEvidence = {
  schemaVersion: typeof ONPREM_MIGRATION_STATUS_SCHEMA_VERSION;
  dataClass: string;
  status: OnPremMigrationStatus;
  trackingTable: "present" | "missing";
  total: number;
  applied: number;
  pending: number;
  failed: number;
  orphan: number;
  checksum: "valid" | "invalid";
  migrationTreeDigest: string;
};

@Injectable()
export class OnPremMigrationStatusService {
  constructor(
    private readonly config: AppConfigService,
    private readonly migrations: MigrationService,
  ) {}

  async getStatus(basePath = process.cwd()): Promise<OnPremMigrationStatusEvidence> {
    const migrationTree = resolveMigrationTree(basePath);
    if (!migrationTree) {
      throw new Error("on-prem migration tree is missing");
    }

    const files = readdirSync(migrationTree)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    if (files.length === 0) {
      throw new Error("on-prem migration tree is missing");
    }

    const status = await this.migrations.getMigrationStatus(basePath, {
      requireMigrationTree: true,
    });
    const evidence = summarizeMigrationStatus(
      this.config.dataClass,
      status,
      computeMigrationTreeDigest(migrationTree, files),
    );
    assertSanitizedMigrationStatus(evidence);
    return evidence;
  }
}

export function summarizeMigrationStatus(
  dataClass: string,
  status: MigrationStatusResult,
  migrationTreeDigest: string,
): OnPremMigrationStatusEvidence {
  const orphan = new Set(status.unexpectedTracked).size;
  const checksum = status.checksumMismatches.length === 0 ? "valid" : "invalid";
  let resultStatus: OnPremMigrationStatus;

  if (status.trackingTable === "missing") {
    resultStatus =
      status.totalFiles > 0 && orphan === 0 && status.failed.length === 0 && checksum === "valid"
        ? "fresh"
        : "incompatible";
  } else if (orphan > 0 || checksum === "invalid" || status.running.length > 0) {
    resultStatus = "incompatible";
  } else if (status.failed.length > 0) {
    resultStatus = "failed";
  } else if (status.pending.length > 0 || status.appliedCount < status.totalFiles) {
    resultStatus = "pending";
  } else {
    resultStatus = "clean";
  }

  return {
    schemaVersion: ONPREM_MIGRATION_STATUS_SCHEMA_VERSION,
    dataClass,
    status: resultStatus,
    trackingTable: status.trackingTable,
    total: status.totalFiles,
    applied: status.appliedCount,
    pending: status.pending.length,
    failed: status.failed.length,
    orphan,
    checksum,
    migrationTreeDigest: normalizeDigest(migrationTreeDigest),
  };
}

export function computeMigrationTreeDigest(directory: string, files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files.slice().sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(resolveMigrationSql(join(directory, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function assertSanitizedMigrationStatus(value: OnPremMigrationStatusEvidence): void {
  const expectedKeys = [
    "applied",
    "checksum",
    "dataClass",
    "failed",
    "migrationTreeDigest",
    "orphan",
    "pending",
    "schemaVersion",
    "status",
    "total",
    "trackingTable",
  ];
  const keys = Object.keys(value).sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys.slice().sort()[index])) {
    throw new Error("on-prem migration status schema mismatch");
  }
  if (
    value.schemaVersion !== ONPREM_MIGRATION_STATUS_SCHEMA_VERSION ||
    value.dataClass !== "synthetic" ||
    !["fresh", "clean", "pending", "failed", "incompatible"].includes(value.status) ||
    !["present", "missing"].includes(value.trackingTable) ||
    !Number.isInteger(value.total) || value.total < 0 ||
    !Number.isInteger(value.applied) || value.applied < 0 ||
    !Number.isInteger(value.pending) || value.pending < 0 ||
    !Number.isInteger(value.failed) || value.failed < 0 ||
    !Number.isInteger(value.orphan) || value.orphan < 0 ||
    !["valid", "invalid"].includes(value.checksum) ||
    !/^[a-f0-9]{64}$/.test(value.migrationTreeDigest)
  ) {
    throw new Error("on-prem migration status schema mismatch");
  }
  if (value.dataClass.includes("\n") || value.dataClass.includes("\r")) {
    throw new Error("on-prem migration status data class is invalid");
  }
}

function resolveMigrationTree(basePath: string): string | undefined {
  const candidates = [
    resolve(basePath, "db", "migrations"),
    resolve(basePath, "..", "db", "migrations"),
    resolve(basePath, "..", "..", "db", "migrations"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function normalizeDigest(value: string): string {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("on-prem migration tree digest is invalid");
  }
  return value.toLowerCase();
}
