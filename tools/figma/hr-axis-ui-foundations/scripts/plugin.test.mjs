import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import test from "node:test"

import { runBundle } from "./runtime-smoke.mjs"

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("manifest loads the offline Figma Design plugin", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(pluginRoot, "manifest.json"), "utf8"),
  )

  assert.equal(manifest.main, "dist/code.js")
  assert.equal(manifest.ui, "ui.html")
  assert.deepEqual(manifest.editorType, ["figma"])
  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"])
})

test("bundle contains the agreed component and page scope", async () => {
  const bundle = await readFile(path.join(pluginRoot, "dist/code.js"), "utf8")
  const requiredNames = [
    "00 Cover",
    "01 Foundations",
    "02 Components",
    "shadcn/ui · Radix Nova",
    "Button",
    "Input + Textarea",
    "Field",
    "Input Group",
    "Select Trigger",
    "Badge",
    "Status Badge",
    "Checkbox",
    "Toggle Group",
    "Card",
    "Table",
    "Tabs Trigger",
    "Accordion Item",
    "Progress",
    "Skeleton",
    "Empty",
    "Separator",
    "Scroll Area",
    "Pagination",
    "Calendar",
    "Dialog",
    "Sheet",
    "Popover",
    "Dropdown Menu",
    "Alert Dialog",
    "Sonner Toast",
    "Breadcrumb",
    "Avatar",
    "Tooltip",
    "Spinner",
    "Chart",
    "Command",
    "Combobox",
    "Radio Group",
    "Switch",
    "Date Picker",
    "Drawer",
    "Collapsible",
  ]

  for (const name of requiredNames) {
    assert.ok(bundle.includes(name), `bundle is missing ${name}`)
  }
  assert.ok(bundle.includes("ensureVariable"))
  assert.ok(bundle.includes("findGeneratedNode"))
})

test("bundle is valid JavaScript", async () => {
  const bundle = await readFile(path.join(pluginRoot, "dist/code.js"), "utf8")
  assert.doesNotThrow(() => new Function(bundle))
})

test("bundle builds the system and remains idempotent", async () => {
  const bundle = await readFile(path.join(pluginRoot, "dist/code.js"), "utf8")
  const mock = await runBundle(bundle)

  assert.deepEqual(
    mock.figma.root.children.slice(0, 3).map((page) => page.name),
    ["00 Cover", "01 Foundations", "02 Components"],
  )
  assert.equal(mock.variables.length, 92)
  assert.ok(mock.messages.some((message) => message.type === "complete"))

  const componentPage = mock.figma.root.children.find(
    (page) => page.name === "02 Components",
  )
  const foundationsPage = mock.figma.root.children.find(
    (page) => page.name === "01 Foundations",
  )
  const foundationsRoot = foundationsPage.findOne(
    (node) => node.name === "HR Axis / Generated / Foundations",
  )
  assert.equal(foundationsRoot.primaryAxisSizingMode, "AUTO")
  assert.ok(
    foundationsRoot.children
      .filter((node) => node.type === "FRAME" && node.name.endsWith(" / Section"))
      .every((node) => node.primaryAxisSizingMode === "AUTO"),
  )
  const componentSetNames = componentPage
    .findAll((node) => node.type === "COMPONENT_SET")
    .map((node) => node.name)
  assert.deepEqual(componentSetNames, [
    "Badge",
    "Status Badge",
    "Button",
    "Input + Textarea",
    "Field",
    "Label",
    "Input Group",
    "Select Trigger",
    "Checkbox",
    "Toggle",
    "Toggle Group",
    "Card",
    "Table",
    "Progress",
    "Skeleton",
    "Empty",
    "Tabs Trigger",
    "Accordion Item",
    "Separator",
    "Scroll Area",
    "Pagination",
    "Calendar",
    "Dropdown Menu",
    "Alert Dialog",
    "Alert",
    "Sonner Toast",
    "Avatar",
    "Tooltip",
    "Combobox",
    "Radio Group",
    "Switch",
    "Date Picker",
    "Spinner",
    "Chart",
    "Collapsible",
  ])
  const componentsRoot = componentPage.findOne(
    (node) => node.name === "HR Axis / Generated / Components",
  )
  assert.equal(componentsRoot.primaryAxisSizingMode, "AUTO")
  assert.ok(
    componentsRoot.children.some(
      (node) => node.name === "Catalog Version / radix-nova-source-v6",
    ),
  )
  assert.ok(
    componentsRoot.children
      .filter((node) => node.type === "FRAME" && node.name.startsWith("HR Axis / Generated / "))
      .every((node) => node.primaryAxisSizingMode === "AUTO"),
  )
  const calendar = componentPage.findOne(
    (node) => node.type === "COMPONENT_SET" && node.name === "Calendar",
  )
  assert.ok(calendar.children.every((node) => node.primaryAxisSizingMode === "AUTO"))
  const button = componentPage.findOne(
    (node) => node.type === "COMPONENT_SET" && node.name === "Button",
  )
  assert.equal(button.children.length, 6 * 8 * 8)
  assert.match(button.description, /button-variants\.ts/)
  const pressedButton = button.children.find((node) => node.name.includes("Interaction=pressed"))
  assert.equal(pressedButton.paddingTop, 2)
  assert.equal(pressedButton.paddingBottom, 0)

  const checkbox = componentPage.findOne(
    (node) => node.type === "COMPONENT_SET" && node.name === "Checkbox",
  )
  assert.ok(checkbox.children.find((node) => node.name === "State=focus").effects.length > 0)

  const calendarStates = Object.fromEntries(calendar.children.map((node) => [node.name, node]))
  const calendarCell = (state) => calendarStates[`State=${state}`].findOne((node) => node.name === "day 9")
  assert.equal(calendarCell("default").fills.length, 0)
  assert.ok(calendarCell("today").fills.length > 0)
  assert.equal(calendarCell("disabled").opacity, 0.5)
  assert.ok(calendarCell("focused").effects.length > 0)
  assert.equal(calendarCell("range-middle").cornerRadius, 0)

  const card = componentPage.findOne(
    (node) => node.type === "COMPONENT_SET" && node.name === "Card",
  )
  assert.ok(card.children.every((node) => node.findOne((child) => child.name === "CardAction")))
  const table = componentPage.findOne(
    (node) => node.type === "COMPONENT_SET" && node.name === "Table",
  )
  for (const anatomy of ["TableHeader", "TableBody", "TableFooter", "TableCaption"]) {
    assert.ok(table.children.every((node) => node.findOne((child) => child.name === anatomy)))
  }
  for (const family of ["Dialog", "Sheet", "Popover"]) {
    assert.ok(
      componentPage.findOne((node) => node.type === "COMPONENT" && node.name === family),
      `${family} anatomy component is missing`,
    )
  }
  const popover = componentPage.findOne((node) => node.type === "COMPONENT" && node.name === "Popover")
  assert.equal(popover.findOne((node) => node.name === "Close button"), null)
  const dialog = componentPage.findOne((node) => node.type === "COMPONENT" && node.name === "Dialog")
  assert.ok(dialog.findOne((node) => node.name === "Close button"))

  const patternsRoot = componentPage.findOne(
    (node) => node.name === "HR Axis / Generated / Patterns",
  )
  const patternNames = [
    "Page header",
    "KPI grid",
    "Filter toolbar",
    "Advanced data table",
    "Detail panel",
    "Form section",
    "Dashboard summary",
    "Inbox list",
    "Empty state",
    "No results",
    "Loading state",
    "Error state",
    "Permission state",
    "Confirmation",
    "Responsive filters",
    "Command palette",
  ]
  const patternCards = patternsRoot.children.filter((node) => patternNames.includes(node.name))
  assert.equal(patternCards.length, patternNames.length)
  assert.ok(patternCards.every((node) => node.findAll((child) => child.type === "INSTANCE").length >= 2))

  for (const family of ["Breadcrumb", "Command", "Drawer"]) {
    assert.ok(
      componentPage.findOne((node) => node.type === "COMPONENT" && node.name === family),
      `${family} component is missing`,
    )
  }

  const pageTemplates = patternsRoot.children.filter((node) => node.name.startsWith("Page Template / "))
  assert.deepEqual(pageTemplates.map((node) => node.name), [
    "Page Template / List / Management",
    "Page Template / Dashboard",
    "Page Template / Detail / Audit",
    "Page Template / Form / Settings",
  ])
  assert.ok(pageTemplates.every((node) => node.findAll((child) => child.type === "INSTANCE").length >= 7))

  const countsBeforeRerun = {
    variables: mock.variables.length,
    nodes: mock.figma.root.findAll(() => true).length,
  }
  await mock.figma.ui.onmessage({ type: "build" })
  assert.equal(mock.variables.length, countsBeforeRerun.variables)
  assert.equal(mock.figma.root.findAll(() => true).length, countsBeforeRerun.nodes)
})
