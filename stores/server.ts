import ky from 'ky'
import { defineStore } from 'pinia'

export interface ServerStatus {
  available: boolean
  configDir: string
}

export interface ConfigFile {
  name: string
  content?: string
}

export const useServerStore = defineStore('server', () => {
  // State
  const serverAvailable = ref(false)
  const configDir = ref('')
  const configList = ref<string[]>([])
  const activeConfig = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Check server status
  async function checkServerStatus(): Promise<boolean> {
    try {
      const response = await ky.get('/api/server/status').json<ServerStatus>()
      serverAvailable.value = response.available
      configDir.value = response.configDir
      return response.available
    } catch {
      serverAvailable.value = false
      configDir.value = ''
      return false
    }
  }

  // Fetch config list
  async function fetchConfigList(): Promise<void> {
    if (!serverAvailable.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await ky
        .get('/api/server/configs')
        .json<{ configs: string[]; active: string | null }>()
      configList.value = response.configs
      activeConfig.value = response.active
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch configs'
      configList.value = []
    } finally {
      isLoading.value = false
    }
  }

  // Read a config file
  async function readConfig(name: string): Promise<string | null> {
    if (!serverAvailable.value) return null

    try {
      const response = await ky
        .get(`/api/server/configs/${encodeURIComponent(name)}`)
        .json<{ name: string; content: string }>()
      return response.content
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to read config'
      return null
    }
  }

  // Create a new config file
  async function createConfig(name: string, content: string): Promise<boolean> {
    if (!serverAvailable.value) return false

    isLoading.value = true
    error.value = null

    try {
      await ky.post('/api/server/configs', {
        json: { name, content },
      })
      await fetchConfigList()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create config'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Update a config file
  async function updateConfig(name: string, content: string): Promise<boolean> {
    if (!serverAvailable.value) return false

    isLoading.value = true
    error.value = null

    try {
      await ky.put(`/api/server/configs/${encodeURIComponent(name)}`, {
        json: { content },
      })
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update config'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Delete a config file
  async function deleteConfig(name: string): Promise<boolean> {
    if (!serverAvailable.value) return false

    isLoading.value = true
    error.value = null

    try {
      await ky.delete(`/api/server/configs/${encodeURIComponent(name)}`)
      await fetchConfigList()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete config'
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Set active config
  async function setActiveConfig(name: string | null): Promise<boolean> {
    if (!serverAvailable.value) return false

    isLoading.value = true
    error.value = null

    try {
      await ky.put('/api/server/active', {
        json: { name },
      })
      activeConfig.value = name
      return true
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Failed to set active config'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    serverAvailable,
    configDir,
    configList,
    activeConfig,
    isLoading,
    error,
    // Actions
    checkServerStatus,
    fetchConfigList,
    readConfig,
    createConfig,
    updateConfig,
    deleteConfig,
    setActiveConfig,
  }
})
