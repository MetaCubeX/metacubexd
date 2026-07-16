import type { MihomoSupervisor } from './types'
import { diffDocument } from '@metacubexd/config-editor'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createProfileConfigEditor } from './profile-editor'
import { createProfileStore } from './profiles'

function state() {
  return {
    status: 'running' as const,
    externalController: '127.0.0.1:9090',
    secret: '',
  }
}

function supervisor(restart = vi.fn(async () => state())): MihomoSupervisor {
  return {
    getState: state,
    start: vi.fn(async () => state()),
    stop: vi.fn(async () => state()),
    restart,
    setBinaryPath: vi.fn(),
    validate: vi.fn(async () => ({ valid: true, message: 'ok' })),
    on: vi.fn(),
    off: vi.fn(),
    dispose: vi.fn(async () => {}),
  }
}

describe('profile config editor', () => {
  it('previews and applies a local profile with one restart', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mcxd-editor-local-'))
    const profiles = createProfileStore({
      dir: join(home, 'profiles'),
      activeConfigPath: join(home, 'active.yaml'),
      idGen: () => 'local',
    })
    await profiles.create({ name: 'local', content: 'mode: rule\n' })
    const sup = supervisor()
    const editor = createProfileConfigEditor({
      profiles,
      supervisor: sup,
      homeDir: home,
    })
    const opened = await editor.open('local')
    const patch = diffDocument(opened.editableYaml, 'mode: global\n')
    const preview = await editor.preview('local', patch)
    expect(preview.editableYaml).toContain('mode: global')

    const result = await editor.apply('local', patch)
    expect(result.activeId).toBe('local')
    expect(await profiles.read('local')).toContain('mode: global')
    expect(sup.restart).toHaveBeenCalledTimes(1)
  })

  it('stores remote edits in one scoped managed merge and detects refresh conflicts', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mcxd-editor-remote-'))
    let remote = 'proxies:\n  - { name: node, type: direct }\n'
    const profiles = createProfileStore({
      dir: join(home, 'profiles'),
      activeConfigPath: join(home, 'active.yaml'),
      fetch: (async () => new Response(remote)) as typeof fetch,
      idGen: (() => {
        let n = 0
        return () => `id${++n}`
      })(),
    })
    await profiles.importFromUrl('https://example.test/sub', 'remote')
    const editor = createProfileConfigEditor({
      profiles,
      supervisor: supervisor(),
      homeDir: home,
    })
    const opened = await editor.open('id1')
    const draft = 'proxies:\n  - { name: node, type: reject }\n'
    await editor.apply('id1', diffDocument(opened.editableYaml, draft))

    expect(await profiles.read('id1')).toBe(remote)
    const overlays = (await profiles.list()).filter(
      (meta) => meta.type === 'merge',
    )
    expect(overlays).toEqual([
      expect.objectContaining({
        baseProfileId: 'id1',
        managedBy: 'visual-editor',
      }),
    ])
    expect((await profiles.compose('id1')).content).toContain('type: reject')

    remote = 'proxies:\n  - { name: node, type: ss, server: upstream }\n'
    await profiles.refresh('id1')
    const conflicted = await editor.open('id1')
    expect(conflicted.profile.editorStatus).toBe('conflicted')
    expect(conflicted.conflicts).toHaveLength(1)
    expect(conflicted.conflicts[0]?.reason).toBe('changed')
    expect(readFileSync(join(home, 'active.yaml'), 'utf8')).toContain(
      'type: reject',
    )

    await editor.resetManagedOverlay('id1')
    expect(
      (await profiles.list()).filter((meta) => meta.type === 'merge'),
    ).toEqual([])
    expect((await profiles.compose('id1')).content).toContain('type: ss')
  })

  it('restores persisted and active state when the restart fails', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mcxd-editor-rollback-'))
    let sequence = 0
    const activeConfigPath = join(home, 'active.yaml')
    const profiles = createProfileStore({
      dir: join(home, 'profiles'),
      activeConfigPath,
      idGen: () => `id${++sequence}`,
    })
    await profiles.create({ name: 'old', content: 'mode: rule\n' })
    await profiles.create({ name: 'draft', content: 'mode: direct\n' })
    await profiles.setActive('id1')

    const restart = vi.fn(async () => {
      throw new Error('restart failed')
    })
    const editor = createProfileConfigEditor({
      profiles,
      supervisor: supervisor(restart),
      homeDir: home,
    })
    const opened = await editor.open('id2')
    const patch = diffDocument(opened.editableYaml, 'mode: global\n')

    await expect(editor.apply('id2', patch)).rejects.toThrow('restart failed')
    expect(await profiles.read('id2')).toBe('mode: direct\n')
    expect(await profiles.getActiveId()).toBe('id1')
    expect(readFileSync(activeConfigPath, 'utf8')).toBe('mode: rule\n')
  })

  it('restores a managed remote overlay when the restart fails', async () => {
    const home = mkdtempSync(join(tmpdir(), 'mcxd-editor-overlay-rollback-'))
    let sequence = 0
    const profiles = createProfileStore({
      dir: join(home, 'profiles'),
      activeConfigPath: join(home, 'active.yaml'),
      fetch: (async () =>
        new Response(
          'proxies:\n  - { name: node, type: direct }\n',
        )) as typeof fetch,
      idGen: () => `id${++sequence}`,
    })
    await profiles.importFromUrl('https://example.test/sub', 'remote')
    const firstEditor = createProfileConfigEditor({
      profiles,
      supervisor: supervisor(),
      homeDir: home,
    })
    const first = await firstEditor.open('id1')
    await firstEditor.apply(
      'id1',
      diffDocument(
        first.editableYaml,
        'proxies:\n  - { name: node, type: reject }\n',
      ),
    )
    const overlay = (await profiles.list()).find(
      (meta) => meta.managedBy === 'visual-editor',
    )!
    const originalOverlay = await profiles.read(overlay.id)

    const failingEditor = createProfileConfigEditor({
      profiles,
      supervisor: supervisor(
        vi.fn(async () => {
          throw new Error('restart failed')
        }),
      ),
      homeDir: home,
    })
    const opened = await failingEditor.open('id1')
    await expect(
      failingEditor.apply(
        'id1',
        diffDocument(
          opened.editableYaml,
          'proxies:\n  - { name: node, type: pass }\n',
        ),
      ),
    ).rejects.toThrow('restart failed')

    expect(await profiles.read(overlay.id)).toBe(originalOverlay)
    expect((await profiles.compose('id1')).content).toContain('type: reject')
    expect((await profiles.list()).find((meta) => meta.id === 'id1')).toEqual(
      expect.objectContaining({ editorStatus: 'clean' }),
    )
  })
})
