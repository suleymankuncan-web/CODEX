import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
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
  PhotoMediaObjectCreateConflictError,
  PhotoMediaObjectStoragePort,
  PhotoMediaObjectReference,
} from "./photo-media-storage.ports";
import {
  PhotoMediaPurgeManifestSource,
  PhotoMediaPurgeReason,
  classifyRetentionUsage,
} from "./photo-media-retention.contract";
import { PhotoMediaRetentionRepositoryPort } from "./photo-media-retention.ports";
import { createPhotoMediaMaintenanceObjectOperations } from "./photo-media-maintenance-object-operations";

export const PHOTO_MEDIA_RETENTION_REPOSITORY = Symbol("PHOTO_MEDIA_RETENTION_REPOSITORY");
const EXECUTION_RETENTION_ERROR_CODES = new Set(["asset_held", "manifest_stale"]);

function isTypedExecutionRetentionFailure(error: unknown): error is HttpException {
  if (!(error instanceof HttpException)) return false;
  const response = error.getResponse();
  return Boolean(
    response && typeof response === "object" &&
    "code" in response && EXECUTION_RETENTION_ERROR_CODES.has(String(response.code)),
  );
}

type ReconciliationReceipt = {
  expectedAssetCount: number;
  missingObjectCount: number;
  mismatchObjectCount: number;
  orphanPrimaryCount: number;
  orphanRecoveryCount: number;
  danglingLinkCount: number;
  stuckUploadCount: number;
  stuckPurgeCount: number;
  protectedExpiryCount: number;
  tombstoneResidueCount: number;
  manifestDigest: string;
};

@Injectable()
export class PhotoMediaMaintenanceService {
  private readonly objectOperations: ReturnType<typeof createPhotoMediaMaintenanceObjectOperations>;

  constructor(
    @Inject(PHOTO_MEDIA_ASSET_REPOSITORY)
    private readonly repository: PhotoMediaAssetRepositoryPort,
    @Inject(PHOTO_MEDIA_RETENTION_REPOSITORY)
    private readonly retentionRepository: PhotoMediaRetentionRepositoryPort,
    @Inject(PHOTO_MEDIA_PRIMARY_STORAGE)
    private readonly primaryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_RECOVERY_STORAGE)
    private readonly recoveryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_STORAGE_CONFIGURATION)
    private readonly configuration: PhotoMediaStorageConfiguration,
  ) {
    this.objectOperations = createPhotoMediaMaintenanceObjectOperations({
      provider: this.configuration.provider,
      reserve: (classAOperations, classBOperations) => this.reserveOperations(classAOperations, classBOperations),
    });
  }

  async reconcile(actorScope?: { companyIds: string[] }): Promise<ReconciliationReceipt> {
    this.assertSyntheticMaintenanceEnabled();
    this.assertActorCompanyScope(actorScope);
    const allowedCompanyIds = actorScope?.companyIds;
    const inventory = await this.repository.listReconciliationInventory(allowedCompanyIds);
    for (const item of inventory) {
      for (const object of [...item.primaryObjects, ...item.recoveryObjects]) {
        this.validateReconciliationObject(object);
      }
    }
    const inventoryPrefixes = allowedCompanyIds
      ? allowedCompanyIds.flatMap((companyId) => [
        `transient/companies/${companyId}/`,
        `locked/companies/${companyId}/`,
        `derived/companies/${companyId}/`,
        `rehearsals/companies/${companyId}/`,
      ])
      : ["transient/", "locked/", "derived/", "rehearsals/"];
    const primaryInventory = await this.listReconciliationIdentities(this.primaryStorage, inventoryPrefixes);
    const recoveryInventory = await this.listReconciliationIdentities(this.recoveryStorage, inventoryPrefixes);
    const expectedPrimary = new Set(inventory.flatMap((item) => item.primaryObjects.map((object) => (
      this.reconciliationIdentity(object)
    ))));
    const expectedRecovery = new Set(inventory.flatMap((item) => item.recoveryObjects.map((object) => (
      this.reconciliationIdentity(object)
    ))));
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
          const objectReference = this.toReconciliationObjectReference(expected);
          const head = await this.objectOperations.head(storage, objectReference);
          if (!head) {
            missingObjectCount += 1;
            findings.push(`${item.mediaAssetId}:${role}:missing`);
            findingEvents.push({
              mediaAssetId: item.mediaAssetId,
              reasonCode: role === "recovery" ? "recovery_missing" : "primary_missing",
            });
          } else if (!this.matchesReconciliationHeadVersion(expected, head)) {
            mismatchObjectCount += 1;
            findings.push(`${item.mediaAssetId}:${role}:mismatch`);
            findingEvents.push({ mediaAssetId: item.mediaAssetId, reasonCode: "hash_mismatch" });
          } else if (expected.sha256) {
            const body = await this.objectOperations.get(storage, objectReference);
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

    const orphanPrimaryCount = [...primaryInventory].filter((identity) => !expectedPrimary.has(identity)).length;
    const orphanRecoveryCount = [...recoveryInventory].filter((identity) => !expectedRecovery.has(identity)).length;
    const lifecycle = await this.retentionRepository.getLifecycleReconciliationSummary(
      allowedCompanyIds,
      this.configuration,
    );
    findings.push(
      `orphan-primary:${orphanPrimaryCount}`,
      `orphan-recovery:${orphanRecoveryCount}`,
      `dangling-link:${lifecycle.danglingLinkCount}`,
      `stuck-upload:${lifecycle.stuckUploadCount}`,
      `stuck-purge:${lifecycle.stuckPurgeCount}`,
      `protected-expiry:${lifecycle.protectedExpiryCount}`,
      `tombstone-residue:${lifecycle.tombstoneResidueCount}`,
    );
    const receipt = {
      expectedAssetCount: inventory.length,
      missingObjectCount,
      mismatchObjectCount,
      orphanPrimaryCount,
      orphanRecoveryCount,
      danglingLinkCount: lifecycle.danglingLinkCount,
      stuckUploadCount: lifecycle.stuckUploadCount,
      stuckPurgeCount: lifecycle.stuckPurgeCount,
      protectedExpiryCount: lifecycle.protectedExpiryCount,
      tombstoneResidueCount: lifecycle.tombstoneResidueCount,
      manifestDigest: createHash("sha256").update(findings.sort().join("\n")).digest("hex"),
    };
    await this.repository.recordReconciliationReceipt({
      ...receipt,
      findingEvents: [...findingEvents, ...lifecycle.findingEvents],
    });
    if (
      missingObjectCount > 0 || mismatchObjectCount > 0 ||
      orphanPrimaryCount > 0 || orphanRecoveryCount > 0 ||
      lifecycle.danglingLinkCount > 0 || lifecycle.stuckUploadCount > 0 ||
      lifecycle.stuckPurgeCount > 0 || lifecycle.tombstoneResidueCount > 0
    ) {
      throw new ServiceUnavailableException("Photo media reconciliation found integrity violations");
    }
    return receipt;
  }

  async rehearseRestore() {
    this.assertSyntheticMaintenanceEnabled();
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const manifestDigest = createHash("sha256").update(body).digest("hex");
    const objectKey = `rehearsals/${randomUUID()}/canonical.webp`;
    let result: { status: "verified"; byteCount: number; manifestDigest: string } | undefined;
    let operationError: unknown;
    let originalPrimary: PhotoMediaObjectReference | undefined;
    let recoveryReference: PhotoMediaObjectReference | undefined;
    let restoredPrimary: PhotoMediaObjectReference | undefined;
    let originalPrimaryDeleted = false;
    try {
      originalPrimary = await this.ensureRestoreObject({
        storage: this.primaryStorage,
        objectKey,
        body,
        contentType: "image/webp",
        sha256: manifestDigest,
        cleanupOnVerificationFailure: true,
      });
      recoveryReference = await this.ensureRestoreObject({
        storage: this.recoveryStorage,
        objectKey,
        body,
        contentType: "image/webp",
        sha256: manifestDigest,
        cleanupOnVerificationFailure: true,
      });
      const recoveryBody = await this.objectOperations.get(this.recoveryStorage, recoveryReference);
      if (!this.matchesBody(recoveryBody, body.byteLength, manifestDigest)) {
        throw new ServiceUnavailableException("Synthetic recovery copy verification failed");
      }
      await this.objectOperations.delete(this.primaryStorage, originalPrimary);
      originalPrimaryDeleted = true;
      restoredPrimary = await this.ensureRestoreObject({
        storage: this.primaryStorage,
        objectKey,
        body: recoveryBody,
        contentType: "image/webp",
        sha256: manifestDigest,
        cleanupOnVerificationFailure: true,
      });
      result = { status: "verified", byteCount: body.byteLength, manifestDigest };
    } catch (error) {
      operationError = error;
    }
    const cleanup = await Promise.allSettled([
      ...(restoredPrimary ? [this.objectOperations.delete(this.primaryStorage, restoredPrimary)] : []),
      ...(recoveryReference ? [this.objectOperations.delete(this.recoveryStorage, recoveryReference)] : []),
      ...(originalPrimary && !originalPrimaryDeleted
        ? [this.objectOperations.delete(this.primaryStorage, originalPrimary)]
        : []),
    ]);
    if (operationError) {
      throw operationError;
    }
    if (cleanup.some((entry) => entry.status === "rejected")) {
      throw new ServiceUnavailableException("Synthetic restore rehearsal cleanup failed");
    }
    return result!;
  }

  async previewRetentionPurge(input: {
    limit: number;
    reason: PhotoMediaPurgeReason;
    source: PhotoMediaPurgeManifestSource;
    actorUserId: string | null;
    actorScope?: { companyIds: string[] };
  }) {
    this.assertSyntheticMaintenanceEnabled();
    this.assertActorCompanyScope(input.actorScope);
    const expectedReason = input.source === "scheduled"
      ? "scheduled_retention_cleanup"
      : "manual_retention_cleanup";
    if (input.reason !== expectedReason) {
      throw new BadRequestException({
        code: "manifest_reason_invalid",
        message: "Photo media purge preview reason does not match its source",
      });
    }
    return this.retentionRepository.createPurgeManifest({
      ...input,
      reason: input.reason,
      limit: this.assertBatchLimit(input.limit),
      ttlMinutes: this.configuration.retentionManifestTtlMinutes ?? 60,
      allowedCompanyIds: input.actorScope?.companyIds,
      storageIdentity: this.configuration,
    });
  }

  async executeRetentionPurge(input: {
    manifestId: string;
    manifestDigest: string;
    actorUserId: string | null;
    actorScope?: { companyIds: string[] };
  }) {
    this.assertSyntheticMaintenanceEnabled();
    this.assertActorCompanyScope(input.actorScope);
    if (!this.configuration.scheduledRetentionCleanupEnabled) {
      throw new ServiceUnavailableException({
        code: "cleanup_disabled",
        message: "Photo media retention cleanup is disabled",
      });
    }
    if (!/^[a-f0-9]{64}$/.test(input.manifestDigest)) {
      throw new BadRequestException({
        code: "manifest_digest_mismatch",
        message: "Photo media purge manifest digest is invalid",
      });
    }
    const claim = await this.retentionRepository.claimPurgeManifest({
      ...input,
      allowedCompanyIds: input.actorScope?.companyIds,
      storageIdentity: this.configuration,
    });
    let deleted = 0;
    try {
      for (const candidate of claim.candidates) {
        try {
          const primaryObjects = candidate.primaryObjects.map((object) =>
            this.toPurgeObjectReference(object),
          );
          const thumbnailObject = this.toPurgeObjectReference(candidate.thumbnailObject);
          const recoveryObjects = candidate.recoveryObjects.map((object) =>
            this.toPurgeObjectReference(object),
          );
          for (const object of primaryObjects) {
            await this.objectOperations.delete(this.primaryStorage, object);
          }
          await this.objectOperations.delete(this.primaryStorage, thumbnailObject);
          for (const object of recoveryObjects) {
            await this.objectOperations.delete(this.recoveryStorage, object);
          }
          await this.repository.markDeletedTombstone({
            mediaAssetId: candidate.mediaAssetId,
            cleanupLeaseToken: candidate.cleanupLeaseToken,
            purgeManifestId: input.manifestId,
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
      await this.retentionRepository.markPurgeManifestCompleted({
        ...input,
        manifestLeaseToken: claim.manifestLeaseToken,
        storageIdentity: this.configuration,
      });
      return {
        manifestId: claim.manifestId,
        manifestDigest: claim.manifestDigest,
        claimedCount: claim.candidates.length,
        deletedCount: deleted,
        status: "completed" as const,
      };
    } catch (error) {
      try {
        await this.retentionRepository.releasePurgeManifestAssetLeases({
          manifestId: input.manifestId,
          manifestLeaseToken: claim.manifestLeaseToken,
          storageIdentity: this.configuration,
        });
        await this.retentionRepository.markPurgeManifestRetryableFailure({
          ...input,
          manifestLeaseToken: claim.manifestLeaseToken,
          reasonCode: "provider_delete_failed",
        });
      } catch {
        // Preserve the original provider/tombstone failure; stale receipt
        // handling is independently observable and must not mask it.
      }
      if (isTypedExecutionRetentionFailure(error)) throw error;
      throw new ServiceUnavailableException({
        code: "provider_delete_failed",
        message: "Photo media provider deletion failed",
      });
    }
  }

  async getRetentionUsage(actorScope?: { companyIds: string[] }) {
    this.assertSyntheticMaintenanceEnabled();
    this.assertActorCompanyScope(actorScope);
    const usage = await this.retentionRepository.getUsageForecast(actorScope?.companyIds);
    const warningPercent = this.configuration.retentionWarningPercent ?? 70;
    const criticalPercent = this.configuration.retentionCriticalPercent ?? 85;
    const alerts = [
      { dimension: "bytes" as const, used: usage.currentBytes, limit: this.configuration.aggregateBytesHardLimit },
      { dimension: "class_a" as const, used: usage.classAOperations, limit: this.configuration.monthlyClassAHardLimit },
      { dimension: "class_b" as const, used: usage.classBOperations, limit: this.configuration.monthlyClassBHardLimit },
    ].map((item) => ({
      ...item,
      state: classifyRetentionUsage({
        used: item.used,
        limit: item.limit,
        warningPercent,
        criticalPercent,
      }),
    }));
    return {
      current: {
        bytes: usage.currentBytes,
        classAOperations: usage.classAOperations,
        classBOperations: usage.classBOperations,
      },
      recentGrowthBytes: usage.recentGrowthBytes,
      projectedThirtyDayBytes: usage.projectedThirtyDayBytes,
      classifications: usage.classifications,
      lifecycle: {
        purgeEligibleCount: usage.purgeEligibleCount,
        protectedExpiredCount: usage.protectedExpiredCount,
        stuckUploadCount: usage.stuckUploadCount,
        stuckPurgeCount: usage.stuckPurgeCount,
        cleanupFailureCount: usage.cleanupFailureCount,
      },
      alerts,
    };
  }

  async cleanupStalePartials(limit: number) {
    this.assertSyntheticMaintenanceEnabled();
    const candidates = await this.repository.claimStalePartialUploads(this.assertBatchLimit(limit));
    let deleted = 0;
    for (const candidate of candidates) {
      try {
        const objectReference = await this.resolveCleanupObjectReference(
          candidate.rawObjectKey,
          candidate.rawObjectVersionId,
        );
        if (objectReference) {
          await this.objectOperations.delete(this.primaryStorage, objectReference);
        }
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
        const objectReference = await this.resolveCleanupObjectReference(
          candidate.rawObjectKey,
          candidate.rawObjectVersionId,
        );
        if (objectReference) {
          await this.objectOperations.delete(this.primaryStorage, objectReference);
        }
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
      const currentPrimary = this.configuration.provider === "r2"
        ? this.toRestoreObjectReference(candidate.canonicalObjectKey, candidate.canonicalObjectVersionId, false)
        : candidate.canonicalObjectKey === null || candidate.canonicalObjectKey === undefined
          ? candidate.canonicalObjectVersionId === null || candidate.canonicalObjectVersionId === undefined
            ? null
            : this.toRestoreObjectReference(candidate.canonicalObjectKey, candidate.canonicalObjectVersionId, true)
          : this.toRestoreObjectReference(candidate.canonicalObjectKey, candidate.canonicalObjectVersionId, true);
      const currentHead = currentPrimary
        ? await this.objectOperations.head(this.primaryStorage, currentPrimary)
        : null;
      if (currentHead) {
        const currentBody = await this.objectOperations.get(this.primaryStorage, currentPrimary!);
        const exactPrimaryProof = this.matchesBody(currentBody, candidate.canonicalByteCount, candidate.canonicalSha256) &&
          this.matchesRestoreHeadVersion(currentPrimary!, currentHead);
        if (exactPrimaryProof) {
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
      const recoveryReference = this.toRestoreObjectReference(
        candidate.recoveryObjectKey,
        candidate.recoveryObjectVersionId,
        true,
      );
      if (!recoveryReference) {
        throw new ServiceUnavailableException("Photo media recovery object identity is unavailable");
      }
      const recoveryBody = await this.objectOperations.get(this.recoveryStorage, recoveryReference);
      if (!this.matchesBody(recoveryBody, candidate.canonicalByteCount, candidate.canonicalSha256)) {
        throw new ServiceUnavailableException("Photo media recovery source integrity verification failed");
      }
      const restoredReference = await this.ensureRestoreObject({
        storage: this.primaryStorage,
        objectKey: candidate.restoreObjectKey,
        body: recoveryBody,
        contentType: "image/webp",
        sha256: candidate.canonicalSha256,
        versionId: candidate.restoreObjectVersionId,
      });
      await this.repository.checkpointRestoreObjectVersion({
        ...input,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        restoreObjectKey: candidate.restoreObjectKey,
        restoreObjectVersionId: restoredReference.versionId ?? null,
        replicaGeneration: candidate.replicaGeneration,
        canonicalSha256: candidate.canonicalSha256,
        canonicalByteCount: candidate.canonicalByteCount,
      });
      await this.repository.markRestoreVerified({
        ...input,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        restoreObjectKey: candidate.restoreObjectKey,
        restoreObjectVersionId: restoredReference.versionId ?? null,
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

  private async listReconciliationIdentities(
    storage: PhotoMediaObjectStoragePort,
    prefixes: string[],
  ): Promise<Set<string>> {
    if (this.configuration.provider === "r2") {
      return new Set((await Promise.all(prefixes.map((prefix) => this.listAll(storage, prefix)))).flat());
    }
    if (typeof storage.listObjectVersionsByPrefix !== "function") {
      throw new ServiceUnavailableException("Photo media reconciliation provider version inventory is unavailable");
    }
    const identities = new Set<string>();
    for (const prefix of prefixes) {
      let cursor: { keyMarker?: string; versionIdMarker?: string } | undefined;
      do {
        await this.reserveOperations(1, 0);
        const page = await storage.listObjectVersionsByPrefix({ prefix, ...(cursor ? { cursor } : {}) });
        if (!page || !Array.isArray(page.versions) || !Array.isArray(page.deleteMarkers)) {
          throw new ServiceUnavailableException("Photo media reconciliation provider inventory is unavailable");
        }
        for (const version of page.versions) {
          this.validateReconciliationObject(version);
          identities.add(this.reconciliationIdentity(version));
        }
        for (const marker of page.deleteMarkers) {
          this.validateReconciliationObject(marker);
          identities.add(`${this.reconciliationIdentity(marker)}\u0000delete-marker`);
        }
        cursor = page.nextCursor;
        if (cursor && (!cursor.keyMarker || !cursor.versionIdMarker)) {
          throw new ServiceUnavailableException("Photo media reconciliation provider inventory is ambiguous");
        }
      } while (cursor);
    }
    return identities;
  }

  private validateReconciliationObject(object: {
    objectKey: string;
    versionId?: string | null;
  }): void {
    if (!object || typeof object.objectKey !== "string" || object.objectKey.trim() === "") {
      throw new ServiceUnavailableException("Photo media reconciliation object identity is unavailable");
    }
    if (
      object.versionId !== null && object.versionId !== undefined &&
      (typeof object.versionId !== "string" || object.versionId.trim() === "")
    ) {
      throw new ServiceUnavailableException("Photo media reconciliation object version identity is unavailable");
    }
    if (
      this.configuration.provider !== "r2" &&
      (typeof object.versionId !== "string" || object.versionId.trim() === "")
    ) {
      throw new ServiceUnavailableException("Photo media reconciliation object version identity is unavailable");
    }
  }

  private reconciliationIdentity(object: { objectKey: string; versionId?: string | null }): string {
    return this.configuration.provider === "r2"
      ? object.objectKey
      : `${object.objectKey}\u0000${object.versionId}`;
  }

  private toReconciliationObjectReference(object: {
    objectKey: string;
    versionId?: string | null;
  }): string | PhotoMediaObjectReference {
    this.validateReconciliationObject(object);
    if (this.configuration.provider === "r2" && (object.versionId === null || object.versionId === undefined)) {
      return object.objectKey;
    }
    return { objectKey: object.objectKey, versionId: object.versionId as string };
  }

  private matchesReconciliationHeadVersion(
    expected: { versionId?: string | null },
    head: { versionId?: string },
  ): boolean {
    if (this.configuration.provider === "r2") return true;
    return typeof expected.versionId === "string" && head.versionId === expected.versionId;
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

  private async resolveCleanupObjectReference(
    objectKey: string,
    objectVersionId: string | null | undefined,
  ): Promise<string | PhotoMediaObjectReference | null> {
    if (this.configuration.provider === "r2") {
      return objectVersionId ? { objectKey, versionId: objectVersionId } : objectKey;
    }
    if (objectVersionId !== null && objectVersionId !== undefined) {
      if (typeof objectVersionId !== "string" || objectVersionId.trim() === "") {
        throw new ServiceUnavailableException("Photo media cleanup object version identity is unavailable");
      }
      return { objectKey, versionId: objectVersionId };
    }
    const inventory = await this.objectOperations.listVersions(this.primaryStorage, { objectKey });
    if (inventory.versions.length > 1) {
      throw new ServiceUnavailableException("Photo media cleanup object version recovery is ambiguous");
    }
    if (inventory.versions.length === 0) {
      return null;
    }
    const reference = inventory.versions[0];
    if (
      reference.objectKey !== objectKey ||
      typeof reference.versionId !== "string" ||
      reference.versionId.trim() === ""
    ) {
      throw new ServiceUnavailableException("Photo media cleanup object version recovery is ambiguous");
    }
    return { objectKey, versionId: reference.versionId };
  }

  private toPurgeObjectReference(reference: PhotoMediaObjectReference): string | PhotoMediaObjectReference {
    if (
      !reference ||
      typeof reference.objectKey !== "string" ||
      reference.objectKey.trim() === ""
    ) {
      throw new ServiceUnavailableException("Photo media purge object identity is unavailable");
    }
    if (this.configuration.provider === "r2") {
      if (reference.versionId === undefined || reference.versionId === null) {
        return reference.objectKey;
      }
      if (typeof reference.versionId !== "string" || reference.versionId.trim() === "") {
        throw new ServiceUnavailableException("Photo media purge object identity is unavailable");
      }
      return reference;
    }
    if (typeof reference.versionId !== "string" || reference.versionId.trim() === "") {
      throw new ServiceUnavailableException("Photo media purge object version identity is unavailable");
    }
    return reference;
  }

  private toRestoreObjectReference(
    objectKey: string | null | undefined,
    objectVersionId: string | null | undefined,
    requireVersion: boolean,
  ): string | PhotoMediaObjectReference | null {
    if (typeof objectKey !== "string" || objectKey.trim() === "") {
      if (!requireVersion && (objectKey === null || objectKey === undefined)) return null;
      throw new ServiceUnavailableException("Photo media restore object identity is unavailable");
    }
    if (
      objectVersionId !== null && objectVersionId !== undefined &&
      (typeof objectVersionId !== "string" || objectVersionId.trim() === "")
    ) {
      throw new ServiceUnavailableException("Photo media restore object version identity is unavailable");
    }
    if (
      this.configuration.provider !== "r2" &&
      (typeof objectVersionId !== "string" || objectVersionId.trim() === "")
    ) {
      if (!requireVersion) return null;
      throw new ServiceUnavailableException("Photo media restore object version identity is unavailable");
    }
    return objectVersionId ? { objectKey, versionId: objectVersionId } : objectKey;
  }

  private matchesRestoreHeadVersion(
    reference: string | PhotoMediaObjectReference,
    head: { versionId?: string } | null,
  ): boolean {
    if (this.configuration.provider === "r2") return true;
    return typeof reference !== "string" && head?.versionId === reference.versionId;
  }

  private async ensureRestoreObject(input: {
    storage: PhotoMediaObjectStoragePort;
    objectKey: string;
    body: Buffer;
    contentType: string;
    sha256: string;
    versionId?: string | null;
    cleanupOnVerificationFailure?: boolean;
  }): Promise<PhotoMediaObjectReference> {
    if (this.configuration.provider === "r2") {
      if (input.versionId !== null && input.versionId !== undefined) {
        const reference = this.toRestoreObjectReference(input.objectKey, input.versionId, false);
        if (!reference || typeof reference === "string") {
          throw new ServiceUnavailableException("Photo media restore object version identity is unavailable");
        }
        await this.verifyRestoreObject(input.storage, reference, input.body, input.sha256, false);
        return reference;
      }
      const putResult = await this.objectOperations.put(input.storage, {
        objectKey: input.objectKey,
        body: input.body,
        contentType: input.contentType,
        sha256: input.sha256,
      });
      const reference = this.toRestoreObjectReference(input.objectKey, putResult?.versionId, false);
      if (!reference) throw new ServiceUnavailableException("Photo media restore object identity is unavailable");
      const exactReference = typeof reference === "string" ? { objectKey: reference } : reference;
      try {
        await this.verifyRestoreObject(input.storage, exactReference, input.body, input.sha256, false);
      } catch (error) {
        if (input.cleanupOnVerificationFailure) {
          try {
            await this.objectOperations.delete(input.storage, exactReference);
          } catch {
            // Preserve the original verification failure; cleanup remains observable to maintenance.
          }
        }
        throw error;
      }
      return exactReference;
    }
    if (input.versionId !== null && input.versionId !== undefined) {
      const reference = this.toRestoreObjectReference(input.objectKey, input.versionId, true);
      if (!reference || typeof reference === "string") {
        throw new ServiceUnavailableException("Photo media restore object version identity is unavailable");
      }
      await this.verifyRestoreObject(input.storage, reference, input.body, input.sha256, true);
      return reference;
    }
    const inventory = await this.objectOperations.listVersions(input.storage, { objectKey: input.objectKey });
    if (inventory.versions.length > 1) {
      throw new ServiceUnavailableException("Photo media restore object version recovery is ambiguous");
    }
    let reference = inventory.versions[0];
    let freshlyPut = false;
    if (!reference) {
      try {
        const putResult = await this.objectOperations.put(input.storage, {
          objectKey: input.objectKey,
          body: input.body,
          contentType: input.contentType,
          sha256: input.sha256,
          createOnly: true,
        });
        reference = {
          objectKey: input.objectKey,
          versionId: putResult?.versionId,
        };
        freshlyPut = true;
      } catch (error) {
        if (!(error instanceof PhotoMediaObjectCreateConflictError)) throw error;
        const recovered = await this.objectOperations.listVersions(input.storage, { objectKey: input.objectKey });
        if (recovered.versions.length !== 1) {
          throw new ServiceUnavailableException("Photo media restore object version recovery is ambiguous");
        }
        reference = recovered.versions[0];
      }
    }
    if (
      reference.objectKey !== input.objectKey ||
      typeof reference.versionId !== "string" ||
      reference.versionId.trim() === ""
    ) {
      throw new ServiceUnavailableException("Photo media restore object version identity is unavailable");
    }
    try {
      await this.verifyRestoreObject(input.storage, reference, input.body, input.sha256, true);
    } catch (error) {
      if (input.cleanupOnVerificationFailure && freshlyPut) {
        try {
          await this.objectOperations.delete(input.storage, reference);
        } catch {
          // Preserve the original verification failure; never fall back to key-only cleanup.
        }
      }
      throw error;
    }
    return reference;
  }

  private async verifyRestoreObject(
    storage: PhotoMediaObjectStoragePort,
    reference: PhotoMediaObjectReference,
    expectedBody: Buffer,
    sha256: string,
    requireHead: boolean,
  ): Promise<void> {
    const head = requireHead ? await this.objectOperations.head(storage, reference) : null;
    const body = await this.objectOperations.get(storage, reference);
    if (
      (requireHead && (
        !head ||
        head.byteCount !== expectedBody.byteLength ||
        head.sha256 !== sha256 ||
        !this.matchesRestoreHeadVersion(reference, head)
      )) ||
      !this.matchesBody(body, expectedBody.byteLength, sha256)
    ) {
      throw new ServiceUnavailableException("Photo media restored primary integrity verification failed");
    }
  }

  private assertSyntheticMaintenanceEnabled(): void {
    if (!this.configuration.enabled || !this.configuration.syntheticOnly) {
      throw new ServiceUnavailableException("Synthetic photo media maintenance is disabled");
    }
  }

  private assertActorCompanyScope(actorScope?: { companyIds: string[] }): void {
    if (actorScope && actorScope.companyIds.length === 0) {
      throw new ForbiddenException("Photo media maintenance requires company scope");
    }
  }

  private reserveOperations(a: number, b: number, enforceHardLimits = true): Promise<void> { return this.repository.reserveProviderOperations({ classAOperations: a, classBOperations: b, monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit, monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit, enforceHardLimits }); }
}
