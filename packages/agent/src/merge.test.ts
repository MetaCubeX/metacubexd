import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { mergeConfigs } from './merge'

// mergeConfigs returns YAML; parse the output to assert on structure rather
// than brittle string formatting.
function merged(base: string, ...overlays: string[]): Record<string, unknown> {
  return parse(mergeConfigs(base, overlays)) as Record<string, unknown>
}

describe('mergeConfigs', () => {
  it('deep-merges plain objects recursively', () => {
    const base = `
dns:
  enable: true
  nameserver:
    - 1.1.1.1
  fake-ip-range: 198.18.0.1/16
`
    const overlay = `
dns:
  enable: false
  enhanced-mode: fake-ip
`
    const out = merged(base, overlay)
    expect(out.dns).toEqual({
      // overlay scalar replaces base scalar
      enable: false,
      // base-only key survives
      nameserver: ['1.1.1.1'],
      'fake-ip-range': '198.18.0.1/16',
      // overlay-only key added
      'enhanced-mode': 'fake-ip',
    })
  })

  it('replaces scalars with overlay scalars', () => {
    const out = merged('mixed-port: 7890\nmode: rule', 'mode: global')
    expect(out['mixed-port']).toBe(7890)
    expect(out.mode).toBe('global')
  })

  it('replaces plain (non-directive) arrays wholesale', () => {
    const base = 'rules:\n  - a\n  - b\n'
    const overlay = 'rules:\n  - c\n'
    const out = merged(base, overlay)
    // a plain `rules:` array in the overlay REPLACES the base array
    expect(out.rules).toEqual(['c'])
  })

  it('prepend-rules / append-rules splice into base rules and do not leak', () => {
    const base = 'rules:\n  - MATCH,DIRECT\n'
    const overlay = `
prepend-rules:
  - DOMAIN,ahead.com,PROXY
append-rules:
  - DOMAIN,behind.com,REJECT
`
    const out = merged(base, overlay)
    expect(out.rules).toEqual([
      'DOMAIN,ahead.com,PROXY',
      'MATCH,DIRECT',
      'DOMAIN,behind.com,REJECT',
    ])
    expect(out).not.toHaveProperty('prepend-rules')
    expect(out).not.toHaveProperty('append-rules')
  })

  it('prepend/append proxies and proxy-groups directives splice and do not leak', () => {
    const base = `
proxies:
  - name: base-proxy
proxy-groups:
  - name: base-group
`
    const overlay = `
prepend-proxies:
  - name: front-proxy
append-proxies:
  - name: back-proxy
prepend-proxy-groups:
  - name: front-group
append-proxy-groups:
  - name: back-group
`
    const out = merged(base, overlay)
    expect(out.proxies).toEqual([
      { name: 'front-proxy' },
      { name: 'base-proxy' },
      { name: 'back-proxy' },
    ])
    expect(out['proxy-groups']).toEqual([
      { name: 'front-group' },
      { name: 'base-group' },
      { name: 'back-group' },
    ])
    for (const k of [
      'prepend-proxies',
      'append-proxies',
      'prepend-proxy-groups',
      'append-proxy-groups',
    ]) {
      expect(out).not.toHaveProperty(k)
    }
  })

  it('treats a missing base array as empty for directives', () => {
    const base = 'mode: rule\n'
    const overlay = 'append-rules:\n  - MATCH,DIRECT\n'
    const out = merged(base, overlay)
    expect(out.rules).toEqual(['MATCH,DIRECT'])
    expect(out).not.toHaveProperty('append-rules')
  })

  it('applies multiple overlays in order', () => {
    const base = 'rules:\n  - MATCH,DIRECT\nmode: rule\n'
    const o1 = 'append-rules:\n  - DOMAIN,one.com,PROXY\nmode: global\n'
    const o2 = 'append-rules:\n  - DOMAIN,two.com,REJECT\nmode: rule\n'
    const out = merged(base, o1, o2)
    // o1 appended first, then o2 appended onto the result
    expect(out.rules).toEqual([
      'MATCH,DIRECT',
      'DOMAIN,one.com,PROXY',
      'DOMAIN,two.com,REJECT',
    ])
    // last overlay's scalar wins
    expect(out.mode).toBe('rule')
  })

  it('returns the base unchanged when there are no overlays', () => {
    const out = merged('mode: rule\nmixed-port: 7890\n')
    expect(out).toEqual({ mode: 'rule', 'mixed-port': 7890 })
  })

  it('throws on a non-object base (scalar top level)', () => {
    expect(() => mergeConfigs('just-a-string', [])).toThrow()
  })

  it('throws on a non-object base (array top level)', () => {
    expect(() => mergeConfigs('- a\n- b\n', [])).toThrow()
  })

  it('throws on a null/empty base', () => {
    expect(() => mergeConfigs('', [])).toThrow()
  })

  it('throws on a non-object overlay', () => {
    expect(() => mergeConfigs('mode: rule\n', ['- a\n'])).toThrow()
  })
})
