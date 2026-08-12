import { S3Client } from "@aws-sdk/client-s3";
import {
  buildS3CompatiblePhotoMediaObjectStorageClientConfiguration,
  S3CompatiblePhotoMediaObjectStorage,
} from "./s3-compatible-photo-media-object-storage";
import { PhotoMediaObjectCreateConflictError } from "../application/photo-media-storage.ports";

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

  it("uses an If-None-Match create-only write when requested", async () => {
    const send = jest.fn().mockResolvedValue({ VersionId: "create-version-1" });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.putObject({
      objectKey: "transient/companies/a/media/b/raw",
      body: Buffer.from("raw"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
      createOnly: true,
    })).resolves.toEqual({ versionId: "create-version-1" });
    expect(send.mock.calls[0]?.[0]?.input).toEqual(expect.objectContaining({
      IfNoneMatch: "*",
    }));
  });

  it("classifies only a create-only precondition conflict without exposing provider details", async () => {
    const send = jest.fn().mockRejectedValue(Object.assign(
      new Error("bucket/transient/secret-version-2 already exists"),
      { name: "PreconditionFailed", $metadata: { httpStatusCode: 412 } },
    ));
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    const error = await storage.putObject({
      objectKey: "transient/companies/a/media/b/raw",
      body: Buffer.from("raw"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
      createOnly: true,
    }).then(() => null, (caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(PhotoMediaObjectCreateConflictError);
    expect(error?.message).toBe("Photo media immutable object create conflicted");
    expect(error?.message).not.toContain("secret-version-2");
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

  it.each(["put", "get", "list"])(
    "rejects the suspended-versioning null sentinel for local exact-version %s",
    async (operation) => {
      const objectKey = "locked/companies/a/media/b/canonical.webp";
      const send = jest.fn().mockResolvedValue(
        operation === "get"
          ? { VersionId: "null", Body: { transformToByteArray: async () => Uint8Array.from([1]) } }
          : operation === "list"
            ? { Versions: [{ Key: objectKey, VersionId: "null" }], IsTruncated: false }
            : { VersionId: "null" },
      );
      const storage = new S3CompatiblePhotoMediaObjectStorage(
        {
          bucket: "hr-axis-media-primary",
          endpoint: "http://object-storage:8333",
          region: "us-east-1",
          forcePathStyle: true,
          requireObjectVersionId: true,
          credentials: { accessKeyId: "key", secretAccessKey: "secret" },
        },
        { send } as never,
        jest.fn(),
      );

      const result = operation === "get"
        ? storage.getObject({ objectKey, versionId: "null" })
        : operation === "list"
          ? storage.listObjectVersions({ objectKey })
          : storage.putObject({
            objectKey, body: Buffer.from("canonical"), contentType: "image/webp", sha256: "a".repeat(64),
          });
      await expect(result).rejects.toThrow("version");
      if (operation === "get") expect(send).not.toHaveBeenCalled();
    },
  );

  it("fails closed when a local provider omits a response version identity", async () => {
    const send = jest.fn().mockResolvedValue({});
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      } as never,
      { send } as never,
      jest.fn(),
    );

    await expect(storage.putObject({
      objectKey: "transient/companies/a/media/b/raw",
      body: Buffer.from("raw"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    })).rejects.toThrow("did not return an object version identity");

    send.mockResolvedValueOnce({
      ContentLength: 3,
      Metadata: { sha256: "a".repeat(64) },
      ContentType: "image/webp",
    });
    await expect(storage.headObject({ objectKey: "transient/companies/a/media/b/raw", versionId: "known-version" }))
      .rejects.toThrow("did not return an object version identity");

    send.mockResolvedValueOnce({ DeleteMarker: true });
    await expect(storage.deleteObject({ objectKey: "transient/companies/a/media/b/raw", versionId: "known-version" }))
      .rejects.toThrow("delete marker");
  });

  it("rejects key-only local reads, heads, deletes, and signed references before provider I/O", async () => {
    const send = jest.fn();
    const signer = jest.fn();
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      } as never,
      { send } as never,
      signer,
    );

    await expect(storage.getObject("locked/companies/a/media/b/canonical.webp"))
      .rejects.toThrow("object version identity is required");
    await expect(storage.headObject("locked/companies/a/media/b/canonical.webp"))
      .rejects.toThrow("object version identity is required");
    await expect(storage.deleteObject("locked/companies/a/media/b/canonical.webp"))
      .rejects.toThrow("object version identity is required");
    await expect(storage.createSignedRead({
      objectKey: "locked/companies/a/media/b/canonical.webp",
      expiresInSeconds: 120,
    })).rejects.toThrow("object version identity is required");

    expect(send).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
  });

  it("rejects local GET and HEAD responses for a different version", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({
        VersionId: "version-2",
        Body: { transformToByteArray: async () => Uint8Array.from([1]) },
      })
      .mockResolvedValueOnce({
        VersionId: "version-2",
        ContentLength: 1,
        Metadata: { sha256: "a".repeat(64) },
      });
    const storage = new S3CompatiblePhotoMediaObjectStorage({
      bucket: "hr-axis-media-primary", endpoint: "http://object-storage:8333",
      region: "us-east-1", forcePathStyle: true, requireObjectVersionId: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    }, { send } as never, jest.fn());

    await expect(storage.getObject({ objectKey: "locked/a", versionId: "version-1" }))
      .rejects.toThrow("requested object version");
    await expect(storage.headObject({ objectKey: "locked/a", versionId: "version-1" }))
      .rejects.toThrow("requested object version");
  });

  it("proves an exact local delete with a post-delete 404", async () => {
    const notFound = Object.assign(new Error("not found"), { $metadata: { httpStatusCode: 404 } });
    const send = jest.fn()
      .mockResolvedValueOnce({ VersionId: "version-1", DeleteMarker: false })
      .mockRejectedValueOnce(notFound);
    const storage = new S3CompatiblePhotoMediaObjectStorage({
      bucket: "hr-axis-media-primary", endpoint: "http://object-storage:8333",
      region: "us-east-1", forcePathStyle: true, requireObjectVersionId: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    }, { send } as never, jest.fn());

    await expect(storage.deleteObject({ objectKey: "locked/a", versionId: "version-1" }))
      .resolves.toEqual({ versionId: "version-1", deleteMarker: false });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects a mismatched or still-present local delete", async () => {
    const mismatched = jest.fn().mockResolvedValue({ VersionId: "version-2", DeleteMarker: false });
    const mismatchStorage = new S3CompatiblePhotoMediaObjectStorage({
      bucket: "hr-axis-media-primary", endpoint: "http://object-storage:8333",
      region: "us-east-1", forcePathStyle: true, requireObjectVersionId: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    }, { send: mismatched } as never, jest.fn());
    await expect(mismatchStorage.deleteObject({ objectKey: "locked/a", versionId: "version-1" }))
      .rejects.toThrow("different object version");

    const stillPresent = jest.fn()
      .mockResolvedValueOnce({ VersionId: "version-1", DeleteMarker: false })
      .mockResolvedValueOnce({ VersionId: "version-1", ContentLength: 1, Metadata: { sha256: "a".repeat(64) } });
    const presentStorage = new S3CompatiblePhotoMediaObjectStorage({
      bucket: "hr-axis-media-primary", endpoint: "http://object-storage:8333",
      region: "us-east-1", forcePathStyle: true, requireObjectVersionId: true,
      credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    }, { send: stillPresent } as never, jest.fn());
    await expect(presentStorage.deleteObject({ objectKey: "locked/a", versionId: "version-1" }))
      .rejects.toThrow("still exists");
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

  it("lists exact local object versions for crash recovery", async () => {
    const objectKey = "locked/companies/a/media/b/canonical.webp";
    const send = jest.fn().mockResolvedValue({
      Versions: [
        { Key: objectKey, VersionId: "opaque-version-1" },
        { Key: `${objectKey}.other`, VersionId: "ignored-version" },
      ],
      DeleteMarkers: [],
      IsTruncated: false,
    });
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.listObjectVersions({ objectKey })).resolves.toEqual({
      versions: [{ objectKey, versionId: "opaque-version-1" }],
    });
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "hr-axis-media-primary",
      Prefix: objectKey,
      MaxKeys: 3,
    });
  });

  it.each([
    [{ Versions: [], DeleteMarkers: [], IsTruncated: true }, "ambiguous"],
    [{ Versions: [], DeleteMarkers: [{ Key: "locked/a", VersionId: "marker" }], IsTruncated: false }, "delete marker"],
    [{ Versions: [{ Key: "locked/a" }], DeleteMarkers: [], IsTruncated: false }, "version identity"],
  ])("fails closed for unsafe local version inventory %#", async (result, message) => {
    const storage = new S3CompatiblePhotoMediaObjectStorage(
      {
        bucket: "hr-axis-media-primary",
        endpoint: "http://object-storage:8333",
        region: "us-east-1",
        forcePathStyle: true,
        requireObjectVersionId: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send: jest.fn().mockResolvedValue(result) } as never,
      jest.fn(),
    );

    await expect(storage.listObjectVersions({ objectKey: "locked/a" })).rejects.toThrow(message);
  });
});
