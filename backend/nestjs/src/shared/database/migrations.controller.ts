import { Controller, Get, NotFoundException, Post } from "@nestjs/common";
import { RequireRoles } from "../../modules/auth/decorators/roles.decorator";
import { RequireScope } from "../../modules/auth/decorators/scope.decorator";
import { AppConfigService } from "../app-config.service";
import { MigrationService } from "./migration.service";

@Controller("admin/migrations")
@RequireScope("authenticated")
@RequireRoles("SUPER_ADMIN")
export class MigrationsController {
  constructor(
    private readonly migrationService: MigrationService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Post("run")
  async runMigrations() {
    if (!this.appConfigService.httpMigrationEndpointEnabled) {
      throw new NotFoundException("Migration endpoint is disabled");
    }

    return this.migrationService.runMigrations(process.cwd());
  }

  @Get("status")
  async getMigrationStatus() {
    return this.migrationService.getMigrationStatus(process.cwd());
  }
}
