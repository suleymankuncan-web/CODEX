import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const sharp: typeof import("sharp").default = require("sharp");
import { buildKeycloakTemplates } from "../src/shared/mail/keycloak-theme";
import { mailIconArtwork, type MailIcon } from "../src/shared/mail/visual-language";

async function generate() {
  const root = resolve(__dirname, "../../..");
  const backendAssets = resolve(root, "backend/nestjs/src/shared/mail/assets");
  const theme = resolve(root, "infra/onprem/core/keycloak/themes/hr-axis/email");
  const themeAssets = resolve(theme, "resources/img");
  for (const dir of [backendAssets, themeAssets, resolve(theme, "html")]) mkdirSync(dir, { recursive: true });
  const check = process.argv.includes("--check");
  const output = (path: string, content: Buffer | string) => {
    if (check) {
      if (!readFileSync(path).equals(Buffer.from(content))) throw new Error(`Generated mail file drift: ${path}`);
    } else writeFileSync(path, content);
  };
  const logo = await sharp(resolve(root, "admin-web/src/assets/login-studio/hr-axis-logo.png")).resize({ width: 280 }).png().toBuffer();
  for (const dir of [backendAssets, themeAssets]) output(resolve(dir, "logo.png"), logo);
  for (const icon of ["security", "approval", "people", "sync"] as MailIcon[]) {
    const png = await sharp(Buffer.from(mailIconArtwork(icon))).png().toBuffer();
    output(resolve(backendAssets, `${icon}.png`), png);
    // Keycloak account messages share the security illustration.
    if (icon === "security") output(resolve(themeAssets, `${icon}.png`), png);
  }
  for (const [filename, template] of Object.entries(buildKeycloakTemplates())) output(resolve(theme, "html", filename), template);
  console.log(check ? "Shared mail assets and Keycloak templates match source." : "Shared mail assets and Keycloak templates generated.");
}

void generate().catch(error => { console.error(error.message); process.exitCode = 1; });
