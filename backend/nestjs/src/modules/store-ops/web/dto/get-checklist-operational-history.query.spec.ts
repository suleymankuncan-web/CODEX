import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GetChecklistOperationalHistoryParamsDto } from "./get-checklist-operational-history.params";
import { GetChecklistOperationalHistoryQueryDto } from "./get-checklist-operational-history.query";

describe("operational history HTTP DTOs", () => {
  it("accepts bounded filters and a PostgreSQL UUID", async () => {
    const query = plainToInstance(GetChecklistOperationalHistoryQueryDto, {
      range: "6m",
      kinds: "checklist_completed,task_assigned",
      cursor: "eyJ2IjoxfQ",
    });
    const params = plainToInstance(GetChecklistOperationalHistoryParamsDto, {
      storeId: "11111111-1111-4111-8111-111111111111",
    });
    expect(await validate(query)).toEqual([]);
    expect(await validate(params)).toEqual([]);
  });

  it("rejects fetch-all, unknown syntax, oversized cursors and malformed store ids", async () => {
    const invalid = plainToInstance(GetChecklistOperationalHistoryQueryDto, {
      range: "24m",
      kinds: "checklist_completed,private.note",
      cursor: "x".repeat(2049),
    });
    const params = plainToInstance(GetChecklistOperationalHistoryParamsDto, { storeId: "all-stores" });
    expect(await validate(invalid)).toHaveLength(3);
    expect(await validate(params)).toHaveLength(1);
  });
});
