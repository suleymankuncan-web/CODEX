import { IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateChecklistInstanceDto {
  @IsPostgresUuid()
  templateId!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsOptional()
  @IsPostgresUuid()
  assignedEmployeeId?: string;
}
