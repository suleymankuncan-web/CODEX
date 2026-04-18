import { IsUUID } from "class-validator";

export class CompleteChecklistInstanceDto {
  @IsUUID()
  auditorEmployeeId!: string;
}
