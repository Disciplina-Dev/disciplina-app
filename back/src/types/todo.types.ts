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
    groupId: number | null;
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
    group_id: number | null;
    deleted: number;
    created_at: string;
    updated_at: string;
}

export interface TodoGroup {
    id: number;
    userId: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface TodoGroupRow {
    id: number;
    user_id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

export interface CreateTodoInput {
    title: string;
    description?: string | null;
    deadline?: string | null;
    status?: TodoStatus;
    assignedTo?: number | null;
    groupId?: number | null;
    groupName?: string | null;
}

export interface UpdateTodoInput {
    title?: string;
    description?: string | null;
    deadline?: string | null;
    status?: TodoStatus;
    groupId?: number | null;
}
