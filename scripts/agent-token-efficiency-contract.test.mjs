import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
const discipline = readFileSync(join(root, "discipline.md"), "utf8");

test("agent entry routes monitoring to its canonical execution policy", () => {
  assert.match(agents, /discipline\.md#token-verimli-otonom-yurutme/);
  assert.match(discipline, /### Token-Verimli Otonom Yurutme/);
  assert.match(discipline, /Do not spawn a model agent only to wait or poll/);
  assert.match(discipline, /Targeted kanit normalde bir kez/);
  assert.match(discipline, /selector'in sectigi full release normalde bir/);
});

test("execution discipline keeps the owner-locked token policy", () => {
  assert.match(discipline, /Token-Verimli Otonom Yurutme/);
  assert.match(discipline, /55-60 saniyelik/);
  assert.match(discipline, /Basarili uzun loglar modele tasinmaz/);
  assert.match(discipline, /Ayni hedefte tamamen okunmus operating docs/);
  assert.match(discipline, /ancak owner[\s\S]*acikca degistirirse gevsetilir/);
  assert.doesNotMatch(discipline, /30 saniyelik kanonik loop/);
});
