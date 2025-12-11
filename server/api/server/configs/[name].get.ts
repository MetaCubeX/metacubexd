import {
  configExists,
  readConfig,
  sanitizeFilename,
} from '~/server/utils/config'

// Read a specific config file
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

    const content = await readConfig(safeName)

    return {
      name: safeName,
      content,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to read config file',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
