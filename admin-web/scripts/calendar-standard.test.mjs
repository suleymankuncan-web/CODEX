import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '../src')
// Incentive/Primler work is deliberately parked as one atomic product slice.
// Keep this migration guard focused on every active non-incentive surface.
const files = fs.readdirSync(root, { recursive: true }).filter(file =>
  file.endsWith('.tsx') &&
  !file.replaceAll('\\', '/').startsWith('features/incentives/') &&
  file.replaceAll('\\', '/') !== 'pages/store-kpis-period-picker.tsx' &&
  file.replaceAll('\\', '/') !== 'pages/store-incentives-period-picker.tsx'
)

test('date pickers keep one DayPicker owner and route native date fields through Input', () => {
  const violations = []
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node) {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(source)
        if (tag === 'DayPicker' && file.replaceAll('\\', '/') !== 'components/ui/calendar.tsx') violations.push(`${file}: separate DayPicker`)
        if (tag === 'input') {
          const type = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'type')
          if (type?.initializer && ts.isStringLiteral(type.initializer) && ['date', 'month', 'datetime-local'].includes(type.initializer.text)) violations.push(`${file}: native calendar bypasses Input`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.deepEqual(violations, [])
  const input = fs.readFileSync(path.join(root, 'components/ui/input.tsx'), 'utf8')
  assert.match(input, /CalendarInput/)
  for (const file of files.filter(file => /(?:period-picker|PeriodPicker|month-year-picker)\.tsx$/.test(file))) {
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    assert.doesNotMatch(text, /<DayPicker|months\.map|monthLabels\.map|monthNames\.map/, `${file} defines a separate calendar`)
  }
})
