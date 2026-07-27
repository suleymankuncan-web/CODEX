import { ClamAvPhotoMediaSafetyScanner } from "./clamav-photo-media-safety-scanner";

describe("ClamAvPhotoMediaSafetyScanner", () => {
  it("maps an exact clamd stream response to a typed clean verdict", async () => {
    const scanner = new ClamAvPhotoMediaSafetyScanner(
      { host: "clamav.internal", port: 3310, timeoutMs: 1000 },
      async () => "stream: OK\0",
    );

    await expect(scanner.scan(Buffer.from("synthetic"))).resolves.toEqual({
      verdict: "clean",
      engine: "clamav",
    });
  });

  it("fails closed for malware, malformed replies, and scanner outages", async () => {
    const unsafe = new ClamAvPhotoMediaSafetyScanner(
      { host: "clamav.internal", port: 3310, timeoutMs: 1000 },
      async () => "stream: Eicar-Signature FOUND\0",
    );
    await expect(unsafe.scan(Buffer.from("synthetic"))).resolves.toMatchObject({
      verdict: "unsafe",
      reasonCode: "malware_detected",
    });

    const unavailable = new ClamAvPhotoMediaSafetyScanner(
      { host: "clamav.internal", port: 3310, timeoutMs: 1000 },
      async () => {
        throw new Error("connection refused");
      },
    );
    await expect(unavailable.scan(Buffer.from("synthetic"))).resolves.toEqual({
      verdict: "unavailable",
      engine: "clamav",
      reasonCode: "scanner_unavailable",
    });
  });
});
