import { createSignal, onCleanup } from 'solid-js'

export const useWindowWidth = () => {
  const [windowWidth, setWindowWidth] = createSignal(0)
  const set = () => {
    setWindowWidth(document.body?.clientWidth ?? 0)
  }

  set()
  window.addEventListener('resize', set, {})

  onCleanup(() => {
    window.removeEventListener('resize', set)
  })

  return {
    windowWidth,
  }
}

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
    } catch {}
    set(name, false)
  }

  return {
    map,
    set,
    setWithCallback,
  }
}
