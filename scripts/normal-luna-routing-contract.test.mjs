import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.ok(
    text.replace(/\s+/g, ' ').includes(expected.replace(/\s+/g, ' ')),
    `Missing routing contract: ${expected}`,
  )
}

const config = readText('.codex/config.toml')
const agents = readText('AGENTS.md')
const contributing = readText('CONTRIBUTING.md')
const discipline = readText('discipline.md')
const currentState = readText('current-state.md')

test('repository config exposes normal Luna Max and caps planning at High', () => {
  requireText(config, 'plan_mode_reasoning_effort = "high"')
  requireText(config, '[agents.luna_max]')
  requireText(config, 'config_file = "agents/luna-max.toml"')

  assert.doesNotMatch(config, /\[agents\.luna_max_fast\]/)
  assert.doesNotMatch(config, /\[agents\.planner_xhigh\]/)
  assert.equal(existsSync(join(workspaceRoot, '.codex/agents/luna-max-fast.toml')), false)
  assert.equal(existsSync(join(workspaceRoot, '.codex/agents/planner-xhigh.toml')), false)
})

test('normal Luna role keeps max reasoning without a fast service-tier override', () => {
  const lunaPath = join(workspaceRoot, '.codex/agents/luna-max.toml')
  assert.equal(existsSync(lunaPath), true)
  const luna = readFileSync(lunaPath, 'utf8')

  requireText(luna, 'model = "gpt-5.6-luna"')
  requireText(luna, 'model_reasoning_effort = "max"')
  assert.doesNotMatch(luna, /^service_tier\s*=/m)
})

test('operating docs route bounded execution to normal Luna and cap reasoning at High', () => {
  for (const text of [agents, contributing, discipline, currentState]) {
    assert.doesNotMatch(text, /luna_max_fast/)
    assert.doesNotMatch(text, /Luna Max Fast/)
    assert.doesNotMatch(text, /planner_xhigh/)
    assert.doesNotMatch(text, /\bXHigh\b/)
  }

  requireText(agents, 'Use `luna_max` with `fork_turns: "none"` as the default cost-efficient execution specialist.')
  requireText(agents, 'Do not set a fast service tier override.')
  requireText(discipline, '`Luna Max normal-speed execution worker`')
  requireText(currentState, 'default bounded normal-speed Luna Max execution and read-only High review')
})
