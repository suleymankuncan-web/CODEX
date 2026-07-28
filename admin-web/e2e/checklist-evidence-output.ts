import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import type { TestInfo } from '@playwright/test'

const repositoryEvidenceRoot = resolve(process.cwd(), '..', 'docs', 'evidence')

export function checklistEvidenceOutputPath(testInfo: TestInfo, relativePath: string) {
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error('Checklist evidence output must be a repository-relative evidence path')
  }

  const outputPath = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'
    ? resolve(repositoryEvidenceRoot, relativePath)
    : testInfo.outputPath('checklist-evidence', relativePath)
  if (process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1') {
    const fromEvidenceRoot = relative(repositoryEvidenceRoot, outputPath)
    if (fromEvidenceRoot.startsWith('..') || isAbsolute(fromEvidenceRoot)) {
      throw new Error('Checklist evidence output escaped docs/evidence')
    }
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  return outputPath
}
