import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { EmployeeOffboardingRequestRow } from "./workforce-offboarding-read.repository";

// Validate the same revision that was authorized before any employee/access writes.
// Comparing only status would allow a delayed approval after reject -> resubmit.
export async function lockOffboardingTransition(
  client: PoolClient,
  expected: EmployeeOffboardingRequestRow,
  sourceStatus: string,
): Promise<void> {
  const result = await client.query<{
    request_status: string;
    request_revision: string;
  }>(
    `SELECT eor.request_status, eor.updated_at::text AS request_revision
     FROM ops.employee_offboarding_request eor
     WHERE eor.offboarding_request_id = $1::uuid
     FOR UPDATE`,
    [expected.offboarding_request_id],
  );
  const current = result.rows[0];
  if (
    !current ||
    current.request_status !== sourceStatus ||
    !expected.request_revision ||
    current.request_revision !== expected.request_revision
  ) {
    throw new ConflictException("Offboarding request changed; refresh before reviewing again");
  }
}
