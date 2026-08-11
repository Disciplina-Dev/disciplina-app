import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { RefreshTokenRepository } from '../repositories/mysql/RefreshTokenRepository';
import { User, JobRole, Permission } from '../types/user.types';
import { UserRow } from '../types/db-rows.types';
import { GoogleTokens } from '../external/google/types';
import { toUser } from './mappers/user.mapper';
import { env } from '../config/env';
import { encryptToken, decryptToken, isEncryptedToken } from '../external/crypto/token-cipher';
import { sha256Hex } from '../external/crypto/hash';
import { logger } from '../external/logger';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../rest/middleware/tokenAuth';
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;

// Mapping des énumérations vers leurs id en base.
const ROLE_TO_ID: Record<JobRole, number> = {
    [JobRole.COMMERCIAL]: 1,
    [JobRole.RH]: 2,
    [JobRole.PEDA]: 3,
    [JobRole.AD]: 4,
    [JobRole.GESTION]: 5,
};

const PERMISSION_TO_ID: Record<Permission, number> = {
    [Permission.EMPLOYEE]: 1,
    [Permission.RESPONSABLE]: 2,
    [Permission.ADMIN]: 3,
};

// Hash bcrypt d'une valeur arbitraire, au même coût que les vrais : sert de leurre
// au login pour que le temps de réponse ne dépende pas de l'existence du compte.
const DUMMY_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Comptes internes créés par un admin : le seuil privilégie la robustesse sur l'ergonomie.
function passwordViolations(password: string): string[] {
    const violations: string[] = [];
    if (password.length < MIN_PASSWORD_LENGTH) violations.push(`au moins ${MIN_PASSWORD_LENGTH} caractères`);
    if (!/[a-z]/.test(password)) violations.push('une minuscule');
    if (!/[A-Z]/.test(password)) violations.push('une majuscule');
    if (!/[0-9]/.test(password)) violations.push('un chiffre');
    return violations;
}

/** Convertit un JobRole enum en id base. */
export function roleToId(role: JobRole): number {
    return ROLE_TO_ID[role];
}

/** Convertit un Permission enum en id base. */
export function permissionToId(permission: Permission): number {
    return PERMISSION_TO_ID[permission];
}

export class UserService {
    private userRepository: UserRepository;
    private refreshTokenRepository: RefreshTokenRepository;

    constructor() {
        this.userRepository = new UserRepository();
        this.refreshTokenRepository = new RefreshTokenRepository();
    }

    private async issueSession(user: User): Promise<{ accessToken: string; refreshToken: string }> {
        const accessToken = signAccessToken({
            id: user.id,
            email: user.email,
            role: user.role,
            permission: user.permission,
        });
        const refreshToken = signRefreshToken({ id: user.id });
        const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
        await this.refreshTokenRepository.create(user.id, sha256Hex(refreshToken), expiresAt);
        return { accessToken, refreshToken };
    }

    private decryptUserTokens(user: User): User {
        const dec = (t: string | null | undefined): string | null => {
            if (!t || !isEncryptedToken(t)) return t ?? null;
            try {
                return decryptToken(t);
            } catch (error) {
                logger.warn(
                    { err: error, userId: user.id },
                    'Échec déchiffrement token Google (clé changée ?) — token ignoré',
                );
                return null;
            }
        };
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

    async findAll(): Promise<User[]> {
        const rows = await this.userRepository.findAll();
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    /** Met à jour les secteurs assignés à un user (valeurs filtrées en amont). */
    async updateSectors(id: number, sectors: string[]): Promise<User | null> {
        await this.userRepository.updateSectors(id, sectors);
        return this.findById(id);
    }

    /**
     * Met à jour le profil d'un user (admin). Champs optionnels ; le mot de passe,
     * s'il est fourni, est haché. Vérifie l'unicité de l'email. Pas de suppression.
     */
    async updateUser(
        id: number,
        input: {
            email?: string;
            firstName?: string;
            lastName?: string;
            role?: JobRole;
            permission?: Permission;
            sectors?: string[];
            passwordPlain?: string;
        },
    ): Promise<User | null> {
        const existing = await this.userRepository.findById(id);
        if (!existing) return null;

        if (input.email && input.email !== existing.email) {
            const clash = await this.userRepository.findByEmail(input.email);
            if (clash && clash.id !== id) {
                throw new Error('Email already in use');
            }
        }

        const fields: Partial<UserRow> = {};
        if (input.email !== undefined) fields.email = input.email;
        if (input.firstName !== undefined) fields.first_name = input.firstName;
        if (input.lastName !== undefined) fields.last_name = input.lastName;
        if (input.role !== undefined) fields.role_id = roleToId(input.role);
        if (input.permission !== undefined) fields.permission_id = permissionToId(input.permission);
        if (input.sectors !== undefined) {
            fields.sectors = input.sectors.length > 0 ? JSON.stringify(input.sectors) : null;
        }
        if (input.passwordPlain) {
            fields.password = await bcrypt.hash(input.passwordPlain, SALT_ROUNDS);
        }

        await this.userRepository.updateProfile(id, fields);
        return this.findById(id);
    }

    async findByRoleId(roleId: number): Promise<User[]> {
        const rows = await this.userRepository.findByRoleId(roleId);
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    async findByJobRole(role: JobRole): Promise<User[]> {
        return this.findByRoleId(ROLE_TO_ID[role]);
    }

    async findByRoleIds(roleIds: number[]): Promise<User[]> {
        const rows = await this.userRepository.findByRoleIds(roleIds);
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    async findByJobRoles(roles: JobRole[]): Promise<User[]> {
        const ids = roles.map((r) => ROLE_TO_ID[r]);
        return this.findByRoleIds(ids);
    }

    async findByPermission(permission: Permission): Promise<User[]> {
        const rows = await this.userRepository.findByPermissionId(PERMISSION_TO_ID[permission]);
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    async findByPermissions(permissions: Permission[]): Promise<User[]> {
        const ids = permissions.map((p) => PERMISSION_TO_ID[p]);
        const rows = await this.userRepository.findByPermissionIds(ids);
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    /** Users habilités à mener les entretiens AB (flag is_interviewer). */
    async findInterviewers(): Promise<User[]> {
        const rows = await this.userRepository.findInterviewers();
        return rows.map((user: UserRow) => this.decryptUserTokens(toUser(user)));
    }

    /**
     * Renvoie le premier utilisateur (parmi les rôles donnés, dans l'ordre)
     * disposant de jetons Google valides. Utilisé par les traitements sans
     * contexte utilisateur (webhooks) pour agir sur le Drive partagé.
     */
    async findFirstGoogleConnectedUser(roles: JobRole[]): Promise<User | null> {
        const users = await this.findByJobRoles(roles);
        // Un access_token suffit pour les routes utilisateur, mais hors session
        // (webhook) il est souvent expiré. On privilégie donc un compte
        // rafraîchissable, avec repli sur un access_token seul.
        return users.find((u) => u.oauthToken && u.refreshToken) ?? users.find((u) => u.oauthToken) ?? null;
    }

    async register(
        email: string,
        firstName: string,
        lastName: string,
        passwordPlain: string,
        roleId: number,
        permissionId: number,
        sectors?: string[],
    ): Promise<User> {
        const violations = passwordViolations(passwordPlain);
        if (violations.length > 0) {
            throw new Error(`Mot de passe trop faible : il faut ${violations.join(', ')}.`);
        }

        const existing = await this.userRepository.findByEmail(email);
        if (existing) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(passwordPlain, SALT_ROUNDS);

        const userToCreate: Omit<UserRow, 'id'> = {
            email,
            first_name: firstName,
            last_name: lastName,
            password: hashedPassword,
            role_id: roleId,
            permission_id: permissionId,
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

    async login(
        email: string,
        passwordPlain: string,
    ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
        const userRow = await this.userRepository.findByEmail(email);

        // Sur e-mail inconnu, comparer quand même contre un faux hash : sans ce
        // travail, la réponse revient ~100 ms plus tôt et révèle que le compte n'existe pas.
        const isMatch = await bcrypt.compare(passwordPlain, userRow?.password || DUMMY_PASSWORD_HASH);
        if (!userRow || !userRow.password || !isMatch) {
            throw new Error('Invalid email or password');
        }

        const user = toUser(userRow);
        const { accessToken, refreshToken } = await this.issueSession(user);
        return { accessToken, refreshToken, user };
    }

    /**
     * Rotation du refresh token : révoque l'ancien, en émet un nouveau. Si le
     * token présenté a déjà été rotaté (réutilisation), c'est un signal de vol
     * — on révoque toute la session de l'utilisateur.
     */
    async refreshAccessToken(
        refreshTokenRaw: string,
    ): Promise<{ accessToken: string; refreshToken: string; user: User } | null> {
        const payload = verifyRefreshToken(refreshTokenRaw);
        if (!payload) return null;

        const tokenHash = sha256Hex(refreshTokenRaw);
        const stored = await this.refreshTokenRepository.findByHash(tokenHash);
        if (!stored) return null;

        if (stored.revoked_at) {
            await this.refreshTokenRepository.revokeAllForUser(stored.user_id);
            return null;
        }
        if (new Date(stored.expires_at).getTime() <= Date.now()) return null;

        const user = await this.findById(stored.user_id);
        if (!user) return null;

        await this.refreshTokenRepository.revokeById(stored.id);
        const { accessToken, refreshToken } = await this.issueSession(user);
        return { accessToken, refreshToken, user };
    }

    /** Révoque uniquement la session courante (l'appareil qui se déconnecte). */
    async logout(refreshTokenRaw: string): Promise<void> {
        const tokenHash = sha256Hex(refreshTokenRaw);
        const stored = await this.refreshTokenRepository.findByHash(tokenHash);
        if (stored) await this.refreshTokenRepository.revokeById(stored.id);
    }

    async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
        const userRow = await this.userRepository.findById(userId);
        if (!userRow || !userRow.password) {
            throw new Error('Utilisateur introuvable');
        }
        const isMatch = await bcrypt.compare(currentPassword, userRow.password);
        if (!isMatch) {
            throw new Error('Mot de passe actuel incorrect');
        }
        if (newPassword.length < 8) {
            throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');
        }
        const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.userRepository.updateProfile(userId, { password: hashed });
    }

    async updateGoogleTokens(id: number, oauthToken: string | null, refreshToken: string | null): Promise<void> {
        const enc = (t: string | null) => (t ? encryptToken(t) : null);
        await this.userRepository.updateTokens(id, enc(oauthToken), enc(refreshToken));
    }

    // Callback à passer aux clients Google (Drive/Gmail/Calendar) : ils l'appellent
    // avec les jetons rafraîchis pour les repersister. Évite de redéfinir la même
    // closure dans chaque contrôleur (elle l'était à l'identique 6 fois).
    googleTokenPersister(userId: number): (refreshed: GoogleTokens) => Promise<void> {
        return (refreshed) =>
            this.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);
    }
}
