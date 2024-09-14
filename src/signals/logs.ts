import { useWsRequest } from '~/signals'
import { logLevel, logMaxRows } from '~/signals/config'
import { Log, LogWithSeq } from '~/types'

let seq = 1

const [logs, setLogs] = createSignal<LogWithSeq[]>([])
const [paused, setPaused] = createSignal(false)

createEffect(
  on(logLevel, (value, oldValue) => {
    if (value === oldValue) return

    const logsData = useWsRequest<Log>('logs', { level: logLevel() })

    createEffect(() => {
      const data = logsData()

      if (!data || paused()) {
        return
      }

      setLogs((logs) => [{ ...data, seq }, ...logs].slice(0, logMaxRows()))
      seq++
    })
  }),
)

export const useLogs = () => {
  return {
    logs,
    paused,
    setPaused,
  }
}
