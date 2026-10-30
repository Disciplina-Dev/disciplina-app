import { randomUUID } from 'crypto';
import { getModels } from '../../db/mongo/tenant';
import {
    EmargementHalf,
    EmargementRecord,
    EmargementSignatureMode,
    EmargementStatus,
} from '../../types/emargement.types';

export interface UpsertEmargementInput {
    alternantId: string;
    firstName: string;
    lastName: string;
    half: EmargementHalf;
    status: EmargementStatus;
    statusTime: string | null;
    signatureMode: EmargementSignatureMode;
    /** Signature manuscrite (data-URL PNG) pour le mode `handwritten`, sinon `null`. */
    signatureImage: string | null;
    signedAt: Date;
    ip: string | null;
    userAgent: string | null;
}

export interface SeanceEmargementCounts {
    marked: number;
    present: number;
}

const PRESENT_STATUSES: EmargementStatus[] = ['present', 'late', 'left_early'];

export class EmargementRepository {
    async findBySeance(seanceId: string): Promise<EmargementRecord[]> {
        return getModels().Emargement.find({ seance_id: seanceId }).lean() as unknown as Promise<EmargementRecord[]>;
    }

    async findOne(seanceId: string, alternantId: string, half: EmargementHalf): Promise<EmargementRecord | null> {
        return getModels()
            .Emargement.findOne({
                seance_id: seanceId,
                alternant_id: alternantId,
                half,
            })
            .lean() as unknown as Promise<EmargementRecord | null>;
    }

    /**
     * Crée ou met à jour la ligne d'un alternant pour un demi-journée.
     * `first_signed_at` / `first_signature_mode` ne sont posés qu'à l'insertion :
     * une correction manuelle du formateur ne peut pas effacer la preuve du QR.
     */
    async upsert(seanceId: string, input: UpsertEmargementInput): Promise<EmargementRecord> {
        const now = new Date();
        const filter = {
            seance_id: seanceId,
            alternant_id: input.alternantId,
            half: input.half,
        };
        const set: Record<string, unknown> = {
            first_name: input.firstName,
            last_name: input.lastName,
            status: input.status,
            status_time: input.statusTime,
            signature_mode: input.signatureMode,
            signed_at: input.signedAt,
            ip: input.ip,
            user_agent: input.userAgent,
            updated_at: now,
        };
        // Le tracé de l'alternant est une pièce de preuve : une simple correction de
        // statut par le formateur ne doit pas l'effacer. Une nouvelle signature de
        // l'alternant (`qr` sur son téléphone, `handwritten` sur l'appareil du
        // formateur) le remplace, et un passage à `absent` / `na` l'efface — le
        // tracé ne prouve alors plus la présence.
        if (input.signatureMode === 'handwritten' || input.signatureMode === 'qr') {
            set.signature_image = input.signatureImage;
        } else if (!PRESENT_STATUSES.includes(input.status)) {
            set.signature_image = null;
        }

        const update = {
            $set: set,
            $setOnInsert: {
                _id: randomUUID(),
                seance_id: seanceId,
                alternant_id: input.alternantId,
                half: input.half,
                first_signed_at: input.signedAt,
                first_signature_mode: input.signatureMode,
                created_at: now,
            },
        };
        return getModels()
            .Emargement.findOneAndUpdate(filter, update, {
                upsert: true,
                returnDocument: 'after',
                runValidators: true,
                setDefaultsOnInsert: true,
            })
            .lean() as unknown as Promise<EmargementRecord>;
    }

    async deleteBySeance(seanceId: string): Promise<void> {
        await getModels().Emargement.deleteMany({ seance_id: seanceId });
    }

    async deleteBySeanceAndHalf(seanceId: string, half: EmargementHalf): Promise<void> {
        await getModels().Emargement.deleteMany({ seance_id: seanceId, half });
    }

    /** Nombre de statuts saisis et de présences, par séance (une requête pour la liste). */
    async countsBySeance(seanceIds: string[]): Promise<Map<string, SeanceEmargementCounts>> {
        if (seanceIds.length === 0) return new Map();
        const rows = await getModels().Emargement.aggregate<{
            _id: string;
            marked: number;
            present: number;
        }>([
            { $match: { seance_id: { $in: seanceIds }, status: { $ne: 'na' } } },
            {
                $group: {
                    _id: '$seance_id',
                    marked: { $sum: 1 },
                    present: {
                        $sum: { $cond: [{ $in: ['$status', PRESENT_STATUSES] }, 1, 0] },
                    },
                },
            },
        ]);
        return new Map(rows.map((row) => [row._id, { marked: row.marked, present: row.present }]));
    }
}
