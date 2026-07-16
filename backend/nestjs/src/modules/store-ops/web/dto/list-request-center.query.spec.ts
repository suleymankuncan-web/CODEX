import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListRequestCenterQueryDto } from "./list-request-center.query";

describe("ListRequestCenterQueryDto", () => {
  it("accepts and transforms one bounded ledger page selection", async () => {
    const dto = plainToInstance(ListRequestCenterQueryDto, {
      bucket: "done",
      type: "target",
      status: "approved",
      period: "2026-07",
      storeId: "11111111-1111-4111-8111-111111111111",
      q: "Temmuz hedefi",
      limit: "15",
      offset: "30",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(15);
    expect(dto.offset).toBe(30);
  });

  it.each([
    ["bucket", "waiting"],
    ["type", "unknown"],
    ["status", "closed"],
    ["period", "2026-7"],
    ["q", "x"],
    ["limit", "201"],
    ["offset", "-1"],
  ])("rejects invalid %s input", async (field, value) => {
    const dto = plainToInstance(ListRequestCenterQueryDto, {
      [field]: value,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
