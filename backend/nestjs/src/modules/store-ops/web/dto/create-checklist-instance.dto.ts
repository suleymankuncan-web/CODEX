import { IsOptional, IsUUID } from "class-validator";

export class CreateChecklistInstanceDto {
  @IsUUID()
  templateId!: string;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsUUID()
  assignedEmployeeId?: string;
}
