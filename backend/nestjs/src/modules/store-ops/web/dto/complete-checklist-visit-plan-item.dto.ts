import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CompleteChecklistVisitPlanItemDto {
  @IsPostgresUuid()
  idempotencyKey!: string;
}
