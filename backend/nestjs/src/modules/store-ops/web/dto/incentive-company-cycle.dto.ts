import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SealIncentiveCompanyDto {
  @ApiProperty({ format: "uuid" }) @IsPostgresUuid() companyId!: string;
  @ApiProperty({ pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" }) @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period!: string;
  @ApiProperty({ type: "integer", minimum: 0 }) @IsInt() @Min(0) expectedRevision!: number;
}
export class DecideIncentiveCompanyDto {
  @ApiProperty({ format: "uuid" }) @IsPostgresUuid() companyId!: string;
  @ApiProperty({ pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" }) @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period!: string;
  @ApiProperty({ format: "uuid" }) @IsPostgresUuid() cycleId!: string;
  @ApiProperty({ type: "integer", minimum: 1 }) @IsInt() @Min(1) revision!: number;
  @IsIn(["sales_director", "hr", "general_manager"]) stage!: "sales_director" | "hr" | "general_manager";
  @Matches(/^[a-f0-9]{64}$/) sealHash!: string;
  @IsIn(["approve", "return"]) decision!: "approve" | "return";
  @IsOptional() @IsString() @MaxLength(1000) reasonNote?: string;
}
export class IncentiveCompanyRevisionDto {
  @ApiProperty({ type: "integer", minimum: 1 }) revision_no!: number;
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) seal_hash!: string;
  @ApiProperty() sealed_at!: string;
  @ApiProperty({ type: "object", additionalProperties: true }) payload!: Record<string, unknown>;
}
export class IncentiveCompanyStateDto {
  @ApiProperty({ format: "uuid" }) cycle_id!: string;
  @ApiProperty({ format: "uuid" }) company_id!: string;
  @ApiProperty() period_key!: string;
  @ApiProperty({ type: "integer", minimum: 0 }) current_revision!: number;
  @ApiProperty({ enum: ["preparation", "sales_director", "hr", "general_manager", "final"] }) stage!: string;
}
export class IncentiveCompanyDecisionDto {
  @ApiProperty() decision_id!: string;
  @ApiProperty({ type: "integer", minimum: 1 }) revision_no!: number;
  @ApiProperty() seal_hash!: string;
  @ApiProperty() stage!: string;
  @ApiProperty() decision!: string;
  @ApiProperty() actor_user_id!: string;
  @ApiPropertyOptional({ nullable: true }) reason_note!: string | null;
  @ApiProperty() decided_at!: string;
}
export class IncentiveCompanyDetailDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() companyName!: string;
  @ApiProperty() period!: string;
  @ApiProperty({ type: IncentiveCompanyStateDto, nullable: true }) cycle!: IncentiveCompanyStateDto | null;
  @ApiProperty({ type: [IncentiveCompanyRevisionDto] }) revisions!: IncentiveCompanyRevisionDto[];
  @ApiProperty({ type: [IncentiveCompanyDecisionDto] }) decisions!: IncentiveCompanyDecisionDto[];
}
export class IncentiveCompanyListDto {
  @ApiProperty({ type: [IncentiveCompanyDetailDto] }) items!: IncentiveCompanyDetailDto[];
}
export class IncentiveCompanyCommandResultDto {
  @ApiProperty({ format: "uuid" }) cycleId!: string;
  @ApiProperty({ format: "uuid" }) companyId!: string;
  @ApiProperty() period!: string;
  @ApiProperty({ type: "integer", minimum: 1 }) revision!: number;
  @ApiProperty({ enum: ["preparation", "sales_director", "hr", "general_manager", "final"] }) stage!: string;
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) sealHash!: string;
  @ApiProperty() total!: string;
}
