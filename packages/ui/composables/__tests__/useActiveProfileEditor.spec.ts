import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useActiveProfileEditor } from '../useActiveProfileEditor'

const api = {
  listProfiles: vi.fn(),
  getProfileEditor: vi.fn(),
  applyProfileEditor: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (feature: string) =>
      featurePresent && feature === 'visual-config-editor',
  }),
}))

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    profile: { id: 'active', name: 'Active', type: 'local', active: true },
    active: true,
    revision: 'rev',
    editableYaml: 'proxies: []\nproxy-groups: []\nrules: []\n',
    composedYaml: 'proxies: []\nproxy-groups: []\nrules: []\n',
    schemaVersion: 'test',
    composition: [],
    diagnostics: [],
    conflicts: [],
    ...overrides,
  }
}

describe('useActiveProfileEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.listProfiles.mockResolvedValue([
      { id: 'inactive', name: 'Old', type: 'local', active: false },
      { id: 'active', name: 'Active', type: 'local', active: true },
    ])
    api.getProfileEditor.mockResolvedValue(snapshot())
    api.applyProfileEditor.mockResolvedValue({ activeId: 'active' })
  })

  it('gates the module on visual-config-editor', async () => {
    featurePresent = false
    const editor = useActiveProfileEditor()
    expect(editor.available.value).toBe(false)
    await expect(editor.load()).resolves.toBe('unavailable')
    expect(api.listProfiles).not.toHaveBeenCalled()
  })

  it('reports no active profile instead of opening an empty config', async () => {
    api.listProfiles.mockResolvedValue([
      { id: 'inactive', name: 'Old', type: 'local', active: false },
    ])
    const editor = useActiveProfileEditor()
    await expect(editor.load()).resolves.toBe('no-active-profile')
    expect(api.getProfileEditor).not.toHaveBeenCalled()
  })

  it('opens the active base profile and applies all replaced sections once', async () => {
    const editor = useActiveProfileEditor()
    await expect(editor.load()).resolves.toBe('ready')
    editor.replaceSections({
      proxies: [{ name: 'node', type: 'direct' }],
      'proxy-groups': [{ name: 'group', type: 'select', proxies: ['node'] }],
    })
    expect(editor.dirty.value).toBe(true)
    await expect(editor.save()).resolves.toBe('saved')
    expect(api.applyProfileEditor).toHaveBeenCalledTimes(1)
    const [, patch] = api.applyProfileEditor.mock.calls[0]!
    expect(
      patch.operations.map(
        (operation: { target: { path: string[] } }) => operation.target.path[0],
      ),
    ).toEqual(expect.arrayContaining(['proxies', 'proxy-groups']))
  })

  it('blocks a stored remote-overlay conflict and links to the full editor', async () => {
    api.getProfileEditor.mockResolvedValue(
      snapshot({ conflicts: [{ reason: 'changed' }] }),
    )
    const editor = useActiveProfileEditor()
    await expect(editor.load()).resolves.toBe('conflict')
    expect(editor.conflicted.value).toBe(true)
    expect(editor.fullEditorPath.value).toBe('/profiles/active/edit')
    await expect(editor.save()).resolves.toBe('conflict')
    expect(api.applyProfileEditor).not.toHaveBeenCalled()
  })

  it('returns invalid without calling the agent for document errors', async () => {
    const editor = useActiveProfileEditor()
    await editor.load()
    editor.replaceSections({ proxies: [{ type: 'direct' }] })
    expect(editor.hasErrors.value).toBe(true)
    await expect(editor.save()).resolves.toBe('invalid')
    expect(api.applyProfileEditor).not.toHaveBeenCalled()
  })

  it('classifies an apply-time 409 as a conflict', async () => {
    api.applyProfileEditor.mockRejectedValue({ response: { status: 409 } })
    const editor = useActiveProfileEditor()
    await editor.load()
    editor.replaceSections({ rules: ['MATCH,DIRECT'] })
    await expect(editor.save()).resolves.toBe('conflict')
  })
})
