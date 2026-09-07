import { Module } from "@nestjs/common";
import { PersonnelCorrectionService } from "./application/personnel-correction.service";
import { PersonnelCorrectionRepository } from "./infrastructure/personnel-correction.repository";
import { PersonnelCorrectionController } from "./web/personnel-correction.controller";

@Module({
  controllers: [PersonnelCorrectionController],
  providers: [PersonnelCorrectionService, PersonnelCorrectionRepository],
})
export class StoreOpsPersonnelCorrectionModule {}
