import { createHash } from "node:crypto";
import { PhotoMediaSafetyScannerPort } from "../application/photo-media-storage.ports";

export class SyntheticFixturePhotoMediaSafetyScanner implements PhotoMediaSafetyScannerPort {
  constructor(private readonly approvedDigests: string[]) {}

  async scan(body: Buffer) {
    const digest = createHash("sha256").update(body).digest("hex");
    if (this.approvedDigests.includes(digest)) {
      return {
        verdict: "clean" as const,
        engine: "synthetic_sha256_allowlist",
        assurance: "fixture_identity_only" as const,
      };
    }
    return {
      verdict: "unsafe" as const,
      engine: "synthetic_sha256_allowlist",
      assurance: "fixture_identity_only" as const,
      reasonCode: "synthetic_fixture_digest_mismatch",
    };
  }
}
