import { join } from 'node:path'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { buildStageInputs, makeStageRecord, readJson, reusableStage, stageOutputDigest } from './release-recovery.mjs'

export function prepareStageRecovery({ root, stage, resume }) {
  const path = join(root, 'tmp', 'release-gate', 'recovery', stage.id + '.json')
  const inputs = buildStageInputs({ root, stage })
  const record = resume ? readJson(path) : null
  const decision = reusableStage({ record, stage, inputs, outputDigest: stageOutputDigest(root, stage) })
  return { path, inputs, record, ...decision }
}

export function recordStageRecovery({ root, stage, prepared, startedAt, durationMs, write }) {
  const record = makeStageRecord({ root, stage, inputs: prepared.inputs, startedAt, durationMs })
  mkdirSync(join(root, 'tmp', 'release-gate', 'recovery'), { recursive: true })
  write(prepared.path, record)
  return record
}

export function clearStageRecovery(prepared) {
  if (existsSync(prepared.path)) rmSync(prepared.path)
}
