import { create } from 'zustand'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  filter: 'all',
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),
  updateTaskStatus: (id, status) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, status } : task
      ),
    })),
  setFilter: (filter) => set({ filter }),
  getTasksByNodeId: (nodeId) => get().tasks.filter((task) => task.node_id === nodeId),
}))
