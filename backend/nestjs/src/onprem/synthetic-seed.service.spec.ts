import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyntheticSeedService } from "./synthetic-seed.service";

function createSeedTree() {
  const root = mkdtempSync(join(tmpdir(), "hr-axis-onprem-seed-"));
  const seeds = join(root, "db", "seeds");
  mkdirSync(seeds, { recursive: true });
  writeFileSync(
    join(seeds, "001_reference_seed.sql"),
    "INSERT INTO example (label) VALUES ('synthetic');",
    "utf8",
  );
  writeFileSync(
    join(seeds, "002_onprem_keycloak_personas.sql"),
    "INSERT INTO example (label) VALUES ('identity');",
    "utf8",
  );
  return root;
}

describe("SyntheticSeedService", () => {
  it("rejects execution outside strict-local synthetic mode", async () => {
    const service = new SyntheticSeedService(
      { dataClass: "synthetic", isStrictLocal: false } as never,
      { withTransaction: jest.fn() } as never,
    );

    await expect(service.run(createSeedTree())).rejects.toThrow(
      "synthetic seed requires strict-local synthetic mode",
    );
  });

  it("executes both versioned synthetic seeds in one transaction and returns aggregate evidence only", async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const service = new SyntheticSeedService(
      { dataClass: "synthetic", isStrictLocal: true } as never,
      {
        withTransaction: jest.fn(async (work) => work({ query })),
      } as never,
    );

    const result = await service.run(createSeedTree());

    expect(query).toHaveBeenNthCalledWith(
      1,
      "INSERT INTO example (label) VALUES ('synthetic');",
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO example (label) VALUES ('identity');",
    );
    expect(result).toMatchObject({
      affectedRows: 2,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      resultSetCount: 2,
      seedCount: 2,
    });
    expect(result.byteCount).toBeGreaterThan(90);
    expect(JSON.stringify(result)).not.toContain("synthetic');");
  });

  it("fails before database access when the Keycloak persona seed is missing", async () => {
    const missingRoot = mkdtempSync(join(tmpdir(), "hr-axis-onprem-missing-seed-"));
    const seeds = join(missingRoot, "db", "seeds");
    mkdirSync(seeds, { recursive: true });
    writeFileSync(
      join(seeds, "001_reference_seed.sql"),
      "INSERT INTO example (label) VALUES ('synthetic');",
      "utf8",
    );
    const withTransaction = jest.fn();
    const service = new SyntheticSeedService(
      { dataClass: "synthetic", isStrictLocal: true } as never,
      { withTransaction } as never,
    );

    await expect(service.run(missingRoot)).rejects.toThrow(
      "synthetic seed set is incomplete",
    );
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
