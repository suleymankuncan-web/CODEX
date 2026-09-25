import { Matches } from "class-validator";

export class SendIncentiveHrDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @Matches(/^[a-f0-9]{64}$/)
  version!: string;
}
