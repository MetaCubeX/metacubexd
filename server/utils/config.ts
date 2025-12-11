import {
  access,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

// Get config directory from runtime config
export function getConfigDir(): string {
  const config = useRuntimeConfig()
  return (config.configDir as string) || '/config'
}

// Check if config directory exists
export async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir()
  try {
    await access(configDir)
  } catch {
    await mkdir(configDir, { recursive: true })
  }
}

// List all config files in the directory
export async function listConfigs(): Promise<string[]> {
  const configDir = getConfigDir()
  await ensureConfigDir()

  const files = await readdir(configDir)
  return files.filter((f) => {
    const ext = extname(f).toLowerCase()
    return ext === '.yaml' || ext === '.yml'
  })
}

// Read a config file
export async function readConfig(name: string): Promise<string> {
  const configDir = getConfigDir()
  const safeName = sanitizeFilename(name)
  const filePath = join(configDir, safeName)

  return await readFile(filePath, 'utf-8')
}

// Write a config file
export async function writeConfig(
  name: string,
  content: string,
): Promise<void> {
  const configDir = getConfigDir()
  await ensureConfigDir()

  const safeName = sanitizeFilename(name)
  const filePath = join(configDir, safeName)

  await writeFile(filePath, content, 'utf-8')
}

// Delete a config file
export async function deleteConfig(name: string): Promise<void> {
  const configDir = getConfigDir()
  const safeName = sanitizeFilename(name)
  const filePath = join(configDir, safeName)

  await unlink(filePath)
}

// Check if a config file exists
export async function configExists(name: string): Promise<boolean> {
  const configDir = getConfigDir()
  const safeName = sanitizeFilename(name)
  const filePath = join(configDir, safeName)

  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

// Sanitize filename to prevent directory traversal attacks
export function sanitizeFilename(name: string): string {
  // Get only the base filename, removing any path components
  let safeName = basename(name)

  // Ensure it has a valid extension
  const ext = extname(safeName).toLowerCase()
  if (ext !== '.yaml' && ext !== '.yml') {
    safeName = `${safeName}.yaml`
  }

  // Remove any remaining dangerous characters
  safeName = safeName.replace(/[^\w.-]/g, '_')

  return safeName
}

// Active config file path
const ACTIVE_CONFIG_FILE = '.active'

// Get the currently active config name
export async function getActiveConfig(): Promise<string | null> {
  const configDir = getConfigDir()
  const activePath = join(configDir, ACTIVE_CONFIG_FILE)

  try {
    const content = await readFile(activePath, 'utf-8')
    return content.trim() || null
  } catch {
    return null
  }
}

// Set the active config name
export async function setActiveConfig(name: string | null): Promise<void> {
  const configDir = getConfigDir()
  await ensureConfigDir()

  const activePath = join(configDir, ACTIVE_CONFIG_FILE)

  if (name) {
    await writeFile(activePath, name, 'utf-8')
  } else {
    try {
      await unlink(activePath)
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
