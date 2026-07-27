import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PhotoMediaMaintenanceService } from "../src/modules/store-ops/application/photo-media-maintenance.service";

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const maintenance = app.get(PhotoMediaMaintenanceService);
    const rawDisposal = await maintenance.cleanupReadyRawDisposals(25, null);
    const partialCleanup = await maintenance.cleanupStalePartials(25);
    const retentionCleanup = await maintenance.cleanupExpired(25);
    const reconciliation = await maintenance.reconcile();
    const restore = await maintenance.rehearseRestore();
    process.stdout.write(`${JSON.stringify({
      event: "photo_media.maintenance.completed",
      reconciliation,
      restore,
      rawDisposal,
      partialCleanup,
      retentionCleanup,
    })}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  void error;
  process.stderr.write(`${JSON.stringify({
    event: "photo_media.maintenance.failed",
    reason: "maintenance_failed",
  })}\n`);
  process.exitCode = 1;
});
