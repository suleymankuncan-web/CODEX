import { IsIn, IsOptional } from "class-validator";

export class GetImportPayloadTemplateQueryDto {
  @IsOptional()
  @IsIn(["employee", "store", "kpi", "assignment", "position", "company", "region"])
  entityType?: "employee" | "store" | "kpi" | "assignment" | "position" | "company" | "region";

  @IsOptional()
  @IsIn(["nebim_v3", "power_bi", "manual", "other"])
  sourceSystem?: "nebim_v3" | "power_bi" | "manual" | "other";
}
