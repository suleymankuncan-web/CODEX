import { Controller, Post } from "@nestjs/common";
import { MigrationService } from "./migration.service";

@Controller("admin/migrations")
export class MigrationsController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post("run")
  async runMigrations() {
    return this.migrationService.runMigrations(process.cwd());
  }
}
