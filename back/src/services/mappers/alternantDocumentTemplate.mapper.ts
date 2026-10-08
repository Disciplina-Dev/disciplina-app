import { AlternantDocumentTemplate } from '../../types/alternantDocumentTemplate.types';
import { ResolvedSequenceDocument } from '../AlternantService';

export function templateToGql(t: AlternantDocumentTemplate): object {
    return {
        id: t._id,
        type: t.type,
        label: t.label,
        maitreApprentissage: t.maitre_apprentissage,
        alternant: t.alternant,
        formateur: t.formateur,
        createdAt: t.created_at ? new Date(t.created_at).toISOString() : null,
        updatedAt: t.updated_at ? new Date(t.updated_at).toISOString() : null,
    };
}

export function resolvedDocumentToGql(r: ResolvedSequenceDocument): object {
    return {
        sequenceId: r.sequenceId,
        header: {
            alternantFullName: r.header.alternantFullName,
            session: r.header.session,
            mentorName: r.header.mentorName,
            companyStartDate: r.header.companyStartDate ? new Date(r.header.companyStartDate).toISOString() : null,
            companyEndDate: r.header.companyEndDate ? new Date(r.header.companyEndDate).toISOString() : null,
        },
        maitreApprentissage: r.maitreApprentissage,
        alternant: r.alternant,
        formateur: r.formateur,
        signatureMaitreApprentissage: r.signatureMaitreApprentissage,
        signatureAlternant: r.signatureAlternant,
        signatureFormateur: r.signatureFormateur,
        isSnapshotted: r.isSnapshotted,
        template: r.template,
    };
}
