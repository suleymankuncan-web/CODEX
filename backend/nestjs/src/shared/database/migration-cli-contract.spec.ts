import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("migration CLI contract", () => {
  it("exposes db:migrate package script and uses MigrationService without starting HTTP", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(process.cwd(), "scripts", "run-migrations.ts"),
      "utf8",
    );

    expect(packageJson.scripts["db:migrate"]).toBe("ts-node scripts/run-migrations.ts");
    expect(script).toContain("NestFactory.createApplicationContext");
    expect(script).toContain("MigrationService");
    expect(script).toContain("runMigrations");
    expect(script).not.toContain("create(AppModule)");
    expect(script).not.toContain("listen(");
  });
});
