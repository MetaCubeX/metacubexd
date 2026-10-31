import type { KernelState, MihomoSupervisor } from './types'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProfileStore } from './profiles'
import { applyActiveRefresh } from './refresh-apply'

const directories: string[] = []
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

async function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'mcxd-refresh-apply-'))
  directories.push(home)
  const activeConfigPath = join(home, 'active.yaml')
  let sequence = 0
  const profiles = createProfileStore({
    dir: join(home, 'profiles'),
    activeConfigPath,
    idGen: () => `id${++sequence}`,
  })
  const profile = await profiles.create({
    name: 'first',
    content: 'mode: rule\n',
  })
  const other = await profiles.create({
    name: 'other',
    content: 'mode: direct\n',
  })
  await profiles.setActive(profile.id)
  const state: KernelState = {
    status: 'running',
    externalController: '127.0.0.1:9090',
    secret: 's',
  }
  const supervisor = {
    validate: vi.fn(async (_path: string) => ({ valid: true, message: '' })),
    restart: vi.fn(async () => ({ ...state, pid: 9 })),
  } as unknown as MihomoSupervisor
  return { home, activeConfigPath, profiles, profile, other, supervisor }
}

describe('applyActiveRefresh', () => {
  it('validates an isolated candidate before applying and restarting', async () => {
    const f = await fixture()
    await f.profiles.update(f.profile.id, { content: 'mode: global\n' })
    vi.mocked(f.supervisor.validate).mockImplementation(async (candidate) => {
      expect(candidate).not.toBe(f.activeConfigPath)
      expect(readFileSync(candidate, 'utf8')).toBe('mode: global\n')
      expect(readFileSync(f.activeConfigPath, 'utf8')).toBe('mode: rule\n')
      return { valid: true, message: '' }
    })
    await applyActiveRefresh(f.profiles, f.supervisor, f.profile.id)
    expect(f.supervisor.validate).toHaveBeenCalledOnce()
    expect(f.supervisor.restart).toHaveBeenCalledOnce()
    expect(readFileSync(f.activeConfigPath, 'utf8')).toBe('mode: global\n')
  })

  it('keeps the working config and kernel when candidate validation fails', async () => {
    const f = await fixture()
    await f.profiles.update(f.profile.id, { content: 'mode: [\n' })
    vi.mocked(f.supervisor.validate).mockResolvedValue({
      valid: false,
      message: 'invalid YAML',
    })
    await expect(
      applyActiveRefresh(f.profiles, f.supervisor, f.profile.id),
    ).rejects.toThrow('invalid YAML')
    expect(readFileSync(f.activeConfigPath, 'utf8')).toBe('mode: rule\n')
    expect(f.supervisor.restart).not.toHaveBeenCalled()
  })

  it('does nothing for a profile that is no longer active', async () => {
    const f = await fixture()
    await f.profiles.setActive(f.other.id)
    await applyActiveRefresh(f.profiles, f.supervisor, f.profile.id)
    expect(f.supervisor.validate).not.toHaveBeenCalled()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
  })

  it('does nothing when no profile is active', async () => {
    const f = await fixture()
    await f.profiles.resetActive()
    await applyActiveRefresh(f.profiles, f.supervisor, f.profile.id)
    expect(f.supervisor.validate).not.toHaveBeenCalled()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
  })

  it('does not switch back if the user activates another profile during validation', async () => {
    const f = await fixture()
    await f.profiles.update(f.profile.id, { content: 'mode: global\n' })
    vi.mocked(f.supervisor.validate).mockImplementation(async () => {
      await f.profiles.setActive(f.other.id)
      return { valid: true, message: '' }
    })
    await applyActiveRefresh(f.profiles, f.supervisor, f.profile.id)
    expect(await f.profiles.getActiveId()).toBe(f.other.id)
    expect(readFileSync(f.activeConfigPath, 'utf8')).toBe('mode: direct\n')
    expect(f.supervisor.restart).not.toHaveBeenCalled()
  })

  it('does not apply an unvalidated edit made while validation is running', async () => {
    const f = await fixture()
    await f.profiles.update(f.profile.id, { content: 'mode: global\n' })
    vi.mocked(f.supervisor.validate).mockImplementation(async () => {
      await f.profiles.update(f.profile.id, { content: 'mode: [\n' })
      return { valid: true, message: '' }
    })
    await applyActiveRefresh(f.profiles, f.supervisor, f.profile.id)
    expect(readFileSync(f.activeConfigPath, 'utf8')).toBe('mode: rule\n')
    expect(f.supervisor.restart).not.toHaveBeenCalled()
    expect(
      readdirSync(f.home).some((name) => name.startsWith('.refresh-')),
    ).toBe(false)
  })
})
