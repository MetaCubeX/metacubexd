import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProxyConfigEditor } from '../useProxyConfigEditor'

const api = {
  listProfiles: vi.fn(),
  getProfileEditor: vi.fn(),
  applyProfileEditor: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (feature: string) => feature === 'visual-config-editor',
  }),
}))

const yaml = `
proxies:
  - { name: node, type: ss, server: old.test, password: keep, custom: value }
proxy-providers:
  provider: { type: http, url: https://example.test }
proxy-groups:
  - { name: group, type: select, proxies: [node], use: [provider] }
rules:
  - MATCH,group
`

function snapshot() {
  return {
    profile: { id: 'active', name: 'Active', type: 'remote', active: true },
    active: true,
    revision: 'rev',
    editableYaml: yaml,
    composedYaml: yaml,
    schemaVersion: 'test',
    composition: [],
    diagnostics: [],
    conflicts: [],
  }
}

describe('useProxyConfigEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listProfiles.mockResolvedValue([
      { id: 'active', name: 'Active', type: 'remote', active: true },
    ])
    api.getProfileEditor.mockResolvedValue(snapshot())
    api.applyProfileEditor.mockResolvedValue({ activeId: 'active' })
  })

  it('loads configured nodes, groups and provider names', async () => {
    const editor = useProxyConfigEditor()
    await expect(editor.load()).resolves.toBe('ready')
    expect(editor.proxies.value[0]).toEqual({
      originalName: 'node',
      value: expect.objectContaining({ custom: 'value', password: 'keep' }),
    })
    expect(editor.groups.value[0]?.originalName).toBe('group')
    expect(editor.providerNames.value).toEqual(['provider'])
  })

  it('keeps persisted identities immutable while preserving unknown fields', async () => {
    const editor = useProxyConfigEditor()
    await editor.load()
    editor.update('proxy', 0, {
      ...editor.proxies.value[0]!.value,
      name: 'renamed',
      server: 'new.test',
    })
    expect(editor.proxies.value[0]?.value).toEqual(
      expect.objectContaining({
        name: 'node',
        server: 'new.test',
        custom: 'value',
        password: 'keep',
      }),
    )
  })

  it('blocks deletion and returns every known reference path', async () => {
    const editor = useProxyConfigEditor()
    await editor.load()
    expect(editor.remove('proxy', 0)).toBe(false)
    expect(editor.blockedReferences.value).toEqual([
      expect.objectContaining({
        path: ['proxy-groups', 0, 'proxies', 0],
      }),
    ])
    expect(editor.remove('group', 0)).toBe(false)
    expect(editor.blockedReferences.value).toEqual([
      expect.objectContaining({ path: ['rules', 0] }),
    ])
  })

  it('adds, edits and reorders nodes and groups in one apply', async () => {
    const editor = useProxyConfigEditor()
    await editor.load()
    editor.add('proxy', { name: 'direct', type: 'direct' })
    editor.add('group', {
      name: 'backup',
      type: 'select',
      proxies: ['direct'],
    })
    editor.move('proxy', 1, 0)
    await expect(editor.save()).resolves.toBe('saved')
    expect(api.applyProfileEditor).toHaveBeenCalledTimes(1)
    const [, patch] = api.applyProfileEditor.mock.calls[0]!
    expect(
      patch.operations.map(
        (operation: { target: { path: string[] } }) => operation.target.path[0],
      ),
    ).toEqual(expect.arrayContaining(['proxies', 'proxy-groups']))
  })

  it('rejects duplicate names across nodes and groups', async () => {
    const editor = useProxyConfigEditor()
    await editor.load()
    expect(editor.nameExists('node')).toBe(true)
    expect(editor.nameExists('new')).toBe(false)
  })
})
