import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SaveMobileChecklistResponseDto } from "./save-mobile-checklist-response.dto";

describe("SaveMobileChecklistResponseDto", () => {
  it.each([
    "compliant",
    "partially_compliant",
    "non_compliant",
    "not_applicable",
  ])("accepts compliance response value %s", async (responseValue) => {
    const dto = plainToInstance(SaveMobileChecklistResponseDto, {
      templateItemId: "00000000-0000-0000-0000-000000000001",
      responseValue,
      scoreValue: 0,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects unknown compliance response values", async () => {
    const dto = plainToInstance(SaveMobileChecklistResponseDto, {
      templateItemId: "00000000-0000-0000-0000-000000000001",
      responseValue: "ignored",
      scoreValue: 0,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
