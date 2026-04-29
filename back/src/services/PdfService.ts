import PDFDocument from 'pdfkit';
import { Candidate } from '../db/mongodb/interface';

export class PdfService {
    static generateCandidatePdf(candidate: Candidate): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];
                
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });
                
                // --- HEADER ---
                doc.fontSize(20).text(`Dossier Candidat : ${candidate.identity.full_name}`, { align: 'center' });
                doc.moveDown();
                
                // --- INFORMATIONS GENERALES ---
                doc.fontSize(16).text('Informations Générales', { underline: true });
                doc.fontSize(12).moveDown(0.5);
                doc.text(`Email : ${candidate.identity.email}`);
                doc.text(`Téléphone : ${candidate.identity.phone}`);
                if (candidate.identity.city) doc.text(`Ville : ${candidate.identity.city}`);
                if (candidate.identity.age) doc.text(`Âge : ${candidate.identity.age} ans`);
                
                doc.text(`Type de Titre Professionnel (TP) : ${candidate.tp_type}`);
                doc.text(`Statut : ${candidate.status}`);
                if (candidate.training_site) doc.text(`Site de formation : ${candidate.training_site}`);
                
                doc.moveDown();

                // --- PARCOURS / EDUCATION ---
                if (candidate.education?.school_level || candidate.background?.last_diploma) {
                    doc.fontSize(16).text('Parcours', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    if (candidate.education?.school_level) doc.text(`Niveau d'étude : ${candidate.education.school_level}`);
                    if (candidate.background?.last_diploma) doc.text(`Dernier diplôme : ${candidate.background.last_diploma}`);
                    doc.moveDown();
                }

                // --- PROFIL ---
                if (candidate.profile) {
                    doc.fontSize(16).text('Profil', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    if (candidate.profile.qualities?.length) doc.text(`Qualités : ${candidate.profile.qualities.join(', ')}`);
                    if (candidate.profile.defects?.length) doc.text(`Axes d'amélioration : ${candidate.profile.defects.join(', ')}`);
                    doc.moveDown();
                }

                // --- PROJET PROFESSIONNEL ---
                if (candidate.professional_projects?.career_objectives) {
                    doc.fontSize(16).text('Projet Professionnel', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    doc.text(`Objectifs : ${candidate.professional_projects.career_objectives}`);
                    doc.moveDown();
                }
                
                // Financement / Recommandations
                if (candidate.synthesis?.pedagogical_recommendations) {
                    doc.fontSize(16).text('Recommandations pédagogiques', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    const reco = candidate.synthesis.pedagogical_recommendations;
                    if (reco.office_tools_reinforcement) doc.text('- Renforcement bureautique');
                    if (reco.written_communication_support) doc.text('- Soutien communication écrite');
                    if (reco.oral_confidence_development) doc.text('- Développement confiance à l\'oral');
                    if (reco.time_management_support) doc.text('- Soutien gestion du temps');
                    doc.moveDown();
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}
