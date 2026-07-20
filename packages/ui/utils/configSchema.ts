import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'

export interface ConfigJsonSchema {
  $ref?: string
  type?: string | string[]
  title?: string
  description?: string
  default?: unknown
  const?: unknown
  enum?: unknown[]
  properties?: Record<string, ConfigJsonSchema>
  items?: ConfigJsonSchema
  additionalProperties?: boolean | ConfigJsonSchema
  patternProperties?: Record<string, ConfigJsonSchema>
  allOf?: ConfigJsonSchema[]
  oneOf?: ConfigJsonSchema[]
  anyOf?: ConfigJsonSchema[]
  if?: ConfigJsonSchema
  then?: ConfigJsonSchema
  else?: ConfigJsonSchema
  not?: ConfigJsonSchema
  required?: string[]
  [key: string]: unknown
}

const rootSchema = metaSchema as ConfigJsonSchema

function refValue(ref: string): ConfigJsonSchema {
  if (!ref.startsWith('#/')) return {}
  let current: unknown = rootSchema
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~')
    if (typeof current !== 'object' || current === null) return {}
    current = (current as Record<string, unknown>)[key]
  }
  return (current ?? {}) as ConfigJsonSchema
}

function matchesValue(schema: ConfigJsonSchema, value: unknown): boolean {
  if (schema.not && matchesValue(schema.not, value)) return false
  if (schema.const !== undefined) return schema.const === value
  if (schema.enum) return schema.enum.includes(value)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const typeMatches = types.some((type) => {
      if (type === 'array') return Array.isArray(value)
      if (type === 'object')
        return (
          typeof value === 'object' && value !== null && !Array.isArray(value)
        )
      if (type === 'integer') return Number.isInteger(value)
      if (type === 'number') return typeof value === 'number'
      if (type === 'null') return value === null
      if (type === 'string') return typeof value === 'string'
      if (type === 'boolean') return typeof value === 'boolean'
      return false
    })
    if (!typeMatches) return false
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const object = value as Record<string, unknown>
    if (schema.required?.some((key) => !(key in object))) return false
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (key in object && !matchesValue(property, object[key])) return false
    }
  }
  return true
}

function mergeSchemas(
  schemas: ConfigJsonSchema[],
  value?: unknown,
): ConfigJsonSchema {
  const merged: ConfigJsonSchema = {}
  const required = new Set<string>()
  for (const schema of schemas) {
    const resolved = resolveConfigSchema(schema, value)
    const previousProperties = merged.properties
    Object.assign(merged, resolved)
    if (resolved.properties) {
      merged.properties = {
        ...(previousProperties ?? {}),
        ...resolved.properties,
      }
    }
    resolved.required?.forEach((field) => required.add(field))
  }
  if (required.size) merged.required = [...required]
  return merged
}

export function resolveConfigSchema(
  schema: ConfigJsonSchema | undefined,
  value?: unknown,
  seen = new Set<string>(),
): ConfigJsonSchema {
  if (!schema) return {}
  let resolved: ConfigJsonSchema = { ...schema }
  if (schema.$ref && !seen.has(schema.$ref)) {
    const nextSeen = new Set(seen).add(schema.$ref)
    resolved = {
      ...resolveConfigSchema(refValue(schema.$ref), value, nextSeen),
      ...resolved,
    }
    delete resolved.$ref
  }
  if (resolved.allOf) {
    const { allOf, ...base } = resolved
    resolved = mergeSchemas([base, ...allOf], value)
  }
  const alternatives = resolved.oneOf ?? resolved.anyOf
  if (alternatives?.length) {
    const selected = alternatives.find((candidate) =>
      matchesValue(resolveConfigSchema(candidate), value),
    )
    const { oneOf: _oneOf, anyOf: _anyOf, ...base } = resolved
    resolved = mergeSchemas([base, selected ?? alternatives[0]!], value)
  }
  if (resolved.if) {
    const { if: condition, then: whenTrue, else: whenFalse, ...base } = resolved
    const branch = matchesValue(resolveConfigSchema(condition), value)
      ? whenTrue
      : whenFalse
    resolved = branch ? mergeSchemas([base, branch], value) : base
  }
  return resolved
}

export function configSectionSchema(section: string): ConfigJsonSchema {
  const definitions = (
    rootSchema as { definitions?: Record<string, ConfigJsonSchema> }
  ).definitions
  return resolveConfigSchema(definitions?.[section] ?? {})
}

export function configGeneralKeys(): string[] {
  return Object.keys(configSectionSchema('general').properties ?? {})
}

export function defaultForSchema(schema: ConfigJsonSchema): unknown {
  const resolved = resolveConfigSchema(schema)
  if (resolved.default !== undefined) return structuredClone(resolved.default)
  if (resolved.const !== undefined) return resolved.const
  if (resolved.enum?.length) return resolved.enum[0]
  const type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type
  if (type === 'object') return {}
  if (type === 'array') return []
  if (type === 'boolean') return false
  if (type === 'integer' || type === 'number') return 0
  return ''
}
