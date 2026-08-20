export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TodoSource = 'MANUAL' | 'SYSTEM';

export interface Todo {
    id: number;
    userId: number;
    assignedBy: number | null;
    title: string;
    description: string | null;
    deadline: string | null;
    position: number;
    status: TodoStatus;
    source: TodoSource;
    sourceRef: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TodoRow {
    id: number;
    user_id: number;
    assigned_by: number | null;
    title: string;
    description: string | null;
    deadline: string | null;
    position: number;
    status: TodoStatus;
    source: TodoSource;
    source_ref: string | null;
    deleted: number;
    created_at: string;
    updated_at: string;
}

export interface CreateTodoInput {
    title: string;
    description?: string | null;
    deadline?: string | null;
    status?: TodoStatus;
    assignedTo?: number | null;
}

export interface UpdateTodoInput {
    title?: string;
    description?: string | null;
    deadline?: string | null;
    status?: TodoStatus;
}
