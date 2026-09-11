HR.iconSvg = (name, colorVariable, size = 16) => {
  const paths = {
    Search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
    Calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
    ChevronDown: '<path d="m6 9 6 6 6-6"></path>',
    ChevronUp: '<path d="m18 15-6-6-6 6"></path>',
    ChevronLeft: '<path d="m15 18-6-6 6-6"></path>',
    ChevronRight: '<path d="m9 18 6-6-6-6"></path>',
    Close: '<path d="M18 6 6 18M6 6l12 12"></path>',
  }
  const svg = figma.createNodeFromSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06142d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`,
  )
  svg.name = `icon / ${name}`
  svg.resize(size, size)
  for (const vector of svg.findAll((node) => node.type === "VECTOR")) {
    if (vector.strokes && vector.strokes.length) {
      vector.strokes = [HR.boundPaint(colorVariable, "#06142d")]
    }
  }
  return svg
}

HR.componentSection = (title, description) => {
  const section = HR.frame(`${HR.GENERATED_PREFIX} / ${title}`, "VERTICAL")
  section.resize(1312, 100)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.pad(section, 32)
  HR.bindGap(section, "space/24")
  HR.bindSurface(section, "color/card", "color/border")
  HR.bindRadius(section, "radius/xl")
  section.appendChild(HR.sectionTitle(title, description))
  return section
}

HR.controlComponent = ({ name, heightName = "control/md", fill = "color/primary", stroke = null, opacity = 1 }) => {
  const component = figma.createComponent()
  component.name = name
  component.layoutMode = "HORIZONTAL"
  component.primaryAxisSizingMode = "AUTO"
  component.counterAxisSizingMode = "FIXED"
  component.primaryAxisAlignItems = "CENTER"
  component.counterAxisAlignItems = "CENTER"
  component.clipsContent = false
  component.fills = fill ? [HR.boundPaint(HR.vars[fill], HR.lightColors[fill], opacity)] : []
  component.strokes = stroke ? [HR.boundPaint(HR.vars[stroke], HR.lightColors[stroke])] : []
  component.strokeWeight = stroke ? 1 : 0
  HR.bindNumber(component, "height", HR.vars[heightName], HR.dimensions[heightName])
  HR.bindRadius(component, heightName === "control/xs" ? "radius/md" : "radius/lg")
  return component
}

HR.buttonColors = (variant) => {
  const map = {
    Default: ["color/primary", "color/primary/foreground", null, 1],
    Outline: ["color/card", "color/foreground", "color/border", 1],
    Secondary: ["color/secondary", "color/secondary/foreground", null, 1],
    Ghost: [null, "color/foreground", null, 1],
    Destructive: ["color/destructive", "color/destructive", null, 0.1],
    Link: [null, "color/primary", null, 1],
  }
  return map[variant]
}

HR.createButtonVariant = (variant, size, state, iconOnly = false) => {
  const heightMap = { XS: "control/xs", SM: "control/sm", MD: "control/md", LG: "control/lg" }
  const paddingMap = { XS: "space/8", SM: "space/10", MD: "space/10", LG: "space/10" }
  const [fill, textColor, stroke, fillOpacity] = HR.buttonColors(variant)
  const component = HR.controlComponent({
    name: `Variant=${variant}, Size=${size}, State=${state}`,
    heightName: heightMap[size],
    fill,
    stroke,
    opacity: fillOpacity,
  })
  component.opacity = state === "Disabled" ? 0.5 : 1
  component.itemSpacing = size === "XS" || size === "SM" ? 4 : 6

  if (iconOnly) {
    component.resize(HR.dimensions[heightMap[size]], HR.dimensions[heightMap[size]])
    component.primaryAxisSizingMode = "FIXED"
    const icon = HR.iconSvg("Calendar", HR.vars[textColor], size === "XS" ? 12 : size === "SM" ? 14 : 16)
    icon.name = "icon"
    component.appendChild(icon)
  } else {
    HR.bindPadding(component, paddingMap[size], "space/4")
    const icon = HR.iconSvg("Calendar", HR.vars[textColor], size === "XS" ? 12 : size === "SM" ? 14 : 16)
    icon.name = "icon"
    component.appendChild(icon)
    const label = HR.text("Buton", size === "XS" ? "MetadataStrong" : "Control", {
      name: "label",
      colorVariable: HR.vars[textColor],
      fallback: HR.lightColors[textColor],
    })
    if (variant === "Link") label.textDecoration = "UNDERLINE"
    component.appendChild(label)
  }
  return component
}

HR.combineVariantGrid = (components, parent, name, columns, description) => {
  const set = figma.combineAsVariants(components, parent)
  set.name = name
  set.description = description
  set.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]
  HR.bindRadius(set, "radius/lg")
  const gap = 16
  const padding = 24
  const cellWidth = 190
  let maxY = 0
  set.children.forEach((child, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    child.x = padding + column * (cellWidth + gap)
    child.y = padding + row * (56 + gap)
    maxY = Math.max(maxY, child.y + child.height)
  })
  set.resizeWithoutConstraints(padding * 2 + columns * cellWidth + (columns - 1) * gap, maxY + padding)
  return set
}

HR.addButtonProperties = (set, iconOnly = false) => {
  if (iconOnly) return
  const labelKey = set.addComponentProperty("Label", "TEXT", "Buton")
  const iconKey = set.addComponentProperty("Show icon", "BOOLEAN", true)
  for (const component of set.children) {
    const label = component.findOne((node) => node.name === "label")
    const icon = component.findOne((node) => node.name === "icon")
    if (label) label.componentPropertyReferences = { characters: labelKey }
    if (icon) icon.componentPropertyReferences = { visible: iconKey }
  }
}

HR.ensureButtons = (root) => {
  if (HR.findGeneratedNode(root, "Button")) return []
  const section = HR.componentSection(
    "Button",
    "Üretim Button API'sindeki variant ve size değerleriyle eşleşir. Durum matrisi varsayılan ve disabled görünümünü kapsar.",
  )
  root.appendChild(section)
  const created = [section.id]
  const sizes = ["XS", "SM", "MD", "LG"]
  const states = ["Default", "Disabled"]
  const groups = [
    ["Button / Core", ["Default", "Outline", "Secondary"]],
    ["Button / Utility", ["Ghost", "Destructive", "Link"]],
  ]
  for (const [name, variants] of groups) {
    const components = []
    for (const variant of variants) {
      for (const size of sizes) {
        for (const state of states) components.push(HR.createButtonVariant(variant, size, state))
      }
    }
    const set = HR.combineVariantGrid(components, section, name, 8, "HR Axis action button variants mapped to admin-web buttonVariants.")
    HR.addButtonProperties(set)
    created.push(set.id)
  }

  const iconComponents = []
  for (const variant of ["Default", "Outline", "Ghost"]) {
    for (const size of sizes) {
      for (const state of states) iconComponents.push(HR.createButtonVariant(variant, size, state, true))
    }
  }
  const iconSet = HR.combineVariantGrid(iconComponents, section, "Icon Button", 8, "Square icon-only actions. Keep a 44 px mobile touch target around compact visuals.")
  created.push(iconSet.id)
  return created
}

HR.fieldComponent = (type, state) => {
  const component = HR.controlComponent({
    name: `Type=${type}, State=${state}`,
    heightName: "control/md",
    fill: state === "Disabled" ? "color/input" : "color/card",
    stroke: state === "Error" ? "color/destructive" : state === "Focused" ? "color/ring" : "color/input",
    opacity: state === "Disabled" ? 0.5 : 1,
  })
  component.resize(280, 32)
  component.primaryAxisSizingMode = "FIXED"
  HR.bindPadding(component, "space/10", "space/4")
  HR.bindGap(component, "space/8")
  if (type === "Search") component.appendChild(HR.iconSvg("Search", HR.vars["color/muted/foreground"], 16))
  const value = HR.text(type === "Search" ? "Mağaza ara" : "Değer girin", "Body", {
    name: "value",
    colorVariable: HR.vars["color/muted/foreground"],
    fallback: HR.lightColors["color/muted/foreground"],
  })
  component.appendChild(value)
  if (state === "Focused") {
    component.effects = [{ type: "DROP_SHADOW", color: { ...HR.hex(HR.lightColors["color/ring"]), a: 0.22 }, offset: { x: 0, y: 0 }, radius: 3, spread: 1, visible: true, blendMode: "NORMAL" }]
  }
  return component
}

HR.ensureFields = (root) => {
  if (HR.findGeneratedNode(root, "Input / Search")) return []
  const section = HR.componentSection(
    "Input / Search",
    "Input ve arama alanı aynı 32 px kontrol yüksekliğini, radius ve focus sözlüğünü paylaşır.",
  )
  root.appendChild(section)
  const components = []
  for (const type of ["Input", "Search"]) {
    for (const state of ["Default", "Focused", "Disabled", "Error"]) components.push(HR.fieldComponent(type, state))
  }
  const set = HR.combineVariantGrid(components, section, "Input / Search", 4, "Text entry and search fields mapped to the production shadcn Input component.")
  const placeholderKey = set.addComponentProperty("Placeholder", "TEXT", "Değer girin")
  for (const component of set.children) {
    const value = component.findOne((node) => node.name === "value")
    if (value) value.componentPropertyReferences = { characters: placeholderKey }
  }
  return [section.id, set.id]
}

HR.selectComponent = (size, state) => {
  const height = size === "SM" ? "control/sm" : "control/md"
  const component = HR.controlComponent({
    name: `Size=${size}, State=${state}`,
    heightName: height,
    fill: state === "Disabled" ? "color/input" : "color/card",
    stroke: state === "Focused" || state === "Open" ? "color/ring" : "color/input",
    opacity: state === "Disabled" ? 0.5 : 1,
  })
  component.resize(220, HR.dimensions[height])
  component.primaryAxisSizingMode = "FIXED"
  component.primaryAxisAlignItems = "SPACE_BETWEEN"
  HR.bindPadding(component, "space/10", "space/4")
  const value = HR.text("Seçim yapın", "Body", { name: "value" })
  component.appendChild(value)
  component.appendChild(HR.iconSvg("ChevronDown", HR.vars["color/muted/foreground"], 16))
  return component
}

HR.ensureSelect = (root) => {
  if (HR.findGeneratedNode(root, "Select")) return []
  const section = HR.componentSection("Select", "Kompakt seçim kontrolü; açık menü popover tokenlarını kullanır.")
  root.appendChild(section)
  const components = []
  for (const size of ["SM", "MD"]) {
    for (const state of ["Default", "Focused", "Open", "Disabled"]) components.push(HR.selectComponent(size, state))
  }
  const set = HR.combineVariantGrid(components, section, "Select", 4, "Select trigger variants mapped to the production SelectTrigger API.")
  const valueKey = set.addComponentProperty("Value", "TEXT", "Seçim yapın")
  for (const component of set.children) {
    const value = component.findOne((node) => node.name === "value")
    if (value) value.componentPropertyReferences = { characters: valueKey }
  }
  return [section.id, set.id]
}

HR.badgeComponent = (variant) => {
  const colorMap = {
    Default: ["color/primary", "color/primary/foreground", null],
    Secondary: ["color/secondary", "color/secondary/foreground", null],
    Destructive: ["color/destructive", "color/destructive", null],
    Outline: ["color/card", "color/foreground", "color/border"],
    Success: ["color/success/soft", "color/success/foreground", null],
    Warning: ["color/warning/soft", "color/warning/foreground", null],
  }
  const [fill, textColor, stroke] = colorMap[variant]
  const component = HR.controlComponent({
    name: `Variant=${variant}`,
    heightName: "control/xs",
    fill,
    stroke,
    opacity: variant === "Destructive" ? 0.12 : 1,
  })
  HR.bindPadding(component, "space/8", "space/4")
  HR.bindRadius(component, "radius/4xl")
  const label = HR.text("Durum", "MetadataStrong", {
    name: "label",
    colorVariable: HR.vars[textColor],
    fallback: HR.lightColors[textColor],
  })
  component.appendChild(label)
  return component
}

HR.ensureBadges = (root) => {
  if (HR.findGeneratedNode(root, "Badge")) return []
  const section = HR.componentSection("Badge", "Durum ve kategori etiketleri. Aksiyon butonu yerine kullanılmaz.")
  root.appendChild(section)
  const components = ["Default", "Secondary", "Destructive", "Outline", "Success", "Warning"].map(HR.badgeComponent)
  const set = HR.combineVariantGrid(components, section, "Badge", 6, "Status and category badges mapped to production Badge semantics.")
  const labelKey = set.addComponentProperty("Label", "TEXT", "Durum")
  for (const component of set.children) {
    const label = component.findOne((node) => node.name === "label")
    if (label) label.componentPropertyReferences = { characters: labelKey }
  }
  return [section.id, set.id]
}

HR.calendarVariant = (state) => {
  const component = figma.createComponent()
  component.name = `State=${state}`
  component.layoutMode = "VERTICAL"
  component.primaryAxisSizingMode = "AUTO"
  component.counterAxisSizingMode = "FIXED"
  component.resize(300, 100)
  component.primaryAxisSizingMode = "AUTO"
  component.counterAxisSizingMode = "FIXED"
  HR.pad(component, 12)
  HR.bindGap(component, "space/8")
  HR.bindSurface(component, "color/popover", "color/border")
  HR.bindRadius(component, "radius/lg")

  const header = HR.frame("month header", "HORIZONTAL")
  header.resize(276, 28)
  header.primaryAxisSizingMode = "FIXED"
  header.counterAxisSizingMode = "FIXED"
  header.primaryAxisAlignItems = "SPACE_BETWEEN"
  header.counterAxisAlignItems = "CENTER"
  header.appendChild(HR.iconSvg("ChevronLeft", HR.vars["color/foreground"], 16))
  header.appendChild(HR.text("Eylül 2026", "Control"))
  header.appendChild(HR.iconSvg("ChevronRight", HR.vars["color/foreground"], 16))
  component.appendChild(header)

  const week = HR.frame("weekdays", "HORIZONTAL")
  week.resize(276, 20)
  week.primaryAxisSizingMode = "FIXED"
  week.counterAxisSizingMode = "FIXED"
  for (const day of ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"]) {
    const label = HR.text(day, "Metadata", {
      colorVariable: HR.vars["color/muted/foreground"],
      fallback: HR.lightColors["color/muted/foreground"],
    })
    label.resize(32, 16)
    label.textAlignHorizontal = "CENTER"
    week.appendChild(label)
  }
  component.appendChild(week)

  let day = 1
  for (let rowIndex = 0; rowIndex < 5; rowIndex += 1) {
    const row = HR.frame(`week ${rowIndex + 1}`, "HORIZONTAL")
    row.resize(276, 32)
    row.primaryAxisSizingMode = "FIXED"
    row.counterAxisSizingMode = "FIXED"
    row.itemSpacing = 8
    for (let column = 0; column < 7; column += 1) {
      const cell = HR.frame(`day ${day}`, "HORIZONTAL")
      cell.resize(32, 28)
      cell.primaryAxisSizingMode = "FIXED"
      cell.counterAxisSizingMode = "FIXED"
      cell.primaryAxisAlignItems = "CENTER"
      cell.counterAxisAlignItems = "CENTER"
      const selected = (state === "Selected" && day === 9) || (state === "Range" && day >= 8 && day <= 12)
      cell.fills = selected ? [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])] : []
      HR.bindRadius(cell, state === "Range" && day > 8 && day < 12 ? "radius/sm" : "radius/md")
      cell.appendChild(
        HR.text(String(day), "Metadata", {
          colorVariable: HR.vars[selected ? "color/primary/foreground" : "color/foreground"],
          fallback: HR.lightColors[selected ? "color/primary/foreground" : "color/foreground"],
        }),
      )
      row.appendChild(cell)
      day += 1
    }
    component.appendChild(row)
  }
  return component
}

HR.monthYearVariant = (state) => {
  const component = HR.controlComponent({
    name: `State=${state}`,
    heightName: "control/md",
    fill: "color/card",
    stroke: state === "Open" ? "color/ring" : "color/input",
  })
  component.resize(190, 32)
  component.primaryAxisSizingMode = "FIXED"
  component.primaryAxisAlignItems = "SPACE_BETWEEN"
  HR.bindPadding(component, "space/10", "space/4")
  const left = HR.frame("value", "HORIZONTAL")
  HR.bindGap(left, "space/8")
  left.counterAxisAlignItems = "CENTER"
  left.appendChild(HR.iconSvg("Calendar", HR.vars["color/muted/foreground"], 16))
  left.appendChild(HR.text("Eylül 2026", "Control", { name: "label" }))
  component.appendChild(left)
  component.appendChild(HR.iconSvg("ChevronDown", HR.vars["color/muted/foreground"], 16))
  return component
}

HR.ensureCalendar = (root) => {
  if (HR.findGeneratedNode(root, "Calendar")) return []
  const section = HR.componentSection(
    "Calendar",
    "Tarih seçimi ve ay-yıl kontrolü aynı 28 px gün hücresini, focus rengini ve popover yüzeyini paylaşır.",
  )
  root.appendChild(section)
  const calendarSet = HR.combineVariantGrid(
    ["Default", "Selected", "Range"].map(HR.calendarVariant),
    section,
    "Calendar",
    3,
    "Single-date and range calendar states mapped to the production Calendar component.",
  )
  const pickerSet = HR.combineVariantGrid(
    ["Default", "Open"].map(HR.monthYearVariant),
    section,
    "Month Year Picker",
    2,
    "Compact month and year selector for reporting periods.",
  )
  return [section.id, calendarSet.id, pickerSet.id]
}

HR.overlayComponent = (type) => {
  const component = figma.createComponent()
  component.name = type
  component.layoutMode = "VERTICAL"
  component.primaryAxisSizingMode = "FIXED"
  component.counterAxisSizingMode = "FIXED"
  component.resize(type === "Dialog" ? 420 : 480, type === "Dialog" ? 260 : 520)
  HR.pad(component, 16)
  HR.bindGap(component, "space/16")
  HR.bindSurface(component, "color/popover", "color/border")
  HR.bindRadius(component, type === "Dialog" ? "radius/xl" : "radius/lg")

  component.effects = [
    { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 20 }, radius: 25, spread: -5, visible: true, blendMode: "NORMAL" },
    { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 8 }, radius: 10, spread: -6, visible: true, blendMode: "NORMAL" },
  ]
  component.description = `${type} overlay mapped to admin-web/src/components/ui/${type === "Dialog" ? "dialog" : "sheet"}.tsx.`
  component.appendChild(HR.text(type === "Dialog" ? "İşlemi onayla" : "Mağaza ayrıntıları", "Section"))
  const description = HR.text(
    type === "Dialog"
      ? "Bu işlem seçili kaydı güncelleyecek. Devam etmek istediğinize emin misiniz?"
      : "İçerik ve işlem geçmişini ana bağlamdan ayrılmadan inceleyin.",
    "Body",
    { colorVariable: HR.vars["color/muted/foreground"], fallback: HR.lightColors["color/muted/foreground"] },
  )
  description.resize(type === "Dialog" ? 388 : 448, 44)
  description.textAutoResize = "HEIGHT"
  component.appendChild(description)

  const body = HR.frame("content", "VERTICAL")
  body.resize(type === "Dialog" ? 388 : 448, type === "Dialog" ? 76 : 320)
  body.primaryAxisSizingMode = "FIXED"
  body.counterAxisSizingMode = "FIXED"
  HR.pad(body, 12)
  HR.bindSurface(body, "color/muted", "color/border")
  HR.bindRadius(body, "radius/lg")
  body.appendChild(HR.text("İçerik alanı", "MetadataStrong"))
  component.appendChild(body)

  const footer = HR.frame("footer", "HORIZONTAL")
  footer.primaryAxisAlignItems = "MAX"
  HR.bindGap(footer, "space/8")
  footer.appendChild(HR.text("İptal", "Control", { colorVariable: HR.vars["color/muted/foreground"], fallback: HR.lightColors["color/muted/foreground"] }))
  footer.appendChild(HR.text("Kaydet", "Control", { colorVariable: HR.vars["color/primary"], fallback: HR.lightColors["color/primary"] }))
  component.appendChild(footer)
  const close = HR.iconSvg("Close", HR.vars["color/muted/foreground"], 16)
  close.name = "close"
  component.appendChild(close)
  close.layoutPositioning = "ABSOLUTE"
  close.x = component.width - 32
  close.y = 16

  return component
}

HR.ensureOverlays = (root) => {
  if (HR.findGeneratedNode(root, "Overlays")) return []
  const section = HR.componentSection(
    "Overlays",
    "Dialog kısa kararlar, Drawer ise bağlamı koruyan ayrıntı ve uzun akışlar içindir.",
  )
  root.appendChild(section)
  const dialog = HR.overlayComponent("Dialog")
  const drawer = HR.overlayComponent("Drawer")
  section.appendChild(dialog)
  section.appendChild(drawer)
  return [section.id, dialog.id, drawer.id]
}

HR.ensureComponentsPage = async (page) => {
  await figma.setCurrentPageAsync(page)
  let root = HR.findGeneratedNode(page, "Components")
  if (!root) {
    root = HR.frame(`${HR.GENERATED_PREFIX} / Components`, "VERTICAL")
    root.resize(1440, 100)
    root.primaryAxisSizingMode = "AUTO"
    root.counterAxisSizingMode = "FIXED"
    HR.pad(root, 64)
    root.itemSpacing = 56
    root.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
    page.appendChild(root)
    root.appendChild(
      HR.sectionTitle(
        "Components",
        "Üretim shadcn API'sine bağlı kompakt masaüstü bileşenleri ve 44 px mobil dokunma hedefi.",
      ),
    )
  } else {
    root.primaryAxisSizingMode = "AUTO"
    for (const section of root.children.filter(
      (node) => node.type === "FRAME" && node.name.startsWith(`${HR.GENERATED_PREFIX} / `),
    )) {
      section.primaryAxisSizingMode = "AUTO"
    }
    const calendar = root.findOne(
      (node) => node.type === "COMPONENT_SET" && node.name === "Calendar",
    )
    for (const component of calendar?.children || []) {
      component.primaryAxisSizingMode = "AUTO"
    }
  }
  const created = [root.id]
  created.push(...HR.ensureBadges(root))
  created.push(...HR.ensureButtons(root))
  created.push(...HR.ensureFields(root))
  created.push(...HR.ensureSelect(root))
  created.push(...HR.ensureCalendar(root))
  created.push(...HR.ensureOverlays(root))
  return created
}

HR.ensurePatternsPage = async (page) => {
  await figma.setCurrentPageAsync(page)
  const existing = HR.findGeneratedNode(page, "Patterns")
  if (existing) {
    existing.primaryAxisSizingMode = "AUTO"
    for (const section of existing.children.filter(
      (node) => node.type === "FRAME" && node.name.startsWith(`${HR.GENERATED_PREFIX} / `),
    )) {
      section.primaryAxisSizingMode = "AUTO"
    }
    return existing.id
  }
  const root = HR.frame(`${HR.GENERATED_PREFIX} / Patterns`, "VERTICAL")
  root.resize(1440, 100)
  root.primaryAxisSizingMode = "AUTO"
  root.x = 1520
  root.counterAxisSizingMode = "FIXED"
  HR.pad(root, 64)
  root.itemSpacing = 56
  root.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
  page.appendChild(root)
  root.appendChild(
    HR.sectionTitle(
      "Patterns",
      "Liste filtresi, dönem seçimi ve overlay aksiyon yerleşimleri için ortak kullanım örnekleri.",
    ),
  )

  const toolbar = HR.componentSection(
    "Filter toolbar",
    "Arama solda; dönem ve birincil aksiyon sağda. Kontroller aynı yükseklik hattına oturur.",
  )
  const bar = HR.frame("Filter toolbar / Example", "HORIZONTAL")
  bar.resize(1248, 64)
  bar.primaryAxisSizingMode = "FIXED"
  bar.counterAxisSizingMode = "FIXED"
  bar.primaryAxisAlignItems = "SPACE_BETWEEN"
  bar.counterAxisAlignItems = "CENTER"
  HR.pad(bar, 16)
  HR.bindSurface(bar, "color/card", "color/border")
  HR.bindRadius(bar, "radius/lg")
  const componentsPage = figma.root.children.find((candidate) => candidate.name === "02 Components")
  const instanceFromSet = (name) => {
    const set = componentsPage?.findOne(
      (node) => node.type === "COMPONENT_SET" && node.name === name,
    )
    return set?.children[0]?.createInstance() || null
  }
  const search = instanceFromSet("Input / Search")
  if (!search) throw new Error("Input / Search component set is missing")
  search.name = "Search / Example"
  search.setProperties({ Type: "Search", State: "Default" })
  bar.appendChild(search)
  const actions = HR.frame("actions", "HORIZONTAL")
  actions.counterAxisAlignItems = "CENTER"
  HR.bindGap(actions, "space/8")
  const select = instanceFromSet("Select")
  const button = instanceFromSet("Button / Core")
  if (!select || !button) throw new Error("Pattern dependencies are missing")
  select.setProperties({ Size: "MD", State: "Default" })
  button.setProperties({ Variant: "Default", Size: "MD", State: "Default" })
  actions.appendChild(select)
  actions.appendChild(button)
  bar.appendChild(actions)
  toolbar.appendChild(bar)
  root.appendChild(toolbar)

  const guidance = HR.componentSection(
    "Usage rules",
    "Bir sayfada tek birincil aksiyon; filtreler tablo başlığına yakın; tarih kontrolleri Calendar tokenlarıyla aynı sözlüğü kullanır.",
  )
  guidance.appendChild(HR.text("• Gri/pastel arka planı sort göstergesi yerine kullanmayın.\n• Durumları Badge ile, aksiyonları Button ile gösterin.\n• Drawer uzun bağlamsal kayıtlar; Dialog kısa kararlar içindir.", "Body"))
  root.appendChild(guidance)
  return root.id
}
