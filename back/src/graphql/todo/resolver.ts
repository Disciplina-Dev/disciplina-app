import { authGuard } from '../authGuard';
import { Permission } from '../../types/user.types';
import { TodoService } from '../../services/TodoService';
import { UserService } from '../../services/UserService';

const todoService = new TodoService();
const userService = new UserService();

export const todoResolvers = {
    Query: {
        myTodos: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.listForUser(context.user.id);
        },
        myTodoGroups: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.listGroupsForUser(context.user.id);
        },
        todoGroupsForUser: async (_: unknown, { userId }: { userId: number }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.listGroupsForUser(userId);
        },
    },
    Mutation: {
        createTodo: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.create(context.user.id, input);
        },
        updateTodo: async (_: unknown, { id, input }: { id: number; input: any }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.update(context.user.id, id, input);
        },
        reorderTodos: async (_: unknown, { orderedIds }: { orderedIds: number[] }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.reorder(context.user.id, orderedIds);
        },
        deleteTodo: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            return todoService.delete(context.user.id, id);
        },
        createTodoGroup: async (_: unknown, { name, forUserId }: { name: string; forUserId?: number | null }, context: any) => {
            authGuard(context.user, Permission.EMPLOYEE);
            const targetUserId = forUserId ?? context.user.id;
            if (forUserId != null && forUserId !== context.user.id) {
                return todoService.createGroupForAssignee(context.user.id, targetUserId, name);
            }
            return todoService.createGroup(targetUserId, name);
        },
        changePassword: async (
            _: unknown,
            { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
            context: any,
        ) => {
            authGuard(context.user, Permission.EMPLOYEE);
            await userService.changePassword(context.user.id, currentPassword, newPassword);
            return true;
        },
    },
};
