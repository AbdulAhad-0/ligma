import { create } from 'zustand'

export const useEventLogStore = create((set) => ({
  events: [],
  lastSeq: 0,
  appendEvent: (event) =>
    set((state) => {
      // Deduplicate by event ID to prevent duplicate keys in EventLogSidebar
      if (event?.id && state.events.some(e => e.id === event.id)) {
        return state
      }
      return {
        events: [...state.events, event].slice(-200),
      }
    }),
  setLastSeq: (lastSeq) =>
    set((state) => ({
      lastSeq: Math.max(state.lastSeq, lastSeq ?? 0),
    })),
}))
