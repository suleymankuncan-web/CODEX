import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const discipline = readFileSync(join(root, "discipline.md"), "utf8");

test("agent entry contract keeps token-efficient monitoring locked", () => {
  assert.match(agents, /55-60 second idle polling intervals/);
  assert.match(agents, /never stream complete successful logs/);
  assert.match(agents, /Do not spawn a model agent only to wait or poll/);
  assert.match(
    agents,
    /run the\s+targeted proof once and the selected full release once/,
  );
});

test("execution discipline keeps the owner-locked token policy", () => {
  assert.match(discipline, /Token-Verimli Otonom Yurutme/);
  assert.match(discipline, /55-60 saniyelik/);
  assert.match(discipline, /Basarili uzun loglar modele tasinmaz/);
  assert.match(discipline, /Ayni hedefte tamamen okunmus operating docs/);
  assert.match(discipline, /ancak owner[\s\S]*acikca degistirirse gevsetilir/);
  assert.doesNotMatch(discipline, /30 saniyelik kanonik loop/);
});
