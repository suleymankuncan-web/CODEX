import { IsString } from "class-validator";

export class CloseStoreActionPlanDto {
  @IsString()
  resolutionNote!: string;
}
