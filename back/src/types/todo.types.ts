export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TodoSource = 'MANUAL' | 'SYSTEM';

export interface Todo {
    id: number;
    userId: number;
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
    title: string;
    description: string | null;
    deadline: string | null;
    position: number;
    status: TodoStatus;
    source: TodoSource;
    source_ref: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateTodoInput {
    title: string;
    description?: string | null;
    deadline?: string | null;
}

export interface UpdateTodoInput {
    title?: string;
    description?: string | null;
    deadline?: string | null;
    status?: TodoStatus;
}
