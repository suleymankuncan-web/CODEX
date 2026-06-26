import {
  ArrayMinSize,
  IsArray,
  IsNumber,
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
