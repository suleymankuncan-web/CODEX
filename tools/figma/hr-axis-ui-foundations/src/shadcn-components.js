HR.catalogMarkerName = `Catalog Version / ${HR.SHADCN_CATALOG_VERSION}`
HR.hasCurrentCatalog = (node) => Boolean(node?.children?.some((child) => child.name === HR.catalogMarkerName))
HR.markCurrentCatalog = (node) => {
  const marker = figma.createRectangle()
  marker.name = HR.catalogMarkerName
  marker.resize(1, 1)
  marker.visible = false
  node.appendChild(marker)
}

HR.shadcnMeta = (node, source, anatomy) => {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    node.description = `shadcn/ui radix-nova · ${source}${anatomy ? ` · Anatomy: ${anatomy}` : ""}`
  }
  return node
}

HR.shadcnIconPaths = {
  Check: '<path d="m5 12 4 4L19 6"></path>',
  Minus: '<path d="M5 12h14"></path>',
  AlertCircle: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path>',
  Loader: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>',
  MoreHorizontal: '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
  Bold: '<path d="M6 4h7a4 4 0 0 1 0 8H6zm0 8h8a4 4 0 0 1 0 8H6z"></path>',
  Italic: '<path d="M10 4h8M6 20h8M14 4 10 20"></path>',
}

HR.shadcnIcon = (name, variable = HR.vars["color/foreground"], size = 16) => {
  if (!HR.shadcnIconPaths[name]) return HR.iconSvg(name, variable, size)
  const svg = figma.createNodeFromSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06142d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${HR.shadcnIconPaths[name]}</svg>`,
  )
  svg.name = `icon / ${name}`
  svg.resize(size, size)
  for (const vector of svg.findAll((node) => node.type === "VECTOR")) {
    if (vector.strokes?.length) vector.strokes = [HR.boundPaint(variable, "#06142d")]
  }
  return svg
}

HR.shadcnText = (value, role = "Body", color = "color/foreground", name = "label") =>
  HR.text(value, role, {
    name,
    colorVariable: HR.vars[color],
    fallback: HR.lightColors[color],
  })

HR.shadcnSurface = (name, width, height, direction = "VERTICAL") => {
  const node = HR.frame(name, direction)
  node.resize(width, height)
  node.primaryAxisSizingMode = "FIXED"
  node.counterAxisSizingMode = "FIXED"
  HR.bindSurface(node, "color/card", "color/border")
  HR.bindRadius(node, "radius/lg")
  return node
}

HR.shadcnSection = (root, title, source, description) => {
  const section = HR.componentSection(title, `${description} Kaynak: ${source}.`)
  section.resize(1832, section.height)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.shadcnMeta(section, source)
  root.appendChild(section)
  return section
}

HR.shadcnVariantSet = (items, parent, name, columns, source, anatomy) => {
  const set = HR.combineVariantGrid(items, parent, name, columns, `shadcn/ui radix-nova · ${source}`)
  const gap = 24
  const padding = 24
  const rows = Math.ceil(set.children.length / columns)
  const columnWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)
  set.children.forEach((child, index) => {
    columnWidths[index % columns] = Math.max(columnWidths[index % columns], child.width)
    rowHeights[Math.floor(index / columns)] = Math.max(rowHeights[Math.floor(index / columns)], child.height)
  })
  const columnX = []
  const rowY = []
  let x = padding
  for (const width of columnWidths) { columnX.push(x); x += width + gap }
  let y = padding
  for (const height of rowHeights) { rowY.push(y); y += height + gap }
  set.children.forEach((child, index) => {
    child.x = columnX[index % columns]
    child.y = rowY[Math.floor(index / columns)]
  })
  set.resizeWithoutConstraints(Math.max(1, x - gap + padding), Math.max(1, y - gap + padding))
  HR.shadcnMeta(set, source, anatomy)
  return set
}

HR.shadcnButton = (variant, size, state) => {
  const heightMap = { default: 32, xs: 24, sm: 28, lg: 36, icon: 32, "icon-xs": 24, "icon-sm": 28, "icon-lg": 36 }
  const paddingMap = { default: 10, xs: 8, sm: 10, lg: 10 }
  const iconOnly = size.startsWith("icon")
  const colorMap = {
    default: ["color/primary", "color/primary/foreground", null, 1],
    outline: [state === "hover" || state === "expanded" ? "color/muted" : "color/background", "color/foreground", "color/border", 1],
    secondary: ["color/secondary", "color/secondary/foreground", null, state === "hover" ? 0.8 : 1],
    ghost: [state === "hover" || state === "expanded" ? "color/muted" : null, "color/foreground", null, 1],
    destructive: ["color/destructive", "color/destructive", null, state === "hover" ? 0.2 : 0.1],
    link: [null, "color/primary", null, 1],
  }
  const [fill, textColor, stroke, opacity] = colorMap[variant]
  const node = HR.controlComponent({
    name: `Variant=${variant}, Size=${size}, Interaction=${state}`,
    heightName: "control/md",
    fill,
    stroke: state === "invalid" ? "color/destructive" : state === "focus" ? "color/ring" : stroke,
    opacity,
  })
  node.resize(iconOnly ? heightMap[size] : 112, heightMap[size])
  node.primaryAxisSizingMode = iconOnly ? "FIXED" : "AUTO"
  node.opacity = state === "disabled" ? 0.5 : 1
  node.itemSpacing = size === "xs" || size === "sm" ? 4 : 6
  const radius = size === "xs" || size === "icon-xs" ? 8 : size === "sm" || size === "icon-sm" ? 8 : 10
  node.cornerRadius = radius
  if (state === "focus" || state === "invalid") {
    const tone = state === "invalid" ? "color/destructive" : "color/ring"
    node.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors[tone]), a: 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }]
  }
  if (state === "pressed") {
    node.paddingTop = 2
    node.paddingBottom = 0
  }
  if (!iconOnly) {
    const padding = paddingMap[size]
    node.paddingLeft = padding
    node.paddingRight = padding
  }
  const icon = HR.shadcnIcon(state === "loading" ? "Loader" : "Calendar", HR.vars[textColor], iconOnly && heightMap[size] === 24 ? 12 : 16)
  icon.name = "icon"
  node.appendChild(icon)
  if (!iconOnly) {
    const label = HR.shadcnText(state === "loading" ? "Loading" : "Button", size === "xs" ? "MetadataStrong" : "Control", textColor)
    if (variant === "link" && state === "hover") label.textDecoration = "UNDERLINE"
    node.appendChild(label)
  }
  return node
}

HR.ensureShadcnButtons = (root) => {
  const section = HR.shadcnSection(root, "Button", "admin-web/src/components/ui/button-variants.ts", "Resmi Nova API matrisi, etkileşim ve erişilebilirlik durumları")
  const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"]
  const sizes = ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"]
  const states = ["default", "hover", "focus", "pressed", "disabled", "loading", "invalid", "expanded"]
  const items = []
  for (const variant of variants) for (const size of sizes) for (const state of states) items.push(HR.shadcnButton(variant, size, state))
  const set = HR.shadcnVariantSet(items, section, "Button", 8, "button-variants.ts", "Button > icon + label; API: variant + size; interaction specs include pseudo, ARIA and composed loading states")
  const labelKey = set.addComponentProperty("Label", "TEXT", "Button")
  const iconKey = set.addComponentProperty("Show icon", "BOOLEAN", true)
  for (const item of set.children) {
    const label = item.findOne((node) => node.name === "label")
    const icon = item.findOne((node) => node.name === "icon")
    if (label) label.componentPropertyReferences = { characters: labelKey }
    if (icon) icon.componentPropertyReferences = { visible: iconKey }
  }
}

HR.shadcnBadge = (variant, state) => {
  const map = {
    default: ["color/primary", "color/primary/foreground", null, 1],
    secondary: ["color/secondary", "color/secondary/foreground", null, 1],
    destructive: ["color/destructive", "color/destructive", null, 0.1],
    outline: [state === "hover" ? "color/muted" : "color/card", "color/foreground", "color/border", 1],
    ghost: [state === "hover" ? "color/muted" : null, "color/muted/foreground", null, 1],
    link: [null, "color/primary", null, 1],
  }
  const [fill, ink, stroke, opacity] = map[variant]
  const node = HR.controlComponent({ name: `Variant=${variant}, State=${state}`, heightName: "control/xs", fill, stroke, opacity })
  node.resize(86, 20)
  node.primaryAxisSizingMode = "AUTO"
  node.paddingLeft = 8
  node.paddingRight = 8
  node.itemSpacing = 4
  node.cornerRadius = 26
  if (state === "focus") node.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors["color/ring"]), a: 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }]
  node.appendChild(HR.shadcnIcon("Check", HR.vars[ink], 12))
  node.appendChild(HR.shadcnText("Badge", "MetadataStrong", ink))
  return node
}

HR.ensureShadcnBadges = (root) => {
  const section = HR.shadcnSection(root, "Badge", "admin-web/src/components/ui/badge.tsx", "Altı resmi varyant; icon, hover ve focus örnekleri")
  const items = []
  for (const variant of ["default", "secondary", "destructive", "outline", "ghost", "link"])
    for (const state of ["default", "hover", "focus"]) items.push(HR.shadcnBadge(variant, state))
  HR.shadcnVariantSet(items, section, "Badge", 6, "badge.tsx", "Badge > optional icon + label")

  const tones = {
    danger: ["color/destructive", "color/destructive", "color/destructive"],
    info: ["color/primary", "color/primary", "color/primary"],
    neutral: ["color/muted", "color/muted/foreground", "color/border"],
    success: ["color/success/soft", "color/success/foreground", "color/success"],
    warning: ["color/warning/soft", "color/warning/foreground", "color/warning"],
  }
  const statusBadges = Object.entries(tones).map(([tone, [fill, ink, stroke]]) => {
    const node = HR.controlComponent({ name: `Tone=${tone}`, heightName: "control/xs", fill: null })
    node.resize(100, 20)
    node.primaryAxisSizingMode = "AUTO"
    node.paddingLeft = node.paddingRight = 8
    node.cornerRadius = 8
    node.fills = [HR.boundPaint(HR.vars[fill], HR.lightColors[fill], tone === "neutral" ? 0.45 : tone === "success" || tone === "warning" ? 1 : 0.1)]
    node.strokes = [HR.boundPaint(HR.vars[stroke], HR.lightColors[stroke], tone === "neutral" ? 1 : 0.25)]
    node.appendChild(HR.shadcnText(tone, "MetadataStrong", ink))
    return node
  })
  HR.shadcnVariantSet(statusBadges, section, "Status Badge", 5, "status-badge.tsx / status-badge-model.ts", "StatusBadge > Badge variant=outline; tone")
}

HR.shadcnInput = (type, state, nested = false) => {
  const textarea = type === "Textarea"
  const node = nested ? figma.createFrame() : figma.createComponent()
  node.layoutMode = "HORIZONTAL"
  node.resize(320, textarea ? 80 : 32)
  node.primaryAxisSizingMode = "FIXED"
  node.counterAxisSizingMode = "FIXED"
  HR.bindRadius(node, "radius/lg")
  node.name = `Type=${type}, State=${state}`
  node.strokes = [HR.boundPaint(HR.vars[state === "invalid" ? "color/destructive" : state === "focus" ? "color/ring" : "color/input"], HR.lightColors[state === "invalid" ? "color/destructive" : state === "focus" ? "color/ring" : "color/input"])]
  node.fills = state === "disabled" ? [HR.boundPaint(HR.vars["color/input"], HR.lightColors["color/input"], 0.5)] : []
  node.opacity = state === "disabled" ? 0.5 : 1
  node.paddingLeft = 10
  node.paddingRight = 10
  node.paddingTop = textarea ? 8 : 4
  node.paddingBottom = textarea ? 8 : 4
  if (state === "focus" || state === "invalid") {
    const tone = state === "invalid" ? "color/destructive" : "color/ring"
    node.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors[tone]), a: state === "invalid" ? 0.2 : 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }]
  }
  node.appendChild(HR.shadcnText(textarea ? "Write your message…" : "Enter value…", "Body", "color/muted/foreground", "placeholder"))
  return node
}

HR.ensureShadcnForms = (root) => {
  const section = HR.shadcnSection(root, "Forms", "input.tsx · textarea.tsx · field.tsx · input-group.tsx", "Kontrol, label, yardım, hata ve addon kompozisyonları")
  const controls = []
  for (const type of ["Input", "Textarea"]) for (const state of ["default", "focus", "disabled", "invalid", "filled"]) controls.push(HR.shadcnInput(type, state))
  HR.shadcnVariantSet(controls, section, "Input + Textarea", 5, "input.tsx / textarea.tsx", "Field > Label + Control + Description/Error")

  const fieldItems = []
  for (const orientation of ["vertical", "horizontal", "responsive"]) {
    for (const state of ["default", "invalid", "disabled"]) {
      const field = figma.createComponent()
      field.name = `Orientation=${orientation}, State=${state}`
      field.layoutMode = orientation === "horizontal" ? "HORIZONTAL" : "VERTICAL"
      field.primaryAxisSizingMode = "AUTO"
      field.counterAxisSizingMode = "FIXED"
      field.resize(360, 100)
      field.primaryAxisSizingMode = "AUTO"
      field.paddingTop = field.paddingBottom = 8
      field.itemSpacing = 8
      field.appendChild(HR.shadcnText("Email address", "Control", state === "invalid" ? "color/destructive" : "color/foreground"))
      field.appendChild(HR.shadcnInput("Input", state === "invalid" ? "invalid" : state === "disabled" ? "disabled" : "default", true))
      field.appendChild(HR.shadcnText(state === "invalid" ? "Enter a valid email address." : "We will never share your email.", "Metadata", state === "invalid" ? "color/destructive" : "color/muted/foreground", "description"))
      fieldItems.push(field)
    }
  }
  HR.shadcnVariantSet(fieldItems, section, "Field", 3, "field.tsx", "FieldGroup > Field > FieldLabel + control + FieldDescription/FieldError")

  const labels = []
  for (const state of ["default", "disabled"]) {
    const label = figma.createComponent()
    label.name = `State=${state}`
    label.layoutMode = "HORIZONTAL"
    label.primaryAxisSizingMode = "AUTO"
    label.counterAxisSizingMode = "AUTO"
    label.opacity = state === "disabled" ? 0.5 : 1
    label.appendChild(HR.shadcnText("Field label", "Control"))
    labels.push(label)
  }
  HR.shadcnVariantSet(labels, section, "Label", 2, "label.tsx", "Label; peer disabled state")

  const addons = []
  for (const align of ["inline-start", "inline-end", "block-start", "block-end"]) {
    const group = figma.createComponent()
    group.name = `Addon=${align}, State=default`
    group.layoutMode = align.startsWith("block") ? "VERTICAL" : "HORIZONTAL"
    group.primaryAxisSizingMode = "FIXED"
    group.counterAxisSizingMode = "FIXED"
    group.resize(320, align.startsWith("block") ? 64 : 32)
    group.counterAxisAlignItems = "CENTER"
    HR.bindSurface(group, "color/card", "color/input")
    HR.bindRadius(group, "radius/lg")
    group.paddingLeft = group.paddingRight = 8
    group.itemSpacing = 6
    const addon = HR.shadcnText(align.includes("start") ? "https://" : ".com", "Metadata", "color/muted/foreground", "addon")
    const value = HR.shadcnText("example", "Body", "color/foreground", "control")
    if (align.includes("start")) { group.appendChild(addon); group.appendChild(value) } else { group.appendChild(value); group.appendChild(addon) }
    addons.push(group)
  }
  HR.shadcnVariantSet(addons, section, "Input Group", 4, "input-group.tsx", "InputGroup > InputGroupAddon + InputGroupInput/Textarea/Button/Text")
}

HR.ensureShadcnSelection = (root) => {
  const section = HR.shadcnSection(root, "Selection Controls", "select.tsx · checkbox.tsx · toggle.tsx · toggle-group.tsx", "Radix durumları ve resmi Nova ölçüleri")
  const selectItems = []
  for (const size of ["default", "sm"]) for (const state of ["default", "hover", "focus", "open", "disabled", "invalid"]) {
    const node = figma.createComponent()
    node.name = `Size=${size}, State=${state}`
    node.layoutMode = "HORIZONTAL"
    node.primaryAxisSizingMode = "FIXED"
    node.counterAxisSizingMode = "FIXED"
    node.resize(220, size === "sm" ? 28 : 32)
    node.primaryAxisAlignItems = "SPACE_BETWEEN"
    node.counterAxisAlignItems = "CENTER"
    node.paddingLeft = 10
    node.paddingRight = 8
    HR.bindSurface(node, "color/card", state === "invalid" ? "color/destructive" : state === "focus" || state === "open" ? "color/ring" : "color/input")
    node.opacity = state === "disabled" ? 0.5 : 1
    node.appendChild(HR.shadcnText("Select option", "Body", "color/muted/foreground", "value"))
    node.appendChild(HR.shadcnIcon("ChevronDown", HR.vars["color/muted/foreground"], 16))
    selectItems.push(node)
  }
  HR.shadcnVariantSet(selectItems, section, "Select Trigger", 6, "select.tsx", "Select > Trigger + Value + Icon; Content > Group + Label + Item + Separator")

  const menu = HR.shadcnSurface("Select Content / anatomy", 240, 196)
  menu.paddingTop = menu.paddingBottom = menu.paddingLeft = menu.paddingRight = 4
  menu.itemSpacing = 2
  menu.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 6, spread: -1, visible: true, blendMode: "NORMAL" }]
  menu.appendChild(HR.shadcnText("TEAM", "Metadata", "color/muted/foreground", "SelectLabel"))
  for (const [label, selected] of [["Operations", true], ["Finance", false], ["People", false]]) {
    const item = HR.frame(`SelectItem / ${label}`, "HORIZONTAL")
    item.resize(232, 32)
    item.primaryAxisSizingMode = "FIXED"
    item.counterAxisSizingMode = "FIXED"
    item.counterAxisAlignItems = "CENTER"
    item.paddingLeft = 6
    item.paddingRight = 8
    item.itemSpacing = 6
    if (selected) item.fills = [HR.boundPaint(HR.vars["color/accent"], HR.lightColors["color/accent"])]
    item.appendChild(HR.shadcnText(label, "Body", selected ? "color/accent/foreground" : "color/foreground"))
    if (selected) item.appendChild(HR.shadcnIcon("Check", HR.vars["color/accent/foreground"], 14))
    menu.appendChild(item)
  }
  section.appendChild(menu)

  const checks = []
  for (const state of ["unchecked", "checked", "indeterminate", "focus", "disabled"]) {
    const node = figma.createComponent()
    node.name = `State=${state}`
    node.resize(16, 16)
    node.cornerRadius = 5
    node.fills = [HR.boundPaint(HR.vars[state === "checked" || state === "indeterminate" ? "color/primary" : "color/background"], HR.lightColors[state === "checked" || state === "indeterminate" ? "color/primary" : "color/background"])]
    node.strokes = [HR.boundPaint(HR.vars[state === "checked" || state === "indeterminate" ? "color/primary" : "color/input"], HR.lightColors[state === "checked" || state === "indeterminate" ? "color/primary" : "color/input"])]
    node.strokeWeight = 1
    node.opacity = state === "disabled" ? 0.5 : 1
    if (state === "focus") node.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors["color/ring"]), a: 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }]
    if (state === "checked" || state === "indeterminate") node.appendChild(HR.shadcnIcon(state === "checked" ? "Check" : "Minus", HR.vars["color/primary/foreground"], 12))
    checks.push(node)
  }
  HR.shadcnVariantSet(checks, section, "Checkbox", 5, "checkbox.tsx", "Checkbox > Indicator > CheckIcon")

  const toggles = []
  for (const variant of ["default", "outline"]) for (const size of ["default", "sm", "lg"]) for (const state of ["off", "hover", "on", "disabled"]) {
    const node = HR.controlComponent({ name: `Variant=${variant}, Size=${size}, State=${state}`, heightName: "control/md", fill: state === "on" || state === "hover" ? "color/muted" : null, stroke: variant === "outline" ? "color/input" : null })
    node.resize(size === "sm" ? 28 : size === "lg" ? 36 : 32, size === "sm" ? 28 : size === "lg" ? 36 : 32)
    node.primaryAxisSizingMode = "FIXED"
    node.opacity = state === "disabled" ? 0.5 : 1
    node.appendChild(HR.shadcnIcon("Bold", HR.vars["color/foreground"], size === "sm" ? 14 : 16))
    toggles.push(node)
  }
  HR.shadcnVariantSet(toggles, section, "Toggle", 6, "toggle-variants.ts", "Toggle / ToggleGroupItem; variant, size, pressed state")

  const groups = []
  for (const orientation of ["horizontal", "vertical"]) for (const spacing of ["0", "2"]) {
    const group = figma.createComponent()
    group.name = `Orientation=${orientation}, Spacing=${spacing}`
    group.layoutMode = orientation === "horizontal" ? "HORIZONTAL" : "VERTICAL"
    group.primaryAxisSizingMode = "AUTO"
    group.counterAxisSizingMode = "AUTO"
    group.itemSpacing = Number(spacing) * 4
    for (const [icon, on] of [["Bold", true], ["Italic", false]]) {
      const item = HR.frame(`ToggleGroupItem / ${icon}`, "HORIZONTAL")
      item.resize(32, 32)
      item.primaryAxisSizingMode = "FIXED"
      item.counterAxisSizingMode = "FIXED"
      item.primaryAxisAlignItems = "CENTER"
      item.counterAxisAlignItems = "CENTER"
      item.cornerRadius = spacing === "0" ? 0 : 10
      item.fills = on ? [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])] : []
      item.appendChild(HR.shadcnIcon(icon, HR.vars["color/foreground"], 16))
      group.appendChild(item)
    }
    groups.push(group)
  }
  HR.shadcnVariantSet(groups, section, "Toggle Group", 4, "toggle-group.tsx", "ToggleGroup > ToggleGroupItem; orientation + spacing context")
}

HR.shadcnCard = (size) => {
  const node = figma.createComponent()
  node.name = `Size=${size}`
  node.layoutMode = "VERTICAL"
  node.primaryAxisSizingMode = "FIXED"
  node.counterAxisSizingMode = "FIXED"
  node.resize(size === "sm" ? 300 : 340, size === "sm" ? 190 : 220)
  node.itemSpacing = size === "sm" ? 12 : 16
  node.paddingTop = size === "sm" ? 12 : 16
  node.paddingBottom = 0
  node.cornerRadius = 14
  node.fills = [HR.boundPaint(HR.vars["color/card"], HR.lightColors["color/card"])]
  node.strokes = [HR.boundPaint(HR.vars["color/foreground"], HR.lightColors["color/foreground"], 0.1)]
  const pad = size === "sm" ? 12 : 16
  const header = HR.frame("CardHeader", "HORIZONTAL")
  header.resize(node.width, 58)
  header.primaryAxisSizingMode = "FIXED"
  header.counterAxisSizingMode = "FIXED"
  header.primaryAxisAlignItems = "SPACE_BETWEEN"
  header.counterAxisAlignItems = "MIN"
  header.paddingLeft = header.paddingRight = pad
  const headerCopy = HR.frame("CardHeaderCopy", "VERTICAL")
  headerCopy.itemSpacing = 4
  headerCopy.appendChild(HR.shadcnText("Card title", size === "sm" ? "Control" : "Strong", "color/card/foreground", "CardTitle"))
  headerCopy.appendChild(HR.shadcnText("Card description explains this surface.", "Metadata", "color/muted/foreground", "CardDescription"))
  header.appendChild(headerCopy)
  const action = HR.frame("CardAction", "HORIZONTAL")
  action.resize(24, 24)
  action.primaryAxisSizingMode = "FIXED"
  action.counterAxisSizingMode = "FIXED"
  action.primaryAxisAlignItems = "CENTER"
  action.counterAxisAlignItems = "CENTER"
  action.appendChild(HR.shadcnIcon("MoreHorizontal", HR.vars["color/muted/foreground"], 16))
  header.appendChild(action)
  node.appendChild(header)
  const content = HR.frame("CardContent", "VERTICAL")
  content.resize(node.width, 72)
  content.primaryAxisSizingMode = "FIXED"
  content.counterAxisSizingMode = "FIXED"
  content.paddingLeft = content.paddingRight = pad
  content.appendChild(HR.shadcnText("Card content", "Body", "color/card/foreground"))
  node.appendChild(content)
  const footer = HR.frame("CardFooter", "HORIZONTAL")
  footer.resize(node.width, 54)
  footer.primaryAxisSizingMode = "FIXED"
  footer.counterAxisSizingMode = "FIXED"
  footer.counterAxisAlignItems = "CENTER"
  footer.paddingLeft = footer.paddingRight = pad
  footer.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"], 0.5)]
  footer.strokes = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]
  footer.strokeTopWeight = 1
  footer.appendChild(HR.shadcnText("Card footer", "Metadata", "color/muted/foreground"))
  node.appendChild(footer)
  return node
}

HR.ensureShadcnDataDisplay = (root) => {
  const section = HR.shadcnSection(root, "Data Display", "card.tsx · table.tsx · badge.tsx · skeleton.tsx · progress.tsx", "Tam Card anatomisi, tablo durumları ve geri bildirim elemanları")
  HR.shadcnVariantSet([HR.shadcnCard("default"), HR.shadcnCard("sm")], section, "Card", 2, "card.tsx", "Card > Header + Title + Description + Action + Content + Footer")

  const tableStates = []
  for (const state of ["default", "hover", "selected"]) {
    const table = figma.createComponent()
    table.name = `Row=${state}`
    table.layoutMode = "VERTICAL"
    table.primaryAxisSizingMode = "FIXED"
    table.counterAxisSizingMode = "FIXED"
    table.resize(680, 212)
    HR.bindSurface(table, "color/card", "color/border")
    const makeRow = (values, header = false, name = "TableRow") => {
      const row = HR.frame(name, "HORIZONTAL")
      row.resize(680, header ? 40 : 48)
      row.primaryAxisSizingMode = "FIXED"
      row.counterAxisSizingMode = "FIXED"
      row.counterAxisAlignItems = "CENTER"
      row.paddingLeft = row.paddingRight = 8
      if (!header && state !== "default") row.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"], state === "hover" ? 0.5 : 1)]
      row.strokes = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]
      row.strokeBottomWeight = 1
      for (const value of values) { const cell = HR.shadcnText(value, header ? "Control" : "Body"); cell.resize(160, 20); row.appendChild(cell) }
      return row
    }
    const header = HR.frame("TableHeader", "VERTICAL")
    header.resize(680, 40)
    header.primaryAxisSizingMode = "FIXED"
    header.counterAxisSizingMode = "FIXED"
    header.appendChild(makeRow(["Employee", "Store", "Status", "Amount"], true))
    table.appendChild(header)
    const body = HR.frame("TableBody", "VERTICAL")
    body.resize(680, 96)
    body.primaryAxisSizingMode = "FIXED"
    body.counterAxisSizingMode = "FIXED"
    body.appendChild(makeRow(["Ada Yılmaz", "Kadıköy", "Approved", "₺12.400"]))
    body.appendChild(makeRow(["Mert Kaya", "Beşiktaş", "Pending", "₺8.250"]))
    table.appendChild(body)
    const footer = HR.frame("TableFooter", "VERTICAL")
    footer.resize(680, 40)
    footer.primaryAxisSizingMode = "FIXED"
    footer.counterAxisSizingMode = "FIXED"
    footer.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"], 0.5)]
    footer.appendChild(makeRow(["Total", "", "2 records", "₺20.650"], false, "TableFooterRow"))
    table.appendChild(footer)
    const caption = HR.shadcnText("Employee records", "Metadata", "color/muted/foreground", "TableCaption")
    caption.resize(680, 20)
    table.appendChild(caption)
    tableStates.push(table)
  }
  HR.shadcnVariantSet(tableStates, section, "Table", 2, "table.tsx", "Container > Table > Header/Body/Footer > Row > Head/Cell + Caption")

  const feedback = HR.frame("Feedback primitives", "VERTICAL")
  feedback.resize(680, 160)
  feedback.primaryAxisSizingMode = "FIXED"
  feedback.counterAxisSizingMode = "FIXED"
  feedback.itemSpacing = 18
  const progressItems = []
  for (const value of [0, 25, 50, 75, 100]) {
    const progress = figma.createComponent(); progress.name = `Value=${value}`; progress.layoutMode = "HORIZONTAL"; progress.resize(480, 4); progress.primaryAxisSizingMode = "FIXED"; progress.counterAxisSizingMode = "FIXED"; progress.cornerRadius = 999; progress.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]
    const indicator = figma.createRectangle(); indicator.name = "ProgressIndicator"; indicator.resize(Math.max(1, 480 * value / 100), 4); indicator.cornerRadius = 999; indicator.fills = [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])]; progress.appendChild(indicator); progressItems.push(progress)
  }
  const progressSet = HR.shadcnVariantSet(progressItems, section, "Progress", 2, "progress.tsx", "Progress > ProgressIndicator; value")
  const skeletonItems = []
  for (const type of ["line", "avatar", "card"]) {
    const skeleton = figma.createComponent(); skeleton.name = `Type=${type}`; skeleton.resize(type === "avatar" ? 40 : type === "card" ? 320 : 240, type === "avatar" ? 40 : type === "card" ? 120 : 20); skeleton.cornerRadius = type === "avatar" ? 999 : 8; skeleton.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])] ; skeletonItems.push(skeleton)
  }
  HR.shadcnVariantSet(skeletonItems, section, "Skeleton", 3, "skeleton.tsx", "Skeleton; animate-pulse shape variants")
  const emptyItems = []
  for (const media of ["default", "icon"]) {
    const empty = figma.createComponent(); empty.name = `Media=${media}`; empty.layoutMode = "VERTICAL"; empty.resize(360, 180); empty.primaryAxisSizingMode = "FIXED"; empty.counterAxisSizingMode = "FIXED"; empty.primaryAxisAlignItems = "CENTER"; empty.counterAxisAlignItems = "CENTER"; empty.itemSpacing = 8; empty.paddingTop = empty.paddingBottom = empty.paddingLeft = empty.paddingRight = 24; empty.strokes = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]; empty.dashPattern = [6, 4]; empty.cornerRadius = 14
    if (media === "icon") { const icon = HR.frame("EmptyMedia", "HORIZONTAL"); icon.resize(32, 32); icon.primaryAxisSizingMode = "FIXED"; icon.counterAxisSizingMode = "FIXED"; icon.primaryAxisAlignItems = "CENTER"; icon.counterAxisAlignItems = "CENTER"; icon.cornerRadius = 10; icon.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]; icon.appendChild(HR.shadcnIcon("Search", HR.vars["color/foreground"], 16)); empty.appendChild(icon) }
    empty.appendChild(HR.shadcnText("No results", "Strong", "color/foreground", "EmptyTitle"))
    empty.appendChild(HR.shadcnText("Try changing the current filters.", "Body", "color/muted/foreground", "EmptyDescription"))
    const content = HR.frame("EmptyContent", "VERTICAL"); content.appendChild(HR.shadcnText("Optional action content", "Metadata", "color/muted/foreground")); empty.appendChild(content); emptyItems.push(empty)
  }
  HR.shadcnVariantSet(emptyItems, section, "Empty", 2, "empty.tsx", "Empty > EmptyHeader > EmptyMedia + EmptyTitle + EmptyDescription; EmptyContent")
  feedback.appendChild(HR.shadcnText("Progress and Skeleton are represented above as reusable component sets.", "Metadata", "color/muted/foreground"))
  section.appendChild(feedback)
}

HR.ensureShadcnNavigation = (root) => {
  const section = HR.shadcnSection(root, "Navigation", "tabs.tsx · accordion.tsx · separator.tsx · scroll-area.tsx", "Gerçek proje Tabs uyarlaması ve Radix durumları")
  const tabs = []
  for (const state of ["default", "hover", "active", "focus", "disabled"]) {
    const node = figma.createComponent(); node.name = `State=${state}`; node.layoutMode = "HORIZONTAL"; node.resize(112, 48); node.primaryAxisSizingMode = "FIXED"; node.counterAxisSizingMode = "FIXED"; node.primaryAxisAlignItems = "CENTER"; node.counterAxisAlignItems = "CENTER"; node.fills = []
    node.strokes = [HR.boundPaint(HR.vars[state === "active" ? "color/primary" : "color/border"], HR.lightColors[state === "active" ? "color/primary" : "color/border"])]
    node.strokeBottomWeight = state === "active" ? 2 : 1; node.opacity = state === "disabled" ? 0.5 : 1
    node.appendChild(HR.shadcnText("Overview", "Control", state === "active" || state === "hover" ? "color/foreground" : "color/muted/foreground"))
    tabs.push(node)
  }
  HR.shadcnVariantSet(tabs, section, "Tabs Trigger", 5, "tabs.tsx", "Tabs > TabsList > TabsTrigger; TabsContent")

  const accordion = []
  for (const state of ["closed", "open", "focus", "disabled"]) {
    const node = figma.createComponent(); node.name = `State=${state}`; node.layoutMode = "VERTICAL"; node.resize(420, state === "open" ? 116 : 44); node.primaryAxisSizingMode = "FIXED"; node.counterAxisSizingMode = "FIXED"; node.paddingTop = node.paddingBottom = 10; node.itemSpacing = 12
    const trigger = HR.frame("AccordionTrigger", "HORIZONTAL"); trigger.resize(420, 24); trigger.primaryAxisSizingMode = "FIXED"; trigger.counterAxisSizingMode = "FIXED"; trigger.primaryAxisAlignItems = "SPACE_BETWEEN"; trigger.appendChild(HR.shadcnText("Is it accessible?", "Control")); trigger.appendChild(HR.shadcnIcon(state === "open" ? "ChevronUp" : "ChevronDown", HR.vars["color/muted/foreground"], 16)); node.appendChild(trigger)
    if (state === "open") node.appendChild(HR.shadcnText("Yes. It follows the WAI-ARIA design pattern.", "Body", "color/muted/foreground", "AccordionContent"))
    node.opacity = state === "disabled" ? 0.5 : 1; accordion.push(node)
  }
  HR.shadcnVariantSet(accordion, section, "Accordion Item", 4, "accordion.tsx", "Accordion > Item > Header > Trigger + Content")
  const separatorItems = []
  for (const orientation of ["horizontal", "vertical"]) { const separator = figma.createComponent(); separator.name = `Orientation=${orientation}`; separator.resize(orientation === "horizontal" ? 360 : 1, orientation === "horizontal" ? 1 : 64); separator.fills = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]; separatorItems.push(separator) }
  HR.shadcnVariantSet(separatorItems, section, "Separator", 2, "separator.tsx", "Separator; horizontal/vertical; decorative")
  const scrollItems = []
  for (const orientation of ["vertical", "horizontal"]) {
    const scroll = figma.createComponent(); scroll.name = `Orientation=${orientation}`; scroll.layoutMode = "VERTICAL"; scroll.resize(300, 128); scroll.primaryAxisSizingMode = "FIXED"; scroll.counterAxisSizingMode = "FIXED"; HR.bindSurface(scroll, "color/card", "color/border"); scroll.paddingTop = scroll.paddingBottom = scroll.paddingLeft = scroll.paddingRight = 12; scroll.appendChild(HR.shadcnText("Scrollable viewport\nContent continues beyond this frame.", "Body", "color/muted/foreground", "ScrollAreaViewport")); const thumb = figma.createRectangle(); thumb.name = "ScrollAreaThumb"; thumb.resize(orientation === "vertical" ? 6 : 120, orientation === "vertical" ? 56 : 6); thumb.cornerRadius = 999; thumb.fills = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])] ; scroll.appendChild(thumb); thumb.layoutPositioning = "ABSOLUTE"; thumb.x = orientation === "vertical" ? 292 : 12; thumb.y = orientation === "vertical" ? 12 : 120; scrollItems.push(scroll)
  }
  HR.shadcnVariantSet(scrollItems, section, "Scroll Area", 2, "scroll-area.tsx", "ScrollArea > Viewport + ScrollBar > Thumb + Corner")
  const paginationItems = []
  for (const state of ["default", "disabled"]) {
    const pagination = figma.createComponent(); pagination.name = `State=${state}`; pagination.layoutMode = "HORIZONTAL"; pagination.resize(360, 32); pagination.primaryAxisSizingMode = "FIXED"; pagination.counterAxisSizingMode = "FIXED"; pagination.primaryAxisAlignItems = "CENTER"; pagination.counterAxisAlignItems = "CENTER"; pagination.itemSpacing = 2; pagination.opacity = state === "disabled" ? 0.5 : 1
    for (const label of ["‹ Previous", "1", "2", "…", "Next ›"]) { const item = HR.frame(label === "2" ? "PaginationLink / active" : "PaginationLink", "HORIZONTAL"); item.resize(label.length > 2 ? 76 : 32, 32); item.primaryAxisSizingMode = "FIXED"; item.counterAxisSizingMode = "FIXED"; item.primaryAxisAlignItems = "CENTER"; item.counterAxisAlignItems = "CENTER"; if (label === "2") HR.bindSurface(item, "color/background", "color/border"); item.appendChild(HR.shadcnText(label, "Metadata", label === "2" ? "color/foreground" : "color/muted/foreground")); pagination.appendChild(item) }
    paginationItems.push(pagination)
  }
  HR.shadcnVariantSet(paginationItems, section, "Pagination", 2, "pagination.tsx", "Pagination > Content > Item > Link + Previous/Next/Ellipsis")
}

HR.shadcnOverlay = (type) => {
  const sheet = type === "Sheet"
  const popover = type === "Popover"
  const node = figma.createComponent()
  node.name = type
  node.layoutMode = "VERTICAL"
  node.primaryAxisSizingMode = "FIXED"
  node.counterAxisSizingMode = "FIXED"
  node.resize(popover ? 288 : sheet ? 512 : 384, popover ? 156 : sheet ? 520 : 260)
  node.paddingTop = node.paddingBottom = node.paddingLeft = node.paddingRight = popover ? 10 : 16
  node.itemSpacing = popover ? 10 : 16
  node.cornerRadius = sheet ? 0 : popover ? 10 : 14
  node.fills = [HR.boundPaint(HR.vars["color/popover"], HR.lightColors["color/popover"])]
  node.strokes = [HR.boundPaint(HR.vars["color/foreground"], HR.lightColors["color/foreground"], 0.1)]
  node.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: popover ? 4 : 20 }, radius: popover ? 6 : 25, spread: popover ? -1 : -5, visible: true, blendMode: "NORMAL" }]
  node.appendChild(HR.shadcnText(`${type} title`, "Strong", "color/popover/foreground", `${type}Title`))
  node.appendChild(HR.shadcnText("Supporting description for this surface.", "Body", "color/muted/foreground", `${type}Description`))
  if (!popover) {
    const body = HR.frame(`${type}Content`, "VERTICAL"); body.resize(node.width - 32, sheet ? 330 : 100); body.primaryAxisSizingMode = "FIXED"; body.counterAxisSizingMode = "FIXED"; body.paddingTop = body.paddingBottom = 12; body.appendChild(HR.shadcnText("Content", "Body")); node.appendChild(body)
    const footer = HR.frame(`${type}Footer`, "HORIZONTAL"); footer.resize(node.width, 60); footer.primaryAxisSizingMode = "FIXED"; footer.counterAxisSizingMode = "FIXED"; footer.primaryAxisAlignItems = "MAX"; footer.counterAxisAlignItems = "CENTER"; footer.itemSpacing = 8; footer.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"], 0.5)]; footer.appendChild(HR.shadcnText("Cancel", "Control", "color/muted/foreground")); footer.appendChild(HR.shadcnText("Save", "Control", "color/primary")); node.appendChild(footer)
  }
  if (!popover) {
    const close = HR.shadcnIcon("Close", HR.vars["color/muted/foreground"], 16); close.name = "Close button"; node.appendChild(close); close.layoutPositioning = "ABSOLUTE"; close.x = node.width - 32; close.y = 12
  }
  return node
}

HR.ensureShadcnOverlays = (root) => {
  const section = HR.shadcnSection(root, "Overlays", "dialog.tsx · sheet.tsx · popover.tsx", "Portal, overlay, content, accessible title ve footer anatomisi")
  const dialog = HR.shadcnOverlay("Dialog"); HR.shadcnMeta(dialog, "dialog.tsx", "Dialog > Portal > Overlay + Content > Header/Title/Description + Footer + Close")
  const sheet = HR.shadcnOverlay("Sheet"); HR.shadcnMeta(sheet, "sheet.tsx", "Sheet > Portal > Overlay + Content > Header/Title/Description + Footer + Close")
  const popover = HR.shadcnOverlay("Popover"); HR.shadcnMeta(popover, "popover.tsx", "Popover > Trigger + Portal > Content > Header/Title/Description")
  section.appendChild(dialog); section.appendChild(sheet); section.appendChild(popover)

  const menuItems = []
  for (const state of ["default", "focus", "checked", "destructive", "disabled"]) {
    const menu = figma.createComponent(); menu.name = `Item=${state}`; menu.layoutMode = "VERTICAL"; menu.resize(240, 164); menu.primaryAxisSizingMode = "FIXED"; menu.counterAxisSizingMode = "FIXED"; menu.paddingTop = menu.paddingBottom = menu.paddingLeft = menu.paddingRight = 4; menu.itemSpacing = 2; HR.bindSurface(menu, "color/popover", "color/border"); menu.cornerRadius = 10
    menu.appendChild(HR.shadcnText("ACTIONS", "Metadata", "color/muted/foreground", "DropdownMenuLabel"))
    for (const [label, key] of [["Edit", "default"], ["Duplicate", "checked"], ["Delete", "destructive"]]) { const item = HR.frame(`DropdownMenuItem / ${key}`, "HORIZONTAL"); item.resize(232, 32); item.primaryAxisSizingMode = "FIXED"; item.counterAxisSizingMode = "FIXED"; item.counterAxisAlignItems = "CENTER"; item.paddingLeft = item.paddingRight = 6; item.primaryAxisAlignItems = "SPACE_BETWEEN"; if (state === key || (state === "focus" && key === "default")) item.fills = [HR.boundPaint(HR.vars[key === "destructive" ? "color/destructive" : "color/accent"], HR.lightColors[key === "destructive" ? "color/destructive" : "color/accent"], key === "destructive" ? 0.1 : 1)]; item.opacity = state === "disabled" && key === "default" ? 0.5 : 1; item.appendChild(HR.shadcnText(label, "Body", key === "destructive" ? "color/destructive" : "color/foreground")); if (state === "checked" && key === "checked") item.appendChild(HR.shadcnIcon("Check", HR.vars["color/foreground"], 14)); menu.appendChild(item) }
    menuItems.push(menu)
  }
  HR.shadcnVariantSet(menuItems, section, "Dropdown Menu", 5, "dropdown-menu.tsx", "DropdownMenu > Portal + Content > Group/Label + Item/CheckboxItem/RadioItem + Separator + Sub")

  const alertDialogs = []
  for (const size of ["default", "sm"]) {
    const alertDialog = figma.createComponent(); alertDialog.name = `Size=${size}`; alertDialog.layoutMode = "VERTICAL"; alertDialog.resize(size === "sm" ? 320 : 384, size === "sm" ? 220 : 240); alertDialog.primaryAxisSizingMode = "FIXED"; alertDialog.counterAxisSizingMode = "FIXED"; alertDialog.paddingTop = alertDialog.paddingLeft = alertDialog.paddingRight = 16; alertDialog.itemSpacing = 12; HR.bindSurface(alertDialog, "color/popover", "color/border"); alertDialog.cornerRadius = 14
    const header = HR.frame("AlertDialogHeader", "VERTICAL"); header.itemSpacing = 6; header.appendChild(HR.shadcnText("Confirm action", "Strong", "color/popover/foreground", "AlertDialogTitle")); header.appendChild(HR.shadcnText("This action requires confirmation before continuing.", "Body", "color/muted/foreground", "AlertDialogDescription")); alertDialog.appendChild(header)
    const footer = HR.frame("AlertDialogFooter", "HORIZONTAL"); footer.resize(alertDialog.width, 60); footer.primaryAxisSizingMode = "FIXED"; footer.counterAxisSizingMode = "FIXED"; footer.primaryAxisAlignItems = "MAX"; footer.counterAxisAlignItems = "CENTER"; footer.itemSpacing = 8; footer.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"], 0.5)]; footer.appendChild(HR.shadcnText("Cancel", "Control", "color/muted/foreground", "AlertDialogCancel")); footer.appendChild(HR.shadcnText("Continue", "Control", "color/primary", "AlertDialogAction")); alertDialog.appendChild(footer); alertDialogs.push(alertDialog)
  }
  HR.shadcnVariantSet(alertDialogs, section, "Alert Dialog", 2, "alert-dialog.tsx", "AlertDialog > Portal > Overlay + Content > Header/Title/Description/Media + Footer > Cancel/Action")

  const alerts = []
  for (const variant of ["default", "destructive"]) {
    const alert = figma.createComponent(); alert.name = `Variant=${variant}`; alert.layoutMode = "HORIZONTAL"; alert.resize(420, 68); alert.primaryAxisSizingMode = "FIXED"; alert.counterAxisSizingMode = "FIXED"; alert.paddingTop = alert.paddingBottom = 8; alert.paddingLeft = alert.paddingRight = 10; alert.itemSpacing = 8; HR.bindSurface(alert, "color/card", "color/border"); alert.appendChild(HR.shadcnIcon("AlertCircle", HR.vars[variant === "destructive" ? "color/destructive" : "color/foreground"], 16)); const copy = HR.frame("copy", "VERTICAL"); copy.itemSpacing = 2; copy.appendChild(HR.shadcnText("Heads up!", "Control", variant === "destructive" ? "color/destructive" : "color/card/foreground", "AlertTitle")); copy.appendChild(HR.shadcnText("You can add components using the CLI.", "Metadata", variant === "destructive" ? "color/destructive" : "color/muted/foreground", "AlertDescription")); alert.appendChild(copy); alerts.push(alert)
  }
  HR.shadcnVariantSet(alerts, section, "Alert", 2, "alert.tsx", "Alert > optional icon + AlertTitle + AlertDescription + AlertAction")

  const toasts = []
  for (const variant of ["default", "success", "warning", "error", "loading"]) {
    const toast = figma.createComponent(); toast.name = `Variant=${variant}`; toast.layoutMode = "HORIZONTAL"; toast.resize(360, 72); toast.primaryAxisSizingMode = "FIXED"; toast.counterAxisSizingMode = "FIXED"; toast.counterAxisAlignItems = "CENTER"; toast.paddingTop = toast.paddingBottom = toast.paddingLeft = toast.paddingRight = 12; toast.itemSpacing = 10; HR.bindSurface(toast, "color/card", "color/border"); toast.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 6, spread: -1, visible: true, blendMode: "NORMAL" }]; const tone = variant === "error" ? "color/destructive" : variant === "success" ? "color/success" : variant === "warning" ? "color/warning" : "color/foreground"; toast.appendChild(HR.shadcnIcon(variant === "loading" ? "Loader" : variant === "error" || variant === "warning" ? "AlertCircle" : "Check", HR.vars[tone], 16)); const copy = HR.frame("copy", "VERTICAL"); copy.itemSpacing = 2; copy.appendChild(HR.shadcnText(variant === "loading" ? "Saving changes" : "Operation complete", "Control", "color/card/foreground", "title")); copy.appendChild(HR.shadcnText("Your changes have been saved.", "Metadata", "color/muted/foreground", "description")); toast.appendChild(copy); toasts.push(toast)
  }
  HR.shadcnVariantSet(toasts, section, "Sonner Toast", 5, "sonner.tsx", "Toaster > toast icon + title + description + action/close")
}

HR.shadcnCalendarVariant = (state) => {
  const node = HR.calendarVariant("Default")
  node.name = `State=${state}`
  const cell = node.findOne((child) => child.name === "day 9")
  const label = cell?.findOne((child) => child.type === "TEXT")
  if (!cell || !label || state === "default") return node

  const primaryStates = ["selected-single", "range-start", "range-end"]
  if (primaryStates.includes(state)) {
    cell.fills = [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])]
    label.fills = [HR.boundPaint(HR.vars["color/primary/foreground"], HR.lightColors["color/primary/foreground"])]
  }
  if (state === "today" || state === "range-middle") {
    cell.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]
  }
  if (state === "range-start") {
    cell.topLeftRadius = cell.bottomLeftRadius = 8
    cell.topRightRadius = cell.bottomRightRadius = 0
  }
  if (state === "range-middle") cell.cornerRadius = 0
  if (state === "range-end") {
    cell.topLeftRadius = cell.bottomLeftRadius = 0
    cell.topRightRadius = cell.bottomRightRadius = 8
  }
  if (state === "outside") {
    label.fills = [HR.boundPaint(HR.vars["color/muted/foreground"], HR.lightColors["color/muted/foreground"])]
  }
  if (state === "disabled") cell.opacity = 0.5
  if (state === "focused") {
    cell.strokes = [HR.boundPaint(HR.vars["color/ring"], HR.lightColors["color/ring"])]
    cell.strokeWeight = 1
    cell.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors["color/ring"]), a: 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }]
  }
  return node
}

HR.ensureShadcnCalendar = (root) => {
  const section = HR.shadcnSection(root, "Calendar", "admin-web/src/components/ui/calendar.tsx", "React DayPicker yapısı, 28 px hücreler ve single/range durumları")
  const items = ["default", "today", "selected-single", "range-start", "range-middle", "range-end", "outside", "disabled", "focused"].map(HR.shadcnCalendarVariant)
  HR.shadcnVariantSet(items, section, "Calendar", 3, "calendar.tsx", "Calendar > Month > Nav + Caption + Weekdays + Week > Day > DayButton")
}

HR.ensureShadcnIdentityNavigation = (root) => {
  const section = HR.shadcnSection(
    root,
    "Navigation & Identity",
    "breadcrumb.tsx · avatar.tsx · tooltip.tsx",
    "Sayfa konumu, kullanıcı kimliği ve kısa bağlamsal yardım bileşenleri",
  )

  const breadcrumb = figma.createComponent()
  breadcrumb.name = "Breadcrumb"
  breadcrumb.layoutMode = "HORIZONTAL"
  breadcrumb.resize(440, 32)
  breadcrumb.primaryAxisSizingMode = "FIXED"
  breadcrumb.counterAxisSizingMode = "FIXED"
  breadcrumb.counterAxisAlignItems = "CENTER"
  breadcrumb.itemSpacing = 8
  for (const [label, current] of [["Operations", false], ["Integrations", false], ["Import batch", true]]) {
    breadcrumb.appendChild(HR.shadcnText(label, current ? "MetadataStrong" : "Metadata", current ? "color/foreground" : "color/muted/foreground", current ? "BreadcrumbPage" : "BreadcrumbLink"))
    if (!current) breadcrumb.appendChild(HR.shadcnIcon("ChevronRight", HR.vars["color/muted/foreground"], 12))
  }
  HR.shadcnMeta(breadcrumb, "breadcrumb.tsx", "Breadcrumb > BreadcrumbList > BreadcrumbItem > BreadcrumbLink/Page + BreadcrumbSeparator")
  section.appendChild(breadcrumb)

  const avatars = []
  for (const [size, dimension] of [["sm", 24], ["default", 32], ["lg", 40]]) {
    const avatar = figma.createComponent()
    avatar.name = `Size=${size}`
    avatar.layoutMode = "HORIZONTAL"
    avatar.resize(dimension, dimension)
    avatar.primaryAxisSizingMode = "FIXED"
    avatar.counterAxisSizingMode = "FIXED"
    avatar.primaryAxisAlignItems = "CENTER"
    avatar.counterAxisAlignItems = "CENTER"
    avatar.cornerRadius = 999
    avatar.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]
    avatar.strokes = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]
    avatar.appendChild(HR.shadcnText("SA", size === "sm" ? "MetadataStrong" : "Control", "color/muted/foreground", "AvatarFallback"))
    avatars.push(avatar)
  }
  HR.shadcnVariantSet(avatars, section, "Avatar", 3, "avatar.tsx", "Avatar > AvatarImage + AvatarFallback + optional AvatarBadge; AvatarGroup")

  const tooltips = []
  for (const side of ["top", "right", "bottom", "left"]) {
    const tooltip = figma.createComponent()
    tooltip.name = `Side=${side}`
    tooltip.layoutMode = "HORIZONTAL"
    tooltip.resize(176, 30)
    tooltip.primaryAxisSizingMode = "FIXED"
    tooltip.counterAxisSizingMode = "FIXED"
    tooltip.primaryAxisAlignItems = "CENTER"
    tooltip.counterAxisAlignItems = "CENTER"
    tooltip.cornerRadius = 8
    tooltip.fills = [HR.boundPaint(HR.vars["color/foreground"], HR.lightColors["color/foreground"])]
    tooltip.appendChild(HR.shadcnText("View record details", "Metadata", "color/background", "TooltipContent"))
    tooltips.push(tooltip)
  }
  HR.shadcnVariantSet(tooltips, section, "Tooltip", 4, "tooltip.tsx", "TooltipProvider > Tooltip > TooltipTrigger + Portal > TooltipContent")
}

HR.ensureShadcnAdvancedInputs = (root) => {
  const section = HR.shadcnSection(
    root,
    "Advanced Inputs",
    "combobox.tsx · radio-group.tsx · switch.tsx · date-picker.tsx",
    "Aranabilir seçim, seçenek grubu, ikili tercih ve resmi Calendar/Popover tarih kompozisyonu",
  )

  const comboboxes = []
  for (const state of ["closed", "open", "disabled", "invalid"]) {
    const combobox = figma.createComponent()
    combobox.name = `State=${state}`
    combobox.layoutMode = "VERTICAL"
    combobox.resize(320, state === "open" ? 184 : 32)
    combobox.primaryAxisSizingMode = "FIXED"
    combobox.counterAxisSizingMode = "FIXED"
    combobox.itemSpacing = 4
    combobox.opacity = state === "disabled" ? 0.5 : 1
    const trigger = HR.frame("ComboboxTrigger", "HORIZONTAL")
    trigger.resize(320, 32)
    trigger.primaryAxisSizingMode = "FIXED"
    trigger.counterAxisSizingMode = "FIXED"
    trigger.primaryAxisAlignItems = "SPACE_BETWEEN"
    trigger.counterAxisAlignItems = "CENTER"
    trigger.paddingLeft = trigger.paddingRight = 10
    HR.bindSurface(trigger, "color/card", state === "invalid" ? "color/destructive" : state === "open" ? "color/ring" : "color/input")
    HR.bindRadius(trigger, "radius/lg")
    trigger.appendChild(HR.shadcnText("Select store", "Body", "color/muted/foreground", "ComboboxValue"))
    trigger.appendChild(HR.shadcnIcon("ChevronDown", HR.vars["color/muted/foreground"], 16))
    combobox.appendChild(trigger)
    if (state === "open") {
      const content = HR.frame("ComboboxContent", "VERTICAL")
      content.resize(320, 148)
      content.primaryAxisSizingMode = "FIXED"
      content.counterAxisSizingMode = "FIXED"
      content.paddingTop = content.paddingBottom = content.paddingLeft = content.paddingRight = 4
      content.itemSpacing = 2
      HR.bindSurface(content, "color/popover", "color/border")
      HR.bindRadius(content, "radius/lg")
      for (const [label, selected] of [["All stores", true], ["İstanbul", false], ["Ankara", false]]) {
        const item = HR.frame(`ComboboxItem / ${label}`, "HORIZONTAL")
        item.resize(312, 36)
        item.primaryAxisSizingMode = "FIXED"
        item.counterAxisSizingMode = "FIXED"
        item.counterAxisAlignItems = "CENTER"
        item.paddingLeft = item.paddingRight = 8
        item.itemSpacing = 6
        if (selected) item.fills = [HR.boundPaint(HR.vars["color/accent"], HR.lightColors["color/accent"])]
        if (selected) item.appendChild(HR.shadcnIcon("Check", HR.vars["color/accent/foreground"], 14))
        item.appendChild(HR.shadcnText(label, "Body", selected ? "color/accent/foreground" : "color/foreground"))
        content.appendChild(item)
      }
      combobox.appendChild(content)
    }
    comboboxes.push(combobox)
  }
  HR.shadcnVariantSet(comboboxes, section, "Combobox", 4, "combobox.tsx", "Combobox > ComboboxInput/Trigger + Portal > ComboboxContent > ComboboxList/Item/Empty")

  const radioGroups = []
  for (const orientation of ["vertical", "horizontal"]) {
    const group = figma.createComponent()
    group.name = `Orientation=${orientation}`
    group.layoutMode = orientation === "horizontal" ? "HORIZONTAL" : "VERTICAL"
    group.primaryAxisSizingMode = "AUTO"
    group.counterAxisSizingMode = "AUTO"
    group.itemSpacing = 12
    for (const [label, checked] of [["All", true], ["Active", false], ["Paused", false]]) {
      const option = HR.frame(`RadioGroupItem / ${label}`, "HORIZONTAL")
      option.itemSpacing = 6
      option.counterAxisAlignItems = "CENTER"
      const radio = figma.createFrame()
      radio.name = checked ? "RadioGroupIndicator" : "RadioGroupItem"
      radio.resize(16, 16)
      radio.cornerRadius = 999
      radio.fills = checked ? [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])] : [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
      radio.strokes = [HR.boundPaint(HR.vars[checked ? "color/primary" : "color/input"], HR.lightColors[checked ? "color/primary" : "color/input"])]
      option.appendChild(radio)
      option.appendChild(HR.shadcnText(label, "Body"))
      group.appendChild(option)
    }
    radioGroups.push(group)
  }
  HR.shadcnVariantSet(radioGroups, section, "Radio Group", 2, "radio-group.tsx", "RadioGroup > RadioGroupItem + Indicator; labels composed with Field")

  const switches = []
  for (const state of ["off", "on", "disabled"]) {
    const control = figma.createComponent()
    control.name = `State=${state}`
    control.layoutMode = "HORIZONTAL"
    control.resize(32, 18)
    control.primaryAxisSizingMode = "FIXED"
    control.counterAxisSizingMode = "FIXED"
    control.primaryAxisAlignItems = state === "on" ? "MAX" : "MIN"
    control.counterAxisAlignItems = "CENTER"
    control.paddingLeft = control.paddingRight = 2
    control.cornerRadius = 999
    control.opacity = state === "disabled" ? 0.5 : 1
    control.fills = [HR.boundPaint(HR.vars[state === "on" ? "color/primary" : "color/input"], HR.lightColors[state === "on" ? "color/primary" : "color/input"])]
    const thumb = figma.createRectangle()
    thumb.name = "SwitchThumb"
    thumb.resize(14, 14)
    thumb.cornerRadius = 999
    thumb.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
    control.appendChild(thumb)
    switches.push(control)
  }
  HR.shadcnVariantSet(switches, section, "Switch", 3, "switch.tsx", "Switch > SwitchThumb; checked, focus and disabled states")

  const pickers = []
  for (const state of ["empty", "filled", "open", "disabled"]) {
    const picker = figma.createComponent()
    picker.name = `State=${state}`
    picker.layoutMode = "VERTICAL"
    picker.resize(320, state === "open" ? 304 : 32)
    picker.primaryAxisSizingMode = "FIXED"
    picker.counterAxisSizingMode = "FIXED"
    picker.itemSpacing = 4
    picker.opacity = state === "disabled" ? 0.5 : 1
    const trigger = HR.frame("PopoverTrigger / Date Picker", "HORIZONTAL")
    trigger.resize(280, 32)
    trigger.primaryAxisSizingMode = "FIXED"
    trigger.counterAxisSizingMode = "FIXED"
    trigger.counterAxisAlignItems = "CENTER"
    trigger.paddingLeft = trigger.paddingRight = 10
    trigger.itemSpacing = 6
    HR.bindSurface(trigger, "color/background", state === "open" ? "color/ring" : "color/input")
    HR.bindRadius(trigger, "radius/lg")
    trigger.appendChild(HR.shadcnIcon("Calendar", HR.vars["color/muted/foreground"], 16))
    trigger.appendChild(HR.shadcnText(state === "empty" ? "Pick a date" : "Sep 9, 2026", "Body", state === "empty" ? "color/muted/foreground" : "color/foreground", "DateValue"))
    picker.appendChild(trigger)
    if (state === "open") {
      const calendarMain = HR.catalogMainComponent(root.parent, "Calendar")
      if (!calendarMain) throw new Error("Date Picker requires the Calendar component set")
      const calendar = calendarMain.createInstance()
      calendar.name = "PopoverContent / Calendar"
      picker.appendChild(calendar)
    }
    pickers.push(picker)
  }
  HR.shadcnVariantSet(pickers, section, "Date Picker", 4, "date-picker.tsx", "Popover > PopoverTrigger as Button + PopoverContent > Calendar")
}

HR.ensureShadcnVisualizationAndDisclosure = (root) => {
  const section = HR.shadcnSection(
    root,
    "Visualization & Disclosure",
    "chart.tsx · spinner.tsx · command.tsx · collapsible.tsx · drawer.tsx",
    "Operasyon trendleri, kısa bekleme geri bildirimi, komut arama ve açılır içerik yüzeyleri",
  )

  const spinners = []
  for (const [size, dimension] of [["sm", 12], ["default", 16], ["lg", 24]]) {
    const spinner = figma.createComponent()
    spinner.name = `Size=${size}`
    spinner.layoutMode = "HORIZONTAL"
    spinner.resize(dimension, dimension)
    spinner.primaryAxisSizingMode = "FIXED"
    spinner.counterAxisSizingMode = "FIXED"
    spinner.appendChild(HR.shadcnIcon("Loader", HR.vars["color/foreground"], dimension))
    spinners.push(spinner)
  }
  HR.shadcnVariantSet(spinners, section, "Spinner", 3, "spinner.tsx", "Loader2Icon with role=status and accessible loading label")

  const charts = []
  for (const type of ["bar", "line", "area"]) {
    const chart = figma.createComponent()
    chart.name = `Type=${type}`
    chart.layoutMode = "VERTICAL"
    chart.resize(420, 220)
    chart.primaryAxisSizingMode = "FIXED"
    chart.counterAxisSizingMode = "FIXED"
    chart.paddingTop = chart.paddingBottom = chart.paddingLeft = chart.paddingRight = 16
    chart.itemSpacing = 12
    HR.bindSurface(chart, "color/card", "color/border")
    HR.bindRadius(chart, "radius/xl")
    chart.appendChild(HR.shadcnText(type === "bar" ? "Records by status" : "Operational trend", "Strong", "color/card/foreground", "ChartTitle"))
    const plot = HR.frame("ChartContainer", "HORIZONTAL")
    plot.resize(388, 152)
    plot.primaryAxisSizingMode = "FIXED"
    plot.counterAxisSizingMode = "FIXED"
    plot.counterAxisAlignItems = "MAX"
    plot.itemSpacing = 16
    for (const height of type === "bar" ? [48, 92, 68, 124, 84, 136] : type === "line" ? [28, 54, 74, 96, 118, 142] : [36, 46, 70, 88, 112, 132]) {
      const mark = figma.createRectangle()
      mark.name = type === "bar" ? "Bar" : type === "line" ? "Line point" : "Area point"
      mark.resize(type === "bar" ? 48 : 44, type === "bar" ? height : 4)
      mark.cornerRadius = type === "bar" ? 6 : 999
      mark.fills = [HR.boundPaint(HR.vars[type === "area" ? "color/chart/2" : "color/chart/1"], HR.lightColors[type === "area" ? "color/chart/2" : "color/chart/1"], type === "area" ? 0.55 : 1)]
      plot.appendChild(mark)
    }
    chart.appendChild(plot)
    charts.push(chart)
  }
  HR.shadcnVariantSet(charts, section, "Chart", 3, "chart.tsx", "ChartContainer > Recharts responsive chart + ChartTooltip/Legend composition")

  const command = figma.createComponent()
  command.name = "Command"
  command.layoutMode = "VERTICAL"
  command.resize(360, 248)
  command.primaryAxisSizingMode = "FIXED"
  command.counterAxisSizingMode = "FIXED"
  command.paddingTop = command.paddingBottom = command.paddingLeft = command.paddingRight = 8
  command.itemSpacing = 4
  HR.bindSurface(command, "color/popover", "color/border")
  HR.bindRadius(command, "radius/xl")
  const search = HR.frame("CommandInputWrapper", "HORIZONTAL")
  search.resize(344, 36)
  search.primaryAxisSizingMode = "FIXED"
  search.counterAxisSizingMode = "FIXED"
  search.counterAxisAlignItems = "CENTER"
  search.itemSpacing = 8
  search.paddingLeft = search.paddingRight = 8
  search.appendChild(HR.shadcnIcon("Search", HR.vars["color/muted/foreground"], 16))
  search.appendChild(HR.shadcnText("Search actions…", "Body", "color/muted/foreground", "CommandInput"))
  command.appendChild(search)
  command.appendChild(HR.shadcnText("NAVIGATION", "MetadataStrong", "color/muted/foreground", "CommandGroupHeading"))
  for (const [label, selected] of [["Open integrations", true], ["Review audit log", false], ["Manage access", false], ["View reports", false]]) {
    const item = HR.frame(`CommandItem / ${label}`, "HORIZONTAL")
    item.resize(344, 36)
    item.primaryAxisSizingMode = "FIXED"
    item.counterAxisSizingMode = "FIXED"
    item.counterAxisAlignItems = "CENTER"
    item.paddingLeft = item.paddingRight = 8
    if (selected) item.fills = [HR.boundPaint(HR.vars["color/accent"], HR.lightColors["color/accent"])]
    item.appendChild(HR.shadcnText(label, "Body", selected ? "color/accent/foreground" : "color/foreground"))
    command.appendChild(item)
  }
  HR.shadcnMeta(command, "command.tsx", "Command > CommandInput + CommandList > CommandEmpty/Group > CommandItem + Separator")
  section.appendChild(command)

  const collapsibles = []
  for (const state of ["closed", "open"]) {
    const collapsible = figma.createComponent()
    collapsible.name = `State=${state}`
    collapsible.layoutMode = "VERTICAL"
    collapsible.resize(420, state === "open" ? 120 : 44)
    collapsible.primaryAxisSizingMode = "FIXED"
    collapsible.counterAxisSizingMode = "FIXED"
    collapsible.paddingTop = collapsible.paddingBottom = collapsible.paddingLeft = collapsible.paddingRight = 10
    collapsible.itemSpacing = 10
    HR.bindSurface(collapsible, "color/card", "color/border")
    HR.bindRadius(collapsible, "radius/lg")
    const trigger = HR.frame("CollapsibleTrigger", "HORIZONTAL")
    trigger.resize(400, 24)
    trigger.primaryAxisSizingMode = "FIXED"
    trigger.counterAxisSizingMode = "FIXED"
    trigger.primaryAxisAlignItems = "SPACE_BETWEEN"
    trigger.appendChild(HR.shadcnText("Technical details", "Control"))
    trigger.appendChild(HR.shadcnIcon(state === "open" ? "ChevronUp" : "ChevronDown", HR.vars["color/muted/foreground"], 16))
    collapsible.appendChild(trigger)
    if (state === "open") collapsible.appendChild(HR.shadcnText("Provider response, timestamps and related identifiers.", "Body", "color/muted/foreground", "CollapsibleContent"))
    collapsibles.push(collapsible)
  }
  HR.shadcnVariantSet(collapsibles, section, "Collapsible", 2, "collapsible.tsx", "Collapsible > CollapsibleTrigger + CollapsibleContent")

  const drawer = figma.createComponent()
  drawer.name = "Drawer"
  drawer.layoutMode = "VERTICAL"
  drawer.resize(420, 420)
  drawer.primaryAxisSizingMode = "FIXED"
  drawer.counterAxisSizingMode = "FIXED"
  drawer.paddingTop = drawer.paddingBottom = drawer.paddingLeft = drawer.paddingRight = 16
  drawer.itemSpacing = 14
  HR.bindSurface(drawer, "color/popover", "color/border")
  drawer.topLeftRadius = drawer.topRightRadius = 18
  const handle = figma.createRectangle()
  handle.name = "DrawerHandle"
  handle.resize(36, 4)
  handle.cornerRadius = 999
  handle.fills = [HR.boundPaint(HR.vars["color/muted/foreground"], HR.lightColors["color/muted/foreground"], 0.4)]
  drawer.appendChild(handle)
  drawer.appendChild(HR.shadcnText("Filters", "Strong", "color/popover/foreground", "DrawerTitle"))
  drawer.appendChild(HR.shadcnText("Refine the records shown on this page.", "Body", "color/muted/foreground", "DrawerDescription"))
  const drawerBody = HR.frame("DrawerContent", "VERTICAL")
  drawerBody.resize(388, 250)
  drawerBody.primaryAxisSizingMode = "FIXED"
  drawerBody.counterAxisSizingMode = "FIXED"
  drawerBody.itemSpacing = 12
  drawerBody.appendChild(HR.shadcnText("Filter controls", "Body", "color/muted/foreground"))
  drawer.appendChild(drawerBody)
  HR.shadcnMeta(drawer, "drawer.tsx", "Drawer > Portal > Overlay + Content > Handle + Header/Title/Description + Footer")
  section.appendChild(drawer)
}

HR.ensureShadcnComponentsPage = async (page) => {
  await figma.setCurrentPageAsync(page)
  for (const orphan of [...page.children].filter(
    (node) =>
      node.name.startsWith(`${HR.GENERATED_PREFIX} / `) &&
      ![`${HR.GENERATED_PREFIX} / Components`, `${HR.GENERATED_PREFIX} / Patterns`].includes(node.name),
  )) orphan.remove()
  let existing = HR.findGeneratedNode(page, "Components")
  if (HR.hasCurrentCatalog(existing)) {
    existing.opacity = 1
    for (const section of existing.children.filter((node) => node.type === "FRAME")) section.opacity = 1
    return [existing.id]
  }
  if (existing) existing.remove()
  const patterns = HR.findGeneratedNode(page, "Patterns")
  if (patterns) patterns.remove()

  const root = HR.frame(`${HR.GENERATED_PREFIX} / Components`, "VERTICAL")
  root.resize(1960, 100)
  root.primaryAxisSizingMode = "AUTO"
  root.counterAxisSizingMode = "FIXED"
  root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = 64
  root.itemSpacing = 56
  root.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
  root.opacity = 1
  page.appendChild(root)
  root.appendChild(HR.sectionTitle("shadcn/ui · Radix Nova", "admin-web içindeki gerçek shadcn kaynaklarından türetilen Figma component kataloğu. Style: radix-nova · Base: Radix · Icons: Lucide · Tailwind v4."))
  HR.ensureShadcnBadges(root)
  HR.ensureShadcnButtons(root)
  HR.ensureShadcnForms(root)
  HR.ensureShadcnSelection(root)
  HR.ensureShadcnDataDisplay(root)
  HR.ensureShadcnNavigation(root)
  HR.ensureShadcnCalendar(root)
  HR.ensureShadcnOverlays(root)
  HR.ensureShadcnIdentityNavigation(root)
  HR.ensureShadcnAdvancedInputs(root)
  HR.ensureShadcnVisualizationAndDisclosure(root)
  HR.markCurrentCatalog(root)
  return [root.id]
}

HR.catalogMainComponent = (page, family) => {
  const set = page.findOne((node) => node.type === "COMPONENT_SET" && node.name === family)
  if (set?.children?.length) return set.children[0]
  return page.findOne((node) => node.type === "COMPONENT" && node.name === family)
}

HR.catalogPattern = (page, definition) => {
  const card = HR.shadcnSurface(definition.name, 1180, 160, "VERTICAL")
  card.primaryAxisSizingMode = "AUTO"
  card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 16
  card.itemSpacing = 16
  card.appendChild(HR.shadcnText(definition.name, "Strong"))

  const rows = HR.frame(`${definition.name} / Instances`, "VERTICAL")
  rows.resize(1148, 100)
  rows.primaryAxisSizingMode = "AUTO"
  rows.counterAxisSizingMode = "FIXED"
  rows.itemSpacing = 12
  let row = null
  let width = 0
  for (const family of definition.components) {
    const main = HR.catalogMainComponent(page, family)
    if (!main) throw new Error(`Pattern component is missing: ${family}`)
    const instance = main.createInstance()
    instance.name = `${family} / Instance`
    if (!row || width + instance.width > 1100) {
      row = HR.frame(`${definition.name} / Row`, "HORIZONTAL")
      row.primaryAxisSizingMode = "AUTO"
      row.counterAxisSizingMode = "AUTO"
      row.itemSpacing = 12
      rows.appendChild(row)
      width = 0
    }
    row.appendChild(instance)
    width += instance.width + 12
  }
  card.appendChild(rows)
  HR.shadcnMeta(card, definition.components.join(" + "), "Real component instances; no detached lookalike frames")
  return card
}

HR.catalogPageTemplate = (page, definition) => {
  const template = HR.shadcnSurface(`Page Template / ${definition.name}`, 1180, 680, "VERTICAL")
  template.primaryAxisSizingMode = "AUTO"
  template.paddingTop = template.paddingBottom = template.paddingLeft = template.paddingRight = 24
  template.itemSpacing = 16

  const heading = HR.frame(`${definition.name} / Template heading`, "VERTICAL")
  heading.itemSpacing = 4
  heading.appendChild(HR.shadcnText(definition.name, "Section"))
  heading.appendChild(HR.shadcnText(definition.description, "Body", "color/muted/foreground"))
  template.appendChild(heading)

  const canvas = HR.frame(`${definition.name} / Existing shell content`, "VERTICAL")
  canvas.resize(1132, 560)
  canvas.primaryAxisSizingMode = "AUTO"
  canvas.counterAxisSizingMode = "FIXED"
  canvas.paddingTop = canvas.paddingBottom = canvas.paddingLeft = canvas.paddingRight = 20
  canvas.itemSpacing = 16
  HR.bindSurface(canvas, "color/background", "color/border")
  HR.bindRadius(canvas, "radius/xl")

  let row = null
  let width = 0
  for (const family of definition.components) {
    const main = HR.catalogMainComponent(page, family)
    if (!main) throw new Error(`Page template component is missing: ${family}`)
    const instance = main.createInstance()
    instance.name = `${family} / Instance`
    if (!row || width + instance.width > 1050) {
      row = HR.frame(`${definition.name} / Template row`, "HORIZONTAL")
      row.primaryAxisSizingMode = "AUTO"
      row.counterAxisSizingMode = "AUTO"
      row.itemSpacing = 12
      canvas.appendChild(row)
      width = 0
    }
    row.appendChild(instance)
    width += instance.width + 12
  }
  template.appendChild(canvas)
  HR.shadcnMeta(template, definition.components.join(" + "), "Existing HR Axis shell content template composed from real catalog instances")
  return template
}

HR.ensureShadcnPatternsPage = async (page) => {
  await figma.setCurrentPageAsync(page)
  let existing = HR.findGeneratedNode(page, "Patterns")
  if (HR.hasCurrentCatalog(existing)) {
    existing.opacity = 1
    for (const section of existing.children.filter((node) => node.type === "FRAME")) section.opacity = 1
    return existing.id
  }
  if (existing) existing.remove()
  const root = HR.frame(`${HR.GENERATED_PREFIX} / Patterns`, "VERTICAL")
  root.resize(1440, 100)
  root.primaryAxisSizingMode = "AUTO"
  root.counterAxisSizingMode = "FIXED"
  root.x = 2040
  root.paddingTop = root.paddingBottom = root.paddingLeft = root.paddingRight = 64
  root.itemSpacing = 40
  root.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
  root.opacity = 1
  page.appendChild(root)
  root.appendChild(HR.sectionTitle("shadcn/ui composition patterns", "Her örnek katalogdaki gerçek component instance’larından oluşur."))
  for (const definition of HR.CATALOG.patterns) root.appendChild(HR.catalogPattern(page, definition))
  root.appendChild(HR.sectionTitle("Page templates", "Mevcut HR Axis admin/store kabuklarının içine yerleşen dört hazır sayfa kompozisyonu."))
  for (const definition of HR.CATALOG.pageTemplates) root.appendChild(HR.catalogPageTemplate(page, definition))
  HR.markCurrentCatalog(root)
  return root.id
}

HR.ensureComponentsPage = HR.ensureShadcnComponentsPage
HR.ensurePatternsPage = HR.ensureShadcnPatternsPage
