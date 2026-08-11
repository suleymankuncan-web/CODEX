import { S3Client } from "@aws-sdk/client-s3";
import {
  buildS3CompatiblePhotoMediaObjectStorageClientConfiguration,
  S3CompatiblePhotoMediaObjectStorage,
  S3CompatiblePhotoMediaObjectStorageClientConfiguration,
  S3CompatiblePhotoMediaObjectStorageConfiguration,
} from "./s3-compatible-photo-media-object-storage";

type Signer = (client: S3Client, command: object, options: { expiresIn: number }) => Promise<string>;

export type R2PhotoMediaObjectStorageClientConfiguration =
  S3CompatiblePhotoMediaObjectStorageClientConfiguration;

export function buildR2PhotoMediaObjectStorageClientConfiguration(
  configuration: Omit<
    S3CompatiblePhotoMediaObjectStorageConfiguration,
    "region" | "forcePathStyle"
  >,
): R2PhotoMediaObjectStorageClientConfiguration {
  return buildS3CompatiblePhotoMediaObjectStorageClientConfiguration({
    endpoint: configuration.endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: configuration.credentials,
  });
}

export class R2PhotoMediaObjectStorage extends S3CompatiblePhotoMediaObjectStorage {
  constructor(
    configuration: Omit<
      S3CompatiblePhotoMediaObjectStorageConfiguration,
      "region" | "forcePathStyle"
    >,
    client?: S3Client,
    signer?: Signer,
  ) {
    super({
      bucket: configuration.bucket,
      ...buildR2PhotoMediaObjectStorageClientConfiguration(configuration),
    }, client, signer);
  }
}
