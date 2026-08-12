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
import { PhotoMediaObjectStoragePort } from "../application/photo-media-storage.ports";

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

  async createSignedRead(input: { objectKey: string; expiresInSeconds: number }) {
    this.assertObjectKey(input.objectKey);
    const command = new GetObjectCommand({ Bucket: this.configuration.bucket, Key: input.objectKey });
    const url = await this.signer(this.client, command, { expiresIn: input.expiresInSeconds });
    return { url, expiresInSeconds: input.expiresInSeconds };
  }

  async getObject(objectKey: string): Promise<Buffer> {
    this.assertObjectKey(objectKey);
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.configuration.bucket,
      Key: objectKey,
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
  }): Promise<void> {
    this.assertObjectKey(input.objectKey);
    await this.client.send(new PutObjectCommand({
      Bucket: this.configuration.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      Metadata: { sha256: input.sha256 },
    }));
  }

  async headObject(objectKey: string) {
    this.assertObjectKey(objectKey);
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.configuration.bucket,
        Key: objectKey,
      }));
      const sha256 = result.Metadata?.sha256;
      if (result.ContentLength === undefined || !sha256) {
        return null;
      }
      return {
        byteCount: result.ContentLength,
        sha256,
        ...(result.ContentType ? { contentType: result.ContentType } : {}),
      };
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.assertObjectKey(objectKey);
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.configuration.bucket,
      Key: objectKey,
    }));
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

  private assertObjectKey(objectKey: string): void {
    if (
      objectKey !== objectKey.trim() ||
      !SAFE_OBJECT_KEY.test(objectKey) ||
      objectKey.includes("//") ||
      objectKey.split("/").some((segment) => segment === "." || segment === "..") ||
      /^(https?:|s3:|r2:|data:|file:)/i.test(objectKey)
    ) {
      throw new BadRequestException("Photo media object key is invalid");
    }
  }
}
