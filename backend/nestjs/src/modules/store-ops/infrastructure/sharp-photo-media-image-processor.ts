import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
const sharp: typeof import("sharp").default = require("sharp");
import { PhotoMediaImageProcessorPort } from "../application/photo-media-storage.ports";

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const CANONICAL_LONG_EDGE = 2048;
const THUMBNAIL_LONG_EDGE = 480;
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);

@Injectable()
export class SharpPhotoMediaImageProcessor implements PhotoMediaImageProcessorPort {
  async process(body: Buffer) {
    if (body.byteLength === 0 || body.byteLength > MAX_INPUT_BYTES) {
      throw new BadRequestException("Photo media input size is invalid");
    }

    try {
      const source = sharp(body, {
        animated: false,
        failOn: "warning",
        limitInputPixels: MAX_INPUT_PIXELS,
      });
      const metadata = await source.metadata();
      if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
        throw new BadRequestException("Photo media must use a supported image format");
      }
      if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
        throw new BadRequestException("Photo media dimensions are invalid");
      }

      const canonicalResult = await sharp(body, {
        animated: false,
        failOn: "warning",
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: CANONICAL_LONG_EDGE,
          height: CANONICAL_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      const thumbnail = await sharp(canonicalResult.data)
        .resize({
          width: THUMBNAIL_LONG_EDGE,
          height: THUMBNAIL_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();

      return {
        canonical: canonicalResult.data,
        thumbnail,
        canonicalSha256: createHash("sha256").update(canonicalResult.data).digest("hex"),
        thumbnailSha256: createHash("sha256").update(thumbnail).digest("hex"),
        widthPx: canonicalResult.info.width,
        heightPx: canonicalResult.info.height,
        mimeType: "image/webp" as const,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Photo media image decode failed");
    }
  }
}
