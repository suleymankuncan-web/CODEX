import { createHash } from "node:crypto";
import { buildPersonnelMasterIdentity } from "./personnel-master-identity";

describe("buildPersonnelMasterIdentity", () => {
  it("returns persistence-safe hashes, a masked display suffix and a normalized phone", () => {
    const nationalId = "12345678901";

    expect(
      buildPersonnelMasterIdentity({
        nationalId,
        phoneNumber: "  +90 555 111 22 33  ",
      }),
    ).toEqual({
      nationalIdHash: createHash("sha256").update(nationalId).digest("hex"),
      nationalIdAlternateHash: createHash("sha256")
        .update(`national_id:${nationalId}`)
        .digest("hex"),
      nationalIdLast4: "8901",
      phoneNumber: "+90 555 111 22 33",
    });
  });
});
