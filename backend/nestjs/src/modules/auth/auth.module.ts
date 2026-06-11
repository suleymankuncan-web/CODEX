import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AccessLifecycleRepository } from "./access-lifecycle.repository";
import { AccessLifecycleService } from "./access-lifecycle.service";
import { AuthAdminAuditRepository } from "./auth-admin-audit.repository";
import { AuthAdminLookupRepository } from "./auth-admin-lookup.repository";
import { AuthActionStoreAssignmentCommandRepository } from "./auth-action-store-assignment-command.repository";
import { AuthAdminRepository } from "./auth-admin.repository";
import { AuthAdminService } from "./auth-admin.service";
import { AuthAdminUserAccountReadRepository } from "./auth-admin-user-account-read.repository";
import { AuthRoleAssignmentCommandRepository } from "./auth-role-assignment-command.repository";
import { AuthRolePermissionCommandRepository } from "./auth-role-permission-command.repository";
import { AuthUserAccountCommandRepository } from "./auth-user-account-command.repository";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { BrowserSessionService } from "./browser-session.service";
import { AuthContextService } from "./auth-context.service";
import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";
import { AuthGuard } from "./guards/auth.guard";
import { BrowserSessionCsrfGuard } from "./guards/browser-session-csrf.guard";
import { MobileSessionGuard } from "./guards/mobile-session.guard";
import { RoleGuard } from "./guards/role.guard";
import { ScopeGuard } from "./guards/scope.guard";
import { MobileSessionRepository } from "./mobile-session.repository";
import { MobileSessionService } from "./mobile-session.service";
import { JwtAuthProvider } from "./providers/jwt-auth.provider";
import { MockAuthProvider } from "./providers/mock-auth.provider";
import { AuthAdminController } from "./web/auth-admin.controller";
import { AuthSessionController } from "./web/auth-session.controller";
import { MobileAuthController } from "./web/mobile-auth.controller";

@Global()
@Module({
  controllers: [AuthAdminController, AuthSessionController, MobileAuthController],
  providers: [
    AccessLifecycleRepository,
    AccessLifecycleService,
    AuthAdminAuditRepository,
    AuthAdminLookupRepository,
    AuthAdminUserAccountReadRepository,
    AuthActionStoreAssignmentCommandRepository,
    AuthRoleAssignmentCommandRepository,
    AuthRolePermissionCommandRepository,
    AuthUserAccountCommandRepository,
    AuthAdminRepository,
    AuthAdminService,
    AuthRoleScopePolicyService,
    BrowserSessionService,
    AuthContextService,
    AuthAuthorizationRepository,
    MobileSessionRepository,
    MobileSessionService,
    MobileSessionGuard,
    MockAuthProvider,
    JwtAuthProvider,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BrowserSessionCsrfGuard,
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
  exports: [
    AccessLifecycleRepository,
    AccessLifecycleService,
    AuthContextService,
    AuthAuthorizationRepository,
    BrowserSessionService,
  ],
})
export class AuthModule {}
