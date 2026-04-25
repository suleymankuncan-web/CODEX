import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";

export class CreateCompetitionTeamTemplateDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  templateCode!: string;

  @IsString()
  @Length(2, 160)
  templateName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  storeIds!: string[];
}
