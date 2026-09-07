import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = join(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const config = read('.codex/config.toml')

test('repository inherits selected model and effort defaults without worker roles', () => {
  assert.match(config, /^model_reasoning_effort = "medium"$/m)
  assert.match(config, /^plan_mode_reasoning_effort = "high"$/m)
  assert.doesNotMatch(config, /^model\s*=/m)
  assert.doesNotMatch(config, /^\[agents(?:\.|\])/m)
  for (const role of ['luna-max', 'luna-max-fast', 'problem-solver-high', 'planner-xhigh']) {
    assert.equal(existsSync(join(root, '.codex/agents/' + role + '.toml')), false, role)
  }
})

test('entry and execution policy require task-specific delegation authority', () => {
  for (const path of ['AGENTS.md', 'discipline.md']) {
    const text = read(path).replace(/\s+/g, ' ')
    assert.ok(text.includes('Do not spawn or reuse subagents unless the user explicitly requests delegation for the current task'))
    assert.doesNotMatch(text, /Luna prompt|Luna Max|luna_max/)
    assert.ok(text.includes('final R4/R5 review'))
  }
  assert.ok(read('AGENTS.md').includes('discipline.md#adaptive-reasoning-effort-routing'))
})

test('inline review retains failure limits and honest review attribution', () => {
  const text = read('discipline.md').replace(/\s+/g, ' ')
  for (const expected of [
    'two evidence-based correction attempts',
    'does not reset the failure budget',
    'never independent agent review',
    'Record actionable findings and their resolution separately',
    'No dedicated problem-solver agent is used',
  ]) assert.ok(text.includes(expected), expected)
})
