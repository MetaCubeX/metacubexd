import type {
  ConfigDiagnostic,
  ConfigPatchConflict,
  ConfigPatchV1,
} from '@metacubexd/config-editor'
import type {
  KernelState,
  MihomoSupervisor,
  ProfileMeta,
  ProfileStore,
} from './types'
import {
  applyPatch,
  diffDocument,
  openDocument,
} from '@metacubexd/config-editor'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ConfigPatchConflictError,
  parseVisualPatch,
  visualPatchContent,
} from './merge'

export interface ProfileEditorSnapshot {
  profile: ProfileMeta
  active: boolean
  revision: string
  editableYaml: string
  composedYaml: string
  schemaVersion: string
  composition: ProfileMeta[]
  diagnostics: ConfigDiagnostic[]
  conflicts: ConfigPatchConflict[]
}

export interface ProfileEditorPreview extends ProfileEditorSnapshot {
  patch: ConfigPatchV1
}

export interface ProfileEditorApplyResult {
  profile: ProfileMeta
  activeId: string
  revision: string
  kernel: KernelState
}

export interface ProfileConfigEditor {
  open: (id: string) => Promise<ProfileEditorSnapshot>
  preview: (id: string, patch: ConfigPatchV1) => Promise<ProfileEditorPreview>
  apply: (id: string, patch: ConfigPatchV1) => Promise<ProfileEditorApplyResult>
  resetManagedOverlay: (id: string) => Promise<KernelState | undefined>
}

export interface ProfileConfigEditorOptions {
  profiles: ProfileStore
  supervisor: MihomoSupervisor
  homeDir: string
}

export class ProfileEditorConflictError extends Error {
  constructor(readonly conflicts: ConfigPatchConflict[]) {
    super('profile editor changes conflict with the current profile')
    this.name = 'ProfileEditorConflictError'
  }
}

export class ProfileEditorValidationError extends Error {
  constructor(
    readonly diagnostics: ConfigDiagnostic[],
    readonly validatorMessage?: string,
  ) {
    super(validatorMessage || 'profile editor validation failed')
    this.name = 'ProfileEditorValidationError'
  }
}

const SCHEMA_VERSION = 'meta-json-schema@1.19.28'

function managedOverlay(
  list: ProfileMeta[],
  baseId: string,
): ProfileMeta | undefined {
  return list.find(
    (meta) =>
      meta.type === 'merge' &&
      meta.baseProfileId === baseId &&
      meta.managedBy === 'visual-editor',
  )
}

export function createProfileConfigEditor(
  options: ProfileConfigEditorOptions,
): ProfileConfigEditor {
  const { profiles, supervisor, homeDir } = options

  async function findProfile(id: string): Promise<ProfileMeta> {
    const meta = (await profiles.list()).find((item) => item.id === id)
    if (!meta) throw new Error(`profile not found: ${id}`)
    if (meta.type === 'merge' || meta.type === 'script') {
      throw new Error('visual editor only supports base profiles')
    }
    return meta
  }

  async function editableState(id: string) {
    const list = await profiles.list()
    const profile = list.find((item) => item.id === id)
    if (!profile) throw new Error(`profile not found: ${id}`)
    if (profile.type === 'merge' || profile.type === 'script') {
      throw new Error('visual editor only supports base profiles')
    }
    const baseYaml = await profiles.read(id)
    const baseDocument = openDocument(baseYaml)
    const overlay = managedOverlay(list, id)
    const storedPatch = overlay
      ? parseVisualPatch(await profiles.read(overlay.id))
      : undefined
    const patched = storedPatch
      ? applyPatch(baseDocument, storedPatch)
      : { document: baseDocument, conflicts: [], applied: 0 }
    return {
      list,
      profile,
      baseDocument,
      overlay,
      editableDocument: patched.document,
      conflicts: patched.conflicts,
    }
  }

  async function composeForDraft(
    id: string,
    profile: ProfileMeta,
    editableYaml: string,
  ) {
    if (profile.type === 'remote') {
      const baseYaml = await profiles.read(id)
      const cumulative = diffDocument(baseYaml, editableYaml)
      const managedContent = visualPatchContent(cumulative)
      const composed = await profiles.compose(id, {
        managedOverlayContent: managedContent,
      })
      return { ...composed, cumulative }
    }
    const composed = await profiles.compose(id, {
      profileContent: editableYaml,
    })
    return {
      ...composed,
      cumulative: diffDocument(await profiles.read(id), editableYaml),
    }
  }

  async function open(id: string): Promise<ProfileEditorSnapshot> {
    const state = await editableState(id)
    let composedYaml = state.editableDocument.yaml
    let composition: ProfileMeta[] = []
    try {
      const composed = await composeForDraft(
        id,
        state.profile,
        state.editableDocument.yaml,
      )
      composedYaml = composed.content
      composition = composed.composition
    } catch (error) {
      if (!(error instanceof ConfigPatchConflictError)) throw error
    }
    return {
      profile: state.profile,
      active: (await profiles.getActiveId()) === id,
      revision: state.editableDocument.revision,
      editableYaml: state.editableDocument.yaml,
      composedYaml,
      schemaVersion: SCHEMA_VERSION,
      composition,
      diagnostics: state.editableDocument.diagnostics,
      conflicts: state.conflicts,
    }
  }

  async function preview(
    id: string,
    patch: ConfigPatchV1,
  ): Promise<ProfileEditorPreview> {
    const state = await editableState(id)
    const applied = applyPatch(state.editableDocument, patch)
    // Opening reports stored-patch conflicts. Submitting a new draft is the
    // explicit resolution step: the new cumulative patch is generated from
    // the refreshed base plus this partial document, so old conflicting ops
    // are either recreated by the user or intentionally dropped.
    const conflicts = applied.conflicts
    const composed = await composeForDraft(
      id,
      state.profile,
      applied.document.yaml,
    )
    return {
      profile: state.profile,
      active: (await profiles.getActiveId()) === id,
      revision: applied.document.revision,
      editableYaml: applied.document.yaml,
      composedYaml: composed.content,
      schemaVersion: SCHEMA_VERSION,
      composition: composed.composition,
      diagnostics: applied.document.diagnostics,
      conflicts,
      patch: composed.cumulative,
    }
  }

  async function apply(
    id: string,
    patch: ConfigPatchV1,
  ): Promise<ProfileEditorApplyResult> {
    const before = await editableState(id)
    const result = await preview(id, patch)
    if (result.conflicts.length) {
      throw new ProfileEditorConflictError(result.conflicts)
    }
    const errors = result.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    )
    if (errors.length) throw new ProfileEditorValidationError(errors)

    const candidate = join(
      homeDir,
      `.editor-${id}-${Date.now().toString(36)}.yaml`,
    )
    await writeFile(candidate, result.composedYaml)
    try {
      const validation = await supervisor.validate(candidate)
      if (!validation.valid) {
        throw new ProfileEditorValidationError([], validation.message)
      }
    } finally {
      await rm(candidate, { force: true })
    }

    const previousActiveId = await profiles.getActiveId()
    const originalProfileContent = await profiles.read(id)
    const originalOverlayContent = before.overlay
      ? await profiles.read(before.overlay.id)
      : undefined
    let createdOverlayId: string | undefined
    try {
      if (before.profile.type === 'remote') {
        const content = visualPatchContent(result.patch)
        if (before.overlay) {
          await profiles.update(before.overlay.id, {
            content,
            editorStatus: 'clean',
          })
        } else {
          const created = await profiles.create({
            name: `${before.profile.name} · Visual overrides`,
            type: 'merge',
            content,
            baseProfileId: id,
            managedBy: 'visual-editor',
            editorStatus: 'clean',
          })
          createdOverlayId = created.id
        }
        await profiles.update(id, { editorStatus: 'clean' })
      } else {
        await profiles.update(id, { content: result.editableYaml })
      }

      await profiles.setActive(id)
      const kernel = await supervisor.restart()
      const profile = await findProfile(id)
      return {
        profile,
        activeId: id,
        revision: result.revision,
        kernel,
      }
    } catch (error) {
      // Restore every persisted input before restoring the running profile.
      if (before.profile.type === 'remote') {
        if (before.overlay && originalOverlayContent !== undefined) {
          await profiles
            .update(before.overlay.id, {
              content: originalOverlayContent,
              editorStatus: before.overlay.editorStatus ?? null,
            })
            .catch(() => {})
        } else if (createdOverlayId) {
          await profiles.delete(createdOverlayId).catch(() => {})
        }
      } else {
        await profiles
          .update(id, { content: originalProfileContent })
          .catch(() => {})
      }
      await profiles
        .update(id, { editorStatus: before.profile.editorStatus ?? null })
        .catch(() => {})
      if (previousActiveId) {
        await profiles.setActive(previousActiveId).catch(() => {})
        await supervisor.restart().catch(() => {})
      } else {
        await profiles.resetActive().catch(() => {})
        await supervisor.restart().catch(() => {})
      }
      throw error
    }
  }

  async function resetManagedOverlay(
    id: string,
  ): Promise<KernelState | undefined> {
    const list = await profiles.list()
    const overlay = managedOverlay(list, id)
    if (!overlay) return undefined
    const base = list.find((meta) => meta.id === id)
    if (!base) throw new Error(`profile not found: ${id}`)
    const active = (await profiles.getActiveId()) === id
    const overlayContent = await profiles.read(overlay.id)
    const emptyPatch: ConfigPatchV1 = {
      version: 1,
      baseRevision: '',
      operations: [],
    }
    const candidate = await profiles.compose(id, {
      managedOverlayContent: visualPatchContent(emptyPatch),
    })
    const candidatePath = join(
      homeDir,
      `.editor-reset-${id}-${Date.now().toString(36)}.yaml`,
    )
    await writeFile(candidatePath, candidate.content)
    try {
      const validation = await supervisor.validate(candidatePath)
      if (!validation.valid) {
        throw new ProfileEditorValidationError([], validation.message)
      }
    } finally {
      await rm(candidatePath, { force: true })
    }

    await profiles.delete(overlay.id)
    try {
      if (!active) return undefined
      await profiles.setActive(id)
      return await supervisor.restart()
    } catch (error) {
      await profiles
        .create({
          name: overlay.name,
          type: 'merge',
          content: overlayContent,
          baseProfileId: id,
          managedBy: 'visual-editor',
          editorStatus: overlay.editorStatus,
        })
        .catch(() => {})
      await profiles
        .update(id, { editorStatus: base.editorStatus ?? null })
        .catch(() => {})
      if (active) {
        await profiles.setActive(id).catch(() => {})
        await supervisor.restart().catch(() => {})
      }
      throw error
    }
  }

  return { open, preview, apply, resetManagedOverlay }
}
