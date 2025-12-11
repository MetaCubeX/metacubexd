import {
  configExists,
  sanitizeFilename,
  writeConfig,
} from '~/server/utils/config'

// Create a new config file
export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; content: string }>(event)

  if (!body?.name) {
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

  const safeName = sanitizeFilename(body.name)

  try {
    // Check if file already exists
    if (await configExists(safeName)) {
      throw createError({
        statusCode: 409,
        statusMessage: `Config file "${safeName}" already exists`,
      })
    }

    await writeConfig(safeName, body.content)

    return {
      success: true,
      name: safeName,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 409) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create config file',
      data: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
