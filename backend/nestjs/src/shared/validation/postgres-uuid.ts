import { Matches, ValidationOptions } from "class-validator";

const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPostgresUuidString(value: unknown): value is string {
  return typeof value === "string" && POSTGRES_UUID_PATTERN.test(value);
}

export function IsPostgresUuid(validationOptions?: ValidationOptions) {
  return Matches(POSTGRES_UUID_PATTERN, {
    message: "$property must be a PostgreSQL UUID string",
    ...validationOptions,
  });
}
