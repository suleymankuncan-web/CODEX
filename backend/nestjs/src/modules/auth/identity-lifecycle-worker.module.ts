import { Module } from "@nestjs/common";
import { IdentityLifecycleRepository } from "./identity-lifecycle.repository";
import { IdentityLifecycleWorkerService } from "./identity-lifecycle-worker.service";
import { KeycloakAdminClient } from "./keycloak-admin.client";
import { AccountSecurityRepository } from "./account-security.repository";
import { AccountSecurityWorkerService } from "./account-security-worker.service";

@Module({
  providers: [IdentityLifecycleRepository, KeycloakAdminClient, IdentityLifecycleWorkerService, AccountSecurityRepository, AccountSecurityWorkerService],
})
export class IdentityLifecycleWorkerModule {}
