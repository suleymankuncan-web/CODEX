import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

class TargetDistributionAllocationDto {
  @IsString()
  assigneeLabel!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTargetDistributionRequestDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsDateString()
  requestMonth!: string;

  @IsString()
  targetLabel!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalTargetValue!: number;

  @IsOptional()
  @IsString()
  requestReason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TargetDistributionAllocationDto)
  allocations!: TargetDistributionAllocationDto[];
}
