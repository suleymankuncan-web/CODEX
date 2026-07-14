import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListChecklistCommandRegionsQueryDto } from "./list-checklist-command-regions.query";

describe("ListChecklistCommandRegionsQueryDto", () => {
  it("accepts the bounded region aggregate contract", async () => {
    const dto = plainToInstance(ListChecklistCommandRegionsQueryDto, {
      period: "2026-07",
      signal: "missing_visit",
      sort: "missing_desc",
      limit: "20",
      offset: "0",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it("rejects invalid region aggregate query values", async () => {
    const dto = plainToInstance(ListChecklistCommandRegionsQueryDto, {
      period: "2026-00",
      signal: "missing_magic",
      sort: "region; DROP TABLE ops.region",
      limit: 101,
      offset: -1,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      "limit",
      "offset",
      "period",
      "signal",
      "sort",
    ]);
  });
});
