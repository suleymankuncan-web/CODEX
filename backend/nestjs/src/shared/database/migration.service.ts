import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseService } from "./database.service";

@Injectable()
export class MigrationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async runMigrations(basePath = process.cwd()): Promise<{ applied: string[] }> {
    const migrationsPath = resolve(basePath, "..", "db", "migrations");
    if (!existsSync(migrationsPath)) {
      return { applied: [] };
    }

    const files = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const applied: string[] = [];

    for (const file of files) {
      const sql = this.resolvePsqlIncludes(join(migrationsPath, file));
      await this.databaseService.query(sql);
      applied.push(file);
    }

    return { applied };
  }

  private resolvePsqlIncludes(filePath: string): string {
    const raw = readFileSync(filePath, "utf8");
    return raw.replace(/^\\i\s+(.+)$/gm, (_match: string, relativePath: string) => {
      const includePath = resolve(dirname(filePath), relativePath.trim());
      return readFileSync(includePath, "utf8");
    });
  }
}
