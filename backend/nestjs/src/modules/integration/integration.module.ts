import { Module } from "@nestjs/common";
import { IntegrationController } from "./web/integration.controller";
import { IntegrationService } from "./application/integration.service";
import { IntegrationRepository } from "./infrastructure/integration.repository";
import { MaterializationService } from "./application/materialization.service";
import { ExternalIdMappingService } from "./application/external-id-mapping.service";

@Module({
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    IntegrationRepository,
    MaterializationService,
    ExternalIdMappingService,
  ],
  exports: [
    IntegrationService,
    IntegrationRepository,
    MaterializationService,
    ExternalIdMappingService,
  ],
})
export class IntegrationModule {}
