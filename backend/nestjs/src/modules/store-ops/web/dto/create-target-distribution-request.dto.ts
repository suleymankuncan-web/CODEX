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

class TargetDistributionRevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsPostgresUuid({ each: true })
  baseReferenceIds!: string[];

  @IsArray()
  @IsPostgresUuid({ each: true })
  removedEmployeeIds!: string[];

}

class TargetDistributionAllocationDto {
  @IsPostgresUuid()
  employeeId!: string;

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

  @IsOptional()
  @ValidateNested()
  @Type(() => TargetDistributionRevisionDto)
  revision?: TargetDistributionRevisionDto;
}
