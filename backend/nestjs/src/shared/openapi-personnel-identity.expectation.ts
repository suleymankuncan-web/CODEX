type ExpectValue = (value: unknown) => {
  toEqual(expected: unknown): void;
};
type ExpectApi = ExpectValue & {
  objectContaining(value: Record<string, unknown>): unknown;
  arrayContaining(value: unknown[]): unknown;
};

export function expectPersonnelIdentityOpenApi(
  document: Record<string, any>,
  expectValue: ExpectApi,
) {
  expectValue(document.components?.schemas?.PersonnelMasterListResponse).toEqual(
    expectValue.objectContaining({
      properties: expectValue.objectContaining({
        items: expectValue.objectContaining({
          items: expectValue.objectContaining({
            properties: expectValue.objectContaining({
              nationalIdLast4: { type: "string", nullable: true },
              phoneNumber: { type: "string", nullable: true },
            }),
          }),
        }),
      }),
    }),
  );
  expectValue(document.components?.schemas?.CreatePersonnelMasterDto).toEqual(
    expectValue.objectContaining({
      required: expectValue.arrayContaining(["nationalId", "phoneNumber"]),
      properties: expectValue.objectContaining({
        nationalId: expectValue.objectContaining({ type: "string" }),
        phoneNumber: expectValue.objectContaining({ type: "string" }),
      }),
    }),
  );
}
