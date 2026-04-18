import { IsIn, IsString, Length } from "class-validator";

export class CreateIntegrationSourceDto {
  @IsString()
  @Length(2, 64)
  sourceCode!: string;

  @IsString()
  @Length(2, 128)
  sourceName!: string;

  @IsIn(["employee", "store", "kpi", "assignment", "position", "company", "region"])
  entityType!: "employee" | "store" | "kpi" | "assignment" | "position" | "company" | "region";
}
