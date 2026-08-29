import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListChecklistCommandQueryDto } from "./list-checklist-command.query";

describe("ListChecklistCommandQueryDto", () => {
  it("rejects unbounded pagination, invalid periods and sort injection", async () => {
    const dto = plainToInstance(ListChecklistCommandQueryDto, {
      period: "2026-13",
      sort: "store_asc; DROP TABLE ops.store",
      limit: 101,
      offset: -1,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      "limit",
      "offset",
      "period",
      "sort",
    ]);
  });

  it("accepts the bounded production query contract", async () => {
    const dto = plainToInstance(ListChecklistCommandQueryDto, {
      period: "2026-07",
      managerUserId: "00000000-0000-4000-8000-000000000020",
      regionId: "00000000-0000-4000-8000-000000000010",
      query: "Marmara",
      status: "needs_visit",
      signal: "missing_visit",
      sort: "bm_score_asc",
      limit: "30",
      offset: "0",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(30);
    expect(dto.offset).toBe(0);
  });

  it("rejects unknown independent coverage signals", async () => {
    const dto = plainToInstance(ListChecklistCommandQueryDto, { signal: "missing_magic" });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(["signal"]);
  });
});
