import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PhotoMediaMaintenanceService } from "../src/modules/store-ops/application/photo-media-maintenance.service";
import { AppConfigService } from "../src/shared/app-config.service";

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const maintenance = app.get(PhotoMediaMaintenanceService);
    const configuration = app.get(AppConfigService).photoMediaStorageConfiguration;
    const rawDisposal = await maintenance.cleanupReadyRawDisposals(25, null);
    const partialCleanup = await maintenance.cleanupStalePartials(25);
    let retentionCleanup: Record<string, unknown> = { status: "disabled" };
    let retentionFailed = false;
    if (configuration.scheduledRetentionCleanupEnabled) {
      try {
        const preview = await maintenance.previewRetentionPurge({
          limit: 25,
          reason: "scheduled_retention_cleanup",
          source: "scheduled",
          actorUserId: null,
        });
        retentionCleanup = await maintenance.executeRetentionPurge({
          manifestId: preview.manifestId,
          manifestDigest: preview.manifestDigest,
          actorUserId: null,
        });
      } catch {
        retentionFailed = true;
        retentionCleanup = { status: "failed", reason: "retention_cleanup_failed" };
      }
    }
    const retentionUsage = await maintenance.getRetentionUsage();
    const reconciliation = await maintenance.reconcile();
    const restore = await maintenance.rehearseRestore();
    process.stdout.write(`${JSON.stringify({
      event: retentionFailed
        ? "photo_media.maintenance.completed_with_retention_failure"
        : "photo_media.maintenance.completed",
      reconciliation,
      restore,
      rawDisposal,
      partialCleanup,
      retentionCleanup,
      retentionUsage,
    })}\n`);
    if (retentionFailed) process.exitCode = 1;
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
