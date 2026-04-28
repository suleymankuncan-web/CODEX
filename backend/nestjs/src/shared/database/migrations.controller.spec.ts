import { NotFoundException } from "@nestjs/common";
import { MigrationsController } from "./migrations.controller";

describe("MigrationsController", () => {
  it("runs migrations when HTTP endpoint is enabled", async () => {
    const migrationService = {
      runMigrations: jest.fn().mockResolvedValue({
        applied: ["001.sql"],
        failed: [],
        skipped: [],
      }),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: true } as never,
    );

    await expect(controller.runMigrations()).resolves.toEqual({
      applied: ["001.sql"],
      failed: [],
      skipped: [],
    });
    expect(migrationService.runMigrations).toHaveBeenCalledWith(process.cwd());
  });

  it("hides HTTP migration endpoint when disabled", async () => {
    const migrationService = {
      runMigrations: jest.fn(),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: false } as never,
    );

    await expect(controller.runMigrations()).rejects.toBeInstanceOf(NotFoundException);
    expect(migrationService.runMigrations).not.toHaveBeenCalled();
  });
});
