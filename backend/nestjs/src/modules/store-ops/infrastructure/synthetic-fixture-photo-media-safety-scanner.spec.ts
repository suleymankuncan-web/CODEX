import { SyntheticFixturePhotoMediaSafetyScanner } from "./synthetic-fixture-photo-media-safety-scanner";

describe("SyntheticFixturePhotoMediaSafetyScanner", () => {
  it("accepts the byte-identical approved fixture with identity-only assurance", async () => {
    const fixture = Buffer.from("approved-synthetic-fixture");
    const scanner = new SyntheticFixturePhotoMediaSafetyScanner([
      "7426c6fa44c789381263de765afba316e47b3b1cf411b1dc483482c532733083",
    ]);

    await expect(scanner.scan(fixture)).resolves.toEqual({
      verdict: "clean",
      engine: "synthetic_sha256_allowlist",
      assurance: "fixture_identity_only",
    });
  });

  it("rejects a one-byte-different fixture", async () => {
    const scanner = new SyntheticFixturePhotoMediaSafetyScanner([
      "7426c6fa44c789381263de765afba316e47b3b1cf411b1dc483482c532733083",
    ]);

    await expect(scanner.scan(Buffer.from("approved-synthetic-fixturf"))).resolves.toEqual({
      verdict: "unsafe",
      engine: "synthetic_sha256_allowlist",
      assurance: "fixture_identity_only",
      reasonCode: "synthetic_fixture_digest_mismatch",
    });
  });
});
