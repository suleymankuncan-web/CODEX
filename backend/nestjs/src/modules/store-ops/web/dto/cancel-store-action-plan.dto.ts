import { IsString } from "class-validator";

export class CancelStoreActionPlanDto {
  @IsString()
  cancelReason!: string;
}
