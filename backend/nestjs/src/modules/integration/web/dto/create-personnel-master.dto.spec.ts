import { validate } from "class-validator";
import { CreatePersonnelMasterDto } from "./create-personnel-master.dto";

function validDto() {
  return Object.assign(new CreatePersonnelMasterDto(), {
    firstName: "Ada",
    lastName: "Lovelace",
    nationalId: "12345678901",
    phoneNumber: "+90 555 111 22 33",
    username: "ada.lovelace",
    email: "ada.lovelace@example.com",
    employmentType: "full_time",
    hireDate: "2026-08-28",
    storeId: "10000000-0000-4000-8000-000000000001",
    positionId: "20000000-0000-4000-8000-000000000001",
  });
}

describe("CreatePersonnelMasterDto", () => {
  it("accepts an 11-digit national id and a supported phone format", async () => {
    await expect(validate(validDto())).resolves.toEqual([]);
  });

  it("rejects malformed identity and phone input", async () => {
    const dto = validDto();
    dto.nationalId = "1234";
    dto.phoneNumber = "555";

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["nationalId", "phoneNumber"]),
    );
  });
});
