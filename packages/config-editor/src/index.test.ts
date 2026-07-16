import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  ConfigDocumentError,
  diffDocument,
  openDocument,
  validateDocument,
} from './index'

describe('config editor document', () => {
  it('rejects invalid YAML and non-mapping roots', () => {
    expect(() => openDocument('dns: [')).toThrow(ConfigDocumentError)
    expect(() => openDocument('- one\n- two\n')).toThrow(ConfigDocumentError)
  })

  it('preserves untouched section comments while replacing touched sections', () => {
    const base = `# header\nmode: rule # keep\ndns:\n  enable: true\n`
    const draft = `mode: rule\ndns:\n  enable: false\n  nameserver: [1.1.1.1]\n`
    const result = applyPatch(base, diffDocument(base, draft))
    expect(result.conflicts).toEqual([])
    expect(result.document.yaml).toContain('# header')
    expect(result.document.yaml).toContain('mode: rule # keep')
    expect(result.document.data.dns).toEqual({
      enable: false,
      nameserver: ['1.1.1.1'],
    })
  })

  it('upserts, deletes, and reorders named resources', () => {
    const base = `proxies:\n  - { name: a, type: ss, server: old }\n  - { name: b, type: direct }\n`
    const draft = `proxies:\n  - { name: c, type: direct }\n  - { name: a, type: ss, server: new }\n`
    const patch = diffDocument(base, draft)
    expect(patch.operations.map((op) => op.op)).toEqual([
      'upsert',
      'delete',
      'upsert',
      'order',
    ])
    const result = applyPatch(base, patch)
    expect(result.conflicts).toEqual([])
    expect(result.document.data.proxies).toEqual([
      { name: 'c', type: 'direct' },
      { name: 'a', type: 'ss', server: 'new' },
    ])
  })

  it('rebases an independent change and reports an overlapping change', () => {
    const base = `proxies:\n  - { name: a, type: ss, server: one }\n  - { name: b, type: direct }\n`
    const draft = `proxies:\n  - { name: a, type: ss, server: two }\n  - { name: b, type: direct }\n`
    const patch = diffDocument(base, draft)
    const independent = applyPatch(`${base}dns:\n  enable: true\n`, patch)
    expect(independent.conflicts).toEqual([])

    const changed = applyPatch(
      `proxies:\n  - { name: a, type: ss, server: upstream }\n  - { name: b, type: direct }\n`,
      patch,
    )
    expect(changed.conflicts).toHaveLength(1)
    expect(changed.conflicts[0]?.reason).toBe('changed')
  })

  it('validates duplicate resources and broken references', () => {
    const diagnostics = validateDocument({
      proxies: [
        { name: 'same', type: 'direct' },
        { name: 'same', type: 'direct' },
      ],
      'proxy-groups': [{ name: 'group', type: 'select', proxies: ['missing'] }],
      rules: ['MATCH,missing'],
    })
    expect(diagnostics.map((item) => item.code)).toEqual([
      'duplicate-name',
      'missing-reference',
      'missing-reference',
    ])
  })

  it('addresses rules by content identity instead of array index', () => {
    const base = `rules:\n  - DOMAIN,one.test,DIRECT\n  - MATCH,DIRECT\n`
    const draft = `rules:\n  - DOMAIN,one.test,REJECT\n  - MATCH,DIRECT\n`
    const patch = diffDocument(base, draft)
    expect(patch.operations[0]?.op).toBe('sequence-replace')

    const refreshed = `rules:\n  - DOMAIN,new.test,DIRECT\n  - DOMAIN,one.test,DIRECT\n  - MATCH,DIRECT\n`
    const result = applyPatch(refreshed, patch)
    expect(result.conflicts).toEqual([])
    expect(result.document.data.rules).toEqual([
      'DOMAIN,new.test,DIRECT',
      'DOMAIN,one.test,REJECT',
      'MATCH,DIRECT',
    ])
  })

  it('reports a conflict when a reorder anchor disappeared upstream', () => {
    const base = `proxies:\n  - { name: a, type: direct }\n  - { name: b, type: direct }\n`
    const draft = `proxies:\n  - { name: b, type: direct }\n  - { name: a, type: direct }\n`
    const patch = diffDocument(base, draft)
    const result = applyPatch(
      `proxies:\n  - { name: b, type: direct }\n`,
      patch,
    )
    expect(result.conflicts).toEqual([
      expect.objectContaining({ reason: 'missing' }),
    ])
  })
})
