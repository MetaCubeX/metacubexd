export const transformEndpointURL = (url: string) =>
  /^https?:\/\//.test(url) ? url : `${window.location.protocol}//${url}`

export const useStringBooleanMap = () => {
  const [map, setMap] = createSignal<Record<string, boolean>>({})
  const set = (name: string, value: boolean) => {
    setMap({
      ...map(),
      [name]: value,
    })
  }

  const setWithCallback = async (
    name: string,
    callback: () => Promise<void>,
  ) => {
    set(name, true)
    try {
      await callback()
    } catch {
      /* empty */
    }
    set(name, false)
  }

  return {
    map,
    set,
    setWithCallback,
  }
}
