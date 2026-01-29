// Unregister any old service workers from previous versions (vite-plugin-pwa)
// This fixes the cache problem where old versions keep loading
// See: https://github.com/MetaCubeX/metacubexd/issues/1796
export default defineNuxtPlugin(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
  }
})
