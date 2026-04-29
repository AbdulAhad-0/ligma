import { create } from 'zustand'

export const useCanvasStore = create((set) => ({
  nodes: {},
  selectedNodeId: null,
  ydoc: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  setYdoc: (ydoc) => set({ ydoc }),
  setNodes: (nodes) => set({ nodes: nodes || {} }),
  addNode: (node) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [node.id]: node,
      },
    })),
  updateNode: (id, patch) =>
    set((state) => {
      const existing = state.nodes[id]
      if (!existing) return state
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            ...patch,
          },
        },
      }
    }),
  deleteNode: (id) =>
    set((state) => {
      const existing = state.nodes[id]
      if (!existing) return state
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            is_deleted: true,
          },
        },
      }
    }),
  setIntent: (id, intent, confidence) =>
    set((state) => {
      const existing = state.nodes[id]
      if (!existing) return state
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...existing,
            intent,
            intent_confidence: confidence,
          },
        },
      }
    }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setViewport: (viewport) => set({ viewport }),
}))
