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

    const seedPaths = resolveSeedPaths(basePath);
    if (!seedPaths) {
      throw new Error("synthetic seed set is incomplete");
    }
    const seeds = seedPaths.map(({ name, path }) => ({
      name,
      sql: readFileSync(path, "utf8"),
    }));
    const results = await this.database.withTransaction(async (client) => {
      // Guard the target as well as the process flags: an old synthetic Compose
      // must not repopulate a company database after connection-file cutover.
      await client.query("LOCK TABLE ops.company IN SHARE ROW EXCLUSIVE MODE");
      const target = await client.query(`SELECT company_id FROM ops.company
        WHERE company_id <> '00000000-0000-0000-0000-000000000001'::uuid LIMIT 1`);
      if (target.rows.length !== 0) {
        throw new Error("synthetic seed refuses a non-synthetic company database");
      }
      const collected = [];
      for (const seed of seeds) {
        const queryResult = await client.query(seed.sql);
        collected.push(...(Array.isArray(queryResult) ? queryResult : [queryResult]));
      }
      return collected;
    });
    const digest = createHash("sha256");
    for (const seed of seeds) {
      digest.update(seed.name).update("\0").update(seed.sql).update("\0");
    }

    return {
      affectedRows: results.reduce(
        (total, result) => total + Math.max(0, result.rowCount ?? 0),
        0,
      ),
      byteCount: seeds.reduce(
        (total, seed) => total + Buffer.byteLength(seed.sql, "utf8"),
        0,
      ),
      digest: digest.digest("hex"),
      resultSetCount: results.length,
      seedCount: seeds.length,
    };
  }
}

function resolveSeedPaths(
  basePath: string,
): Array<{ name: string; path: string }> | undefined {
  const names = [
    "001_reference_seed.sql",
    "002_onprem_keycloak_personas.sql",
  ] as const;
  const roots = [
    resolve(basePath, "db", "seeds"),
    resolve(basePath, "..", "db", "seeds"),
    resolve(basePath, "..", "..", "db", "seeds"),
  ];
  for (const root of roots) {
    const paths = names.map((name) => ({ name, path: resolve(root, name) }));
    if (paths.every(({ path }) => existsSync(path))) {
      return paths;
    }
  }
  return undefined;
}
