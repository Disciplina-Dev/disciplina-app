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
