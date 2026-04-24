import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

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
  @IsUUID()
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
