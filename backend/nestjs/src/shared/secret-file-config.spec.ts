import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSecretFileMetadata,
  assertSecretFileOwnership,
  assertSecretFilePermissions,
  assertPublicTrustFilePermissions,
  readFileBackedSetting,
} from "./secret-file-config";

function createConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  };
}

describe("file-backed settings", () => {
  it("loads a trimmed setting from an owner-only file", () => {
    const directory = mkdtempSync(join(tmpdir(), "hr-axis-secret-"));
    const filePath = join(directory, "database-url");
    writeFileSync(filePath, "postgres://runtime:local-only@db.invalid/app\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(filePath, 0o600);

    expect(
      readFileBackedSetting(createConfig({ DATABASE_URL_FILE: filePath }), "DATABASE_URL"),
    ).toBe("postgres://runtime:local-only@db.invalid/app");
  });

  it("rejects simultaneous plaintext and file-backed forms without exposing values", () => {
    const read = () =>
      readFileBackedSetting(
        createConfig({
          DATABASE_URL: "postgres://plaintext.invalid/app",
          DATABASE_URL_FILE: "Z:/not-read.ini",
        }),
        "DATABASE_URL",
      );

    expect(read).toThrow("DATABASE_URL and DATABASE_URL_FILE cannot both be configured");
    expect(read).not.toThrow("plaintext.invalid");
  });

  it("rejects unreadable and empty files with sanitized errors", () => {
    const directory = mkdtempSync(join(tmpdir(), "hr-axis-secret-"));
    const emptyPath = join(directory, "empty");
    writeFileSync(emptyPath, " \n", { encoding: "utf8", mode: 0o600 });
    chmodSync(emptyPath, 0o600);

    expect(() =>
      readFileBackedSetting(createConfig({ REDIS_URL_FILE: emptyPath }), "REDIS_URL"),
    ).toThrow("REDIS_URL_FILE must reference a non-empty readable file");
    expect(() =>
      readFileBackedSetting(
        createConfig({ JWT_SECRET_FILE: join(directory, "missing") }),
        "JWT_SECRET",
      ),
    ).toThrow("JWT_SECRET_FILE must reference a non-empty readable file");
  });

  it("rejects group-readable or world-readable secret modes", () => {
    expect(() => assertSecretFilePermissions("REDIS_URL_FILE", 0o100640)).toThrow(
      "REDIS_URL_FILE permissions are too permissive",
    );
    expect(() => assertSecretFilePermissions("JWT_SECRET_FILE", 0o100604)).toThrow(
      "JWT_SECRET_FILE permissions are too permissive",
    );
    expect(() => assertSecretFilePermissions("DATABASE_URL_FILE", 0o100600)).not.toThrow();
  });

  it("allows only the exact group-readable mode for photo credential files", () => {
    expect(() =>
      assertSecretFilePermissions("PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE", 0o100440),
    ).not.toThrow();
    expect(() =>
      assertSecretFilePermissions("PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY_FILE", 0o100444),
    ).toThrow("PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY_FILE permissions are too permissive");
    expect(() =>
      assertSecretFilePermissions("REDIS_URL_FILE", 0o100440),
    ).toThrow("REDIS_URL_FILE permissions are too permissive");
  });

  it("allows a public CA to be readable but never group/world writable", () => {
    expect(() =>
      assertPublicTrustFilePermissions("DB_SSL_CA_FILE", 0o100444),
    ).not.toThrow();
    expect(() =>
      assertPublicTrustFilePermissions("DB_SSL_CA_FILE", 0o100644),
    ).not.toThrow();
    expect(() =>
      assertPublicTrustFilePermissions("DB_SSL_CA_FILE", 0o100664),
    ).toThrow("DB_SSL_CA_FILE permissions allow untrusted modification");
    expect(() =>
      assertPublicTrustFilePermissions("DB_SSL_CA_FILE", 0o100646),
    ).toThrow("DB_SSL_CA_FILE permissions allow untrusted modification");
  });

  it("rejects symlinks, non-regular files, and unexpected owners", () => {
    expect(() =>
      assertSecretFileMetadata("DATABASE_URL_FILE", {
        isFile: () => true,
        isSymbolicLink: () => true,
      }),
    ).toThrow("DATABASE_URL_FILE must reference a regular non-symlink file");
    expect(() =>
      assertSecretFileMetadata("DATABASE_URL_FILE", {
        isFile: () => false,
        isSymbolicLink: () => false,
      }),
    ).toThrow("DATABASE_URL_FILE must reference a regular non-symlink file");
    expect(() => assertSecretFileOwnership("REDIS_URL_FILE", 1001, 65532)).toThrow(
      "REDIS_URL_FILE owner does not match the runtime user",
    );
    expect(() => assertSecretFileOwnership("REDIS_URL_FILE", 65532, 65532)).not.toThrow();
  });
});
