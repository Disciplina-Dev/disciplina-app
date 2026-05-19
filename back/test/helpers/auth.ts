import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

type Role = 'ADMIN' | 'COMMERCIAL' | 'RH';

export function mintToken(user: { id: number; email: string; role: Role }): string {
    return jwt.sign(user, env.JWT_SECRET, { expiresIn: '1h' });
}
