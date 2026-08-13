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
  PhotoMediaObjectCreateConflictError,
  PhotoMediaObjectReference,
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
    storeId?: string;
    companyId?: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
    syntheticFixtureAttestation: boolean;
    classification?: "checklist_evidence" | "action_evidence" | "vm_reference" | "vm_campaign_evidence" | "derived_artifact";
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
    const fixtureDigest = createHash("sha256").update(input.contentBody).digest("hex");
    if (!(this.configuration.syntheticFixtureSha256Allowlist ?? []).includes(fixtureDigest)) {
      throw new ForbiddenException("Only an approved synthetic fixture is authorized");
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
        companyId: input.companyId,
        contentType: input.contentType,
        contentLength: input.contentLength,
        captureSource: "system_generated",
        classification: input.classification ?? "checklist_evidence",
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
      if (reasonCode && input.storeId) {
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
    let rawObjectVersionId: string | undefined;
    // Provider cleanup is deferred on every failure; a failed response or
    // expired lease may have allowed another worker to adopt the object.
    try {
      uploadLeaseToken = await this.repository.acquireProcessingLease({
        mediaAssetId,
        requiredState: "initiated",
        concurrentProcessingHardLimit: this.configuration.concurrentProcessingHardLimit,
      });
      const keys = buildPhotoMediaObjectKeys({ companyId: asset.companyId, mediaAssetId });
      const rawObjectKey = asset.rawObjectKey ?? keys.raw;
      const rawSha256 = createHash("sha256").update(input.contentBody).digest("hex");
      await this.reserveExactRecoveryOperations();
      const rawReference = await this.createOrRecoverExactObject(this.primaryStorage, {
        objectKey: rawObjectKey,
        body: input.contentBody,
        contentType: input.contentType,
        sha256: rawSha256,
      });
      rawObjectVersionId = rawReference.versionId;
      await this.repository.markUploaded({
        mediaAssetId,
        actorUserId: input.actorUserId,
        byteCount: input.contentLength,
        contentType: input.contentType,
        rawObjectVersionId: rawObjectVersionId ?? null,
        processingLeaseToken: uploadLeaseToken,
      });
      return { mediaAssetId, state: "uploaded" as const };
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
    storeId?: string;
    companyId?: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
    classification?: "checklist_evidence" | "action_evidence" | "vm_reference" | "vm_campaign_evidence" | "derived_artifact";
  }) {
    this.assertEnabled();
    if (!this.configuration.syntheticOnly) {
      throw new ForbiddenException("Real-photo processing is not authorized");
    }
    return this.initiateSyntheticUpload({
      ...input,
      actorRoleCodes: ["SUPER_ADMIN"],
      syntheticFixtureAttestation: true,
    });
  }

  async initiateRealVmCampaignUpload(input: {
    actorUserId: string;
    actorRoleCodes: readonly string[];
    actorScope: PhotoMediaActorScope;
    actorActionScope: { assignedStoreIds: string[] };
    storeId: string;
    companyId: string;
    contentType: string;
    contentLength: number;
    contentBody: Buffer;
    captureSource: "camera" | "gallery";
    contentPolicyAttestation: boolean;
    cohortAuthorized: boolean;
    bindInitiatedAsset?: (mediaAssetId: string) => Promise<void>;
  }) {
    this.assertEnabled();
    if (
      !input.cohortAuthorized ||
      !input.contentPolicyAttestation ||
      !input.actorRoleCodes.includes("STORE_MANAGER") ||
      !input.actorActionScope.assignedStoreIds.includes(input.storeId) ||
      !input.actorScope.companyIds.includes(input.companyId)
    ) {
      throw new ForbiddenException("Real VM campaign photo upload is outside the approved cohort");
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
    if (detectImageMimeType(input.contentBody) !== input.contentType) {
      throw new BadRequestException("Photo media declared type does not match image bytes");
    }
    const mediaAssetId = randomUUID();
    const asset = await this.repository.createInitiatedAsset({
      mediaAssetId,
      actorUserId: input.actorUserId,
      allowedCompanyIds: [input.companyId],
      storeId: input.storeId,
      companyId: input.companyId,
      contentType: input.contentType,
      contentLength: input.contentLength,
      captureSource: input.captureSource,
      classification: "vm_campaign_evidence",
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
    let uploadLeaseToken: string | null = null;
    let rawObjectVersionId: string | undefined;
    // Provider cleanup is deferred on every failure; reconciliation owns the
    // initiated row and any object left by a failed upload response.
    try {
      // The assignment/revision binding must succeed before any customer bytes reach object storage.
      // This closes the revocation race without relying on best-effort object cleanup.
      await input.bindInitiatedAsset?.(mediaAssetId);
      uploadLeaseToken = await this.repository.acquireProcessingLease({
        mediaAssetId,
        requiredState: "initiated",
        concurrentProcessingHardLimit: this.configuration.concurrentProcessingHardLimit,
      });
      // Decode under the bounded processing lease, before any bytes reach object storage.
      await this.imageProcessor.process(input.contentBody);
      const rawObjectKey = asset.rawObjectKey ?? buildPhotoMediaObjectKeys({
        companyId: asset.companyId,
        mediaAssetId,
      }).raw;
      const rawSha256 = createHash("sha256").update(input.contentBody).digest("hex");
      await this.reserveExactRecoveryOperations();
      const rawReference = await this.createOrRecoverExactObject(this.primaryStorage, {
        objectKey: rawObjectKey,
        body: input.contentBody,
        contentType: input.contentType,
        sha256: rawSha256,
      });
      rawObjectVersionId = rawReference.versionId;
      await this.repository.markUploaded({
        mediaAssetId,
        actorUserId: input.actorUserId,
        byteCount: input.contentLength,
        contentType: input.contentType,
        rawObjectVersionId: rawObjectVersionId ?? null,
        processingLeaseToken: uploadLeaseToken,
      });
      return { mediaAssetId, state: "uploaded" as const };
    } finally {
      if (uploadLeaseToken) {
        await this.repository.releaseProcessingLease({ mediaAssetId, processingLeaseToken: uploadLeaseToken });
      }
    }
  }

  async createSignedRead(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorScope: PhotoMediaActorScope;
    variant: "canonical" | "thumbnail";
    contentPath?: string;
  }) {
    this.assertEnabled();
    const asset = await this.repository.findAssetForRead(input.mediaAssetId);
    if (!asset || asset.state !== "ready") {
      throw new NotFoundException("Photo media asset is not available");
    }
    if (!this.isInReadScope(asset, input.actorScope)) {
      throw new ForbiddenException("Photo media asset is outside actor scope");
    }
    if (this.configuration.provider === "seaweedfs") {
      assertAuthenticatedPhotoMediaContentPath(input.contentPath, input.mediaAssetId, input.variant);
    }

    const objectKey = input.variant === "thumbnail"
      ? asset.thumbnailObjectKey
      : asset.canonicalObjectKey;
    if (!objectKey) {
      throw new ServiceUnavailableException("Photo media object is unavailable");
    }
    if (this.configuration.provider === "seaweedfs") {
      return {
        url: input.contentPath,
        expiresInSeconds: this.configuration.signedReadTtlSeconds,
      };
    }
    const objectReference = this.toObjectReference(
      objectKey,
      input.variant === "thumbnail" ? asset.thumbnailObjectVersionId : asset.canonicalObjectVersionId,
    );
    await this.repository.reserveProviderOperations({
      classAOperations: 0,
      classBOperations: 1,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
    const signed = await this.primaryStorage.createSignedRead({
      ...(typeof objectReference === "string" ? { objectKey: objectReference } : objectReference),
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
    const objectReference = this.toObjectReference(
      objectKey,
      input.variant === "thumbnail" ? asset.thumbnailObjectVersionId : asset.canonicalObjectVersionId,
    );
    await this.repository.reserveProviderOperations({
      classAOperations: 0,
      classBOperations: 1,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
    const body = await this.primaryStorage.getObject(objectReference);
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
    allowCompanyScopedVmReference?: boolean;
    realVmPilotAuthorized?: boolean;
  }) {
    this.assertEnabled();
    if (!input.realVmPilotAuthorized && !this.configuration.syntheticOnly) {
      throw new ServiceUnavailableException("Real-photo processing is not authorized");
    }

    const existingAsset = await this.repository.findAssetForRead(input.mediaAssetId);
    if (!existingAsset || !["uploaded", "ready"].includes(existingAsset.state) || !existingAsset.rawObjectKey) {
      throw new BadRequestException("Photo media upload cannot be finalized");
    }
    if (input.realVmPilotAuthorized && existingAsset.classification !== "vm_campaign_evidence") {
      throw new ForbiddenException("Real-photo finalization is limited to VM campaign evidence");
    }
    if (input.realVmPilotAuthorized && !["camera", "gallery"].includes(existingAsset.captureSource ?? "")) {
      throw new ForbiddenException("Real-photo finalization requires camera or gallery provenance");
    }
    const superAdminCompanyAccess =
      input.actorRoleCodes?.includes("SUPER_ADMIN") &&
      input.actorScope?.companyIds.includes(existingAsset.companyId);
    const publisherCompanyAccess = input.allowCompanyScopedVmReference === true &&
      existingAsset.classification === "vm_reference" &&
      existingAsset.storeId === null &&
      Boolean(input.actorScope?.companyIds.includes(existingAsset.companyId));
    if (
      !superAdminCompanyAccess && !publisherCompanyAccess &&
      (!existingAsset.storeId || !input.actorActionScope.assignedStoreIds.includes(existingAsset.storeId))
    ) {
      throw new ForbiddenException("Photo media upload is outside actor action scope");
    }

    if (existingAsset.state === "ready") {
      if (!existingAsset.canonicalSha256 || !/^[a-f0-9]{64}$/.test(existingAsset.canonicalSha256) || typeof existingAsset.canonicalByteCount !== "number" || !Number.isSafeInteger(existingAsset.canonicalByteCount) || existingAsset.canonicalByteCount <= 0) {
        throw new ServiceUnavailableException("Photo media canonical identity is unavailable");
      }
      return {
        ...await this.disposeFinalizedRaw(existingAsset, input.actorUserId),
        canonicalSha256: existingAsset.canonicalSha256,
        canonicalByteCount: existingAsset.canonicalByteCount!,
      };
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
      classAOperations: this.requiresObjectVersionId() ? 6 : 3,
      classBOperations: 7,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });

    const raw = await this.primaryStorage.getObject(
      this.toObjectReference(asset.rawObjectKey!, asset.rawObjectVersionId),
    );
    let assuranceEngine = "strict_image_decode_reencode";
    let assuranceVersion: string | null = null;
    if (!input.realVmPilotAuthorized) {
      const scan = await this.safetyScanner.scan(raw);
      if (scan.assurance !== this.configuration.safetyAssurance) {
        throw new ServiceUnavailableException("Photo media safety assurance does not match the configured mode");
      }
      if (scan.verdict === "unavailable") {
        throw new ServiceUnavailableException("Photo media safety scanning is temporarily unavailable");
      }
      if (scan.verdict === "unsafe") {
        await this.repository.markQuarantined({
          mediaAssetId: asset.mediaAssetId,
          actorUserId: input.actorUserId,
          reasonCode: scan.reasonCode ?? `scanner_${scan.verdict}`,
          processingLeaseToken,
        });
        throw new BadRequestException("Photo media upload did not pass safety scanning");
      }
      assuranceEngine = scan.engine;
      assuranceVersion = scan.signatureVersion ?? null;
    }
    const processed = await this.imageProcessor.process(raw);
    await this.repository.resizeByteReservation({
      mediaAssetId: asset.mediaAssetId,
      requiredBytes: raw.byteLength + processed.canonical.byteLength * 2 + processed.thumbnail.byteLength,
      aggregateBytesHardLimit: this.configuration.aggregateBytesHardLimit,
      processingLeaseToken,
    });
    const keys = buildPhotoMediaObjectKeys({
      companyId: asset.companyId,
      mediaAssetId: asset.mediaAssetId,
      storageAttemptId: asset.storageAttemptId,
    });
    const checkpoints = await this.repository.findFinalizeObjectCheckpoints(asset.mediaAssetId);
    let primaryReference: PhotoMediaObjectReference;
    let thumbnailReference: PhotoMediaObjectReference;
    try {
      primaryReference = await this.ensureImmutableObject(
        this.primaryStorage, keys.canonical, processed.canonical, processed.mimeType,
        processed.canonicalSha256, checkpoints.primary,
      );
      await this.repository.recordVerifiedReplica({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        replicaRole: "primary",
        objectKey: keys.canonical,
        objectVersionId: primaryReference.versionId ?? null,
        sha256: processed.canonicalSha256,
        byteCount: processed.canonical.byteLength,
        processingLeaseToken,
      });
      thumbnailReference = await this.ensureImmutableObject(
        this.primaryStorage, keys.thumbnail, processed.thumbnail, processed.mimeType,
        processed.thumbnailSha256,
        asset.thumbnailObjectKey === keys.thumbnail && asset.thumbnailObjectVersionId
          ? { objectKey: keys.thumbnail, versionId: asset.thumbnailObjectVersionId }
          : undefined,
      );
      await this.repository.checkpointThumbnailObject({
        mediaAssetId: asset.mediaAssetId,
        thumbnailObjectKey: keys.thumbnail,
        thumbnailObjectVersionId: thumbnailReference.versionId ?? null,
        processingLeaseToken,
      });
      await this.repository.recordProviderFailure({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        eventType: "checklist_photo_evidence.storage.recovery_copy_started",
        reasonCode: null,
      });
      const recoveryReference = await this.ensureImmutableObject(
        this.recoveryStorage, keys.recovery, processed.canonical, processed.mimeType,
        processed.canonicalSha256, checkpoints.recovery,
      );
      await this.repository.recordVerifiedReplica({
        mediaAssetId: asset.mediaAssetId,
        actorUserId: input.actorUserId,
        replicaRole: "recovery",
        objectKey: keys.recovery,
        objectVersionId: recoveryReference.versionId ?? null,
        sha256: processed.canonicalSha256,
        byteCount: processed.canonical.byteLength,
        processingLeaseToken,
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
      thumbnailObjectVersionId: thumbnailReference.versionId ?? null,
      recoveryObjectKey: keys.recovery,
      originalSha256: createHash("sha256").update(raw).digest("hex"),
      canonicalSha256: processed.canonicalSha256,
      canonicalByteCount: processed.canonical.byteLength,
      thumbnailByteCount: processed.thumbnail.byteLength,
      widthPx: processed.widthPx,
      heightPx: processed.heightPx,
      mimeType: processed.mimeType,
      scannerEngine: assuranceEngine,
      scannerSignatureVersion: assuranceVersion,
      processingLeaseToken,
    });

      return {
        ...await this.disposeFinalizedRaw(asset, input.actorUserId),
        canonicalSha256: processed.canonicalSha256,
        canonicalByteCount: processed.canonical.byteLength,
      };
    } finally {
      await this.repository.releaseProcessingLease({
        mediaAssetId: asset.mediaAssetId,
        processingLeaseToken,
      });
    }
  }

  async finalizeRealVmCampaignUpload(input: {
    mediaAssetId: string;
    actorUserId: string;
    actorActionScope: { assignedStoreIds: string[] };
    actorRoleCodes: string[];
    actorScope: PhotoMediaActorScope;
    cohortAuthorized: boolean;
  }) {
    if (!input.cohortAuthorized || !input.actorRoleCodes.includes("STORE_MANAGER")) {
      throw new ForbiddenException("Real VM campaign photo finalization is outside the approved cohort");
    }
    return this.finalizeSyntheticUpload({ ...input, realVmPilotAuthorized: true });
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
      await this.primaryStorage.deleteObject(
        this.toObjectReference(candidate.rawObjectKey, candidate.rawObjectVersionId),
      );
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
    checkpoint?: PhotoMediaObjectReference,
  ): Promise<PhotoMediaObjectReference> {
    let reference: PhotoMediaObjectReference;
    if (this.requiresObjectVersionId()) {
      if (checkpoint) {
        if (checkpoint.objectKey !== objectKey || !checkpoint.versionId) {
          throw new ServiceUnavailableException("Photo media object checkpoint conflicts with retry");
        }
        return this.verifyExactObject(storage, checkpoint, expectedBody, sha256);
      } else {
        return this.createOrRecoverExactObject(storage, {
          objectKey,
          body: expectedBody,
          contentType,
          sha256,
        });
      }
    } else {
      const existing = await storage.headObject(objectKey);
      if (existing) {
        reference = { objectKey, ...(existing.versionId ? { versionId: existing.versionId } : {}) };
      } else {
        const putResult = await storage.putObject({ objectKey, body: expectedBody, contentType, sha256 });
        const versionId = this.resolvePutVersion(putResult);
        reference = { objectKey, ...(versionId ? { versionId } : {}) };
      }
    }
    const exactReference = this.toObjectReference(reference.objectKey, reference.versionId);
    const storedBody = await storage.getObject(exactReference);
    const storedDigest = createHash("sha256").update(storedBody).digest("hex");
    if (storedBody.byteLength !== expectedBody.byteLength || storedDigest !== sha256) {
      throw new ServiceUnavailableException("Photo media immutable object integrity verification failed");
    }
    return typeof exactReference === "string" ? { objectKey: exactReference } : exactReference;
  }

  private async createOrRecoverExactObject(
    storage: PhotoMediaObjectStoragePort,
    input: { objectKey: string; body: Buffer; contentType: string; sha256: string },
  ): Promise<PhotoMediaObjectReference> {
    if (!this.requiresObjectVersionId()) {
      const putResult = await storage.putObject(input);
      const versionId = this.resolvePutVersion(putResult);
      return { objectKey: input.objectKey, ...(versionId ? { versionId } : {}) };
    }
    const inventory = await storage.listObjectVersions({ objectKey: input.objectKey });
    if (inventory.versions.length > 1) {
      throw new ServiceUnavailableException("Photo media object version recovery is ambiguous");
    }
    let reference = inventory.versions[0];
    if (!reference) {
      try {
        const putResult = await storage.putObject({ ...input, createOnly: true });
        reference = {
          objectKey: input.objectKey,
          versionId: this.resolvePutVersion(putResult),
        };
      } catch (error) {
        if (!(error instanceof PhotoMediaObjectCreateConflictError)) throw error;
        const recovered = await storage.listObjectVersions({ objectKey: input.objectKey });
        if (recovered.versions.length !== 1) {
          throw new ServiceUnavailableException("Photo media object version recovery is ambiguous");
        }
        reference = recovered.versions[0];
      }
    }
    if (reference.objectKey !== input.objectKey) {
      throw new ServiceUnavailableException("Photo media object version recovery is ambiguous");
    }
    return this.verifyExactObject(storage, reference, input.body, input.sha256);
  }

  private async verifyExactObject(
    storage: PhotoMediaObjectStoragePort,
    reference: PhotoMediaObjectReference,
    expectedBody: Buffer,
    sha256: string,
  ): Promise<PhotoMediaObjectReference> {
    if (!reference.versionId) {
      throw new ServiceUnavailableException("Photo media object version identity is unavailable");
    }
    const head = await storage.headObject(reference);
    const storedBody = await storage.getObject(reference);
    const storedDigest = createHash("sha256").update(storedBody).digest("hex");
    if (
      !head || head.byteCount !== expectedBody.byteLength || head.sha256 !== sha256 ||
      storedBody.byteLength !== expectedBody.byteLength || storedDigest !== sha256
    ) {
      throw new ServiceUnavailableException("Photo media immutable object integrity verification failed");
    }
    return reference;
  }

  private reserveExactRecoveryOperations(): Promise<void> {
    if (!this.requiresObjectVersionId()) return Promise.resolve();
    return this.repository.reserveProviderOperations({
      classAOperations: 1,
      classBOperations: 2,
      monthlyClassAHardLimit: this.configuration.monthlyClassAHardLimit,
      monthlyClassBHardLimit: this.configuration.monthlyClassBHardLimit,
    });
  }

  private resolvePutVersion(result: { versionId?: string } | undefined): string | undefined {
    const versionId = result?.versionId;
    if (this.requiresObjectVersionId() && !versionId) {
      throw new ServiceUnavailableException("Photo media object version identity is unavailable");
    }
    return versionId;
  }

  private toObjectReference(
    objectKey: string,
    versionId: string | null | undefined,
  ): string | PhotoMediaObjectReference {
    if (this.requiresObjectVersionId() && !versionId) {
      throw new ServiceUnavailableException("Photo media object version identity is unavailable");
    }
    return versionId ? { objectKey, versionId } : objectKey;
  }

  private requiresObjectVersionId(): boolean {
    return this.configuration.provider !== "r2";
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
      await this.primaryStorage.deleteObject(
        this.toObjectReference(candidate.rawObjectKey, candidate.rawObjectVersionId),
      );
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

function detectImageMimeType(body: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (body.length >= 12 && body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

const PHOTO_MEDIA_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const AUTHENTICATED_PHOTO_MEDIA_CONTENT_PATHS = [
  new RegExp(`^/api/internal/photo-media/assets/${PHOTO_MEDIA_UUID}/content/(canonical|thumbnail)$`, "i"),
  new RegExp(
    `^/api/mobile/checklists/instances/${PHOTO_MEDIA_UUID}/items/${PHOTO_MEDIA_UUID}/evidence/${PHOTO_MEDIA_UUID}/content/(canonical|thumbnail)$`,
    "i",
  ),
  new RegExp(
    `^/api/mobile/visual-campaigns/${PHOTO_MEDIA_UUID}/items/${PHOTO_MEDIA_UUID}/reference-content/(canonical|thumbnail)$`,
    "i",
  ),
];

function assertAuthenticatedPhotoMediaContentPath(
  contentPath: string | undefined,
  mediaAssetId: string,
  variant: "canonical" | "thumbnail",
): asserts contentPath is string {
  // VM routes intentionally omit mediaAssetId; assignment/reference authorization binds that route to the asset.
  const expectedVariantSuffix = `/${variant}`;
  const internalOrChecklistAssetBinding =
    contentPath?.includes(`/assets/${mediaAssetId}/content/${variant}`) ||
    contentPath?.includes(`/evidence/${mediaAssetId}/content/${variant}`);
  const vmVariantBinding = contentPath?.endsWith(`/reference-content${expectedVariantSuffix}`);
  if (
    !contentPath ||
    contentPath.includes("?") ||
    contentPath.includes("#") ||
    contentPath.includes("\\") ||
    contentPath.includes("%") ||
    Array.from(contentPath).some((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    }) ||
    !AUTHENTICATED_PHOTO_MEDIA_CONTENT_PATHS.some((pattern) => pattern.test(contentPath)) ||
    (!internalOrChecklistAssetBinding && !vmVariantBinding)
  ) {
    throw new BadRequestException("Photo media content path must be an authenticated same-origin API route");
  }
}
