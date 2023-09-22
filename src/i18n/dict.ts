import { Flatten } from '@solid-primitives/i18n'
import { LANG } from '~/constants'
import en from './en'
import zh from './zh'

export type Dict = Flatten<typeof en>

export default {
  [LANG.EN]: en,
  [LANG.ZH]: zh,
}
