import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException } from "@nestjs/common";
import {
  PhotoMediaObjectDeleteResult,
  PhotoMediaObjectCreateConflictError,
  PhotoMediaObjectReference,
  PhotoMediaObjectStoragePort,
  PhotoMediaObjectPutResult,
  PhotoMediaObjectVersionInventory,
  PhotoMediaObjectVersionInventoryCursor,
  PhotoMediaObjectVersionInventoryPage,
} from "../application/photo-media-storage.ports";

const SAFE_OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
type Signer = (client: S3Client, command: object, options: { expiresIn: number }) => Promise<string>;

export type S3CompatiblePhotoMediaObjectStorageConfiguration = {
  bucket: string;
  endpoint: string;
  region: string;
  forcePathStyle: true;
  requireObjectVersionId?: boolean;
  lockedObjectRetentionDays?: number;
  credentials: { accessKeyId: string; secretAccessKey: string };
};

export type S3CompatiblePhotoMediaObjectStorageClientConfiguration = Pick<
  S3CompatiblePhotoMediaObjectStorageConfiguration,
  "endpoint" | "region" | "forcePathStyle" | "credentials"
>;

export function buildS3CompatiblePhotoMediaObjectStorageClientConfiguration(
  configuration: S3CompatiblePhotoMediaObjectStorageClientConfiguration,
): S3CompatiblePhotoMediaObjectStorageClientConfiguration {
  return {
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: configuration.forcePathStyle,
    credentials: configuration.credentials,
  };
}

export class S3CompatiblePhotoMediaObjectStorage implements PhotoMediaObjectStoragePort {
  private readonly client: S3Client;
  private readonly signer: Signer;
  private readonly requireObjectVersionId: boolean;
  private readonly lockedObjectRetentionDays?: number;
  private readonly now: () => Date;

  constructor(
    private readonly configuration: S3CompatiblePhotoMediaObjectStorageConfiguration,
    client?: S3Client,
    signer?: Signer,
    now: () => Date = () => new Date(),
  ) {
    this.requireObjectVersionId = configuration.requireObjectVersionId === true;
    this.lockedObjectRetentionDays = configuration.lockedObjectRetentionDays;
    this.now = now;
    this.client = client ?? new S3Client(
      buildS3CompatiblePhotoMediaObjectStorageClientConfiguration(configuration),
    );
    this.signer = signer ?? (getSignedUrl as Signer);
  }

  async createSignedRead(
    input: PhotoMediaObjectReference & { expiresInSeconds: number },
  ) {
    const { objectKey, versionId } = this.resolveObjectReference(input);
    this.assertObjectKey(objectKey);
    const command = new GetObjectCommand({
      Bucket: this.configuration.bucket,
      Key: objectKey,
      ...(versionId !== undefined ? { VersionId: versionId } : {}),
    });
    const url = await this.signer(this.client, command, { expiresIn: input.expiresInSeconds });
    return { url, expiresInSeconds: input.expiresInSeconds };
  }

  async getObject(objectReference: string | PhotoMediaObjectReference): Promise<Buffer> {
    const { objectKey, versionId } = this.resolveObjectReference(objectReference);
    this.assertObjectKey(objectKey);
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.configuration.bucket,
      Key: objectKey,
      ...(versionId !== undefined ? { VersionId: versionId } : {}),
    }));
    const providerVersionId = this.validateVersionId(
      result.VersionId,
      new Error("Photo media provider returned an invalid object version identity"),
    );
    this.assertExactProviderVersion(versionId, providerVersionId);
    if (!result.Body) {
      throw new Error("Photo media object body is missing");
    }
    if (typeof result.Body.transformToByteArray === "function") {
      return Buffer.from(await result.Body.transformToByteArray());
    }
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: string;
    sha256: string;
    createOnly?: boolean;
  }): Promise<PhotoMediaObjectPutResult> {
    this.assertObjectKey(input.objectKey);
    const objectLock = this.resolveLockedObjectRetention(input.objectKey);
    let result;
    try {
      result = await this.client.send(new PutObjectCommand({
        Bucket: this.configuration.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentLength: input.body.byteLength,
        ContentType: input.contentType,
        Metadata: { sha256: input.sha256 },
        ...(input.createOnly ? { IfNoneMatch: "*" } : {}),
        ...(objectLock ?? {}),
      }));
    } catch (error) {
      if (input.createOnly && isCreateOnlyConflict(error)) {
        throw new PhotoMediaObjectCreateConflictError();
      }
      throw error;
    }
    const versionId = this.validateVersionId(
      result.VersionId,
      new Error("Photo media provider returned an invalid object version identity"),
    );
    this.assertProviderVersion(versionId);
    return versionId === undefined ? {} : { versionId };
  }

  private resolveLockedObjectRetention(objectKey: string): {
    ObjectLockMode: "COMPLIANCE";
    ObjectLockRetainUntilDate: Date;
  } | undefined {
    if (!this.requireObjectVersionId || !objectKey.startsWith("locked/")) {
      return undefined;
    }
    if (this.lockedObjectRetentionDays !== 30) {
      throw new Error("Photo media locked object retention is not configured for exactly 30 days");
    }
    const now = this.now();
    const nowMilliseconds = now instanceof Date ? now.getTime() : Number.NaN;
    if (!Number.isFinite(nowMilliseconds)) {
      throw new Error("Photo media locked object retention clock is invalid");
    }
    return {
      ObjectLockMode: "COMPLIANCE",
      ObjectLockRetainUntilDate: new Date(nowMilliseconds + 30 * 24 * 60 * 60 * 1000),
    };
  }

  async headObject(objectReference: string | PhotoMediaObjectReference) {
    const { objectKey, versionId } = this.resolveObjectReference(objectReference);
    this.assertObjectKey(objectKey);
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.configuration.bucket,
        Key: objectKey,
        ...(versionId !== undefined ? { VersionId: versionId } : {}),
      }));
      const providerVersionId = this.validateVersionId(
        result.VersionId,
        new Error("Photo media provider returned an invalid object version identity"),
      );
      this.assertProviderVersion(providerVersionId);
      this.assertExactProviderVersion(versionId, providerVersionId);
      const sha256 = result.Metadata?.sha256;
      if (result.ContentLength === undefined || !sha256) {
        return null;
      }
      return {
        byteCount: result.ContentLength,
        sha256,
        ...(result.ContentType ? { contentType: result.ContentType } : {}),
        ...(providerVersionId !== undefined ? { versionId: providerVersionId } : {}),
      };
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(
    objectReference: string | PhotoMediaObjectReference,
  ): Promise<PhotoMediaObjectDeleteResult> {
    const { objectKey, versionId } = this.resolveObjectReference(objectReference);
    this.assertObjectKey(objectKey);
    const result = await this.client.send(new DeleteObjectCommand({
      Bucket: this.configuration.bucket,
      Key: objectKey,
      ...(versionId !== undefined ? { VersionId: versionId } : {}),
    }));
    const providerVersionId = this.validateVersionId(
      result.VersionId,
      new Error("Photo media provider returned an invalid object version identity"),
    );
    if (this.requireObjectVersionId && result.DeleteMarker === true) {
      throw new Error("Photo media provider created or targeted a delete marker");
    }
    if (versionId !== undefined && providerVersionId !== undefined && providerVersionId !== versionId) {
      throw new Error("Photo media provider returned a different object version identity");
    }
    if (this.requireObjectVersionId && versionId !== undefined) {
      await this.assertExactVersionAbsentAfterDelete(objectKey, versionId);
    } else {
      this.assertProviderVersion(providerVersionId);
    }
    return {
      ...(providerVersionId !== undefined ? { versionId: providerVersionId } : {}),
      deleteMarker: Boolean(result.DeleteMarker),
    };
  }

  async listObjectKeys(input: { prefix: string; cursor?: string }) {
    this.assertObjectKey(input.prefix);
    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.configuration.bucket,
      Prefix: input.prefix,
      ContinuationToken: input.cursor,
    }));
    const objectKeys = (result.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));
    for (const objectKey of objectKeys) {
      this.assertObjectKey(objectKey);
    }
    return {
      objectKeys,
      ...(result.IsTruncated && result.NextContinuationToken
        ? { nextCursor: result.NextContinuationToken }
        : {}),
    };
  }

  async listObjectVersions(input: { objectKey: string }): Promise<PhotoMediaObjectVersionInventory> {
    this.assertObjectKey(input.objectKey);
    const versions: PhotoMediaObjectReference[] = [];
    let cursor: PhotoMediaObjectVersionInventoryCursor | undefined;
    do {
      const page = await this.listObjectVersionsByPrefix({ prefix: input.objectKey, ...(cursor ? { cursor } : {}) });
      if (page.deleteMarkers.some((entry) => entry.objectKey === input.objectKey)) {
        throw new Error("Photo media object version inventory contains a delete marker");
      }
      versions.push(...page.versions.filter((entry) => entry.objectKey === input.objectKey));
      cursor = page.nextCursor;
    } while (cursor);
    return { versions };
  }

  async listObjectVersionsByPrefix(input: {
    prefix: string;
    cursor?: PhotoMediaObjectVersionInventoryCursor;
  }): Promise<PhotoMediaObjectVersionInventoryPage> {
    this.assertObjectKey(input.prefix);
    if (input.cursor?.keyMarker !== undefined) this.assertObjectKey(input.cursor.keyMarker);
    const result = await this.client.send(new ListObjectVersionsCommand({
      Bucket: this.configuration.bucket,
      Prefix: input.prefix,
      MaxKeys: 3,
      ...(input.cursor?.keyMarker !== undefined ? { KeyMarker: input.cursor.keyMarker } : {}),
      ...(input.cursor?.versionIdMarker !== undefined ? { VersionIdMarker: input.cursor.versionIdMarker } : {}),
    }));
    const mapEntries = (entries: Array<{ Key?: string; VersionId?: string }>): PhotoMediaObjectReference[] => entries.map((entry) => {
      this.assertObjectKey(entry.Key);
      if (!entry.Key.startsWith(input.prefix)) {
        throw new Error("Photo media object version inventory contains an object outside the requested prefix");
      }
      const versionId = this.validateVersionId(
        entry.VersionId,
        new Error("Photo media provider returned an invalid object version identity"),
      );
      this.assertProviderVersion(versionId);
      return { objectKey: entry.Key, ...(versionId !== undefined ? { versionId } : {}) };
    });
    const versions = mapEntries(result.Versions ?? []);
    const deleteMarkers = mapEntries(result.DeleteMarkers ?? []);
    if (!result.IsTruncated) return { versions, deleteMarkers };
    if (!result.NextKeyMarker || !result.NextVersionIdMarker) {
      throw new Error("Photo media object version inventory is ambiguous");
    }
    this.assertObjectKey(result.NextKeyMarker);
    if (!result.NextKeyMarker.startsWith(input.prefix)) {
      throw new Error("Photo media object version inventory contains a marker outside the requested prefix");
    }
    this.validateVersionId(
      result.NextVersionIdMarker,
      new Error("Photo media object version inventory is ambiguous"),
    );
    return {
      versions,
      deleteMarkers,
      nextCursor: {
        keyMarker: result.NextKeyMarker,
        versionIdMarker: result.NextVersionIdMarker,
      },
    };
  }

  private assertObjectKey(objectKey: unknown): asserts objectKey is string {
    if (
      typeof objectKey !== "string" ||
      objectKey !== objectKey.trim() ||
      !SAFE_OBJECT_KEY.test(objectKey) ||
      objectKey.includes("//") ||
      objectKey.split("/").some((segment) => segment === "." || segment === "..") ||
      /^(https?:|s3:|r2:|data:|file:)/i.test(objectKey)
    ) {
      throw new BadRequestException("Photo media object key is invalid");
    }
  }

  private resolveObjectReference(
    objectReference: string | PhotoMediaObjectReference,
  ): PhotoMediaObjectReference {
    if (typeof objectReference === "string") {
      if (this.requireObjectVersionId) {
        throw new BadRequestException("Photo media object version identity is required");
      }
      return { objectKey: objectReference };
    }
    if (!objectReference || typeof objectReference !== "object" || Array.isArray(objectReference)) {
      throw new BadRequestException("Photo media object reference is invalid");
    }
    const versionId = this.validateVersionId(
      objectReference.versionId,
      new BadRequestException("Photo media object version identity is invalid"),
    );
    if (this.requireObjectVersionId && versionId === undefined) {
      throw new BadRequestException("Photo media object version identity is required");
    }
    return {
      objectKey: objectReference.objectKey,
      ...(versionId !== undefined ? { versionId } : {}),
    };
  }

  private validateVersionId(versionId: unknown, error: Error): string | undefined {
    if (versionId === undefined) {
      return undefined;
    }
    if (
      typeof versionId !== "string" ||
      versionId.length === 0 ||
      (this.requireObjectVersionId && versionId === "null") ||
      Buffer.byteLength(versionId, "utf8") > 1024 ||
      versionId !== versionId.trim() ||
      this.containsAsciiControlCharacters(versionId)
    ) {
      throw error;
    }
    return versionId;
  }

  private assertProviderVersion(versionId: string | undefined): void {
    if (this.requireObjectVersionId && versionId === undefined) {
      throw new Error("Photo media provider did not return an object version identity");
    }
  }

  private assertExactProviderVersion(
    requestedVersionId: string | undefined,
    providerVersionId: string | undefined,
  ): void {
    if (
      this.requireObjectVersionId &&
      (requestedVersionId === undefined || providerVersionId !== requestedVersionId)
    ) {
      throw new Error("Photo media provider did not prove the requested object version identity");
    }
  }

  private async assertExactVersionAbsentAfterDelete(
    objectKey: string,
    versionId: string,
  ): Promise<void> {
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.configuration.bucket,
        Key: objectKey,
        VersionId: versionId,
      }));
      const providerVersionId = this.validateVersionId(
        result.VersionId,
        new Error("Photo media provider returned an invalid object version identity"),
      );
      this.assertExactProviderVersion(versionId, providerVersionId);
      throw new Error("Photo media exact object version still exists after delete");
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode === 404) return;
      throw error;
    }
  }

  private containsAsciiControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
  }
}

function isCreateOnlyConflict(error: unknown): boolean {
  const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  if (statusCode === 409 || statusCode === 412) return true;
  const name = (error as { name?: string }).name;
  return [
    "AlreadyExists",
    "ConditionalCheckFailedException",
    "ConditionalRequestConflict",
    "ObjectAlreadyExists",
    "PreconditionFailed",
    "PreconditionFailedException",
  ].includes(name ?? "");
}
