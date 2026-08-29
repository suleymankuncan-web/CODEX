import { validate } from "class-validator";
import { UpdatePersonnelMasterDto } from "./update-personnel-master.dto";

describe("UpdatePersonnelMasterDto", () => {
  it("rejects termination through the generic update command", async () => {
    const dto = Object.assign(new UpdatePersonnelMasterDto(), {
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "+90 555 111 22 33",
      employmentStatus: "terminated",
      employmentType: "full_time",
      hireDate: "2025-01-01",
      storeId: "10000000-0000-4000-8000-000000000001",
      positionId: "20000000-0000-4000-8000-000000000001",
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "employmentStatus")).toBe(true);
  });

  it("accepts a normalized personnel contact update", async () => {
    const dto = Object.assign(new UpdatePersonnelMasterDto(), {
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "+90 555 111 22 33",
      employmentStatus: "active",
      employmentType: "full_time",
      hireDate: "2025-01-01",
      storeId: "10000000-0000-4000-8000-000000000001",
      positionId: "20000000-0000-4000-8000-000000000001",
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
