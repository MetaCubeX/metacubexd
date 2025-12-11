import {
  configExists,
  deleteConfig,
  getActiveConfig,
  sanitizeFilename,
  setActiveConfig,
} from '~/server/utils/config'

// Delete a config file
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Config name is required',
    })
  }

  const safeName = sanitizeFilename(name)

  try {
    if (!(await configExists(safeName))) {
      throw createError({
        statusCode: 404,
        statusMessage: `Config file "${safeName}" not found`,
      })
    }

    // If deleting the active config, clear the active status
    const activeConfig = await getActiveConfig()
    if (activeConfig === safeName) {
      await setActiveConfig(null)
    }

    await deleteConfig(safeName)

    return {
      success: true,
      name: safeName,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete config file',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
