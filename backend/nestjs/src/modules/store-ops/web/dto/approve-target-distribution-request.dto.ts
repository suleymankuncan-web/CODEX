import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsInt,
  Max,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ApprovedTargetDistributionAllocationDto {
  @ApiProperty()
  @IsPostgresUuid()
  employeeId!: string;

  @ApiProperty()
  @IsString()
  assigneeLabel!: string;

  @ApiProperty({ minimum: 0, type: Number })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue!: number;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  distributionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ApproveTargetDistributionRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalNote?: string;

  @ApiPropertyOptional({ minimum: 0, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedTotalTargetValue?: number;

  @ApiPropertyOptional({
    type: "array",
    items: {
      type: "object",
      required: ["employeeId", "assigneeLabel", "targetValue"],
      properties: {
        employeeId: { type: "string" },
        assigneeLabel: { type: "string" },
        targetValue: { minimum: 0, type: "number" },
        distributionDays: { minimum: 0, maximum: Number.MAX_SAFE_INTEGER, type: "integer" },
        note: { type: "string" },
      },
    },
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovedTargetDistributionAllocationDto)
  approvedAllocations?: ApprovedTargetDistributionAllocationDto[];
}
