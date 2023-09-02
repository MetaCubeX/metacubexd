export const themes = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
]

export enum ROUTE {
  Overview = '/overview',
  Proxies = '/proxies',
  Proxyprovider = '/proxyprovider',
  Rules = '/rules',
  Conns = '/conns',
  Log = '/logs',
  Config = '/config',
}

export enum AccessorKey {
  Close = 'close',
  ID = 'ID',
  Type = 'type',
  Process = 'process',
  Host = 'host',
  Rule = 'rules',
  Chains = 'chains',
  DlSpeed = 'dlSpeed',
  ULSpeed = 'ulSpeed',
  Download = 'dl',
  Upload = 'ul',
  Source = 'source',
  Destination = 'destination',
}

export enum DELAY {
  NOT_CONNECTED = 0,
  MEDIUM = 200,
  HIGH = 500,
}

export enum PROXIES_PREVIEW_TYPE {
  OFF = 'off',
  DOTS = 'dots',
  BAR = 'bar',
  Auto = 'auto',
}

export enum PROXIES_SORTING_TYPE {
  NATURAL = 'orderNatural',
  LATENCY_ASC = 'orderLatency_asc',
  LATENCY_DESC = 'orderLatency_desc',
  NAME_ASC = 'orderName_asc',
  NAME_DESC = 'orderName_desc',
}

export enum LANG {
  EN = 'en-US',
  ZH = 'zh-CN',
}

export const initColumnOrder = Object.values(AccessorKey)
export const initColumnVisibility = {
  ...Object.fromEntries(initColumnOrder.map((i) => [i, true])),
  [AccessorKey.ID]: false,
}
