import { AlternantDocumentTemplateRepository } from '../repositories/mongo/AlternantDocumentTemplateRepository';
import { AppSettingsRepository } from '../repositories/mysql/AppSettingsRepository';
import { AlternantDocumentTemplate } from '../types/alternantDocumentTemplate.types';
import { AlternantSequenceType } from '../types/alternant.types';
import { sanitizeMailHtml } from './sanitizeMailHtml';
import { logger } from '../external/logger';

/** Les 2 modèles système (J15/J10W) ne peuvent être ni créés à nouveau ni supprimés. */
export class SystemDocumentTemplateError extends Error {}

/** Clé app_settings : les 2 modèles système (J15/J10W) ont déjà été semés une fois. */
export const ALTERNANT_DOCUMENT_TEMPLATES_SEEDED_KEY = 'alternant_document_templates_seeded';

export interface AlternantDocumentTemplateInput {
    label: string;
    maitreApprentissage: string;
    alternant: string;
    formateur: string;
}

function requireNonBlank(value: string | undefined, field: string): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) throw new Error(`${field} est obligatoire`);
    return trimmed;
}

export class AlternantDocumentTemplateService {
    private templates = new AlternantDocumentTemplateRepository();

    async findAll(type?: AlternantSequenceType): Promise<AlternantDocumentTemplate[]> {
        return this.templates.findAll(type);
    }

    async findById(id: string): Promise<AlternantDocumentTemplate | null> {
        return this.templates.findById(id);
    }

    /** Pour la résolution J15/J10W — les 2 lignes système sont uniques par type. */
    async findSystemTemplate(
        type: AlternantSequenceType.J15 | AlternantSequenceType.J10W,
    ): Promise<AlternantDocumentTemplate | null> {
        return this.templates.findSystemTemplate(type);
    }

    /** Seuls les modèles périodiques sont créables librement depuis les Réglages. */
    async create(input: AlternantDocumentTemplateInput): Promise<AlternantDocumentTemplate> {
        return this.templates.create({
            type: AlternantSequenceType.PERIODIQUE,
            label: requireNonBlank(input.label, 'Le libellé'),
            maitre_apprentissage: sanitizeMailHtml(input.maitreApprentissage ?? ''),
            alternant: sanitizeMailHtml(input.alternant ?? ''),
            formateur: sanitizeMailHtml(input.formateur ?? ''),
        });
    }

    /** Le contenu des 2 modèles système reste éditable — seule leur existence est protégée. */
    async update(id: string, input: AlternantDocumentTemplateInput): Promise<AlternantDocumentTemplate> {
        const existing = await this.templates.findById(id);
        if (!existing) throw new Error('Modèle introuvable');
        const updated = await this.templates.update(id, {
            label: requireNonBlank(input.label, 'Le libellé'),
            maitre_apprentissage: sanitizeMailHtml(input.maitreApprentissage ?? ''),
            alternant: sanitizeMailHtml(input.alternant ?? ''),
            formateur: sanitizeMailHtml(input.formateur ?? ''),
        });
        if (!updated) throw new Error('Modèle introuvable');
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const existing = await this.templates.findById(id);
        if (!existing) return false;
        if (existing.type !== AlternantSequenceType.PERIODIQUE) throw new SystemDocumentTemplateError();
        return this.templates.delete(id);
    }

    /**
     * Sème les 2 modèles système (J15/J10W, contenu vide par défaut, à compléter
     * depuis les Réglages) au premier démarrage. Idempotent via flag app_settings
     * ET vérification d'existence par type, pour ne jamais en dupliquer un.
     */
    async seedSystemDefaults(): Promise<void> {
        const settings = new AppSettingsRepository();
        if (await settings.get(ALTERNANT_DOCUMENT_TEMPLATES_SEEDED_KEY)) return;

        const seeds: { type: AlternantSequenceType.J15 | AlternantSequenceType.J10W; label: string }[] = [
            { type: AlternantSequenceType.J15, label: 'Prise de contact (J+15)' },
            { type: AlternantSequenceType.J10W, label: 'Fin de période d’essai (10 semaines)' },
        ];
        for (const seed of seeds) {
            if (await this.templates.exists({ type: seed.type })) continue;
            await this.templates.create({
                type: seed.type,
                label: seed.label,
                maitre_apprentissage: '',
                alternant: '',
                formateur: '',
            });
            logger.info({ type: seed.type }, 'alternant-document-templates: modèle système semé');
        }
        await settings.set(ALTERNANT_DOCUMENT_TEMPLATES_SEEDED_KEY, '1');
    }
}
