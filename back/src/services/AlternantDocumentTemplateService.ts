import { AlternantDocumentTemplateRepository } from '../repositories/mongo/AlternantDocumentTemplateRepository';
import { AlternantDocumentTemplate } from '../types/alternantDocumentTemplate.types';
import { AlternantSequenceType } from '../types/alternant.types';
import { sanitizeMailHtml } from './sanitizeMailHtml';
import { logger } from '../external/logger';

/** Les modèles système (J15/J10W/SA finale) ne peuvent être ni créés à nouveau ni supprimés. */
export class SystemDocumentTemplateError extends Error {}

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

    /** Pour la résolution J15/J10W/SA finale — les lignes système sont uniques par type. */
    async findSystemTemplate(
        type: AlternantSequenceType.J15 | AlternantSequenceType.J10W | AlternantSequenceType.SA_FINALE,
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
     * Sème les modèles système (J15/J10W/SA finale, contenu vide par défaut, à
     * compléter depuis les Réglages) au premier démarrage, et tout nouveau type
     * ajouté plus tard (#960 : SA_FINALE sur un environnement où J15/J10W
     * existaient déjà). Idempotent via vérification d'existence par type — pas
     * de flag global, sans quoi un type ajouté après coup ne serait jamais semé.
     */
    async seedSystemDefaults(): Promise<void> {
        const seeds: {
            type: AlternantSequenceType.J15 | AlternantSequenceType.J10W | AlternantSequenceType.SA_FINALE;
            label: string;
        }[] = [
            { type: AlternantSequenceType.J15, label: 'Prise de contact (J+15)' },
            { type: AlternantSequenceType.J10W, label: 'Fin de période d’essai (10 semaines)' },
            { type: AlternantSequenceType.SA_FINALE, label: 'SA finale avant l’examen' },
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
    }
}
