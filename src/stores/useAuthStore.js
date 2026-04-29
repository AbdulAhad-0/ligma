import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const initialState = {
  user: null,
  profile: null,
  session: null,
}

export const useAuthStore = create((set) => ({
  ...initialState,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSession: (session) => set({ session }),
  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      set(initialState)
    }
  },
}))

export default useAuthStore
