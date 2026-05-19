import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const adminRoot = resolve(scriptDir, '..')
const repoRoot = resolve(adminRoot, '..')
const openApiPath = resolve(repoRoot, 'docs/api/openapi.json')
const outputPath = resolve(adminRoot, 'src/generated/openapi-types.ts')
const checkMode = process.argv.includes('--check')

const document = JSON.parse(await readFile(openApiPath, 'utf8'))

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete'])
const selectedOperations = [
  { path: '/api/auth/action-store-assignments', method: 'get' },
  { path: '/api/auth/action-store-assignments/{assignmentId}/audit', method: 'get' },
  { path: '/api/auth/bootstrap', method: 'get' },
  { path: '/api/auth/lookups', method: 'get' },
  { path: '/api/auth/lookups/stores/search', method: 'get' },
  { path: '/api/auth/lookups/users/search', method: 'get' },
  { path: '/api/auth/permissions', method: 'get' },
  { path: '/api/auth/role-assignments', method: 'get' },
  { path: '/api/auth/role-assignments', method: 'post' },
  { path: '/api/auth/role-assignments/{assignmentId}/audit', method: 'get' },
  { path: '/api/auth/role-assignments/{assignmentId}/deactivate', method: 'patch' },
  { path: '/api/auth/roles', method: 'get' },
  { path: '/api/auth/session', method: 'get' },
  { path: '/api/auth/users', method: 'get' },
  { path: '/api/auth/users/{userId}/audit', method: 'get' },
  { path: '/api/competitions', method: 'get' },
  { path: '/api/competitions/{competitionId}', method: 'get' },
  { path: '/api/competitions/{competitionId}/stage-package-plans', method: 'get' },
  { path: '/api/competitions/stage-package-plans/{planId}/audit', method: 'get' },
  { path: '/api/competitions/team-templates', method: 'get' },
  { path: '/api/integrations/external-id-map-candidates', method: 'get' },
  { path: '/api/integrations/import-batches/{batchId}/audit', method: 'get' },
  { path: '/api/integrations/import-batches/{batchId}/errors', method: 'get' },
  { path: '/api/integrations/import-batches/{batchId}/reconciliation', method: 'get' },
  { path: '/api/integrations/import-batches/{batchId}', method: 'get' },
  { path: '/api/integrations/import-batches/overview', method: 'get' },
  { path: '/api/integrations/import-batches/needs-action', method: 'get' },
  { path: '/api/integrations/import-payload-templates', method: 'get' },
  { path: '/api/integrations/lookups', method: 'get' },
  { path: '/api/integrations/personnel-master', method: 'get' },
  { path: '/api/integrations/personnel-master-lookups', method: 'get' },
  { path: '/api/integrations/store-master', method: 'get' },
  { path: '/api/integrations/store-master-lookups', method: 'get' },
  { path: '/api/integrations/master-data-bootstrap/batches', method: 'get' },
  { path: '/api/integrations/master-data-bootstrap/batches/{batchId}', method: 'get' },
  {
    path: '/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness',
    method: 'get',
  },
  { path: '/api/mobile/checklists/today', method: 'get' },
  { path: '/api/reports/checklists', method: 'get' },
  { path: '/api/snapshots/daily-closure', method: 'get' },
  { path: '/api/snapshots/runs/needs-action', method: 'get' },
  { path: '/api/snapshots/runs/overview', method: 'get' },
  { path: '/api/snapshots/runs/{snapshotRunId}', method: 'get' },
  { path: '/api/snapshots/runs/{snapshotRunId}/audit', method: 'get' },
  { path: '/api/snapshots/runs/{snapshotRunId}/dependencies', method: 'get' },
  { path: '/api/snapshots/runs/{snapshotRunId}/lineage', method: 'get' },
  { path: '/api/reports/kpi-config', method: 'get' },
  { path: '/api/reports/kpi-config', method: 'patch' },
  { path: '/api/reports/kpi-config/audit', method: 'get' },
  { path: '/api/reports/kpi-config/editor', method: 'get' },
  { path: '/api/reports/kpi-config/publish', method: 'patch' },
  { path: '/api/reports/kpis', method: 'get' },
  { path: '/api/reports/leaderboards/closed', method: 'get' },
  { path: '/api/reports/my-performance', method: 'get' },
  { path: '/api/reports/personnel-performance/{employeeId}', method: 'get' },
  { path: '/api/reports/rankings', method: 'get' },
  { path: '/api/reports/snapshot-runs', method: 'get' },
  { path: '/api/reports/store-kpi-highlights', method: 'get' },
  { path: '/api/reports/store-score-breakdown', method: 'get' },
  { path: '/api/reports/summary', method: 'get' },
  { path: '/api/reports/turnover', method: 'get' },
  { path: '/api/reports/workforce', method: 'get' },
  { path: '/api/target-distributions/coverage', method: 'get' },
  { path: '/api/target-distributions/requests', method: 'get' },
  { path: '/api/target-distributions/store-personnel', method: 'get' },
  { path: '/api/workforce/offboarding-requests', method: 'get' },
  { path: '/api/workforce/position-options', method: 'get' },
  { path: '/api/workforce/seller-code-reference', method: 'get' },
  { path: '/api/workforce/seller-code-requests', method: 'get' },
  { path: '/api/workforce/store-employees', method: 'get' },
  { path: '/api/workflow/inbox', method: 'get' },
]
const selectedSchemaNames = collectReferencedSchemaNames(document, selectedOperations)

const output = [
  '// Generated by admin-web/scripts/generate-openapi-types.mjs from docs/api/openapi.json.',
  '// Add operations to selectedOperations in the generator before adopting more endpoints.',
  '// Do not edit manually.',
  '',
  renderComponents(document.components ?? {}, selectedSchemaNames),
  '',
  renderPaths(document.paths ?? {}, selectedOperations),
  '',
]
const outputText = `${output.join('\n')}\n`

if (checkMode) {
  await verifyGeneratedTypesAreCurrent(outputText)
} else {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, outputText, 'utf8')

  console.log(`Generated ${outputPath}`)
}

async function verifyGeneratedTypesAreCurrent(expectedOutput) {
  let currentOutput = ''

  try {
    currentOutput = await readFile(outputPath, 'utf8')
  } catch {
    console.error(`Generated OpenAPI types are missing at ${outputPath}. Run npm run api:generate in admin-web.`)
    process.exit(1)
  }

  if (normalizeLineEndings(currentOutput) !== expectedOutput) {
    console.error(`Generated OpenAPI types are stale at ${outputPath}. Run npm run api:generate in admin-web.`)
    process.exit(1)
  }

  console.log('Generated OpenAPI types are current.')
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

function renderComponents(components, schemaNames) {
  const schemas = components.schemas ?? {}
  const lines = ['export type components = {', '  schemas: {']

  for (const name of Array.from(schemaNames).sort()) {
    if (!schemas[name]) {
      continue
    }

    lines.push(`    ${quoteKey(name)}: ${schemaToType(schemas[name], 2)}`)
  }

  lines.push('  }', '}')
  return lines.join('\n')
}

function renderPaths(paths, operations) {
  const operationsByPath = groupOperationsByPath(operations)
  const lines = ['export type paths = {']

  for (const [path, methods] of operationsByPath) {
    const pathItem = paths[path] ?? {}
    lines.push(`  ${quoteKey(path)}: {`)

    for (const method of Array.from(methods).sort()) {
      const operation = pathItem[method] ?? {}
      const requestBodyType = requestBodyToType(operation.requestBody, 3)
      lines.push(`    ${method}: {`)
      if (requestBodyType) {
        lines.push(`      requestBody: ${requestBodyType}`)
      }
      lines.push(`      responses: ${responsesToType(operation.responses ?? {}, 3)}`)
      lines.push('    }')
    }

    lines.push('  }')
  }

  lines.push('}')
  return lines.join('\n')
}

function groupOperationsByPath(operations) {
  const operationsByPath = new Map()

  for (const operation of operations) {
    if (!httpMethods.has(operation.method)) {
      throw new Error(`Unsupported OpenAPI method selected: ${operation.method}`)
    }

    const methods = operationsByPath.get(operation.path) ?? new Set()
    methods.add(operation.method)
    operationsByPath.set(operation.path, methods)
  }

  return operationsByPath
}

function collectReferencedSchemaNames(openApiDocument, operations) {
  const schemaNames = new Set()
  const schemas = openApiDocument.components?.schemas ?? {}

  for (const { path, method } of operations) {
    const pathItem = openApiDocument.paths?.[path] ?? {}
    const operation = pathItem[method] ?? {}
    collectSchema(operation.requestBody?.content?.['application/json']?.schema)

    for (const response of Object.values(operation.responses ?? {})) {
      collectSchema(response?.content?.['application/json']?.schema)
    }
  }

  return schemaNames

  function collectSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return
    }

    if (schema.$ref) {
      const name = schema.$ref.split('/').at(-1)
      if (name && !schemaNames.has(name)) {
        schemaNames.add(name)
        collectSchema(schemas[name])
      }
      return
    }

    for (const key of ['allOf', 'oneOf', 'anyOf']) {
      for (const item of schema[key] ?? []) {
        collectSchema(item)
      }
    }

    collectSchema(schema.items)
    collectSchema(schema.additionalProperties)

    for (const propertySchema of Object.values(schema.properties ?? {})) {
      collectSchema(propertySchema)
    }
  }
}

function requestBodyToType(requestBody, level) {
  const jsonSchema = requestBody?.content?.['application/json']?.schema
  if (!jsonSchema) {
    return null
  }

  const indent = '  '.repeat(level)
  const childIndent = '  '.repeat(level + 1)

  return [
    '{',
    `${childIndent}content: {`,
    `${childIndent}  'application/json': ${schemaToType(jsonSchema, level + 2)}`,
    `${childIndent}}`,
    `${indent}}`,
  ].join('\n')
}

function responsesToType(responses, level) {
  const entries = Object.entries(responses)

  if (entries.length === 0) {
    return 'Record<string, never>'
  }

  const indent = '  '.repeat(level)
  const childIndent = '  '.repeat(level + 1)
  const lines = ['{']

  for (const [status, response] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    const jsonSchema = response?.content?.['application/json']?.schema
    lines.push(`${childIndent}${quoteKey(status)}: {`)

    if (jsonSchema) {
      lines.push(`${childIndent}  content: {`)
      lines.push(`${childIndent}    'application/json': ${schemaToType(jsonSchema, level + 3)}`)
      lines.push(`${childIndent}  }`)
    } else {
      lines.push(`${childIndent}  content: Record<string, never>`)
    }

    lines.push(`${childIndent}}`)
  }

  lines.push(`${indent}}`)
  return lines.join('\n')
}

function schemaToType(schema, level) {
  if (!schema || typeof schema !== 'object') {
    return 'unknown'
  }

  const nullable = schema.nullable === true

  if (schema.$ref) {
    return applyNullable(refToType(schema.$ref), nullable)
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return applyNullable(schema.allOf.map((item) => wrapComposite(schemaToType(item, level))).join(' & '), nullable)
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return applyNullable(schema.oneOf.map((item) => wrapComposite(schemaToType(item, level))).join(' | '), nullable)
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return applyNullable(schema.anyOf.map((item) => wrapComposite(schemaToType(item, level))).join(' | '), nullable)
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return applyNullable(schema.enum.map(literalToType).join(' | '), nullable)
  }

  const schemaTypes = Array.isArray(schema.type) ? schema.type : [schema.type].filter(Boolean)
  const includesNull = schemaTypes.includes('null')
  const type = schemaTypes.find((item) => item !== 'null')

  if (type === 'array') {
    return applyNullable(arrayToType(schema.items, level), nullable || includesNull)
  }

  if (type === 'object' || schema.properties || schema.additionalProperties) {
    return applyNullable(objectToType(schema, level), nullable || includesNull)
  }

  if (type === 'integer' || type === 'number') {
    return applyNullable('number', nullable || includesNull)
  }

  if (type === 'string') {
    return applyNullable('string', nullable || includesNull)
  }

  if (type === 'boolean') {
    return applyNullable('boolean', nullable || includesNull)
  }

  return applyNullable('unknown', nullable || includesNull)
}

function objectToType(schema, level) {
  const properties = schema.properties ?? {}
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  const entries = Object.entries(properties)
  const indent = '  '.repeat(level)
  const childIndent = '  '.repeat(level + 1)
  const lines = ['{']

  for (const [name, propertySchema] of entries) {
    const optional = required.has(name) ? '' : '?'
    lines.push(`${childIndent}${quoteKey(name)}${optional}: ${schemaToType(propertySchema, level + 1)}`)
  }

  if (schema.additionalProperties) {
    const valueType =
      schema.additionalProperties === true ? 'unknown' : schemaToType(schema.additionalProperties, level + 1)
    lines.push(`${childIndent}[key: string]: ${valueType}`)
  }

  if (lines.length === 1) {
    return 'Record<string, unknown>'
  }

  lines.push(`${indent}}`)
  return lines.join('\n')
}

function arrayToType(items, level) {
  const itemType = schemaToType(items ?? {}, level + 1)
  return isPlainType(itemType) ? `${itemType}[]` : `Array<${itemType}>`
}

function refToType(ref) {
  const parts = ref.split('/')
  const componentType = parts.at(-2)
  const name = parts.at(-1)

  if (componentType === 'schemas' && name) {
    return `components['schemas'][${quoteKey(decodeURIComponent(name))}]`
  }

  return 'unknown'
}

function applyNullable(type, nullable) {
  return nullable ? `${wrapComposite(type)} | null` : type
}

function wrapComposite(type) {
  return type.includes('\n') ? `(${type})` : type
}

function isPlainType(type) {
  return /^[A-Za-z0-9_$.[\]'"]+$/.test(type)
}

function literalToType(value) {
  return value === null ? 'null' : JSON.stringify(value)
}

function quoteKey(key) {
  return JSON.stringify(key)
}
