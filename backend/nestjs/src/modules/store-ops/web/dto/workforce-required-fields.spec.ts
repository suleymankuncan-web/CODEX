import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateSellerCodeRequestDto } from "./create-seller-code-request.dto";
import { ResubmitSellerCodeRequestDto } from "./resubmit-seller-code-request.dto";
const complete = { storeId: "11111111-1111-4111-8111-111111111111", requestType: "create_code", firstName: "Ayşe", lastName: "Örnek", nationalId: "12345678901", phoneNumber: "05551234567", email: "test@example.test", hireDate: "2026-09-12", requestedPositionId: "11111111-1111-4111-8111-111111111111", employmentType: "full_time", requestReason: "Yeni personel" };
describe("Required personnel request fields", () => {
  it.each([CreateSellerCodeRequestDto, ResubmitSellerCodeRequestDto])("accepts complete fields without a separate username", async (Dto) => {
    expect(await validate(plainToInstance(Dto, complete))).toHaveLength(0);
  });
  it.each(["firstName", "lastName", "nationalId", "phoneNumber", "email", "hireDate", "requestedPositionId", "employmentType", "requestReason"])("rejects missing %s on create and resubmit", async field => {
    for (const Dto of [CreateSellerCodeRequestDto, ResubmitSellerCodeRequestDto]) {
      expect((await validate(plainToInstance(Dto, { ...complete, [field]: undefined }))).length).toBeGreaterThan(0);
    }
  });
  it.each(["          ", "----------", "123"])("rejects empty or incomplete phone %s", async phoneNumber => {
    expect((await validate(plainToInstance(CreateSellerCodeRequestDto, { ...complete, phoneNumber }))).length).toBeGreaterThan(0);
  });
  it("rejects whitespace-only identity and reason", async () => {
    for (const field of ["firstName", "lastName", "requestReason"]) expect((await validate(plainToInstance(CreateSellerCodeRequestDto, { ...complete, [field]: "  " }))).length).toBeGreaterThan(0);
  });
});
