import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

export function mintToken(user: { id: number; email: string; role: string; permission?: string }): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
}
