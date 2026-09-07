import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListPersonnelObservationsQueryDto } from "./list-personnel-observations.query";

describe("personnel observation query", () => {
  const valid = { fromDate: "2026-08-09", toDate: "2026-09-07" };
  it("accepts dates and coerces bounded pagination", async () => {
    const query = plainToInstance(ListPersonnelObservationsQueryDto, { ...valid, limit: "200", offset: "1000000", q: "P001" });
    expect(await validate(query)).toHaveLength(0);
    expect(query.limit).toBe(200);
  });
  it.each([
    {}, { ...valid, fromDate: "2026-02-30" },
    { ...valid, toDate: "2026-09-07T00:00:00Z" },
    { ...valid, limit: 201 }, { ...valid, limit: 0 },
    { ...valid, offset: -1 }, { ...valid, offset: 1000001 },
    { ...valid, q: "x".repeat(81) }, { ...valid, storeId: "bad" },
  ])("rejects invalid dates, filters, or pagination: %j", async (input) => {
    expect((await validate(plainToInstance(ListPersonnelObservationsQueryDto, input))).length).toBeGreaterThan(0);
  });
});
