const postProgress = (text) => figma.ui.postMessage({ type: "progress", text })

const buildSystem = async () => {
  if (figma.editorType !== "figma") {
    throw new Error("Bu plugin yalnızca Figma Design dosyasında çalışır.")
  }

  postProgress("Yazı tipleri hazırlanıyor…")
  await HR.loadFonts()

  postProgress("Tokenlar ve stiller doğrulanıyor…")
  const foundationSummary = await HR.ensureFoundations()

  postProgress("Sayfa yapısı hazırlanıyor…")
  const [coverPage, foundationsPage, componentsPage] = await HR.ensurePages()

  postProgress("Kapak ve foundation dokümantasyonu hazırlanıyor…")
  const coverId = await HR.ensureCover(coverPage)
  const foundationsId = await HR.ensureFoundationsPage(foundationsPage)

  postProgress("Bileşen aileleri hazırlanıyor…")
  const componentIds = await HR.ensureComponentsPage(componentsPage)

  postProgress("Kullanım örnekleri hazırlanıyor…")
  const patternsId = await HR.ensurePatternsPage(componentsPage)

  await figma.setCurrentPageAsync(componentsPage)
  const componentsRoot = HR.findGeneratedNode(componentsPage, "Components")
  if (componentsRoot) figma.viewport.scrollAndZoomIntoView([componentsRoot])
  figma.commitUndo()

  return {
    pages: HR.PAGE_NAMES,
    variableCount: foundationSummary.variableCount,
    generatedNodeIds: [coverId, foundationsId, ...componentIds, patternsId],
  }
}

figma.showUI(__html__, { width: 380, height: 336, themeColors: true })

figma.ui.onmessage = async (message) => {
  if (message.type !== "build") return
  try {
    const result = await buildSystem()
    figma.ui.postMessage({
      type: "complete",
      text: `Tamamlandı. ${result.pages.length} sayfa ve ${result.variableCount} token hazır. Dosyayı Figma'dan düzenleyebilirsin.`,
    })
    figma.notify("HR Axis UI Foundations hazır.")
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    figma.ui.postMessage({ type: "error", text: `İşlem tamamlanamadı: ${detail}` })
    figma.notify("HR Axis UI Foundations oluşturulamadı.", { error: true })
  }
}
