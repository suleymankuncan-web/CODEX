import { IsOptional, IsString } from "class-validator";

export class AcknowledgeChecklistInstanceDto {
  @IsOptional()
  @IsString()
  acknowledgementNote?: string;
}
