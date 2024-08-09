import { fetchBackendVersionAPI } from '~/apis'

export const [backendVersion, setBackendVersion] = createSignal('')
export const isSingBox = createMemo(() => {
  return backendVersion().includes('sing-box')
})
export const updateBackendVersion = () => {
  fetchBackendVersionAPI().then(setBackendVersion)
}
