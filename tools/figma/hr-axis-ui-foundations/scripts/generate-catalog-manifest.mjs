import { readdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(pluginRoot, "../../..")
const adminRoot = path.join(repoRoot, "admin-web")
const outputPath = path.join(pluginRoot, "src/catalog-manifest.generated.js")

const colorNames = [
  "background", "foreground", "card", "card-foreground", "popover",
  "popover-foreground", "primary", "primary-foreground", "secondary",
  "secondary-foreground", "muted", "muted-foreground", "accent",
  "accent-foreground", "destructive", "success", "success-foreground",
  "success-soft", "warning", "warning-foreground", "warning-soft", "border",
  "input", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
]

const patterns = [
  { name: "Page header", components: ["Breadcrumb", "Button"] },
  { name: "KPI grid", components: ["Card", "Status Badge"] },
  { name: "Filter toolbar", components: ["Field", "Input Group", "Select Trigger", "Button"] },
  { name: "Advanced data table", components: ["Card", "Checkbox", "Table", "Status Badge", "Dropdown Menu", "Pagination"] },
  { name: "Detail panel", components: ["Card", "Avatar", "Status Badge", "Separator", "Collapsible", "Button"] },
  { name: "Form section", components: ["Card", "Field", "Input + Textarea", "Combobox", "Radio Group", "Switch", "Date Picker", "Button"] },
  { name: "Dashboard summary", components: ["Card", "Chart", "Status Badge", "Table"] },
  { name: "Inbox list", components: ["Avatar", "Checkbox", "Status Badge", "Dropdown Menu", "Pagination"] },
  { name: "Empty state", components: ["Empty", "Button"] },
  { name: "No results", components: ["Empty", "Button"] },
  { name: "Loading state", components: ["Card", "Skeleton", "Spinner", "Progress"] },
  { name: "Error state", components: ["Alert", "Button"] },
  { name: "Permission state", components: ["Alert", "Button"] },
  { name: "Confirmation", components: ["Alert Dialog", "Button"] },
  { name: "Responsive filters", components: ["Drawer", "Field", "Select Trigger", "Date Picker", "Button"] },
  { name: "Command palette", components: ["Command", "Combobox"] },
]

const pageTemplates = [
  {
    name: "List / Management",
    description: "Header, filters, selectable records, row actions and complete route states.",
    components: ["Breadcrumb", "Button", "Card", "Field", "Input Group", "Select Trigger", "Date Picker", "Table", "Status Badge", "Dropdown Menu", "Pagination", "Empty", "Spinner"],
  },
  {
    name: "Dashboard",
    description: "Operational summary with KPIs, trend visualization and a supporting table.",
    components: ["Breadcrumb", "Button", "Card", "Chart", "Status Badge", "Table", "Pagination"],
  },
  {
    name: "Detail / Audit",
    description: "Record identity, current status, metadata, history and guarded actions.",
    components: ["Breadcrumb", "Button", "Card", "Avatar", "Status Badge", "Separator", "Collapsible", "Table", "Sheet", "Alert Dialog"],
  },
  {
    name: "Form / Settings",
    description: "Sectioned form with validation-ready controls, preferences and save feedback.",
    components: ["Breadcrumb", "Tabs Trigger", "Card", "Field", "Input + Textarea", "Combobox", "Radio Group", "Switch", "Date Picker", "Button", "Alert Dialog", "Sonner Toast"],
  },
]

const componentFileByName = {
  Alert: "alert",
  "Alert Dialog": "alert-dialog",
  Avatar: "avatar",
  Breadcrumb: "breadcrumb",
  Button: "button",
  Card: "card",
  Checkbox: "checkbox",
  Chart: "chart",
  Collapsible: "collapsible",
  Combobox: "combobox",
  Command: "command",
  "Date Picker": "date-picker",
  "Dropdown Menu": "dropdown-menu",
  Drawer: "drawer",
  Empty: "empty",
  Field: "field",
  "Input + Textarea": "input",
  "Input Group": "input-group",
  Pagination: "pagination",
  Progress: "progress",
  "Radio Group": "radio-group",
  "Select Trigger": "select",
  Separator: "separator",
  Sheet: "sheet",
  Skeleton: "skeleton",
  "Sonner Toast": "sonner",
  Spinner: "spinner",
  "Status Badge": "status-badge",
  Switch: "switch",
  Table: "table",
  "Tabs Trigger": "tabs",
  Tooltip: "tooltip",
}

const clamp = (value) => Math.min(1, Math.max(0, value))
const gamma = (value) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
const byte = (value) => Math.round(clamp(gamma(value)) * 255).toString(16).padStart(2, "0")

const oklchToHex = (value) => {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (!match) throw new Error(`Unsupported color value: ${value}`)
  const lightness = Number(match[1])
  const chroma = Number(match[2])
  const hue = Number(match[3]) * Math.PI / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return `#${byte(red)}${byte(green)}${byte(blue)}`
}

const extractBlock = (css, selector) => {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`Missing ${selector} block in shadcn-tailwind.css`)
  const bodyStart = css.indexOf("{", start) + 1
  let depth = 1
  for (let index = bodyStart; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1
    if (css[index] === "}") depth -= 1
    if (depth === 0) return css.slice(bodyStart, index)
  }
  throw new Error(`Unclosed ${selector} block in shadcn-tailwind.css`)
}

const readColors = (block) => Object.fromEntries(colorNames.map((name) => {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Missing --${name} token in shadcn-tailwind.css`)
  const raw = match[1].trim()
  const value = raw.startsWith("oklch(") ? oklchToHex(raw) : raw
  return [`color/${name.replaceAll("-", "/")}`, value]
}))

const componentsJson = JSON.parse(await readFile(path.join(adminRoot, "components.json"), "utf8"))
const themeCss = await readFile(path.join(adminRoot, "src/styles/shadcn-tailwind.css"), "utf8")
const foundationCss = await readFile(path.join(adminRoot, "src/styles/foundation.css"), "utf8")
const uiDirectory = path.join(adminRoot, "src/components/ui")
const componentFiles = (await readdir(uiDirectory))
  .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
  .map((name) => name.replace(/\.tsx$/, ""))
  .sort()

for (const composition of [...patterns, ...pageTemplates]) {
  for (const component of composition.components) {
    const source = componentFileByName[component]
    if (!source || !componentFiles.includes(source)) {
      throw new Error(`${composition.name} references missing component: ${component}`)
    }
  }
}

const fontMatch = foundationCss.match(/--legacy-font-sans:\s*'([^']+)'/)
if (!fontMatch) throw new Error("Cannot resolve the production font from foundation.css")

const manifest = {
  version: "radix-nova-source-v6",
  generatedFrom: [
    "admin-web/components.json",
    "admin-web/src/styles/shadcn-tailwind.css",
    "admin-web/src/styles/foundation.css",
    "admin-web/src/components/ui/*.tsx",
  ],
  config: {
    style: componentsJson.style,
    base: componentsJson.style.startsWith("radix-") ? "radix" : "base",
    iconLibrary: componentsJson.iconLibrary,
    tailwindPrefix: componentsJson.tailwind.prefix,
  },
  typography: {
    productionFamily: fontMatch[1],
    fallbackFamilies: ["DM Sans", "Inter"],
  },
  colors: {
    light: readColors(extractBlock(themeCss, ":root")),
    dark: readColors(extractBlock(themeCss, ".dark")),
  },
  componentFiles,
  patterns,
  pageTemplates,
}

const output = [
  "// Generated by scripts/generate-catalog-manifest.mjs. Do not edit by hand.",
  `HR.CATALOG = ${JSON.stringify(manifest, null, 2)}`,
  "HR.SHADCN_CATALOG_VERSION = HR.CATALOG.version",
  "HR.lightColors = HR.CATALOG.colors.light",
  "HR.darkColors = HR.CATALOG.colors.dark",
  "HR.typography = {",
  '  "font/family/operational": HR.CATALOG.typography.productionFamily,',
  '  "font/style/regular": "Regular",',
  '  "font/style/medium": "Medium",',
  '  "font/style/semibold": "SemiBold",',
  '  "font/size/metadata": 12,',
  '  "font/size/body": 14,',
  '  "font/size/section": 18,',
  '  "font/size/page": 28,',
  '  "font/line-height/metadata": 16,',
  '  "font/line-height/body": 20,',
  '  "font/line-height/section": 24,',
  '  "font/line-height/page": 34,',
  "}",
  "",
].join("\n")

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "")
  if (current !== output) throw new Error("catalog-manifest.generated.js is stale; run npm.cmd run build")
} else {
  await writeFile(outputPath, output, "utf8")
}
