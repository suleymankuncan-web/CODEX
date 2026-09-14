import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateChecklistTemplateItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  sectionName!: string;

  @IsInt()
  @Min(1)
  itemNo!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  itemText!: string;

  @IsIn(["score", "yes_no", "partial", "compliance", "text"])
  responseType!: "score" | "yes_no" | "partial" | "compliance" | "text";

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsOptional()
  @IsString()
  expectedValue?: string;

  @IsOptional()
  @IsIn(["none", "optional", "required"])
  evidencePolicy?: "none" | "optional" | "required";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxEvidenceCount?: number;

  @IsOptional()
  @IsBoolean()
  createsRemediationTask?: boolean;
}

export class CreateChecklistTemplateDto {
  @IsPostgresUuid()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  templateCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  templateName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  templateType!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  category!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistTemplateItemDto)
  items!: CreateChecklistTemplateItemDto[];
}
