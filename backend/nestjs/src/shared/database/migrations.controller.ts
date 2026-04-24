import { Controller, Post } from "@nestjs/common";
import { RequireRoles } from "../../modules/auth/decorators/roles.decorator";
import { RequireScope } from "../../modules/auth/decorators/scope.decorator";
import { MigrationService } from "./migration.service";

@Controller("admin/migrations")
@RequireScope("authenticated")
@RequireRoles("SUPER_ADMIN")
export class MigrationsController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post("run")
  async runMigrations() {
    return this.migrationService.runMigrations(process.cwd());
  }
}
