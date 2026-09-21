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
  assert.match(discipline, /55-60 saniye(?:lik|dir)/);
  assert.match(discipline, /Basarili uzun loglar modele tasinmaz/);
  assert.match(discipline, /Ayni hedefte tamamen okunmus operating docs/);
  assert.match(discipline, /ancak owner[\s\S]*acikca degistirirse gevsetilir/);
  assert.doesNotMatch(discipline, /30 saniyelik kanonik loop/);
});

test('entry and skill bodies have explicit context budgets', () => {
  const budgets = {
    'AGENTS.md': 4500,
    'CONTRIBUTING.md': 4000,
    'current-state.md': 6500,
    'discipline.md': 20000,
    'sokrates.md': 9000,
    '.agents/skills/hr-axis-ui/SKILL.md': 3500,
    '.agents/skills/hr-axis-pr-closeout/SKILL.md': 2500,
    '.agents/skills/hr-axis-session-handoff/SKILL.md': 2000,
    'SKILL/ui-ux-pro-max/SKILL.md': 1000,
  };
  for (const [path, max] of Object.entries(budgets)) {
    const text = readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
    assert.ok([...text].length <= max, `${path} exceeds ${max} characters; extract a relevant reference instead`);
  }
});

test('reading routes are conditional while high-risk and verification coverage stay mandatory', () => {
  assert.doesNotMatch(agents, /read all[\s\S]{0,50}four operating documents completely/i);
  for (const expected of ['Context recovery:', 'all touched risk domains must be covered',
    'Reopen only changed or', 'Unknown risk requires investigation',
    'docs/process/execution-release.md', 'docs/process/decision-risk-reference.md']) {
    assert.ok(agents.includes(expected), expected);
  }
  const skill = readFileSync(join(root, '.agents/skills/hr-axis-ui/SKILL.md'), 'utf8');
  assert.match(skill, /React\s+web/);
  assert.match(skill, /Do not regenerate a design system/);
  assert.match(skill, /missing evidence blocks parity claims/);
  assert.match(skill, /Marketing taste libraries are optional/);
  assert.doesNotMatch(skill, /this project's only tech stack|Always start with `--design-system`/);
});
