import { differenceWith, isNumber, unionWith } from 'lodash'
import { Accessor, createEffect, createSignal, untrack } from 'solid-js'
import { Connection, ConnectionRawMessage } from '~/types'
import { selectedEndpoint, useWsRequest } from './request'

type WsMsg = {
  connections: ConnectionRawMessage[]
  uploadTotal: number
  downloadTotal: number
} | null

// we make connections global, so we can keep track of connections when user in proxy page
// when user selects proxy and close some connections they can back and check connections
// they closed
const [allConnections, setAllConnections] = createSignal<Connection[]>([])

export let latestConnectionMsg: Accessor<WsMsg> = () => ({
  uploadTotal: 0,
  downloadTotal: 0,
  connections: [],
})

createEffect(() => {
  if (selectedEndpoint()) {
    setAllConnections([])
    latestConnectionMsg = useWsRequest<WsMsg>('connections')
  }
})

export const useConnections = () => {
  const [closedConnections, setClosedConnections] = createSignal<Connection[]>(
    [],
  )
  const [activeConnections, setActiveConnections] = createSignal<Connection[]>(
    [],
  )
  const [paused, setPaused] = createSignal(false)

  createEffect(() => {
    const rawConns = latestConnectionMsg()?.connections

    if (!rawConns) {
      return
    }

    untrack(() => {
      const activeConns = restructRawMsgToConnection(
        rawConns,
        activeConnections(),
      )
      const allConns = mergeAllConnections(activeConns)

      if (!paused()) {
        const closedConns = diffClosedConnections(activeConns, allConns)

        setActiveConnections(activeConns.slice(-200))
        setClosedConnections(closedConns.slice(-200))
      }

      setAllConnections(allConns.slice(-400))
    })
  })

  return {
    closedConnections,
    activeConnections,
    paused,
    setPaused,
  }
}

export function restructRawMsgToConnection(
  connections: ConnectionRawMessage[],
  prevActiveConnections: Connection[],
): Connection[] {
  const prevMap = new Map<string, Connection>()
  prevActiveConnections.forEach((prev) => prevMap.set(prev.id, prev))

  return connections.map((connection) => {
    const prevConn = prevMap.get(connection.id)

    if (
      !prevConn ||
      !isNumber(prevConn.download) ||
      !isNumber(prevConn.upload)
    ) {
      return { ...connection, downloadSpeed: 0, uploadSpeed: 0 }
    }

    return {
      ...connection,
      downloadSpeed: connection.download - prevConn.download,
      uploadSpeed: connection.upload - prevConn.upload,
    }
  })
}

export function mergeAllConnections(activeConns: Connection[]) {
  return unionWith(allConnections(), activeConns, (a, b) => a.id === b.id)
}

function diffClosedConnections(
  activeConns: Connection[],
  allConns: Connection[],
) {
  return differenceWith(allConns, activeConns, (a, b) => a.id === b.id)
}
