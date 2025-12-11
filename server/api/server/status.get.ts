// Server status API - returns server capabilities
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const configDir = config.configDir || '/config'

  return {
    available: true,
    configDir,
  }
})
