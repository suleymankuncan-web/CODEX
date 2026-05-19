import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

const candidates = [
  resolve(process.cwd(), "dist/src/openapi/generate-openapi.js"),
  resolve(process.cwd(), "dist/openapi/generate-openapi.js"),
];

const generatorPath = candidates.find((candidate) => existsSync(candidate));

if (!generatorPath) {
  throw new Error(
    `OpenAPI generator build output was not found. Checked: ${candidates.join(", ")}`,
  );
}

require(generatorPath);
