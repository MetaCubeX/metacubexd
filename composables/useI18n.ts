import type { Dict } from '~/i18n'
import dict from '~/i18n'

export function useI18n() {
  const configStore = useConfigStore()

  const t = (
    key: keyof Dict | string,
    params?: Record<string, string | number>,
  ) => {
    const k = key as keyof Dict
    const translation = dict[configStore.locale]?.[k] || dict['en-US'][k] || key

    if (!params) return translation

    // Simple template replacement for {name} style placeholders
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      translation,
    )
  }

  return { t, locale: computed(() => configStore.locale) }
}
