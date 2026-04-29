import { create } from 'zustand'

export const usePresenceStore = create((set) => ({
  cursors: {},
  updateCursor: (userId, data) =>
    set((state) => ({
      cursors: {
        ...state.cursors,
        [userId]: {
          ...(state.cursors[userId] || {}),
          ...data,
        },
      },
    })),
  removeCursor: (userId) =>
    set((state) => {
      const nextCursors = { ...state.cursors }
      delete nextCursors[userId]
      return { cursors: nextCursors }
    }),
}))

export default usePresenceStore
