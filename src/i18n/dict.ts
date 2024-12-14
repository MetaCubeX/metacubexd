import { Flatten } from '@solid-primitives/i18n'
import { LANG } from '~/constants'
import en from './en'
import ru from './ru'
import zh from './zh'

export type Dict = Flatten<typeof en>

export default {
  [LANG.EN]: en,
  [LANG.ZH]: zh,
  [LANG.RU]: ru,
}
