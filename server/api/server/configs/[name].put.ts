import {
  configExists,
  sanitizeFilename,
  writeConfig,
} from '~/server/utils/config'

// Update a config file
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const body = await readBody<{ content: string }>(event)

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Config name is required',
    })
  }

  if (!body?.content) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Config content is required',
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

    await writeConfig(safeName, body.content)

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
      statusMessage: 'Failed to update config file',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
