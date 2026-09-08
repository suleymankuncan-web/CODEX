import { Module } from "@nestjs/common";
import { IdentityLifecycleRepository } from "./identity-lifecycle.repository";
import { IdentityLifecycleWorkerService } from "./identity-lifecycle-worker.service";
import { KeycloakAdminClient } from "./keycloak-admin.client";

@Module({
  providers: [IdentityLifecycleRepository, KeycloakAdminClient, IdentityLifecycleWorkerService],
})
export class IdentityLifecycleWorkerModule {}
