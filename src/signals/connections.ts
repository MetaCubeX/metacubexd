import { differenceWith, unionWith } from 'lodash'
import { Accessor, createEffect, createSignal, untrack } from 'solid-js'
import { Connection, ConnectionWithSpeed } from '~/types'
import { selectedEndpoint, useWsRequest } from './request'

type WsMsg = {
  connections: Connection[]
  uploadTotal: number
  downloadTotal: number
} | null

// we make connections global, so we can keep track of connections when user in proxy page
// when user selects proxy and close some connections they can back and check connections
// they closed
const [allConnectionsWithSpeed, setAllConnectionsWithSpeed] = createSignal<
  ConnectionWithSpeed[]
>([])

export let connections: Accessor<WsMsg> = () => ({
  uploadTotal: 0,
  downloadTotal: 0,
  connections: [],
})

createEffect(() => {
  if (selectedEndpoint()) {
    connections = useWsRequest<WsMsg>('connections')
  }
})

export const useConnections = () => {
  const [closedConnectionsWithSpeed, setClosedConnectionsWithSpeed] =
    createSignal<ConnectionWithSpeed[]>([])
  const [activeConnectionsWithSpeed, setActiveConnectionsWithSpeed] =
    createSignal<ConnectionWithSpeed[]>([])
  const [paused, setPaused] = createSignal(false)

  const updateConnectionsWithSpeed = (connections: Connection[]) => {
    const prevActiveConnections = activeConnectionsWithSpeed()
    const prevMap = new Map<string, Connection>()
    prevActiveConnections.forEach((prev) => prevMap.set(prev.id, prev))

    const activeConnections: ConnectionWithSpeed[] = connections.map(
      (connection) => {
        const prevConn = prevMap.get(connection.id)

        if (!prevConn) {
          return { ...connection, downloadSpeed: 0, uploadSpeed: 0 }
        }

        return {
          ...connection,
          downloadSpeed:
            connection.download - (prevConn.download ?? connection.download),
          uploadSpeed:
            connection.upload - (prevConn.upload ?? connection.upload),
        }
      },
    )

    const allConnections = unionWith(
      allConnectionsWithSpeed(),
      activeConnections,
      (a, b) => a.id === b.id,
    )
    const closedConnections = differenceWith(
      allConnections,
      activeConnections,
      (a, b) => a.id === b.id,
    )

    return {
      activeConns: activeConnections.slice(-200),
      closedConns: closedConnections.slice(-200),
      allConns: allConnections.slice(-400),
    }
  }

  createEffect(() => {
    const connection = connections()?.connections

    if (!connection) {
      return
    }

    untrack(() => {
      const { activeConns, closedConns, allConns } =
        updateConnectionsWithSpeed(connection)

      if (!paused()) {
        setActiveConnectionsWithSpeed(activeConns)
        setClosedConnectionsWithSpeed(closedConns)
      }

      setAllConnectionsWithSpeed(allConns)
    })
  })

  return {
    closedConnectionsWithSpeed,
    activeConnectionsWithSpeed,
    paused,
    setPaused,
  }
}
