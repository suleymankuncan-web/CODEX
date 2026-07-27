import { Injectable } from "@nestjs/common";
import { Socket } from "node:net";
import { PhotoMediaSafetyScannerPort } from "../application/photo-media-storage.ports";

type ClamAvConfiguration = { host: string; port: number; timeoutMs: number };
type ClamAvTransport = (body: Buffer) => Promise<string>;

@Injectable()
export class ClamAvPhotoMediaSafetyScanner implements PhotoMediaSafetyScannerPort {
  private readonly transport: ClamAvTransport;

  constructor(
    private readonly configuration: ClamAvConfiguration,
    transport?: ClamAvTransport,
  ) {
    this.transport = transport ?? ((body) => this.scanWithTcp(body));
  }

  async scan(body: Buffer) {
    try {
      const rawReply = await this.transport(body);
      const reply = rawReply.replace(/\0+$/g, "").trim();
      if (/^stream: OK$/i.test(reply)) {
        return { verdict: "clean" as const, engine: "clamav" };
      }
      if (/^stream: .+ FOUND$/i.test(reply)) {
        return {
          verdict: "unsafe" as const,
          engine: "clamav",
          reasonCode: "malware_detected",
        };
      }
      return {
        verdict: "unavailable" as const,
        engine: "clamav",
        reasonCode: "scanner_invalid_response",
      };
    } catch {
      return {
        verdict: "unavailable" as const,
        engine: "clamav",
        reasonCode: "scanner_unavailable",
      };
    }
  }

  private scanWithTcp(body: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const response: Buffer[] = [];
      let responseBytes = 0;
      const finish = (error?: Error) => {
        socket.destroy();
        if (error) {
          reject(error);
          return;
        }
        resolve(Buffer.concat(response).toString("utf8"));
      };

      socket.setTimeout(this.configuration.timeoutMs, () => finish(new Error("timeout")));
      socket.once("error", (error) => finish(error));
      socket.on("data", (chunk: Buffer) => {
        responseBytes += chunk.byteLength;
        if (responseBytes > 4096) {
          finish(new Error("response_too_large"));
          return;
        }
        response.push(chunk);
        if (chunk.includes(0)) {
          finish();
        }
      });
      socket.connect(this.configuration.port, this.configuration.host, () => {
        socket.write(Buffer.from("zINSTREAM\0", "utf8"));
        for (let offset = 0; offset < body.byteLength; offset += 64 * 1024) {
          const chunk = body.subarray(offset, Math.min(offset + 64 * 1024, body.byteLength));
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.byteLength, 0);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
}
