import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { User, Role } from '../types/user.types';
import { UserRow } from '../types/db-rows.types';
import { toUser } from './mappers/user.mapper';
import { env } from '../config/env';
import { encryptToken, decryptToken, isEncryptedToken } from '../external/crypto/token-cipher';
const SALT_ROUNDS = 10;

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    private decryptUserTokens(user: User): User {
        const dec = (t: string | null | undefined) => (t && isEncryptedToken(t) ? decryptToken(t) : t ?? null);
        return { ...user, oauthToken: dec(user.oauthToken), refreshToken: dec(user.refreshToken) };
    }

    async findByEmail(email: string): Promise<User | null> {
        const row = await this.userRepository.findByEmail(email);
        return row ? this.decryptUserTokens(toUser(row)) : null;
    }

    async findById(id: number): Promise<User | null> {
        const row = await this.userRepository.findById(id);
        return row ? this.decryptUserTokens(toUser(row)) : null;
    }

    async findByRole(role: Role): Promise<User[] | null> {
        const row = await this.userRepository.findByRole(role);
        return row ? row.map((user: UserRow) => this.decryptUserTokens(toUser(user))) : null;
    }

    async findByRoles(roles: Role[]): Promise<User[]> {
        const rows = await this.userRepository.findByRoles(roles);
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    async register(email: string, name: string, passwordPlain: string, role: Role, sectors?: string[]): Promise<User> {
        const existing = await this.userRepository.findByEmail(email);
        if (existing) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);

        const userToCreate: Omit<UserRow, 'id'> = {
            email,
            name,
            password: hashedPassword,
            role,
            sectors: sectors && sectors.length > 0 ? JSON.stringify(sectors) : null,
            oauth_token: null,
            refresh_token: null,
        };

        const newId = await this.userRepository.create(userToCreate);
        const created = await this.userRepository.findById(newId);
        if (!created) {
            throw new Error('Failed to create user');
        }

        return toUser(created);
    }

    async login(email: string, passwordPlain: string): Promise<{ token: string; user: User }> {
        const userRow = await this.userRepository.findByEmail(email);
        if (!userRow || !userRow.password) {
            throw new Error('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(passwordPlain, userRow.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }

        const user = toUser(userRow);

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
            expiresIn: '24h',
        });

        return { token, user };
    }

    async updateGoogleTokens(id: number, oauthToken: string | null, refreshToken: string | null): Promise<void> {
        const enc = (t: string | null) => (t ? encryptToken(t) : null);
        await this.userRepository.updateTokens(id, enc(oauthToken), enc(refreshToken));
    }
}
