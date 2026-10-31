import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  ConfigDocumentError,
  diffDocument,
  findResourceReferences,
  hashConfigValue,
  openDocument,
  splitRuleFields,
  validateDocument,
} from './index'

describe('config editor document', () => {
  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects %s paths before any patch operation can mutate a prototype',
    (segment) => {
      const patch = {
        version: 1 as const,
        baseRevision: '',
        operations: [
          {
            op: 'set' as const,
            target: { path: [segment, 'mcxdPolluted'] },
            expectedHash: hashConfigValue(undefined),
            value: 'polluted',
          },
        ],
      }
      try {
        expect(() => applyPatch('mode: rule\n', patch)).toThrow(
          'Invalid configuration patch',
        )
        expect(Object.hasOwn(Object.prototype, 'mcxdPolluted')).toBe(false)
      } finally {
        Reflect.deleteProperty(Object.prototype, 'mcxdPolluted')
      }
    },
  )

  it('never follows an inherited object when creating a patch parent', () => {
    const inherited = { marker: 'untouched' }
    // Simulate a polluted environment; always remove the property in finally.
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, 'mcxdInherited', {
      value: inherited,
      configurable: true,
    })
    try {
      const result = applyPatch('mode: rule\n', {
        version: 1,
        baseRevision: '',
        operations: [
          {
            op: 'set',
            target: { path: ['mcxdInherited', 'marker'] },
            expectedHash: hashConfigValue(undefined),
            value: 'local',
          },
        ],
      })
      expect(result.conflicts).toEqual([])
      expect(result.document.data.mcxdInherited).toEqual({ marker: 'local' })
      expect(inherited.marker).toBe('untouched')
    } finally {
      Reflect.deleteProperty(Object.prototype, 'mcxdInherited')
    }
  })

  it.each([
    'remove',
    'upsert',
    'delete',
    'order',
    'sequence-replace',
    'sequence-delete',
    'sequence-insert',
    'sequence-order',
  ])('rejects unsafe paths for %s operations as well as set', (op) => {
    expect(() =>
      applyPatch('mode: rule\n', {
        version: 1,
        baseRevision: '',
        operations: [
          {
            op,
            target: { path: ['dns', '__proto__'], key: 'name', id: 'item' },
            expectedHash: hashConfigValue(undefined),
            value: { name: 'item' },
            ids: [],
            previousIds: [],
          },
        ],
      } as never),
    ).toThrow('Invalid configuration patch')
  })

  it('can add a map entry whose name matches an inherited method', () => {
    const base = 'hosts: {}\n'
    const draft = 'hosts:\n  toString: 127.0.0.1\n'
    const result = applyPatch(base, diffDocument(base, draft))
    expect(result.conflicts).toEqual([])
    expect(result.document.data.hosts).toEqual({ toString: '127.0.0.1' })
  })

  it.each([
    null,
    { version: 1, baseRevision: '', operations: [null] },
    {
      version: 1,
      baseRevision: '',
      operations: [
        { op: 'unknown', target: { path: ['mode'] }, expectedHash: '' },
      ],
    },
    {
      version: 1,
      baseRevision: '',
      operations: [
        { op: 'set', target: { path: [] }, expectedHash: '', value: 'global' },
      ],
    },
    {
      version: 1,
      baseRevision: '',
      operations: [
        { op: 'set', target: { path: [1] }, expectedHash: '', value: 'global' },
      ],
    },
    {
      version: 1,
      baseRevision: '',
      operations: [{ op: 'set', target: { path: ['mode'] }, expectedHash: '' }],
    },
    {
      version: 1,
      baseRevision: '',
      operations: [
        {
          op: 'order',
          target: { path: ['proxies'], key: 'name' },
          expectedHash: '',
          ids: [1],
          previousIds: [],
        },
      ],
    },
  ])('rejects malformed patch input before execution: %j', (patch) => {
    expect(() => applyPatch('mode: rule\n', patch as never)).toThrow(
      'Invalid configuration patch',
    )
  })

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

  it('splits logical and quoted rules only at top-level commas', () => {
    expect(
      splitRuleFields(
        'AND,((DOMAIN,one.test),(NETWORK,UDP)),Proxy Group,no-resolve',
      ),
    ).toEqual([
      'AND',
      '((DOMAIN,one.test),(NETWORK,UDP))',
      'Proxy Group',
      'no-resolve',
    ])
    expect(splitRuleFields('DOMAIN,"one,two.test",DIRECT')).toEqual([
      'DOMAIN',
      '"one,two.test"',
      'DIRECT',
    ])
  })

  it('finds named proxy references across routing and network sections', () => {
    const data = openDocument(`
proxies:
  - { name: chained, type: direct, dialer-proxy: target }
proxy-groups:
  - { name: group, type: select, proxies: [target] }
proxy-providers:
  remote: { type: http, url: https://example.test, proxy: target }
rule-providers:
  rules: { type: http, url: https://example.test, proxy: target }
listeners:
  - { name: inbound, type: mixed, port: 7890, proxy: target }
tunnels:
  - { network: tcp, address: 127.0.0.1:1, target: example.test:2, proxy: target }
ntp: { enable: true, dialer-proxy: target }
sub-rules:
  child:
    - MATCH,target
rules:
  - AND,((DOMAIN,one.test),(NETWORK,UDP)),target
  - SUB-RULE,(NETWORK,TCP),target
`).data
    expect(
      findResourceReferences(data, 'target').map((item) => item.kind),
    ).toEqual([
      'proxy-group-member',
      'rule-policy',
      'rule-policy',
      'dialer-proxy',
      'dialer-proxy',
      'provider-proxy',
      'provider-proxy',
      'listener-proxy',
      'tunnel-proxy',
    ])
  })

  it('does not treat unrelated same-name strings as proxy references', () => {
    const data = openDocument(`
proxies:
  - { name: target, type: direct, server: target }
hosts: { target: 127.0.0.1 }
rules:
  - DOMAIN,target,DIRECT
`).data
    expect(findResourceReferences(data, 'target')).toEqual([])
  })

  it('validates missing references in sub-rules and dialer fields', () => {
    const diagnostics = validateDocument({
      proxies: [{ name: 'node', type: 'direct', 'dialer-proxy': 'missing' }],
      'sub-rules': { child: ['MATCH,missing'] },
      rules: ['SUB-RULE,(NETWORK,TCP),absent', 'MATCH,GLOBAL'],
    })
    expect(diagnostics).toEqual([
      expect.objectContaining({
        path: ['sub-rules', 'child', 0],
        severity: 'warning',
      }),
      expect.objectContaining({
        path: ['proxies', 0, 'dialer-proxy'],
        severity: 'error',
      }),
      expect.objectContaining({
        path: ['rules', 0],
        message: 'Unknown sub-rule: absent',
        severity: 'error',
      }),
    ])
  })
})
