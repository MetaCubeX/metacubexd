type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/**
 * Extract the useful diagnostic from a ky v2 HTTPError. H3 serializes
 * createError({ data: { error } }) as `HTTPError.data.data.error`; the generic
 * Error.message only says "Request failed with status code 400" and hides the
 * Mihomo validator output users need to repair their profile (#2121).
 */
export function controlErrorMessage(error: unknown): string {
  if (isRecord(error)) {
    const responseData = error.data
    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData
    }
    if (isRecord(responseData)) {
      const nested = responseData.data
      if (isRecord(nested)) {
        const detail =
          nonEmptyString(nested.error) ?? nonEmptyString(nested.message)
        if (detail) return detail
      }
      const detail =
        nonEmptyString(responseData.error) ??
        nonEmptyString(responseData.statusMessage) ??
        nonEmptyString(responseData.message)
      if (detail) return detail
    }
  }

  return error instanceof Error ? error.message : String(error)
}
