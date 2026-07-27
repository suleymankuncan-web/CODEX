import { R2PhotoMediaObjectStorage } from "./r2-photo-media-object-storage";

describe("R2PhotoMediaObjectStorage", () => {
  it("uses only the configured private bucket and preserves sha256 metadata", async () => {
    const send = jest.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 9, Metadata: { sha256: "a".repeat(64) }, ContentType: "image/webp" });
    const signer = jest.fn().mockResolvedValue("https://signed.invalid/object?signature=secret");
    const storage = new R2PhotoMediaObjectStorage(
      {
        bucket: "hr-axis-photo-primary",
        endpoint: "https://account.eu.r2.cloudflarestorage.com",
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      signer,
    );

    await storage.putObject({
      objectKey: "companies/a/media/b/canonical.webp",
      body: Buffer.from("canonical"),
      contentType: "image/webp",
      sha256: "a".repeat(64),
    });
    await expect(storage.headObject("companies/a/media/b/canonical.webp")).resolves.toEqual({
      byteCount: 9,
      sha256: "a".repeat(64),
      contentType: "image/webp",
    });
    expect(send).toHaveBeenCalledTimes(2);

    await expect(storage.createSignedRead({
      objectKey: "companies/a/media/b/canonical.webp",
      expiresInSeconds: 120,
    })).resolves.toEqual({ url: "https://signed.invalid/object?signature=secret", expiresInSeconds: 120 });
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe object keys before reaching R2", async () => {
    const send = jest.fn();
    const storage = new R2PhotoMediaObjectStorage(
      {
        bucket: "hr-axis-photo-primary",
        endpoint: "https://account.eu.r2.cloudflarestorage.com",
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.headObject("../secret")).rejects.toThrow("object key");
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed when provider metadata has no digest proof", async () => {
    const send = jest.fn().mockResolvedValue({
      ContentLength: 1024,
      ContentType: "image/jpeg",
    });
    const storage = new R2PhotoMediaObjectStorage(
      {
        bucket: "hr-axis-photo-primary",
        endpoint: "https://account.eu.r2.cloudflarestorage.com",
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.headObject("transient/companies/a/media/b/raw")).resolves.toBeNull();
  });

  it("paginates private inventory without exposing another bucket", async () => {
    const send = jest.fn().mockResolvedValue({
      Contents: [{ Key: "companies/a/media/b/canonical.webp" }],
      IsTruncated: true,
      NextContinuationToken: "opaque-cursor",
    });
    const storage = new R2PhotoMediaObjectStorage(
      {
        bucket: "hr-axis-photo-primary",
        endpoint: "https://account.eu.r2.cloudflarestorage.com",
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
      { send } as never,
      jest.fn(),
    );

    await expect(storage.listObjectKeys({ prefix: "companies/" })).resolves.toEqual({
      objectKeys: ["companies/a/media/b/canonical.webp"],
      nextCursor: "opaque-cursor",
    });
    expect(send.mock.calls[0]?.[0]?.input).toEqual(expect.objectContaining({
      Bucket: "hr-axis-photo-primary",
      Prefix: "companies/",
    }));
  });
});
