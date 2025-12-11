import {
  configExists,
  sanitizeFilename,
  setActiveConfig,
} from '~/server/utils/config'

// Set the active config
export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string | null }>(event)

  // Allow clearing the active config by passing null
  if (body?.name === null) {
    try {
      await setActiveConfig(null)
      return {
        success: true,
        active: null,
      }
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to clear active config',
        data: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  if (!body?.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Config name is required',
    })
  }

  const safeName = sanitizeFilename(body.name)

  try {
    // Verify the config file exists
    if (!(await configExists(safeName))) {
      throw createError({
        statusCode: 404,
        statusMessage: `Config file "${safeName}" not found`,
      })
    }

    await setActiveConfig(safeName)

    return {
      success: true,
      active: safeName,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to set active config',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
