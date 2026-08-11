import { Module } from "@nestjs/common";
import { OnPremDatabaseModule } from "./onprem-database.module";
import { KeycloakIdentityBinderService } from "./keycloak-identity-binder.service";

@Module({
  imports: [OnPremDatabaseModule],
  providers: [KeycloakIdentityBinderService],
  exports: [KeycloakIdentityBinderService],
})
export class KeycloakIdentityBinderModule {}
