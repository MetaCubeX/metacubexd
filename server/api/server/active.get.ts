import { getActiveConfig } from '~/server/utils/config'

// Get the currently active config
export default defineEventHandler(async () => {
  try {
    const active = await getActiveConfig()

    return {
      active,
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get active config',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
