import { create } from 'zustand'

export const useWorkspaceStore = create((set) => ({
  workspace: null,
  members: [],
  myRole: null,
  setWorkspace: (workspace) => set({ workspace }),
  setMembers: (members) => set({ members }),
  setMyRole: (myRole) => set({ myRole }),
  updateMemberRole: (userId, role) =>
    set((state) => ({
      members: state.members.map((member) =>
        member.user_id === userId ? { ...member, role } : member
      ),
    })),
}))
