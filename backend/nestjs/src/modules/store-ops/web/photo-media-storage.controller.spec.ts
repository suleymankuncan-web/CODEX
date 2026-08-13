import { StreamableFile } from "@nestjs/common";
import { PhotoMediaStorageController } from "./photo-media-storage.controller";

describe("PhotoMediaStorageController", () => {
  function createController() {
    const service = {
      createSignedRead: jest.fn(async (input: { contentPath?: string }) => ({
        url: input.contentPath ?? "https://signed.invalid",
        expiresInSeconds: 120,
      })),
      readContent: jest.fn(async () => ({ body: Buffer.from("webp"), contentType: "image/webp" })),
    };
    const controller = new PhotoMediaStorageController(service as never, {} as never);
    return { controller, service };
  }

  const request = {
    user: {
      userId: "55555555-5555-4555-8555-555555555555",
      roleCodes: ["SUPER_ADMIN"],
      scope: { companyIds: [], regionIds: [], storeIds: ["44444444-4444-4444-8444-444444444444"] },
      actionScope: { assignedStoreIds: [] },
    },
  };

  it("supplies the internal authenticated content path to read-url creation", async () => {
    const { controller, service } = createController();
    const mediaAssetId = "22222222-2222-4222-8222-222222222222";

    await controller.readUrl(request, mediaAssetId, { variant: "thumbnail" });

    expect(service.createSignedRead).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId,
      contentPath: `/api/internal/photo-media/assets/${mediaAssetId}/content/thumbnail`,
    }));
  });

  it("streams authenticated image/webp content through the server-authorized proxy", async () => {
    const { controller, service } = createController();
    const mediaAssetId = "22222222-2222-4222-8222-222222222222";

    const result = await controller.readContent(request, mediaAssetId, "canonical");

    expect(service.readContent).toHaveBeenCalledWith({
      mediaAssetId,
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      variant: "canonical",
    });
    expect(result).toBeInstanceOf(StreamableFile);
    await expect(readStreamableFile(result)).resolves.toEqual(Buffer.from("webp"));
  });
});

async function readStreamableFile(file: StreamableFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
