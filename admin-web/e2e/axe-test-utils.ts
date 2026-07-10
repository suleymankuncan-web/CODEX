import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export async function expectNoCriticalAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === 'critical',
  )
  const failureSummary = criticalViolations.map((violation) => ({
    help: violation.help,
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.flatMap((node) => node.target),
  }))

  expect(
    criticalViolations,
    `Critical WCAG 2 A/AA violations:\n${JSON.stringify(failureSummary, null, 2)}`,
  ).toEqual([])
}
