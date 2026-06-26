import { describe, it, expect, beforeEach } from 'vitest';
import { env } from '../../../config/env';
import { UserRepository } from '../../../repositories/mysql/UserRepository';
import { truncateMysql } from '../../../../test/helpers/db';
import bcrypt from 'bcrypt';

const API_PORT = env.API_PORT;
const LOGIN_URL = `http://localhost:${API_PORT}/api/auth/login`;
const REGISTER_URL = `http://localhost:${API_PORT}/api/auth/register`;

describe('Auth sensitive fields sanitization', () => {
    beforeEach(async () => {
        await truncateMysql();
    });

    it('login response does not expose password, oauthToken, or refreshToken', async () => {
        const repo = new UserRepository();
        const hashedPassword = await bcrypt.hash('testpass123', 10);

        await repo.create({
            email: 'test@local.test',
            first_name: 'Test',
            last_name: 'User',
            password: hashedPassword,
            role: 'ADMIN',
            sectors: null,
            oauth_token: 'encrypted_token_here',
            refresh_token: 'encrypted_refresh_token_here',
        });

        const res = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@local.test',
                passwordPlain: 'testpass123',
            }),
        });

        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.token).toBeDefined();
        expect(data.user).toBeDefined();

        expect(data.user).not.toHaveProperty('password');
        expect(data.user).not.toHaveProperty('oauthToken');
        expect(data.user).not.toHaveProperty('refreshToken');

        expect(data.user).toHaveProperty('id');
        expect(data.user).toHaveProperty('email');
        expect(data.user).toHaveProperty('firstName');
        expect(data.user).toHaveProperty('lastName');
        expect(data.user).toHaveProperty('role');
    });

    it('register response does not expose password or tokens', async () => {
        const adminRepo = new UserRepository();
        const hashedPassword = await bcrypt.hash('adminpass', 10);

        const adminId = await adminRepo.create({
            email: 'admin@local.test',
            first_name: 'Admin',
            last_name: '',
            password: hashedPassword,
            role: 'ADMIN',
            sectors: null,
            oauth_token: null,
            refresh_token: null,
        });

        const adminToken = require('jsonwebtoken').sign(
            { id: adminId, email: 'admin@local.test', role: 'ADMIN' },
            env.JWT_SECRET,
            { expiresIn: '24h' },
        );

        const res = await fetch(REGISTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                email: 'newuser@local.test',
                firstName: 'New',
                lastName: 'User',
                passwordPlain: 'newpass123',
                role: 'COMMERCIAL',
            }),
        });

        const data = await res.json();
        expect(res.status).toBe(201);
        expect(data).not.toHaveProperty('password');
        expect(data).not.toHaveProperty('oauthToken');
        expect(data).not.toHaveProperty('refreshToken');

        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('email', 'newuser@local.test');
        expect(data).toHaveProperty('firstName', 'New');
        expect(data).toHaveProperty('lastName', 'User');
        expect(data).toHaveProperty('role', 'COMMERCIAL');
    });
});
