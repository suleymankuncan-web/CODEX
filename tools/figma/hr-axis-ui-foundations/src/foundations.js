HR.ensurePages = async () => {
  await figma.loadAllPagesAsync()
  const firstPage = figma.root.children[0]
  if (
    firstPage &&
    firstPage.name === "Page 1" &&
    firstPage.children.length === 0 &&
    !figma.root.children.some((page) => page.name === HR.PAGE_NAMES[0])
  ) {
    firstPage.name = HR.PAGE_NAMES[0]
  }

  const pages = HR.PAGE_NAMES.map(HR.ensurePage)
  pages.forEach((page, index) => figma.root.insertChild(index, page))
  return pages
}

HR.sectionTitle = (title, description) => {
  const block = HR.frame(`${title} / Header`, "VERTICAL")
  HR.bindGap(block, "space/8")
  block.appendChild(HR.text(title, "Section"))
  if (description) {
    const body = HR.text(description, "Body", {
      colorVariable: HR.vars["color/muted/foreground"],
      fallback: HR.lightColors["color/muted/foreground"],
    })
    body.resize(1100, body.height)
    body.textAutoResize = "HEIGHT"
    block.appendChild(body)
  }
  return block
}

HR.ensureCover = async (page) => {
  await figma.setCurrentPageAsync(page)
  const existing = HR.findGeneratedNode(page, "Cover")
  if (existing) return existing.id

  const cover = HR.frame(`${HR.GENERATED_PREFIX} / Cover`, "VERTICAL")
  cover.resize(1440, 900)
  cover.primaryAxisSizingMode = "FIXED"
  cover.counterAxisSizingMode = "FIXED"
  cover.primaryAxisAlignItems = "CENTER"
  cover.counterAxisAlignItems = "CENTER"
  HR.bindGap(cover, "space/16")
  cover.fills = [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])]
  page.appendChild(cover)

  const eyebrow = HR.text("HR AXIS · SHADCN/UI · RADIX NOVA", "MetadataStrong", {
    colorVariable: HR.vars["color/primary/foreground"],
    fallback: "#ffffff",
    opacity: 0.72,
  })
  eyebrow.letterSpacing = { value: 16, unit: "PERCENT" }
  cover.appendChild(eyebrow)

  const title = HR.text("UI Foundations", "Page", {
    size: 64,
    lineHeight: 72,
    colorVariable: HR.vars["color/primary/foreground"],
    fallback: "#ffffff",
  })
  cover.appendChild(title)

  cover.appendChild(
    HR.text("admin-web içindeki gerçek shadcn/ui kaynaklarıyla eşleşen operasyon bileşen sistemi.", "Body", {
      size: 18,
      lineHeight: 28,
      colorVariable: HR.vars["color/primary/foreground"],
      fallback: "#ffffff",
      opacity: 0.82,
    }),
  )
  cover.appendChild(
    HR.text("V1 · 09 Eylül 2026", "MetadataStrong", {
      colorVariable: HR.vars["color/primary/foreground"],
      fallback: "#ffffff",
      opacity: 0.6,
    }),
  )
  return cover.id
}

HR.colorCard = (name, variable, fallback) => {
  const card = HR.frame(`Swatch / ${name}`, "VERTICAL")
  card.resize(148, 108)
  card.counterAxisSizingMode = "FIXED"
  card.primaryAxisSizingMode = "FIXED"
  HR.pad(card, 8)
  card.itemSpacing = 6
  HR.bindSurface(card, "color/card", "color/border")
  HR.bindRadius(card, "radius/lg")

  const swatch = figma.createRectangle()
  swatch.name = "Color"
  swatch.resize(130, 54)
  swatch.fills = [HR.boundPaint(variable, fallback)]
  swatch.cornerRadius = 6
  card.appendChild(swatch)

  const label = HR.text(name.replace("color/", ""), "MetadataStrong")
  label.resize(130, 16)
  label.textAutoResize = "HEIGHT"
  card.appendChild(label)
  return card
}

HR.colorSection = (title, description, variables, values) => {
  const section = HR.frame(`${title} / Section`, "VERTICAL")
  section.resize(1312, 100)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.bindGap(section, "space/24")
  section.appendChild(HR.sectionTitle(title, description))

  const names = Object.keys(values)
  for (let offset = 0; offset < names.length; offset += 8) {
    const row = HR.frame(`${title} / Row ${offset / 8 + 1}`, "HORIZONTAL")
    row.resize(1312, 108)
    row.primaryAxisSizingMode = "FIXED"
    row.counterAxisSizingMode = "FIXED"
    HR.bindGap(row, "space/16")
    for (const name of names.slice(offset, offset + 8)) {
      row.appendChild(HR.colorCard(name, variables[name], values[name]))
    }
    section.appendChild(row)
  }
  return section
}

HR.typographySection = () => {
  const section = HR.frame("Typography / Section", "VERTICAL")
  section.resize(1312, 100)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.bindGap(section, "space/24")
  section.appendChild(
    HR.sectionTitle(
      "Typography",
      `Üretim fontu ${HR.CATALOG.typography.productionFamily}; yalnızca cihazda yoksa tanımlı fallback kullanılır.`,
    ),
  )

  for (const [name, style, size, lineHeight] of HR.textStyles) {
    const row = HR.frame(`Type / ${name}`, "HORIZONTAL")
    row.resize(1312, Math.max(64, lineHeight + 32))
    row.primaryAxisSizingMode = "FIXED"
    row.counterAxisSizingMode = "FIXED"
    row.counterAxisAlignItems = "CENTER"
    HR.bindGap(row, "space/24")
    row.strokes = [HR.boundPaint(HR.vars["color/border"], HR.lightColors["color/border"])]
    row.strokeBottomWeight = 1

    const meta = HR.text(`${name}\n${HR.fonts[style].family} ${HR.fonts[style].style} · ${size}/${lineHeight}`, "Metadata", {
      colorVariable: HR.vars["color/muted/foreground"],
      fallback: HR.lightColors["color/muted/foreground"],
    })
    meta.resize(260, 36)
    meta.textAutoResize = "HEIGHT"
    row.appendChild(meta)

    const sample = figma.createText()
    sample.name = "Sample"
    sample.fontName = HR.fonts[style]
    sample.fontSize = size
    sample.lineHeight = { value: lineHeight, unit: "PIXELS" }
    sample.characters = "Mağaza operasyonu, tek ve anlaşılır bir sistemde."
    sample.fills = [HR.boundPaint(HR.vars["color/foreground"], HR.lightColors["color/foreground"])]
    row.appendChild(sample)
    section.appendChild(row)
  }
  return section
}

HR.measureSection = () => {
  const section = HR.frame("Measures / Section", "VERTICAL")
  section.resize(1312, 100)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.bindGap(section, "space/32")
  section.appendChild(
    HR.sectionTitle(
      "Spacing, radius and control size",
      "Kompakt masaüstü kontrolleri; mobil kullanımda minimum 44 px dokunma alanı korunur.",
    ),
  )

  const spacing = HR.frame("Spacing / Rows", "VERTICAL")
  HR.bindGap(spacing, "space/12")
  for (const name of Object.keys(HR.dimensions).filter((key) => key.startsWith("space/"))) {
    const row = HR.frame(`Measure / ${name}`, "HORIZONTAL")
    row.counterAxisAlignItems = "CENTER"
    HR.bindGap(row, "space/16")
    const bar = figma.createRectangle()
    bar.name = name
    bar.resize(HR.dimensions[name] * 4, 12)
    bar.fills = [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])]
    bar.cornerRadius = 3
    row.appendChild(bar)
    row.appendChild(HR.text(`${name} · ${HR.dimensions[name]} px`, "MetadataStrong"))
    spacing.appendChild(row)
  }
  section.appendChild(spacing)

  const radiusRow = HR.frame("Radius / Row", "HORIZONTAL")
  HR.bindGap(radiusRow, "space/24")
  for (const name of Object.keys(HR.dimensions).filter((key) => key.startsWith("radius/"))) {
    const item = HR.frame(`Measure / ${name}`, "VERTICAL")
    item.counterAxisAlignItems = "CENTER"
    HR.bindGap(item, "space/8")
    const box = figma.createRectangle()
    box.resize(72, 72)
    box.fills = [HR.boundPaint(HR.vars["color/secondary"], HR.lightColors["color/secondary"])]
    box.strokes = [HR.boundPaint(HR.vars["color/primary"], HR.lightColors["color/primary"])]
    box.strokeWeight = 1
    HR.bindNumber(box, "cornerRadius", HR.vars[name], HR.dimensions[name])
    item.appendChild(box)
    item.appendChild(HR.text(`${name.replace("radius/", "")} · ${HR.dimensions[name]} px`, "Metadata"))
    radiusRow.appendChild(item)
  }
  section.appendChild(radiusRow)

  const controlRow = HR.frame("Control / Row", "HORIZONTAL")
  controlRow.counterAxisAlignItems = "MAX"
  HR.bindGap(controlRow, "space/24")
  for (const name of ["control/xs", "control/sm", "control/md", "control/lg", "control/touch-target"]) {
    const item = HR.frame(`Measure / ${name}`, "VERTICAL")
    item.counterAxisAlignItems = "CENTER"
    HR.bindGap(item, "space/8")
    const box = figma.createRectangle()
    box.resize(112, HR.dimensions[name])
    box.fills = [HR.boundPaint(HR.vars["color/card"], HR.lightColors["color/card"])]
    box.strokes = [HR.boundPaint(HR.vars["color/input"], HR.lightColors["color/input"])]
    box.strokeWeight = 1
    HR.bindNumber(box, "cornerRadius", HR.vars["radius/lg"], HR.dimensions["radius/lg"])
    item.appendChild(box)
    item.appendChild(HR.text(`${name.replace("control/", "")} · ${HR.dimensions[name]} px`, "Metadata"))
    controlRow.appendChild(item)
  }
  section.appendChild(controlRow)
  return section
}

HR.elevationSection = async () => {
  const section = HR.frame("Elevation / Section", "VERTICAL")
  section.resize(1312, 100)
  section.primaryAxisSizingMode = "AUTO"
  section.counterAxisSizingMode = "FIXED"
  HR.bindGap(section, "space/24")
  section.appendChild(
    HR.sectionTitle("Elevation", "Yalnızca açılır yüzeyler ve overlay katmanlarında kullanılır."),
  )

  const row = HR.frame("Elevation / Row", "HORIZONTAL")
  HR.pad(row, 32)
  HR.bindGap(row, "space/32")
  row.fills = [HR.boundPaint(HR.vars["color/muted"], HR.lightColors["color/muted"])]
  HR.bindRadius(row, "radius/xl")
  const effects = await figma.getLocalEffectStylesAsync()
  for (const name of ["Shadow/Medium", "Shadow/Overlay"]) {
    const card = HR.frame(`Elevation / ${name}`, "VERTICAL")
    card.resize(220, 120)
    card.primaryAxisSizingMode = "FIXED"
    card.counterAxisSizingMode = "FIXED"
    card.primaryAxisAlignItems = "CENTER"
    card.counterAxisAlignItems = "CENTER"
    HR.bindSurface(card, "color/card", null)
    HR.bindRadius(card, "radius/lg")
    const style = effects.find((candidate) => candidate.name === name)
    if (style) card.effects = style.effects
    card.appendChild(HR.text(name, "MetadataStrong"))
    row.appendChild(card)
  }
  section.appendChild(row)
  return section
}

HR.ensureFoundationsPage = async (page) => {
  await figma.setCurrentPageAsync(page)
  const existing = HR.findGeneratedNode(page, "Foundations")
  if (existing) {
    existing.primaryAxisSizingMode = "AUTO"
    for (const section of existing.children.filter(
      (node) => node.type === "FRAME" && node.name.endsWith(" / Section"),
    )) {
      section.primaryAxisSizingMode = "AUTO"
    }
    return existing.id
  }

  const root = HR.frame(`${HR.GENERATED_PREFIX} / Foundations`, "VERTICAL")
  root.resize(1440, 100)
  root.primaryAxisSizingMode = "AUTO"
  root.counterAxisSizingMode = "FIXED"
  HR.pad(root, 64)
  root.itemSpacing = 72
  root.fills = [HR.boundPaint(HR.vars["color/background"], HR.lightColors["color/background"])]
  page.appendChild(root)

  root.appendChild(
    HR.sectionTitle(
      "HR Axis · shadcn/ui Foundations",
      "Radix Nova bileşenlerinin kullandığı üretim CSS tokenlarıyla bağlı, tasarım ve kod arasında izlenebilir kaynak.",
    ),
  )
  root.appendChild(
    HR.colorSection(
      "Semantic colors · Light",
      "Bileşenlerde doğrudan hex yerine bu semantik değişkenleri kullanın.",
      HR.vars,
      HR.lightColors,
    ),
  )
  root.appendChild(
    HR.colorSection(
      "Semantic colors · Dark reference",
      "Starter plan tek mod kısıtı nedeniyle ayrı koleksiyonda tutulan koyu tema referansı.",
      HR.darkVars,
      HR.darkColors,
    ),
  )
  root.appendChild(HR.typographySection())
  root.appendChild(HR.measureSection())
  root.appendChild(await HR.elevationSection())
  return root.id
}
