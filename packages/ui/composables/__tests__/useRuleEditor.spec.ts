import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRuleEditor } from '../useRuleEditor'

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

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))

const yaml = `rules:
  - DOMAIN-SUFFIX,google.com,PROXY
  - AND,((DOMAIN,one.test),(NETWORK,UDP)),DIRECT
  - MATCH,DIRECT
`

function snapshot(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  }
}

describe('useRuleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.listProfiles.mockResolvedValue([
      { id: 'active', name: 'Active', type: 'remote', active: true },
    ])
    api.getProfileEditor.mockResolvedValue(snapshot())
    api.applyProfileEditor.mockResolvedValue({ activeId: 'active' })
  })

  it('is available only with visual-config-editor', () => {
    expect(useRuleEditor().available.value).toBe(true)
    featurePresent = false
    expect(useRuleEditor().available.value).toBe(false)
  })

  it('loads raw rule strings without corrupting composite rules', async () => {
    const editor = useRuleEditor()
    await expect(editor.load()).resolves.toBe('ready')
    expect(editor.rules.value).toEqual([
      'DOMAIN-SUFFIX,google.com,PROXY',
      'AND,((DOMAIN,one.test),(NETWORK,UDP)),DIRECT',
      'MATCH,DIRECT',
    ])
  })

  it('adds, updates, removes and reorders raw lines', async () => {
    const editor = useRuleEditor()
    await editor.load()
    editor.add('DOMAIN,new.test,REJECT')
    editor.update(0, 'DOMAIN,changed.test,DIRECT')
    editor.remove(1)
    editor.move(2, 0)
    expect(editor.rules.value).toEqual([
      'DOMAIN,new.test,REJECT',
      'DOMAIN,changed.test,DIRECT',
      'MATCH,DIRECT',
    ])
  })

  it('rejects empty fields but accepts logical rules', () => {
    const editor = useRuleEditor()
    expect(editor.isValid('')).toBe(false)
    expect(editor.isValid('DOMAIN,,DIRECT')).toBe(false)
    expect(editor.isValid('DOMAIN,DIRECT')).toBe(false)
    expect(editor.isValid('MATCH,DIRECT')).toBe(true)
    expect(editor.isValid('AND,((DOMAIN,one.test),(NETWORK,UDP)),DIRECT')).toBe(
      true,
    )
  })

  it('saves a rules-only profile patch through one apply', async () => {
    const editor = useRuleEditor()
    await editor.load()
    editor.add('DOMAIN,new.test,REJECT')
    await expect(editor.save()).resolves.toBe(true)
    expect(api.applyProfileEditor).toHaveBeenCalledTimes(1)
    const [, patch] = api.applyProfileEditor.mock.calls[0]!
    expect(
      patch.operations.every(
        (operation: { target: { path: string[] } }) =>
          operation.target.path[0] === 'rules',
      ),
    ).toBe(true)
  })

  it('reports no active profile without applying an empty config', async () => {
    api.listProfiles.mockResolvedValue([])
    const editor = useRuleEditor()
    await expect(editor.load()).resolves.toBe('no-active-profile')
    expect(editor.rules.value).toEqual([])
    expect(api.applyProfileEditor).not.toHaveBeenCalled()
  })

  it('blocks a stored conflict and exposes the full editor path', async () => {
    api.getProfileEditor.mockResolvedValue(
      snapshot({ conflicts: [{ reason: 'changed' }] }),
    )
    const editor = useRuleEditor()
    await expect(editor.load()).resolves.toBe('conflict')
    expect(editor.fullEditorPath.value).toBe('/profiles/active/edit')
    await expect(editor.save()).resolves.toBe(false)
    expect(api.applyProfileEditor).not.toHaveBeenCalled()
  })
})
