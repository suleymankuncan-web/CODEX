import { createHash } from "node:crypto";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildPersonnelMasterIdentity(input: {
  nationalId: string;
  phoneNumber: string;
}) {
  const nationalId = input.nationalId.trim();

  return {
    nationalIdHash: sha256(nationalId),
    nationalIdAlternateHash: sha256(`national_id:${nationalId}`),
    nationalIdLast4: nationalId.slice(-4),
    phoneNumber: input.phoneNumber.trim(),
  };
}
