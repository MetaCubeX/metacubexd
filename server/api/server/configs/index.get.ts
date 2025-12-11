import { getActiveConfig, listConfigs } from '~/server/utils/config'

// List all config files
export default defineEventHandler(async () => {
  try {
    const configs = await listConfigs()
    const active = await getActiveConfig()

    return {
      configs,
      active,
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list config files',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
