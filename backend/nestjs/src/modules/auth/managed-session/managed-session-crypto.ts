import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";

function encryptionKey(secret: string) {
  return createHash("sha256").update("hr-axis/managed-session/refresh/v2\0").update(secret).digest();
}

export function encryptRefreshToken(token: string, sessionId: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(sessionId));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("base64url")).join(".");
}

export function decryptRefreshToken(value: string, sessionId: string, secrets: string[]) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new UnauthorizedException("Invalid browser session");
  for (const secret of secrets) {
    try {
      const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, "base64url"));
      const cipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
      cipher.setAAD(Buffer.from(sessionId));
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8");
    } catch { /* Try only the configured previous key. */ }
  }
  throw new UnauthorizedException("Invalid browser session");
}
