import { decryptRefreshToken, encryptRefreshToken } from "./managed-session-crypto";

describe("managed refresh credential encryption", () => {
  it("binds ciphertext to its session and supports a bounded previous-key rotation", () => {
    const value = encryptRefreshToken("synthetic-secret-token", "sid-one", "previous-secret");
    expect(value).not.toContain("synthetic-secret-token");
    expect(decryptRefreshToken(value, "sid-one", ["new-secret", "previous-secret"])).toBe("synthetic-secret-token");
    expect(() => decryptRefreshToken(value, "sid-two", ["previous-secret"])).toThrow("Invalid browser session");
    expect(() => decryptRefreshToken(value, "sid-one", ["wrong-secret"])).toThrow("Invalid browser session");
    const parts = value.split("."); parts[1] = Buffer.alloc(16).toString("base64url");
    expect(() => decryptRefreshToken(parts.join("."), "sid-one", ["previous-secret"])).toThrow();
  });
});
