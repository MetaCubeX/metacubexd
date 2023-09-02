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
  DOTS = 'dots',
  BAR = 'bar',
  Auto = 'auto',
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
