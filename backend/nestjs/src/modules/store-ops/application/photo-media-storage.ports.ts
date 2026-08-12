import { PhotoMediaAssetRecord } from "./photo-media-storage.contract";

export type PhotoMediaSignedRequest = {
  url: string;
  expiresInSeconds: number;
};

export type PhotoMediaObjectReference = {
  objectKey: string;
  versionId?: string;
};

export type PhotoMediaObjectPutResult = {
  versionId?: string;
};

/**
 * Provider rejected an immutable create-only write because an object already
 * exists at the requested key. The error intentionally carries no object key
 * or provider version so callers cannot accidentally expose storage details.
 */
export class PhotoMediaObjectCreateConflictError extends Error {
  readonly code = "photo_media_object_create_conflict" as const;

  constructor() {
    super("Photo media immutable object create conflicted");
    this.name = "PhotoMediaObjectCreateConflictError";
  }
}

export type PhotoMediaObjectDeleteResult = {
  versionId?: string;
  deleteMarker: boolean;
};

export type PhotoMediaObjectHead = {
  byteCount: number;
  sha256: string;
  contentType?: string;
  versionId?: string;
};

export type PhotoMediaObjectInventoryPage = {
  objectKeys: string[];
  nextCursor?: string;
};

export type PhotoMediaObjectVersionInventory = {
  versions: PhotoMediaObjectReference[];
};

export interface PhotoMediaObjectStoragePort {
  createSignedRead(input: PhotoMediaObjectReference & { expiresInSeconds: number }): Promise<PhotoMediaSignedRequest>;
  getObject(objectReference: string | PhotoMediaObjectReference): Promise<Buffer>;
  putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: string;
    sha256: string;
    createOnly?: boolean;
  }): Promise<PhotoMediaObjectPutResult>;
  headObject(objectReference: string | PhotoMediaObjectReference): Promise<PhotoMediaObjectHead | null>;
  deleteObject(objectReference: string | PhotoMediaObjectReference): Promise<PhotoMediaObjectDeleteResult>;
  listObjectKeys(input: { prefix: string; cursor?: string }): Promise<PhotoMediaObjectInventoryPage>;
  listObjectVersions(input: { objectKey: string }): Promise<PhotoMediaObjectVersionInventory>;
}

export type PhotoMediaReconciliationInventoryItem = {
  mediaAssetId: string;
  recoveryRequired: boolean;
  primaryObjects: Array<{ objectKey: string; versionId?: string | null; sha256?: string; byteCount?: number }>;
  recoveryObjects: Array<{ objectKey: string; versionId?: string | null; sha256?: string; byteCount?: number }>;
};

export type PhotoMediaPartialCleanupCandidate = {
  mediaAssetId: string;
  cleanupLeaseToken: string;
  rawObjectKey: string;
  rawObjectVersionId?: string | null;
};

export type PhotoMediaFinalizeObjectCheckpoints = {
  primary?: PhotoMediaObjectReference;
  recovery?: PhotoMediaObjectReference;
};

export type PhotoMediaRestoreCandidate = {
  mediaAssetId: string;
  cleanupLeaseToken: string;
  canonicalObjectKey: string;
  recoveryObjectKey: string;
  restoreObjectKey: string;
  replicaGeneration: number;
  canonicalSha256: string;
  canonicalByteCount: number;
};

export interface PhotoMediaSafetyScannerPort {
  scan(body: Buffer): Promise<{
    verdict: "clean" | "unsafe" | "unavailable";
    engine: string;
    assurance: "fixture_identity_only" | "malware_scan";
    signatureVersion?: string;
    reasonCode?: string;
  }>;
}

export interface PhotoMediaImageProcessorPort {
  process(body: Buffer): Promise<{
    canonical: Buffer;
    thumbnail: Buffer;
    canonicalSha256: string;
    thumbnailSha256: string;
    widthPx: number;
    heightPx: number;
    mimeType: "image/webp";
  }>;
}

export interface PhotoMediaAssetRepositoryPort {
  getUsage(): Promise<{
    aggregateStoredBytes: number;
    monthlyClassAOperations: number;
    monthlyClassBOperations: number;
  }>;
  createInitiatedAsset(input: Record<string, unknown>): Promise<PhotoMediaAssetRecord>;
  findAssetForRead(mediaAssetId: string): Promise<PhotoMediaAssetRecord | null>;
  recordAccessEvent(input: Record<string, unknown>): Promise<void>;
  markQuarantined(input: Record<string, unknown>): Promise<void>;
  markRejected(input: Record<string, unknown>): Promise<void>;
  markUploaded(input: Record<string, unknown>): Promise<void>;
  prepareFinalizeAttempt(mediaAssetId: string): Promise<PhotoMediaAssetRecord>;
  findFinalizeObjectCheckpoints(mediaAssetId: string): Promise<PhotoMediaFinalizeObjectCheckpoints>;
  checkpointThumbnailObject(input: Record<string, unknown>): Promise<void>;
  acquireProcessingLease(input: Record<string, unknown>): Promise<string>;
  releaseProcessingLease(input: Record<string, unknown>): Promise<void>;
  resizeByteReservation(input: Record<string, unknown>): Promise<void>;
  recordVerifiedReplica(input: Record<string, unknown>): Promise<void>;
  markReadyAfterVerifiedRecovery(input: Record<string, unknown>): Promise<void>;
  claimReadyRawDisposal(mediaAssetId: string): Promise<PhotoMediaPartialCleanupCandidate | null>;
  claimReadyRawDisposals(limit: number): Promise<PhotoMediaPartialCleanupCandidate[]>;
  markRawDisposed(input: Record<string, unknown>): Promise<void>;
  listReconciliationInventory(allowedCompanyIds?: string[]): Promise<PhotoMediaReconciliationInventoryItem[]>;
  recordReconciliationReceipt(input: Record<string, unknown>): Promise<void>;
  markDeletedTombstone(input: Record<string, unknown>): Promise<void>;
  claimStalePartialUploads(limit: number): Promise<PhotoMediaPartialCleanupCandidate[]>;
  claimQuarantinedDisposal(mediaAssetId: string): Promise<PhotoMediaPartialCleanupCandidate>;
  markPartialUploadDisposed(input: Record<string, unknown>): Promise<void>;
  recordCleanupFailure(input: Record<string, unknown>): Promise<void>;
  claimRestoreCandidate(input: Record<string, unknown>): Promise<PhotoMediaRestoreCandidate>;
  markRestoreVerified(input: Record<string, unknown>): Promise<void>;
  markRestoreFailed(input: Record<string, unknown>): Promise<void>;
  markRestoreSkipped(input: Record<string, unknown>): Promise<void>;
  reserveRestoreGeneration(input: Record<string, unknown>): Promise<void>;
  recordProviderFailure(input: Record<string, unknown>): Promise<void>;
  recordQuotaDenial(input: Record<string, unknown>): Promise<void>;
  reserveProviderOperations(input: {
    classAOperations: number;
    classBOperations: number;
    monthlyClassAHardLimit: number;
    monthlyClassBHardLimit: number;
  }): Promise<void>;
}
