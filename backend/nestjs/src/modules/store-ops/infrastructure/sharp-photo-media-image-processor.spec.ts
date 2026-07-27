const sharp: typeof import("sharp").default = require("sharp");
import { SharpPhotoMediaImageProcessor } from "./sharp-photo-media-image-processor";

describe("SharpPhotoMediaImageProcessor", () => {
  it("decodes, bounds, re-encodes and strips source metadata", async () => {
    const source = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#5d4fd8" },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "must-not-survive" } } })
      .jpeg({ quality: 95 })
      .toBuffer();

    const result = await new SharpPhotoMediaImageProcessor().process(source);
    const canonicalMetadata = await sharp(result.canonical).metadata();
    const thumbnailMetadata = await sharp(result.thumbnail).metadata();

    expect(result.mimeType).toBe("image/webp");
    expect(result.widthPx).toBe(1200);
    expect(result.heightPx).toBe(800);
    expect(result.canonicalSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalMetadata.exif).toBeUndefined();
    expect(canonicalMetadata.icc).toBeUndefined();
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(480);
    expect(thumbnailMetadata.height).toBeLessThanOrEqual(480);
  });

  it("rejects malformed and unsupported image formats", async () => {
    const processor = new SharpPhotoMediaImageProcessor();
    await expect(processor.process(Buffer.from("not-an-image"))).rejects.toThrow("decode");

    const gif = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#000000" },
    }).gif().toBuffer();
    await expect(processor.process(gif)).rejects.toThrow("supported image format");
  });
});
