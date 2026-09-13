export type PersonnelCorrectionValues = {
  email?: string;
  nationalIdLast4?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  hireDate: string;
  employmentType: "full_time" | "part_time" | "temporary";
  positionId: string;
};
export type CreatePersonnelCorrectionInput = {
  storeId: string;
  employeeId: string;
  expectedRevision: string;
  proposed: PersonnelCorrectionValues & { nationalId?: string };
  reason: string;
};
export type ReviewPersonnelCorrectionInput = {
  decision: "approve" | "reject";
  note: string;
};
