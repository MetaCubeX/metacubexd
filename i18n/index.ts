import { LANG } from '~/constants'
import en from './en'
import ru from './ru'
import zh from './zh'

export type Dict = typeof en

const dict: Record<LANG, Dict> = {
  [LANG.EN]: en,
  [LANG.ZH]: zh,
  [LANG.RU]: ru,
}

export default dict

export { en, ru, zh }
