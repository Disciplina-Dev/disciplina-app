import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import { Formateur } from '../../types/formateur.types';

/** Adresse normalisée : minuscules et espaces retirés. */
export function normalizeFormateurEmail(email: string): string {
    return email.trim().toLowerCase();
}

export class FormateurRepository {
    async findAll(): Promise<Formateur[]> {
        return getModels().Formateur.find({}).sort({ name: 1, email: 1 }).lean() as unknown as Promise<Formateur[]>;
    }

    async findById(id: string): Promise<Formateur | null> {
        return getModels().Formateur.findOne({ _id: id }).lean() as unknown as Promise<Formateur | null>;
    }

    async findByEmail(email: string): Promise<Formateur | null> {
        return getModels()
            .Formateur.findOne({ email: normalizeFormateurEmail(email) })
            .lean() as unknown as Promise<Formateur | null>;
    }

    async create(data: Omit<Formateur, '_id' | 'created_at' | 'updated_at'>): Promise<Formateur> {
        const now = new Date();
        const doc = new (getModels().Formateur)({
            _id: randomUUID(),
            ...data,
            email: normalizeFormateurEmail(data.email),
            created_at: now,
            updated_at: now,
        });
        await doc.save();
        return doc.toObject() as Formateur;
    }

    async update(id: string, patch: Record<string, unknown>): Promise<Formateur | null> {
        const { _id, ...rest } = patch;
        if (typeof rest.email === 'string') rest.email = normalizeFormateurEmail(rest.email);
        return getModels()
            .Formateur.findOneAndUpdate(
                { _id: id },
                { $set: { ...rest, updated_at: new Date() } },
                { returnDocument: 'after', runValidators: true, context: 'query' },
            )
            .lean() as unknown as Promise<Formateur | null>;
    }
}
