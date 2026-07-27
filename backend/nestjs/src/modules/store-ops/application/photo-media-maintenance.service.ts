import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  PHOTO_MEDIA_ASSET_REPOSITORY,
  PHOTO_MEDIA_PRIMARY_STORAGE,
  PHOTO_MEDIA_RECOVERY_STORAGE,
  PHOTO_MEDIA_STORAGE_CONFIGURATION,
} from "./photo-media-storage.service";
import { PhotoMediaStorageConfiguration } from "./photo-media-storage.contract";
import {
  PhotoMediaAssetRepositoryPort,
  PhotoMediaObjectStoragePort,
} from "./photo-media-storage.ports";

type ReconciliationReceipt = {
  expectedAssetCount: number;
  missingObjectCount: number;
  mismatchObjectCount: number;
  orphanPrimaryCount: number;
  orphanRecoveryCount: number;
  manifestDigest: string;
};

@Injectable()
export class PhotoMediaMaintenanceService {
  constructor(
    @Inject(PHOTO_MEDIA_ASSET_REPOSITORY)
    private readonly repository: PhotoMediaAssetRepositoryPort,
    @Inject(PHOTO_MEDIA_PRIMARY_STORAGE)
    private readonly primaryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_RECOVERY_STORAGE)
    private readonly recoveryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_STORAGE_CONFIGURATION)
    private readonly configuration: PhotoMediaStorageConfiguration,
  ) {}

  async reconcile(): Promise<ReconciliationReceipt> {
    this.assertSyntheticMaintenanceEnabled();
    const inventory = await this.repository.listReconciliationInventory();
    const inventoryPrefixes = ["transient/", "locked/", "derived/", "rehearsals/"];
    const primaryKeys = new Set((await Promise.all(
      inventoryPrefixes.map((prefix) => this.listAll(this.primaryStorage, prefix)),
    )).flat());
    const recoveryKeys = new Set((await Promise.all(
      inventoryPrefixes.map((prefix) => this.listAll(this.recoveryStorage, prefix)),
    )).flat());
    const expectedPrimary = new Set(inventory.flatMap((item) => item.primaryObjects.map((object) => object.objectKey)));
    const expectedRecovery = new Set(inventory.flatMap((item) => item.recoveryObjects.map((object) => object.objectKey)));
    const findings: string[] = [];
    const findingEvents: Array<{ mediaAssetId: string; reasonCode: string }> = [];
    let missingObjectCount = 0;
    let mismatchObjectCount = 0;

    for (const item of inventory) {
      for (const [role, storage, objects] of [
        ["primary", this.primaryStorage, item.primaryObjects],
        ["recovery", this.recoveryStorage, item.recoveryObjects],
      ] as const) {
        for (const expected of objects) {
          await this.reserveOperations(0, 1);
          const head = await storage.headObject(expected.objectKey);
          if (!head) {
            missingObjectCount += 1;
            findings.push(`${item.mediaAssetId}:${role}:missing`);
            findingEvents.push({
              mediaAssetId: item.mediaAssetId,
              reasonCode: role === "recovery" ? "recovery_missing" : "primary_missing",
            });
          } else if (expected.sha256) {
            await this.reserveOperations(0, 1);
            const body = await storage.getObject(expected.objectKey);
            if (!this.matchesBody(body, expected.byteCount ?? body.byteLength, expected.sha256)) {
              mismatchObjectCount += 1;
              findings.push(`${item.mediaAssetId}:${role}:mismatch`);
              findingEvents.push({ mediaAssetId: item.mediaAssetId, reasonCode: "hash_mismatch" });
            }
          } else if (expected.byteCount && head.byteCount !== expected.byteCount) {
            mismatchObjectCount += 1;
            findings.push(`${item.mediaAssetId}:${role}:mismatch`);
            findingEvents.push({ mediaAssetId: item.mediaAssetId, reasonCode: "hash_mismatch" });
          }
        }
        if (objects.length === 0 && role === "recovery" && item.recoveryRequired) {
          missingObjectCount += 1;
          findings.push(`${item.mediaAssetId}:recovery:row_missing`);
          findingEvents.push({ mediaAssetId: item.mediaAssetId, reasonCode: "database_row_missing" });
        }
      }
    }

    const orphanPrimaryCount = [...primaryKeys].filter((key) => !expectedPrimary.has(key)).length;
    const orphanRecoveryCount = [...recoveryKeys].filter((key) => !expectedRecovery.has(key)).length;
    findings.push(`orphan-primary:${orphanPrimaryCount}`, `orphan-recovery:${orphanRecoveryCount}`);
    const receipt = {
      expectedAssetCount: inventory.length,
      missingObjectCount,
      mismatchObjectCount,
      orphanPrimaryCount,
      orphanRecoveryCount,
      manifestDigest: createHash("sha256").update(findings.sort().join("\n")).digest("hex"),
    };
    await this.repository.recordReconciliationReceipt({ ...receipt, findingEvents });
    if (
      missingObjectCount > 0 || mismatchObjectCount > 0 ||
      orphanPrimaryCount > 0 || orphanRecoveryCount > 0
    ) {
      throw new ServiceUnavailableException("Photo media reconciliation found integrity violations");
    }
    return receipt;
  }

  async rehearseRestore() {
    this.assertSyntheticMaintenanceEnabled();
    await this.reserveOperations(3, 2);
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const manifestDigest = createHash("sha256").update(body).digest("hex");
    const objectKey = `rehearsals/${randomUUID()}/canonical.webp`;
    const put = { objectKey, body, contentType: "image/webp", sha256: manifestDigest };
    let result: { status: "verified"; byteCount: number; manifestDigest: string } | undefined;
    let operationError: unknown;
    try {
      await this.primaryStorage.putObject(put);
      await this.recoveryStorage.putObject(put);
      const recoveryBody = await this.recoveryStorage.getObject(objectKey);
      if (!this.matchesBody(recoveryBody, body.byteLength, manifestDigest)) {
        throw new ServiceUnavailableException("Synthetic recovery copy verification failed");
      }
      await this.primaryStorage.deleteObject(objectKey);
      await this.primaryStorage.putObject({ ...put, body: recoveryBody });
      const restoredBody = await this.primaryStorage.getObject(objectKey);
      if (!this.matchesBody(restoredBody, body.byteLength, manifestDigest)) {
        throw new ServiceUnavailableException("Synthetic restore verification failed");
      }
      result = { status: "verified", byteCount: body.byteLength, manifestDigest };
    } catch (error) {
      operationError = error;
    }
    const cleanup = await Promise.allSettled([
      this.primaryStorage.deleteObject(objectKey),
      this.recoveryStorage.deleteObject(objectKey),
    ]);
    if (operationError) {
      throw operationError;
    }
    if (cleanup.some((entry) => entry.status === "rejected")) {
      throw new ServiceUnavailableException("Synthetic restore rehearsal cleanup failed");
    }
    return result!;
  }

  async cleanupExpired(limit: number) {
    this.assertSyntheticMaintenanceEnabled();
    const candidates = await this.repository.claimCleanupCandidates(this.assertBatchLimit(limit));
    let deleted = 0;
    for (const candidate of candidates) {
      try {
        for (const objectKey of candidate.primaryObjectKeys) {
          await this.primaryStorage.deleteObject(objectKey);
        }
        await this.primaryStorage.deleteObject(candidate.thumbnailObjectKey);
        for (const objectKey of candidate.recoveryObjectKeys) {
          await this.recoveryStorage.deleteObject(objectKey);
        }
        await this.repository.markDeletedTombstone({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          tombstoneSha256: candidate.canonicalSha256,
          reasonCode: "governed_cleanup",
        });
        deleted += 1;
      } catch (error) {
        await this.repository.recordCleanupFailure({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          reasonCode: "provider_delete_failed",
        });
        throw error;
      }
    }
    return { claimed: candidates.length, deleted };
  }

  async cleanupStalePartials(limit: number) {
    this.assertSyntheticMaintenanceEnabled();
    const candidates = await this.repository.claimStalePartialUploads(this.assertBatchLimit(limit));
    let deleted = 0;
    for (const candidate of candidates) {
      try {
        await this.primaryStorage.deleteObject(candidate.rawObjectKey);
        await this.repository.markPartialUploadDisposed({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          reasonCode: "partial_expired",
        });
        deleted += 1;
      } catch (error) {
        await this.repository.recordCleanupFailure({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          reasonCode: "provider_delete_failed",
        });
        throw error;
      }
    }
    return { claimed: candidates.length, deleted };
  }

  async cleanupReadyRawDisposals(limit: number, actorUserId: string | null) {
    this.assertSyntheticMaintenanceEnabled();
    const candidates = await this.repository.claimReadyRawDisposals(this.assertBatchLimit(limit));
    let deleted = 0;
    for (const candidate of candidates) {
      try {
        await this.primaryStorage.deleteObject(candidate.rawObjectKey);
        await this.repository.markRawDisposed({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          actorUserId,
        });
        deleted += 1;
      } catch (error) {
        await this.repository.recordCleanupFailure({
          mediaAssetId: candidate.mediaAssetId,
          cleanupLeaseToken: candidate.cleanupLeaseToken,
          reasonCode: "provider_delete_failed",
        });
        throw error;
      }
    }
    return { claimed: candidates.length, deleted };
  }

  async restoreAsset(input: { mediaAssetId: string; actorUserId: string }) {
    this.assertSyntheticMaintenanceEnabled();
    const candidate = await this.repository.claimRestoreCandidate(input);
    try {
      await this.reserveOperations(0, 1);
      const currentHead = await this.primaryStorage.headObject(candidate.canonicalObjectKey);
      if (currentHead) {
        await this.reserveOperations(0, 1);
        const currentBody = await this.primaryStorage.getObject(candidate.canonicalObjectKey);
        if (this.matchesBody(currentBody, candidate.canonicalByteCount, candidate.canonicalSha256)) {
          await this.repository.markRestoreSkipped({
            ...input,
            cleanupLeaseToken: candidate.cleanupLeaseToken,
          });
          return { mediaAssetId: candidate.mediaAssetId, status: "not_required" as const };
        }
      }
      await this.repository.reserveRestoreGeneration({
        mediaAssetId: candidate.mediaAssetId,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        restoreObjectKey: candidate.restoreObjectKey,
        replicaGeneration: candidate.replicaGeneration,
        canonicalSha256: candidate.canonicalSha256,
        canonicalByteCount: candidate.canonicalByteCount,
        additionalBytes: currentHead ? candidate.canonicalByteCount : 0,
        aggregateBytesHardLimit: this.configuration.aggregateBytesHardLimit,
      });
      await this.reserveOperations(1, 2);
      const recoveryBody = await this.recoveryStorage.getObject(candidate.recoveryObjectKey);
      if (!this.matchesBody(recoveryBody, candidate.canonicalByteCount, candidate.canonicalSha256)) {
        throw new ServiceUnavailableException("Photo media recovery source integrity verification failed");
      }
      await this.primaryStorage.putObject({
        objectKey: candidate.restoreObjectKey,
        body: recoveryBody,
        contentType: "image/webp",
        sha256: candidate.canonicalSha256,
      });
      const restored = await this.primaryStorage.getObject(candidate.restoreObjectKey);
      if (!this.matchesBody(restored, candidate.canonicalByteCount, candidate.canonicalSha256)) {
        throw new ServiceUnavailableException("Photo media restored primary integrity verification failed");
      }
      await this.repository.markRestoreVerified({
        ...input,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        restoreObjectKey: candidate.restoreObjectKey,
        replicaGeneration: candidate.replicaGeneration,
        previousPrimaryMissing: !currentHead,
      });
      return { mediaAssetId: candidate.mediaAssetId, status: "verified" as const };
    } catch (error) {
      await this.repository.markRestoreFailed({
        ...input,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        reasonCode: "provider_write_failed",
      });
      throw error;
    }
  }

  private async listAll(storage: PhotoMediaObjectStoragePort, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      await this.reserveOperations(1, 0);
      const page = await storage.listObjectKeys({ prefix, ...(cursor ? { cursor } : {}) });
      keys.push(...page.objectKeys);
      cursor = page.nextCursor;
    } while (cursor);
    return keys;
  }

  private matches(
    head: { byteCount: number; sha256: string } | null,
    byteCount: number,
    sha256: string,
  ): boolean {
    return Boolean(head && head.byteCount === byteCount && head.sha256 === sha256);
  }

  private matchesBody(body: Buffer, byteCount: number, sha256: string): boolean {
    return body.byteLength === byteCount && createHash("sha256").update(body).digest("hex") === sha256;
  }

  private assertBatchLimit(limit: number): number {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Photo media maintenance batch limit must be between 1 and 100");
    }
    return limit;
  }

  private assertSyntheticMaintenanceEnabled(): void {
    if (!this.configuration.enabled || !this.configuration.syntheticOnly) {
      throw new ServiceUnavailableException("Synthetic photo media maintenance is disabled");
    }
  }

  private reserveOperations(classAOperations: number, classBOperations: number): Promise<void> {
    return this.repository.reserveProviderOperations({
      classAOperations,
      classBOperations,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
  }
}
