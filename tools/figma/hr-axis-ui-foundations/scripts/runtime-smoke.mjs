import vm from "node:vm"

let sequence = 0
const nextId = (prefix) => `${prefix}:${++sequence}`

class MockNode {
  constructor(type, owner) {
    this.id = nextId(type.toLowerCase())
    this.type = type
    this.owner = owner
    this.name = `${type} ${sequence}`
    this._children = []
    this.parent = null
    this.width = 100
    this.height = 100
    this.fills = []
    this.strokes = []
    this.effects = []
    this.componentPropertyDefinitions = {}
    this.pluginData = {}
  }

  get children() {
    if (this.type === "PAGE" && this.owner && !this.owner.pagesLoaded) {
      throw new Error(
        "Cannot access property `children` on a page that has not been explicitly loaded.",
      )
    }
    return this._children
  }

  get counterAxisAlignItems() {
    return this._counterAxisAlignItems
  }

  set counterAxisAlignItems(value) {
    if (!["MIN", "MAX", "CENTER", "BASELINE"].includes(value)) {
      throw new Error(`Invalid counterAxisAlignItems value: ${value}`)
    }
    this._counterAxisAlignItems = value
  }

  appendChild(node) {
    if (node.parent) {
      node.parent._children = node.parent.children.filter((child) => child !== node)
    }
    node.parent = this
    this.children.push(node)
    return node
  }

  insertChild(index, node) {
    if (node.parent) {
      node.parent._children = node.parent.children.filter((child) => child !== node)
    }
    node.parent = this
    this.children.splice(index, 0, node)
  }

  remove() {
    if (!this.parent) return
    this.parent._children = this.parent.children.filter((child) => child !== this)
    this.parent = null
  }

  findAll(predicate) {
    const result = []
    const visit = (node) => {
      for (const child of node.children || []) {
        if (predicate(child)) result.push(child)
        visit(child)
      }
    }
    visit(this)
    return result
  }

  findOne(predicate) {
    return this.findAll(predicate)[0] || null
  }

  resize(width, height) {
    this.width = width
    this.height = height
    if (this.layoutMode && this.layoutMode !== "NONE") {
      this.primaryAxisSizingMode = "FIXED"
      this.counterAxisSizingMode = "FIXED"
    }
  }

  resizeWithoutConstraints(width, height) {
    this.resize(width, height)
  }

  setBoundVariable(field, variable) {
    this.boundVariables ||= {}
    this.boundVariables[field] = variable.id
  }

  addComponentProperty(name, type, defaultValue) {
    const key = `${name}#${this.id}`
    this.componentPropertyDefinitions[key] = { type, defaultValue }
    return key
  }

  createInstance() {
    const instance = new MockNode("INSTANCE", this.owner)
    instance.mainComponent = this
    instance.variantProperties = Object.fromEntries(
      this.name.split(", ").map((part) => part.split("=")),
    )
    this.owner.attach(instance)
    return instance
  }

  setProperties(properties) {
    this.variantProperties = { ...(this.variantProperties || {}), ...properties }
  }

  getPluginData(key) {
    return this.pluginData[key] || ""
  }

  setPluginData(key, value) {
    this.pluginData[key] = String(value)
  }
}

class MockVariable {
  constructor(name, collection, type) {
    this.id = nextId("variable")
    this.name = name
    this.variableCollectionId = collection.id
    this.resolvedType = type
    this.scopes = []
    this.codeSyntax = {}
    this.valuesByMode = {}
  }

  setVariableCodeSyntax(platform, value) {
    this.codeSyntax[platform] = value
  }

  setValueForMode(modeId, value) {
    this.valuesByMode[modeId] = value
  }
}

export const createFigmaMock = () => {
  const messages = []
  const variables = []
  const collections = []
  const textStyles = []
  const effectStyles = []
  const root = new MockNode("DOCUMENT")
  const firstPage = new MockNode("PAGE")
  firstPage.name = "Page 1"
  root.appendChild(firstPage)

  const figma = {
    editorType: "figma",
    root,
    currentPage: firstPage,
    pagesLoaded: false,
    ui: {
      onmessage: null,
      postMessage(message) {
        messages.push(message)
      },
    },
    viewport: { scrollAndZoomIntoView() {} },
    variables: {
      async getLocalVariableCollectionsAsync() {
        return [...collections]
      },
      async getLocalVariablesAsync() {
        return [...variables]
      },
      createVariableCollection(name) {
        const collection = {
          id: nextId("collection"),
          name,
          defaultModeId: nextId("mode"),
          renameMode(_modeId, modeName) {
            this.modeName = modeName
          },
        }
        collections.push(collection)
        return collection
      },
      createVariable(name, collection, type) {
        const variable = new MockVariable(name, collection, type)
        variables.push(variable)
        return variable
      },
      setBoundVariableForPaint(paint, field, variable) {
        return { ...paint, boundVariables: { [field]: { id: variable.id } } }
      },
    },
    attach(node) {
      this.currentPage.appendChild(node)
      return node
    },
    createPage() {
      const page = new MockNode("PAGE", this)
      root.appendChild(page)
      return page
    },
    createFrame() {
      return this.attach(new MockNode("FRAME", this))
    },
    createComponent() {
      return this.attach(new MockNode("COMPONENT", this))
    },
    createText() {
      const text = new MockNode("TEXT", this)
      text.height = 16
      text.characters = ""
      return this.attach(text)
    },
    createRectangle() {
      return this.attach(new MockNode("RECTANGLE", this))
    },
    createNodeFromSvg() {
      const frame = this.attach(new MockNode("FRAME", this))
      frame.appendChild(new MockNode("VECTOR", this))
      frame.children[0].strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }]
      return frame
    },
    combineAsVariants(components, parent) {
      const set = new MockNode("COMPONENT_SET", this)
      parent.appendChild(set)
      components.forEach((component) => set.appendChild(component))
      return set
    },
    async setCurrentPageAsync(page) {
      this.pagesLoaded = true
      this.currentPage = page
    },
    async loadAllPagesAsync() {
      this.pagesLoaded = true
    },
    async loadFontAsync() {},
    async getLocalTextStylesAsync() {
      return textStyles
    },
    async getLocalEffectStylesAsync() {
      return effectStyles
    },
    createTextStyle() {
      const style = { id: nextId("text-style"), name: "" }
      textStyles.push(style)
      return style
    },
    createEffectStyle() {
      const style = { id: nextId("effect-style"), name: "" }
      effectStyles.push(style)
      return style
    },
    showUI() {},
    commitUndo() {},
    notify() {},
  }

  for (const method of ["createPage", "createFrame", "createComponent", "createText", "createRectangle", "createNodeFromSvg"]) {
    figma[method] = figma[method].bind(figma)
  }
  root.owner = figma
  firstPage.owner = figma

  return { figma, messages, variables, collections, textStyles, effectStyles }
}

export const runBundle = async (bundle) => {
  const mock = createFigmaMock()
  const context = vm.createContext({ figma: mock.figma, __html__: "" })
  vm.runInContext(bundle, context)
  await mock.figma.ui.onmessage({ type: "build" })
  return mock
}
