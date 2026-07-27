import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  PhotoMediaActorScope,
  PhotoMediaStorageConfiguration,
  assertPhotoMediaStorageConfiguration,
  buildPhotoMediaObjectKeys,
} from "./photo-media-storage.contract";
import {
  PhotoMediaAssetRepositoryPort,
  PhotoMediaImageProcessorPort,
  PhotoMediaObjectStoragePort,
  PhotoMediaSafetyScannerPort,
} from "./photo-media-storage.ports";

export const PHOTO_MEDIA_ASSET_REPOSITORY = Symbol("PHOTO_MEDIA_ASSET_REPOSITORY");
export const PHOTO_MEDIA_PRIMARY_STORAGE = Symbol("PHOTO_MEDIA_PRIMARY_STORAGE");
export const PHOTO_MEDIA_RECOVERY_STORAGE = Symbol("PHOTO_MEDIA_RECOVERY_STORAGE");
export const PHOTO_MEDIA_IMAGE_PROCESSOR = Symbol("PHOTO_MEDIA_IMAGE_PROCESSOR");
export const PHOTO_MEDIA_SAFETY_SCANNER = Symbol("PHOTO_MEDIA_SAFETY_SCANNER");
export const PHOTO_MEDIA_STORAGE_CONFIGURATION = Symbol("PHOTO_MEDIA_STORAGE_CONFIGURATION");

@Injectable()
export class PhotoMediaStorageService {
  constructor(
    @Inject(PHOTO_MEDIA_ASSET_REPOSITORY)
    private readonly repository: PhotoMediaAssetRepositoryPort,
    @Inject(PHOTO_MEDIA_PRIMARY_STORAGE)
    private readonly primaryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_RECOVERY_STORAGE)
    private readonly recoveryStorage: PhotoMediaObjectStoragePort,
    @Inject(PHOTO_MEDIA_IMAGE_PROCESSOR)
    private readonly imageProcessor: PhotoMediaImageProcessorPort,
    @Inject(PHOTO_MEDIA_SAFETY_SCANNER)
    private readonly safetyScanner: PhotoMediaSafetyScannerPort,
    @Inject(PHOTO_MEDIA_STORAGE_CONFIGURATION)
    private readonly configuration: PhotoMediaStorageConfiguration,
  ) {
    assertPhotoMediaStorageConfiguration(configuration);
  }

  async initiateSyntheticUpload(input: {
    actorUserId: string;
    actorRoleCodes: string[];
    actorScope: PhotoMediaActorScope;
    storeId: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
    syntheticFixtureAttestation: boolean;
  }) {
    this.assertEnabled();
    if (
      !this.configuration.syntheticOnly ||
      !input.syntheticFixtureAttestation ||
      !input.actorRoleCodes.includes("SUPER_ADMIN")
    ) {
      throw new ForbiddenException("Only attested synthetic fixture uploads are authorized in PR-3");
    }
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(input.contentType)) {
      throw new BadRequestException("Photo media content type is not supported");
    }
    if (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0 || input.contentLength > 15 * 1024 * 1024) {
      throw new BadRequestException("Photo media content length is invalid");
    }
    if (input.contentBody.byteLength !== input.contentLength) {
      throw new BadRequestException("Photo media content length does not match the submitted body");
    }
    if (input.actorScope.companyIds.length === 0) {
      throw new ForbiddenException("Photo media upload requires company scope");
    }

    const mediaAssetId = randomUUID();
    let asset;
    try {
      asset = await this.repository.createInitiatedAsset({
        mediaAssetId,
        actorUserId: input.actorUserId,
        allowedCompanyIds: input.actorScope.companyIds,
        storeId: input.storeId,
        contentType: input.contentType,
        contentLength: input.contentLength,
        captureSource: "system_generated",
        quota: {
          aggregateBytesHardLimit: this.configuration.aggregateBytesHardLimit,
          monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
          monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
          lockSafetyDays: this.configuration.lockSafetyDays,
          perUserDailyBytesHardLimit: this.configuration.perUserDailyBytesHardLimit,
          perStoreDailyBytesHardLimit: this.configuration.perStoreDailyBytesHardLimit,
          concurrentProcessingHardLimit: this.configuration.concurrentProcessingHardLimit,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const reasonCode = message.includes("per-user")
        ? "storage_hard_limit"
        : message.includes("per-store")
          ? "storage_hard_limit"
          : message.includes("Class A")
            ? "class_a_hard_limit"
            : message.includes("Class B")
              ? "class_b_hard_limit"
              : message.includes("storage hard limit")
                ? "storage_hard_limit"
                : null;
      if (reasonCode) {
        await this.repository.recordQuotaDenial({
          actorUserId: input.actorUserId,
          allowedCompanyIds: input.actorScope.companyIds,
          storeId: input.storeId,
          correlationId: mediaAssetId,
          reasonCode,
        });
      }
      throw error;
    }

    let uploadLeaseToken: string | null = null;
    try {
      uploadLeaseToken = await this.repository.acquireProcessingLease({
        mediaAssetId,
        requiredState: "initiated",
        concurrentProcessingHardLimit: this.configuration.concurrentProcessingHardLimit,
      });
      const keys = buildPhotoMediaObjectKeys({ companyId: asset.companyId, mediaAssetId });
      await this.primaryStorage.putObject({
        objectKey: asset.rawObjectKey ?? keys.raw,
        body: input.contentBody,
        contentType: input.contentType,
        sha256: createHash("sha256").update(input.contentBody).digest("hex"),
      });
      await this.repository.markUploaded({
        mediaAssetId,
        actorUserId: input.actorUserId,
        byteCount: input.contentLength,
        contentType: input.contentType,
      });
      return { mediaAssetId, state: "uploaded" as const };
    } catch (error) {
      const rawObjectKey = asset.rawObjectKey ?? buildPhotoMediaObjectKeys({
        companyId: asset.companyId,
        mediaAssetId,
      }).raw;
      try {
        await this.primaryStorage.deleteObject(rawObjectKey);
        await this.repository.markRejected({
          mediaAssetId,
          actorUserId: input.actorUserId,
          reasonCode: "server_upload_failed",
        });
      } catch {
        // Preserve the reservation and initiated row when compensating cleanup cannot be proven.
      }
      throw error;
    } finally {
      if (uploadLeaseToken) {
        await this.repository.releaseProcessingLease({
          mediaAssetId, processingLeaseToken: uploadLeaseToken,
        });
      }
    }
  }

  async initiateApprovedSyntheticFixtureUpload(input: {
    actorUserId: string;
    actorScope: PhotoMediaActorScope;
    storeId: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
  }) {
    this.assertEnabled();
    if (!this.configuration.syntheticOnly) {
      throw new ForbiddenException("Real-photo processing is not authorized");
    }
    const digest = createHash("sha256").update(input.contentBody).digest("hex");
    if (!(this.configuration.syntheticFixtureSha256Allowlist ?? []).includes(digest)) {
      throw new ForbiddenException("Only an approved synthetic fixture is authorized");
    }
    return this.initiateSyntheticUpload({
      ...input,
      actorRoleCodes: ["SUPER_ADMIN"],
      syntheticFixtureAttestation: true,
    });
  }

  async createSignedRead(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorScope: PhotoMediaActorScope;
    variant: "canonical" | "thumbnail";
  }) {
    this.assertEnabled();
    const asset = await this.repository.findAssetForRead(input.mediaAssetId);
    if (!asset || asset.state !== "ready") {
      throw new NotFoundException("Photo media asset is not available");
    }
    if (!this.isInReadScope(asset, input.actorScope)) {
      throw new ForbiddenException("Photo media asset is outside actor scope");
    }

    const objectKey = input.variant === "thumbnail"
      ? asset.thumbnailObjectKey
      : asset.canonicalObjectKey;
    if (!objectKey) {
      throw new ServiceUnavailableException("Photo media object is unavailable");
    }

    await this.repository.reserveProviderOperations({
      classAOperations: 0,
      classBOperations: 1,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
    const signed = await this.primaryStorage.createSignedRead({
      objectKey,
      expiresInSeconds: this.configuration.signedReadTtlSeconds,
    });
    await this.repository.recordAccessEvent({
      actorUserId: input.actorUserId,
      mediaAssetId: asset.mediaAssetId,
      companyId: asset.companyId,
      regionId: asset.regionId,
      storeId: asset.storeId,
      variant: input.variant,
    });
    return signed;
  }

  async readContent(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorScope: PhotoMediaActorScope;
    variant: "canonical" | "thumbnail";
  }) {
    this.assertEnabled();
    const asset = await this.repository.findAssetForRead(input.mediaAssetId);
    if (!asset || asset.state !== "ready") {
      throw new NotFoundException("Photo media asset is not available");
    }
    if (!this.isInReadScope(asset, input.actorScope)) {
      throw new ForbiddenException("Photo media asset is outside actor scope");
    }
    const objectKey = input.variant === "thumbnail"
      ? asset.thumbnailObjectKey
      : asset.canonicalObjectKey;
    if (!objectKey) {
      throw new ServiceUnavailableException("Photo media object is unavailable");
    }
    await this.repository.reserveProviderOperations({
      classAOperations: 0,
      classBOperations: 1,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
    const body = await this.primaryStorage.getObject(objectKey);
    await this.repository.recordAccessEvent({
      actorUserId: input.actorUserId,
      mediaAssetId: asset.mediaAssetId,
      companyId: asset.companyId,
      regionId: asset.regionId,
      storeId: asset.storeId,
      variant: input.variant,
    });
    return { body, contentType: "image/webp" as const };
  }

  async finalizeSyntheticUpload(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorActionScope: { assignedStoreIds: string[] };
    actorRoleCodes?: string[];
    actorScope?: PhotoMediaActorScope;
  }) {
    this.assertEnabled();
    if (!this.configuration.syntheticOnly) {
      throw new ServiceUnavailableException("Real-photo processing is not authorized");
    }

    const existingAsset = await this.repository.findAssetForRead(input.mediaAssetId);
    if (!existingAsset || !["uploaded", "ready"].includes(existingAsset.state) || !existingAsset.rawObjectKey) {
      throw new BadRequestException("Photo media upload cannot be finalized");
    }
    const superAdminCompanyAccess =
      input.actorRoleCodes?.includes("SUPER_ADMIN") &&
      input.actorScope?.companyIds.includes(existingAsset.companyId);
    if (
      !superAdminCompanyAccess &&
      (!existingAsset.storeId || !input.actorActionScope.assignedStoreIds.includes(existingAsset.storeId))
    ) {
      throw new ForbiddenException("Photo media upload is outside actor action scope");
    }

    if (existingAsset.state === "ready") {
      return this.disposeFinalizedRaw(existingAsset, input.actorUserId);
    }

    const asset = await this.repository.prepareFinalizeAttempt(existingAsset.mediaAssetId);
    if (!asset.storageAttemptId) {
      throw new ServiceUnavailableException("Photo media finalize attempt identity is unavailable");
    }
    const processingLeaseToken = await this.repository.acquireProcessingLease({
      mediaAssetId: asset.mediaAssetId,
      requiredState: "uploaded",
      concurrentProcessingHardLimit: this.configuration.concurrentProcessingHardLimit,
    });

    try {
      await this.repository.reserveProviderOperations({
      classAOperations: 3,
      classBOperations: 7,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });

    const raw = await this.primaryStorage.getObject(asset.rawObjectKey!);
    const scan = await this.safetyScanner.scan(raw);
    if (scan.verdict === "unavailable") {
      throw new ServiceUnavailableException("Photo media safety scanning is temporarily unavailable");
    }
    if (scan.verdict === "unsafe") {
      await this.repository.markQuarantined({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        reasonCode: scan.reasonCode ?? `scanner_${scan.verdict}`,
      });
      throw new BadRequestException("Photo media upload did not pass safety scanning");
    }

    const processed = await this.imageProcessor.process(raw);
    await this.repository.resizeByteReservation({
      mediaAssetId: asset.mediaAssetId,
      requiredBytes: raw.byteLength + processed.canonical.byteLength * 2 + processed.thumbnail.byteLength,
      aggregateBytesHardLimit: this.configuration.aggregateBytesHardLimit,
    });
    const keys = buildPhotoMediaObjectKeys({
      companyId: asset.companyId,
      mediaAssetId: asset.mediaAssetId,
      storageAttemptId: asset.storageAttemptId,
    });
    try {
      await this.ensureImmutableObject(
        this.primaryStorage, keys.canonical, processed.canonical, processed.mimeType, processed.canonicalSha256,
      );
      await this.repository.recordVerifiedReplica({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        replicaRole: "primary",
        objectKey: keys.canonical,
        sha256: processed.canonicalSha256,
        byteCount: processed.canonical.byteLength,
      });
      await this.ensureImmutableObject(
        this.primaryStorage, keys.thumbnail, processed.thumbnail, processed.mimeType, processed.thumbnailSha256,
      );
      await this.repository.recordProviderFailure({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        eventType: "checklist_photo_evidence.storage.recovery_copy_started",
        reasonCode: null,
      });
      await this.ensureImmutableObject(
        this.recoveryStorage, keys.recovery, processed.canonical, processed.mimeType, processed.canonicalSha256,
      );
      await this.repository.recordVerifiedReplica({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        replicaRole: "recovery",
        objectKey: keys.recovery,
        sha256: processed.canonicalSha256,
        byteCount: processed.canonical.byteLength,
      });
    } catch (error) {
      await this.repository.recordProviderFailure({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        eventType: "checklist_photo_evidence.storage.provider_failed",
        reasonCode: "provider_write_failed",
      });
      throw error;
    }

    await this.repository.markReadyAfterVerifiedRecovery({
      mediaAssetId: asset.mediaAssetId,
      actorUserId: input.actorUserId,
      canonicalObjectKey: keys.canonical,
      thumbnailObjectKey: keys.thumbnail,
      recoveryObjectKey: keys.recovery,
      originalSha256: createHash("sha256").update(raw).digest("hex"),
      canonicalSha256: processed.canonicalSha256,
      canonicalByteCount: processed.canonical.byteLength,
      thumbnailByteCount: processed.thumbnail.byteLength,
      widthPx: processed.widthPx,
      heightPx: processed.heightPx,
      mimeType: processed.mimeType,
      scannerEngine: scan.engine,
      scannerSignatureVersion: scan.signatureVersion ?? null,
    });

      return this.disposeFinalizedRaw(asset, input.actorUserId);
    } finally {
      await this.repository.releaseProcessingLease({
        mediaAssetId: asset.mediaAssetId,
        processingLeaseToken,
      });
    }
  }

  async disposeSyntheticQuarantine(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorRoleCodes: string[];
    confirmed: boolean;
  }) {
    this.assertEnabled();
    if (!this.configuration.syntheticOnly || !input.confirmed || !input.actorRoleCodes.includes("SUPER_ADMIN")) {
      throw new ForbiddenException("Synthetic quarantine disposal requires explicit Super Admin confirmation");
    }
    const candidate = await this.repository.claimQuarantinedDisposal(input.mediaAssetId);
    try {
      await this.primaryStorage.deleteObject(candidate.rawObjectKey);
      await this.repository.markPartialUploadDisposed({
        mediaAssetId: candidate.mediaAssetId,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        reasonCode: "quarantine_disposed",
      });
      return { mediaAssetId: candidate.mediaAssetId, state: "rejected" as const };
    } catch (error) {
      await this.repository.recordCleanupFailure({
        mediaAssetId: candidate.mediaAssetId,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        reasonCode: "provider_delete_failed",
      });
      throw error;
    }
  }

  private assertEnabled(): void {
    if (!this.configuration.enabled) {
      throw new ServiceUnavailableException("Photo media storage is disabled");
    }
  }

  private async ensureImmutableObject(
    storage: PhotoMediaObjectStoragePort,
    objectKey: string,
    expectedBody: Buffer,
    contentType: string,
    sha256: string,
  ): Promise<void> {
    const existing = await storage.headObject(objectKey);
    if (!existing) {
      await storage.putObject({ objectKey, body: expectedBody, contentType, sha256 });
    }
    const storedBody = await storage.getObject(objectKey);
    const storedDigest = createHash("sha256").update(storedBody).digest("hex");
    if (storedBody.byteLength !== expectedBody.byteLength || storedDigest !== sha256) {
      throw new ServiceUnavailableException("Photo media immutable object integrity verification failed");
    }
  }

  private async disposeFinalizedRaw(
    asset: { mediaAssetId: string; rawObjectKey?: string; rawDisposedAt?: Date | null },
    actorUserId: string,
  ) {
    if (!asset.rawObjectKey || asset.rawDisposedAt) {
      return { mediaAssetId: asset.mediaAssetId, state: "ready" as const, rawDisposal: "verified" as const };
    }
    const candidate = await this.repository.claimReadyRawDisposal(asset.mediaAssetId);
    if (!candidate) {
      return { mediaAssetId: asset.mediaAssetId, state: "ready" as const, rawDisposal: "pending" as const };
    }
    try {
      await this.primaryStorage.deleteObject(candidate.rawObjectKey);
      await this.repository.markRawDisposed({
        mediaAssetId: asset.mediaAssetId,
        actorUserId,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
      });
      return { mediaAssetId: asset.mediaAssetId, state: "ready" as const, rawDisposal: "verified" as const };
    } catch {
      await this.repository.recordCleanupFailure({
        mediaAssetId: asset.mediaAssetId,
        cleanupLeaseToken: candidate.cleanupLeaseToken,
        reasonCode: "provider_delete_failed",
      });
      return { mediaAssetId: asset.mediaAssetId, state: "ready" as const, rawDisposal: "pending" as const };
    }
  }

  private isInReadScope(
    asset: { companyId: string; regionId: string | null; storeId: string | null },
    scope: PhotoMediaActorScope,
  ): boolean {
    return (
      scope.companyIds.includes(asset.companyId) ||
      Boolean(asset.regionId && scope.regionIds.includes(asset.regionId)) ||
      Boolean(asset.storeId && scope.storeIds.includes(asset.storeId))
    );
  }
}
