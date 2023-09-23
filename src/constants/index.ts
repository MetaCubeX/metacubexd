import { ApexOptions } from 'apexcharts'
import byteSize from 'byte-size'

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
] as const

export enum ROUTES {
  Overview = '/overview',
  Proxies = '/proxies',
  Rules = '/rules',
  Conns = '/conns',
  Log = '/logs',
  Config = '/config',
  Setup = '/setup',
}

export const CHART_MAX_XAXIS = 10

export const DEFAULT_CHART_OPTIONS: ApexOptions = {
  title: { align: 'center', style: { color: 'gray', fontSize: '16px' } },
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { easing: 'linear' },
  },
  noData: { text: 'Loading...' },
  legend: {
    showForSingleSeries: true,
    fontSize: '16px',
    labels: { colors: 'gray' },
    itemMargin: { horizontal: 32 },
  },
  dataLabels: { enabled: false },
  grid: { yaxis: { lines: { show: false } } },
  stroke: { curve: 'smooth' },
  tooltip: { enabled: false },
  xaxis: {
    range: CHART_MAX_XAXIS,
    labels: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { colors: 'gray', fontSize: '13px' },
      formatter: (val) => byteSize(val).toString(),
    },
  },
}

export enum LATENCY_QUALITY_MAP_HTTP {
  NOT_CONNECTED = -1,
  MEDIUM = 200,
  HIGH = 500,
}

export enum LATENCY_QUALITY_MAP_HTTPS {
  NOT_CONNECTED = -1,
  MEDIUM = 800,
  HIGH = 1500,
}

export enum PROXIES_PREVIEW_TYPE {
  OFF = 'off',
  DOTS = 'dots',
  BAR = 'bar',
  Auto = 'auto',
}

export enum PROXIES_ORDERING_TYPE {
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

export enum CONNECTIONS_TABLE_ACCESSOR_KEY {
  Details = 'details',
  Close = 'close',
  ID = 'ID',
  Type = 'type',
  Process = 'process',
  Host = 'host',
  SniffHost = 'sniffHost',
  Rule = 'rules',
  Chains = 'chains',
  DlSpeed = 'dlSpeed',
  ULSpeed = 'ulSpeed',
  Download = 'dl',
  Upload = 'ul',
  ConnectTime = 'connectTime',
  SourceIP = 'sourceIP',
  SourcePort = 'sourcePort',
  Destination = 'destination',
}

export const CONNECTIONS_TABLE_MAX_CLOSED_ROWS = 200

export const CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER = Object.values(
  CONNECTIONS_TABLE_ACCESSOR_KEY,
)
export const CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY = {
  ...Object.fromEntries(
    CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER.map((i) => [i, true]),
  ),
  [CONNECTIONS_TABLE_ACCESSOR_KEY.ID]: false,
}

export enum TAILWINDCSS_SIZE {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
}

export enum MODE_OPTIONS {
  Global = 'global',
  Rule = 'rule',
  Direct = 'direct',
}

export enum LOG_LEVEL {
  Info = 'info',
  Error = 'error',
  Warning = 'warning',
  Debug = 'debug',
  Silent = 'silent',
}

export const LOGS_TABLE_MAX_ROWS_LIST = [200, 300, 500, 800, 1000]
export const DEFAULT_LOGS_TABLE_MAX_ROWS = LOGS_TABLE_MAX_ROWS_LIST[0]
