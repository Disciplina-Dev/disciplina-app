export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TodoSource = 'MANUAL' | 'SYSTEM'

export interface Todo {
  id: number
  userId: number
  title: string
  description: string | null
  deadline: string | null
  position: number
  status: TodoStatus
  source: TodoSource
  sourceRef: string | null
  createdAt: string
  updatedAt: string
}
