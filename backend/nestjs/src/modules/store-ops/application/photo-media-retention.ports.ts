import {
  PhotoMediaLifecycleReconciliationSummary,
  PhotoMediaPurgeClaim,
  PhotoMediaPurgeManifestReceipt,
  PhotoMediaPurgeReason,
  PhotoMediaPurgeManifestSource,
  PhotoMediaUsageForecast,
} from "./photo-media-retention.contract";
import { PhotoMediaStorageIdentity } from "./photo-media-storage.contract";

export interface PhotoMediaRetentionRepositoryPort {
  createPurgeManifest(input: {
    limit: number;
    reason: PhotoMediaPurgeReason;
    source: PhotoMediaPurgeManifestSource;
    actorUserId: string | null;
    ttlMinutes: number;
    allowedCompanyIds?: string[];
    storageIdentity?: PhotoMediaStorageIdentity;
  }): Promise<PhotoMediaPurgeManifestReceipt>;
  claimPurgeManifest(input: {
    manifestId: string;
    manifestDigest: string;
    actorUserId: string | null;
    allowedCompanyIds?: string[];
    storageIdentity?: PhotoMediaStorageIdentity;
  }): Promise<PhotoMediaPurgeClaim>;
  markPurgeManifestCompleted(input: {
    manifestId: string;
    manifestDigest: string;
    manifestLeaseToken: string;
    actorUserId: string | null;
    storageIdentity?: PhotoMediaStorageIdentity;
  }): Promise<void>;
  markPurgeManifestRetryableFailure(input: {
    manifestId: string;
    manifestDigest: string;
    manifestLeaseToken: string;
    actorUserId: string | null;
    reasonCode: "provider_delete_failed";
  }): Promise<void>;
  releasePurgeManifestAssetLeases(input: {
    manifestId: string;
    manifestLeaseToken: string;
    storageIdentity?: PhotoMediaStorageIdentity;
  }): Promise<void>;
  getLifecycleReconciliationSummary(
    allowedCompanyIds?: string[],
    storageIdentity?: PhotoMediaStorageIdentity,
  ): Promise<PhotoMediaLifecycleReconciliationSummary>;
  getUsageForecast(allowedCompanyIds?: string[]): Promise<PhotoMediaUsageForecast>;
}
