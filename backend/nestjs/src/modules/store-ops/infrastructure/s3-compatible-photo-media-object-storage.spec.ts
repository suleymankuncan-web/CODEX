import { S3Client } from "@aws-sdk/client-s3";
import {
  buildS3CompatiblePhotoMediaObjectStorageClientConfiguration,
  S3CompatiblePhotoMediaObjectStorage,
} from "./s3-compatible-photo-media-object-storage";

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  };
});

describe("S3CompatiblePhotoMediaObjectStorage", () => {
  it("builds the exact local S3-compatible client configuration", () => {
    expect(buildS3CompatiblePhotoMediaObjectStorageClientConfiguration({
      endpoint: "http://object-storage:8333",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    })).toEqual({
      endpoint: "http://object-storage:8333",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    });
  });

  it("constructs the S3 client from the local configuration builder", () => {
    const clientConstructor = S3Client as unknown as jest.Mock;
    clientConstructor.mockClear();

    new S3CompatiblePhotoMediaObjectStorage({
      bucket: "hr-axis-media-primary",
      endpoint: "http://object-storage:8333",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    });

    expect(clientConstructor).toHaveBeenCalledWith({
      endpoint: "http://object-storage:8333",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    });
  });

  it("binds every command to the configured private bucket and preserves digest metadata", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        ContentLength: 9,
        Metadata: { sha256: "a".repeat(64) },
        ContentType: "image/webp",
      });
    const signer = jest.fn().mockResolvedValue("http://object-storage:8333/signed");
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      signer,
    );

    await storage.putObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      body: Buffer.from("canonical"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    });
    await expect(storage.headObject("locked/companies/a/media/b/canonical.webp"))
      .resolves.toEqual({
        byteCount: 9,
        sha256: "a".repeat(64),
        contentType: "image/webp",
      });
    expect(send.mock.calls[0]?.[0]?.input).toEqual(expect.objectContaining({
      Bucket: "hr-axis-media-primary",
      Metadata: { sha256: "a".repeat(64) },
    }));
    await expect(storage.createSignedRead({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      expiresInSeconds: 120,
    })).resolves.toEqual({
      url: "http://object-storage:8333/signed",
      expiresInSeconds: 120,
    });
  });

  it("returns the provider version identity from a versioned put", async () => {
    const send = jest.fn().mockResolvedValue({ VersionId: "opaque-version-1" });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.putObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      body: Buffer.from("canonical"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    })).resolves.toEqual({ versionId: "opaque-version-1" });
  });

  it("passes a typed object version reference to get", async () => {
    const send = jest.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => Uint8Array.from([4, 5, 6]) },
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.getObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId: "opaque-get-version",
    })).resolves.toEqual(Buffer.from([4, 5, 6]));
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
      VersionId: "opaque-get-version",
    });
  });

  it("passes a typed object version reference to head and returns the provider version", async () => {
    const send = jest.fn().mockResolvedValue({
      ContentLength: 9,
      Metadata: { sha256: "a".repeat(64) },
      ContentType: "image/webp",
      VersionId: "opaque-head-version",
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.headObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId: "opaque-head-version",
    })).resolves.toEqual({
      byteCount: 9,
      sha256: "a".repeat(64),
      contentType: "image/webp",
      versionId: "opaque-head-version",
    });
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
      VersionId: "opaque-head-version",
    });
  });

  it("passes an optional version identity to a signed read", async () => {
    const signer = jest.fn().mockResolvedValue("http://object-storage:8333/signed-version");
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send: jest.fn() } as never,
      signer,
    );

    await expect(storage.createSignedRead({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId: "opaque-signed-version",
      expiresInSeconds: 120,
    })).resolves.toEqual({
      url: "http://object-storage:8333/signed-version",
      expiresInSeconds: 120,
    });
    expect(signer.mock.calls[0]?.[1]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
      VersionId: "opaque-signed-version",
    });
  });

  it("passes a typed object version reference to delete and sanitizes the response", async () => {
    const send = jest.fn().mockResolvedValue({
      VersionId: "opaque-delete-version",
      DeleteMarker: true,
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.deleteObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId: "opaque-delete-version",
    })).resolves.toEqual({
      versionId: "opaque-delete-version",
      deleteMarker: true,
    });
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
      VersionId: "opaque-delete-version",
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["leading whitespace", " opaque-version"],
    ["trailing whitespace", "opaque-version "],
    ["too long", "x".repeat(1025)],
    ["multibyte too long", "é".repeat(513)],
    ["ASCII control", "opaque\nversion"],
  ])("rejects an invalid provided version identity (%s) before provider I/O", async (_label, versionId) => {
    const send = jest.fn();
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.getObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId,
    })).rejects.toThrow("version");
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["too long", "x".repeat(1025)],
    ["ASCII control", "opaque\u007fversion"],
  ])("fails closed on an invalid provider version identity from put (%s)", async (_label, versionId) => {
    const send = jest.fn().mockResolvedValue({ VersionId: versionId });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.putObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      body: Buffer.from("canonical"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    })).rejects.toThrow("provider returned an invalid object version");
  });

  it("accepts a multibyte version identity at exactly 1024 UTF-8 bytes", async () => {
    const versionId = "é".repeat(512);
    const send = jest.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => Uint8Array.from([7, 8, 9]) },
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.getObject({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      versionId,
    })).resolves.toEqual(Buffer.from([7, 8, 9]));
    expect(Buffer.byteLength(versionId, "utf8")).toBe(1024);
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
      VersionId: versionId,
    });
  });

  it("fails closed with a static error for a malformed provider head version", async () => {
    const malformedVersionId = "head\u0000version";
    const send = jest.fn().mockResolvedValue({
      ContentLength: 9,
      Metadata: { sha256: "a".repeat(64) },
      VersionId: malformedVersionId,
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    const error = await storage.headObject("locked/companies/a/media/b/canonical.webp")
      .then(() => null, (caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("Photo media provider returned an invalid object version identity");
    expect(error?.message).not.toContain(malformedVersionId);
  });

  it("fails closed with a static error for a malformed provider delete version", async () => {
    const malformedVersionId = "delete\u0007version";
    const send = jest.fn().mockResolvedValue({
      VersionId: malformedVersionId,
      DeleteMarker: true,
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    const error = await storage.deleteObject("locked/companies/a/media/b/canonical.webp")
      .then(() => null, (caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("Photo media provider returned an invalid object version identity");
    expect(error?.message).not.toContain(malformedVersionId);
  });

  it("fails before the S3 client sees an unsafe key", async () => {
    const send = jest.fn();
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.deleteObject("../secret")).rejects.toThrow("object key");
    expect(send).not.toHaveBeenCalled();
  });

  it("reads bytes, deletes objects, and preserves paginated private inventory", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({
        Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Contents: [
          { Key: "locked/companies/a/media/b/canonical.webp" },
          { Key: "locked/companies/a/media/c/canonical.webp" },
        ],
        IsTruncated: true,
        NextContinuationToken: "next-page",
      });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.getObject("locked/companies/a/media/b/canonical.webp"))
      .resolves.toEqual(Buffer.from([1, 2, 3]));
    await storage.deleteObject("transient/companies/a/media/b/raw");
    await expect(storage.listObjectKeys({
      prefix: "locked/companies/a/",
      cursor: "current-page",
    })).resolves.toEqual({
      objectKeys: [
        "locked/companies/a/media/b/canonical.webp",
        "locked/companies/a/media/c/canonical.webp",
      ],
      nextCursor: "next-page",
    });

    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "locked/companies/a/media/b/canonical.webp",
    });
    expect(send.mock.calls[1]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Key: "transient/companies/a/media/b/raw",
    });
    expect(send.mock.calls[2]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Prefix: "locked/companies/a/",
      ContinuationToken: "current-page",
    });
  });

  it("rejects an unsafe object key returned by the provider inventory", async () => {
    const send = jest.fn().mockResolvedValue({
      Contents: [{ Key: "https://public.invalid/object" }],
      IsTruncated: false,
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.listObjectKeys({ prefix: "locked/" })).rejects.toThrow("object key");
  });
});
