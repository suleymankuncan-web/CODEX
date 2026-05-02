import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
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

export class UpdateChecklistTemplateItemDto {
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

  @IsIn(["score", "yes_no", "partial", "text"])
  responseType!: "score" | "yes_no" | "partial" | "text";

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
}

export class UpdateChecklistTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  templateName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  templateType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  category?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateChecklistTemplateItemDto)
  items?: UpdateChecklistTemplateItemDto[];
}
