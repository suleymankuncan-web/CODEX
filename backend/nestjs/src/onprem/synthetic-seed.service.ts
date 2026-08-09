import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppConfigService } from "../shared/app-config.service";
import { DatabaseService } from "../shared/database/database.service";

@Injectable()
export class SyntheticSeedService {
  constructor(
    private readonly config: AppConfigService,
    private readonly database: DatabaseService,
  ) {}

  async run(basePath = process.cwd()) {
    if (!this.config.isStrictLocal || this.config.dataClass !== "synthetic") {
      throw new Error("synthetic seed requires strict-local synthetic mode");
    }

    const seedPath = resolveSeedPath(basePath);
    if (!seedPath) {
      throw new Error("synthetic reference seed is missing");
    }
    const sql = readFileSync(seedPath, "utf8");
    const queryResult = await this.database.withTransaction((client) =>
      client.query(sql),
    );
    const results = Array.isArray(queryResult) ? queryResult : [queryResult];

    return {
      affectedRows: results.reduce(
        (total, result) => total + Math.max(0, result.rowCount ?? 0),
        0,
      ),
      byteCount: Buffer.byteLength(sql, "utf8"),
      digest: createHash("sha256").update(sql).digest("hex"),
      resultSetCount: results.length,
    };
  }
}

function resolveSeedPath(basePath: string): string | undefined {
  const candidates = [
    resolve(basePath, "db", "seeds", "001_reference_seed.sql"),
    resolve(basePath, "..", "db", "seeds", "001_reference_seed.sql"),
    resolve(basePath, "..", "..", "db", "seeds", "001_reference_seed.sql"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}
