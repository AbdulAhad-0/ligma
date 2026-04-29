import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useCanvasStore } from '../stores/useCanvasStore'

export function yAddNode(yNodes, node) {
  const ydoc = yNodes?.doc
  if (!ydoc) return

  ydoc.transact(() => {
    yNodes.set(node.id, node)
  })
}

export function yUpdateNode(yNodes, id, patch) {
  const ydoc = yNodes?.doc
  if (!ydoc) return

  ydoc.transact(() => {
    yNodes.set(id, { ...yNodes.get(id), ...patch })
  })
}

export function yDeleteNode(yNodes, id) {
  const ydoc = yNodes?.doc
  if (!ydoc) return

  ydoc.transact(() => {
    yNodes.set(id, { ...yNodes.get(id), is_deleted: true })
  })
}

export default function useYjs(workspaceId) {
  const setYdoc = useCanvasStore((state) => state.setYdoc)
  const setNodes = useCanvasStore((state) => state.setNodes)
  const [runtime, setRuntime] = useState({ yNodes: null, ydoc: null, provider: null })

  useEffect(() => {
    if (!workspaceId) {
      setRuntime({ yNodes: null, ydoc: null, provider: null })
      setYdoc(null)
      setNodes({})
      return undefined
    }

    const rawWsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:4000'
    const wsUrl = rawWsUrl.replace(/^http/, 'ws')
    const ydoc = new Y.Doc()
    const provider = new WebsocketProvider(wsUrl, workspaceId, ydoc)
    const yNodes = ydoc.getMap('nodes')

    const syncNodes = () => {
      setNodes(Object.fromEntries(yNodes.entries()))
    }

    setYdoc(ydoc)
    syncNodes()
    yNodes.observe(syncNodes)

    setRuntime({ yNodes, ydoc, provider })

    return () => {
      yNodes.unobserve(syncNodes)
      provider.destroy()
      ydoc.destroy()
      setYdoc(null)
      setNodes({})
      setRuntime({ yNodes: null, ydoc: null, provider: null })
    }
  }, [workspaceId, setNodes, setYdoc])

  return runtime
}
