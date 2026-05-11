import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function jwtContext({ req }: { req: any }) {
    const token = req.headers.authorization?.split(' ')[1] || '';
    if (token) {
        try {
            const user = jwt.verify(token, env.JWT_SECRET);
            return { user };
        } catch {
            // invalid token — treat as unauthenticated
        }
    }
    return { user: null };
}
