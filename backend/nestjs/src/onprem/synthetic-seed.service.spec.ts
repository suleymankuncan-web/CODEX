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

  it("executes the unchanged reference seed and returns aggregate evidence only", async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const service = new SyntheticSeedService(
      { dataClass: "synthetic", isStrictLocal: true } as never,
      {
        withTransaction: jest.fn(async (work) => work({ query })),
      } as never,
    );

    const result = await service.run(createSeedTree());

    expect(query).toHaveBeenCalledWith(
      "INSERT INTO example (label) VALUES ('synthetic');",
    );
    expect(result).toEqual({
      affectedRows: 1,
      byteCount: 49,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      resultSetCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain("synthetic');");
  });
});
