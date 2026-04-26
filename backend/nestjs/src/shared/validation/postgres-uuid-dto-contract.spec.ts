import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

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

describe("PostgreSQL UUID DTO validation contract", () => {
  it("keeps web DTOs on IsPostgresUuid instead of class-validator IsUUID", () => {
    const modulesRoot = join(process.cwd(), "src", "modules");
    const webDtoMarker = `${sep}web${sep}dto${sep}`;
    const dtoFiles = collectFiles(
      modulesRoot,
      (path) => path.endsWith(".ts") && path.includes(webDtoMarker),
    );

    const offenders = dtoFiles
      .filter((path) => readFileSync(path, "utf8").includes("IsUUID"))
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"));

    expect(offenders).toEqual([]);
  });
});
