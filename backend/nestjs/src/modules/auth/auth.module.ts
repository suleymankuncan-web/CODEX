import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthAdminRepository } from "./auth-admin.repository";
import { AuthAdminService } from "./auth-admin.service";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { AuthContextService } from "./auth-context.service";
import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";
import { AuthGuard } from "./guards/auth.guard";
import { RoleGuard } from "./guards/role.guard";
import { ScopeGuard } from "./guards/scope.guard";
import { JwtAuthProvider } from "./providers/jwt-auth.provider";
import { MockAuthProvider } from "./providers/mock-auth.provider";
import { AuthAdminController } from "./web/auth-admin.controller";

@Global()
@Module({
  controllers: [AuthAdminController],
  providers: [
    AuthAdminRepository,
    AuthAdminService,
    AuthRoleScopePolicyService,
    AuthContextService,
    AuthAuthorizationRepository,
    MockAuthProvider,
    JwtAuthProvider,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ScopeGuard,
    },
  ],
  exports: [AuthContextService, AuthAuthorizationRepository],
})
export class AuthModule {}
