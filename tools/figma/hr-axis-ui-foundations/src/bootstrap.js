const HR = {}

HR.PAGE_NAMES = ["00 Cover", "01 Foundations", "02 Components"]
HR.GENERATED_PREFIX = "HR Axis / Generated"

// Theme colors and typography are generated from admin-web source files in
// catalog-manifest.generated.js before any Figma nodes are created.
HR.lightColors = {}
HR.darkColors = {}

HR.dimensions = {
  "space/4": 4,
  "space/8": 8,
  "space/10": 10,
  "space/12": 12,
  "space/16": 16,
  "space/24": 24,
  "space/32": 32,
  "radius/sm": 6,
  "radius/md": 8,
  "radius/lg": 10,
  "radius/xl": 14,
  "radius/2xl": 18,
  "radius/3xl": 22,
  "radius/4xl": 26,
  "control/xs": 24,
  "control/sm": 28,
  "control/md": 32,
  "control/lg": 36,
  "control/touch-target": 44,
  "icon/xs": 12,
  "icon/sm": 14,
  "icon/md": 16,
}

HR.typography = {}

HR.textStyles = [
  ["Page/Title", "SemiBold", 28, 34],
  ["Section/Title", "SemiBold", 18, 24],
  ["Body/Default", "Regular", 14, 20],
  ["Body/Strong", "SemiBold", 14, 20],
  ["Control/Label", "Medium", 14, 20],
  ["Metadata/Default", "Regular", 12, 16],
  ["Metadata/Strong", "SemiBold", 12, 16],
]

HR.hex = (value) => {
  const raw = value.replace("#", "")
  return {
    r: Number.parseInt(raw.slice(0, 2), 16) / 255,
    g: Number.parseInt(raw.slice(2, 4), 16) / 255,
    b: Number.parseInt(raw.slice(4, 6), 16) / 255,
  }
}

HR.fallbackPaint = (hex, opacity = 1) => ({
  type: "SOLID",
  color: HR.hex(hex),
  opacity,
})

HR.boundPaint = (variable, fallback = "#ff00ff", opacity = 1) => {
  const paint = HR.fallbackPaint(fallback, opacity)
  return variable
    ? figma.variables.setBoundVariableForPaint(paint, "color", variable)
    : paint
}

HR.ensurePage = (name) => {
  const existing = figma.root.children.find((page) => page.name === name)
  if (existing) return existing
  const page = figma.createPage()
  page.name = name
  return page
}

HR.findGeneratedNode = (page, suffix) =>
  page.children.find((node) => node.name === `${HR.GENERATED_PREFIX} / ${suffix}`)

HR.frame = (name, direction = "VERTICAL") => {
  const node = figma.createFrame()
  node.name = name
  node.layoutMode = direction
  node.primaryAxisSizingMode = "AUTO"
  node.counterAxisSizingMode = "AUTO"
  node.fills = []
  node.clipsContent = false
  return node
}

HR.pad = (node, top, right = top, bottom = top, left = right) => {
  node.paddingTop = top
  node.paddingRight = right
  node.paddingBottom = bottom
  node.paddingLeft = left
}

HR.bindNumber = (node, field, variable, fallback) => {
  if (field === "width") node.resize(fallback, node.height)
  else if (field === "height") node.resize(node.width, fallback)
  else node[field] = fallback
  if (variable) node.setBoundVariable(field, variable)
}

HR.loadFonts = async () => {
  const requested = ["Regular", "Medium", "SemiBold"]
  const loaded = {}
  for (const style of requested) {
    const styleCandidates = style === "SemiBold"
      ? ["Semibold", "SemiBold", "Semi Bold", "Bold"]
      : style === "Medium" ? ["Medium", "Regular"] : ["Regular"]
    const families = [
      HR.CATALOG.typography.productionFamily,
      ...HR.CATALOG.typography.fallbackFamilies,
    ]
    let selected = null
    for (const family of families) {
      for (const candidate of styleCandidates) {
        try {
          await figma.loadFontAsync({ family, style: candidate })
          selected = { family, style: candidate }
          break
        } catch {
          // Try the next declared production/fallback font style.
        }
      }
      if (selected) break
    }
    if (!selected) throw new Error(`Yazı tipi yüklenemedi: ${style}`)
    loaded[style] = selected
  }
  HR.fonts = loaded
  HR.typography["font/family/operational"] = loaded.Regular.family
  return loaded
}

HR.text = (characters, role = "Body", options = {}) => {
  const roleMap = {
    Page: ["SemiBold", 28, 34],
    Section: ["SemiBold", 18, 24],
    Body: ["Regular", 14, 20],
    Strong: ["SemiBold", 14, 20],
    Control: ["Medium", 14, 20],
    Metadata: ["Regular", 12, 16],
    MetadataStrong: ["SemiBold", 12, 16],
  }
  const [style, size, lineHeight] = roleMap[role]
  const node = figma.createText()
  node.name = options.name || role
  node.fontName = HR.fonts[style]
  node.fontSize = options.size || size
  node.lineHeight = { value: options.lineHeight || lineHeight, unit: "PIXELS" }
  node.characters = characters
  node.fills = [
    HR.boundPaint(
      options.colorVariable || HR.vars?.["color/foreground"],
      options.fallback || "#06142d",
      options.opacity ?? 1,
    ),
  ]
  return node
}

HR.variableScopes = (name) => {
  if (name.startsWith("color/")) {
    if (/foreground/.test(name)) return ["TEXT_FILL", "STROKE_COLOR", "SHAPE_FILL"]
    if (/border|input|ring/.test(name)) return ["STROKE_COLOR", "FRAME_FILL", "SHAPE_FILL"]
    return ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"]
  }
  if (name.startsWith("space/")) return ["GAP"]
  if (name.startsWith("radius/")) return ["CORNER_RADIUS"]
  if (name.startsWith("control/") || name.startsWith("icon/")) return ["WIDTH_HEIGHT"]
  if (name.includes("family")) return ["FONT_FAMILY"]
  if (name.includes("style")) return ["FONT_STYLE"]
  if (name.includes("/size/")) return ["FONT_SIZE"]
  if (name.includes("line-height")) return ["LINE_HEIGHT"]
  return ["TEXT_CONTENT"]
}

HR.colorCodeSyntax = (name) => `var(--${name.replace("color/", "").replaceAll("/", "-")})`
HR.dimensionCodeSyntax = (name, value) => {
  if (name.startsWith("radius/")) return `var(--${name.replaceAll("/", "-")})`
  if (name.startsWith("space/")) return `calc(var(--spacing) * ${value / 4})`
  return `${value}px`
}

HR.ensureVariable = (collection, variables, name, type, value, modeId, syntax) => {
  let variable = variables.find(
    (candidate) =>
      candidate.variableCollectionId === collection.id && candidate.name === name,
  )
  if (variable) return variable
  variable = figma.variables.createVariable(name, collection, type)
  variable.scopes = HR.variableScopes(name)
  variable.setVariableCodeSyntax("WEB", syntax)
  variable.setValueForMode(modeId, value)
  variables.push(variable)
  return variable
}

HR.ensureFoundations = async () => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const variables = await figma.variables.getLocalVariablesAsync()

  const ensureCollection = (name, modeName) => {
    let collection = collections.find((candidate) => candidate.name === name)
    if (!collection) {
      collection = figma.variables.createVariableCollection(name)
      collection.renameMode(collection.defaultModeId, modeName)
      collections.push(collection)
    }
    return collection
  }

  const light = ensureCollection("HR Axis / Color", "Light")
  const dark = ensureCollection("HR Axis / Color Dark Reference", "Dark")
  const dimensions = ensureCollection("HR Axis / Dimension", "Default")
  const typography = ensureCollection("HR Axis / Typography", "Default")

  for (const [name, hex] of Object.entries(HR.lightColors)) {
    HR.ensureVariable(
      light,
      variables,
      name,
      "COLOR",
      HR.hex(hex),
      light.defaultModeId,
      HR.colorCodeSyntax(name),
    )
  }
  for (const [name, hex] of Object.entries(HR.darkColors)) {
    HR.ensureVariable(
      dark,
      variables,
      name,
      "COLOR",
      HR.hex(hex),
      dark.defaultModeId,
      HR.colorCodeSyntax(name),
    )
  }
  for (const [name, value] of Object.entries(HR.dimensions)) {
    HR.ensureVariable(
      dimensions,
      variables,
      name,
      "FLOAT",
      value,
      dimensions.defaultModeId,
      HR.dimensionCodeSyntax(name, value),
    )
  }
  for (const [name, value] of Object.entries(HR.typography)) {
    const type = typeof value === "number" ? "FLOAT" : "STRING"
    HR.ensureVariable(
      typography,
      variables,
      name,
      type,
      value,
      typography.defaultModeId,
      name.startsWith("font/family") ? `font-family: "${value}"` : String(value),
    )
  }

  const refreshed = await figma.variables.getLocalVariablesAsync()
  HR.vars = Object.fromEntries(
    refreshed
      .filter((variable) =>
        [light.id, dimensions.id, typography.id].includes(variable.variableCollectionId),
      )
      .map((variable) => [variable.name, variable]),
  )
  HR.darkVars = Object.fromEntries(
    refreshed
      .filter((variable) => variable.variableCollectionId === dark.id)
      .map((variable) => [variable.name, variable]),
  )

  const existingTextStyles = await figma.getLocalTextStylesAsync()
  for (const [name, style, size, lineHeight] of HR.textStyles) {
    if (existingTextStyles.some((candidate) => candidate.name === name)) continue
    const textStyle = figma.createTextStyle()
    textStyle.name = name
    textStyle.fontName = HR.fonts[style]
    textStyle.fontSize = size
    textStyle.lineHeight = { value: lineHeight, unit: "PIXELS" }
    textStyle.description = "HR Axis operational interface typography."
  }

  const existingEffects = await figma.getLocalEffectStylesAsync()
  const effectDefinitions = [
    [
      "Shadow/Medium",
      [
        { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 6, spread: -1, visible: true, blendMode: "NORMAL" },
        { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 2 }, radius: 4, spread: -2, visible: true, blendMode: "NORMAL" },
      ],
    ],
    [
      "Shadow/Overlay",
      [
        { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 20 }, radius: 25, spread: -5, visible: true, blendMode: "NORMAL" },
        { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 8 }, radius: 10, spread: -6, visible: true, blendMode: "NORMAL" },
      ],
    ],
  ]
  for (const [name, effects] of effectDefinitions) {
    if (existingEffects.some((candidate) => candidate.name === name)) continue
    const effectStyle = figma.createEffectStyle()
    effectStyle.name = name
    effectStyle.effects = effects
    effectStyle.description = "Production-aligned HR Axis elevation."
  }

  return {
    collections: [light.name, dark.name, dimensions.name, typography.name],
    variableCount: Object.keys(HR.lightColors).length * 2 + Object.keys(HR.dimensions).length + Object.keys(HR.typography).length,
  }
}

HR.bindSurface = (node, fillName = "color/card", strokeName = "color/border") => {
  node.fills = [HR.boundPaint(HR.vars[fillName], HR.lightColors[fillName])]
  if (strokeName) {
    node.strokes = [HR.boundPaint(HR.vars[strokeName], HR.lightColors[strokeName])]
    node.strokeWeight = 1
  }
}

HR.bindRadius = (node, name = "radius/lg") => {
  const variable = HR.vars[name]
  const value = HR.dimensions[name]
  for (const field of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) {
    HR.bindNumber(node, field, variable, value)
  }
}

HR.bindPadding = (node, horizontalName, verticalName = horizontalName) => {
  const horizontal = HR.vars[horizontalName]
  const vertical = HR.vars[verticalName]
  HR.bindNumber(node, "paddingLeft", horizontal, HR.dimensions[horizontalName])
  HR.bindNumber(node, "paddingRight", horizontal, HR.dimensions[horizontalName])
  HR.bindNumber(node, "paddingTop", vertical, HR.dimensions[verticalName])
  HR.bindNumber(node, "paddingBottom", vertical, HR.dimensions[verticalName])
}

HR.bindGap = (node, name) =>
  HR.bindNumber(node, "itemSpacing", HR.vars[name], HR.dimensions[name])
