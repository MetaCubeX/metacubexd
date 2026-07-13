// Quick-filter input is a list of literal, case-insensitive terms. Supporting
// explicit separators keeps the feature predictable and prevents malformed or
// expensive user-supplied patterns from running for every connection update.
export function parseQuickFilterTerms(input: string): string[] {
  return input
    .replaceAll('\r', '\n')
    .replaceAll('\n', '|')
    .replaceAll(',', '|')
    .split('|')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
}

export function chainMatchesQuickFilter(
  chain: string[],
  terms: string[],
): boolean {
  return chain.some((name) => {
    const normalized = name.toLowerCase()
    return terms.some((term) => normalized.includes(term))
  })
}
