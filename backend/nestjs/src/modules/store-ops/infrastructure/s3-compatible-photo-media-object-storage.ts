import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException } from "@nestjs/common";
import {
  PhotoMediaObjectDeleteResult,
  PhotoMediaObjectReference,
  PhotoMediaObjectStoragePort,
  PhotoMediaObjectPutResult,
} from "../application/photo-media-storage.ports";

const SAFE_OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
type Signer = (client: S3Client, command: object, options: { expiresIn: number }) => Promise<string>;

export type S3CompatiblePhotoMediaObjectStorageConfiguration = {
  bucket: string;
  endpoint: string;
  region: string;
  forcePathStyle: true;
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

  constructor(
    private readonly configuration: S3CompatiblePhotoMediaObjectStorageConfiguration,
    client?: S3Client,
    signer?: Signer,
  ) {
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
  }): Promise<PhotoMediaObjectPutResult> {
    this.assertObjectKey(input.objectKey);
    const result = await this.client.send(new PutObjectCommand({
      Bucket: this.configuration.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      Metadata: { sha256: input.sha256 },
    }));
    const versionId = this.validateVersionId(
      result.VersionId,
      new Error("Photo media provider returned an invalid object version identity"),
    );
    return versionId === undefined ? {} : { versionId };
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
    return {
      ...(providerVersionId !== undefined ? { versionId: providerVersionId } : {}),
      deleteMarker: result.DeleteMarker === true,
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
      return { objectKey: objectReference };
    }
    if (!objectReference || typeof objectReference !== "object" || Array.isArray(objectReference)) {
      throw new BadRequestException("Photo media object reference is invalid");
    }
    const versionId = this.validateVersionId(
      objectReference.versionId,
      new BadRequestException("Photo media object version identity is invalid"),
    );
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
      Buffer.byteLength(versionId, "utf8") > 1024 ||
      versionId !== versionId.trim() ||
      this.containsAsciiControlCharacters(versionId)
    ) {
      throw error;
    }
    return versionId;
  }

  private containsAsciiControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
  }
}
