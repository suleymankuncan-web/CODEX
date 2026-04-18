import { IsDateString, IsIn } from "class-validator";

export class CreateSnapshotRunDto {
  @IsIn(["daily", "weekly", "monthly", "custom"])
  snapshotType!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
