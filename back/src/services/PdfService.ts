import PDFDocument from 'pdfkit';
import { Candidate } from '../types/candidate.types';
import { Companies } from '../types/company.types';
import { NeedsAnalysis } from '../types/needsAnalysis.types';

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
                    if (candidate.education?.school_level)
                        doc.text(`Niveau d'étude : ${candidate.education.school_level}`);
                    if (candidate.background?.last_diploma)
                        doc.text(`Dernier diplôme : ${candidate.background.last_diploma}`);
                    doc.moveDown();
                }

                // --- PROFIL ---
                if (candidate.profile) {
                    doc.fontSize(16).text('Profil', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    if (candidate.profile.qualities?.length)
                        doc.text(`Qualités : ${candidate.profile.qualities.join(', ')}`);
                    if (candidate.profile.defects?.length)
                        doc.text(`Axes d'amélioration : ${candidate.profile.defects.join(', ')}`);
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
                    if (reco.oral_confidence_development) doc.text("- Développement confiance à l'oral");
                    if (reco.time_management_support) doc.text('- Soutien gestion du temps');
                    doc.moveDown();
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    static generateNeedsAnalysisPdf(analysis: NeedsAnalysis, company: Companies): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Styling colors
                const primaryColor = '#0052cc';
                const textColor = '#333333';

                // --- HEADER ---
                doc.rect(0, 0, 612, 15).fill(primaryColor); // top bar
                doc.moveDown(2);

                doc.fillColor(primaryColor).fontSize(22).text('DISCIPLINA', { align: 'center', tracking: 2 } as any);
                doc.fillColor(textColor).fontSize(14).text('Centre de Formation & CFA', { align: 'center' });
                doc.moveDown(1);
                
                doc.fontSize(16).fillColor(primaryColor).text('ANALYSE DU BESOIN EN RECRUTEMENT APPRENTISSAGE (AB)', { align: 'center', underline: true });
                doc.moveDown(2);

                // --- 1. IDENTITÉ DE L'ENTREPRISE ---
                doc.fillColor(primaryColor).fontSize(14).text("1. Identité de l'entreprise", { underline: false });
                doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y + 2).lineTo(560, doc.y + 2).stroke();
                doc.moveDown(0.8);

                doc.fillColor(textColor).fontSize(11);
                doc.text(`Raison Sociale : ${company.name || '-'}`);
                doc.text(`SIRET : ${company.siret || '-'}`);
                doc.text(`Adresse : ${company.address || '-'}`);
                doc.text(`Représentant Légal : ${company.legalReferent || '-'}`);
                doc.moveDown(0.5);

                doc.fillColor(textColor).fontSize(11).text('Responsable Recrutement :', { underline: true });
                doc.text(`Nom : ${analysis.recruitmentResponsibleName || '-'}`);
                doc.text(`Téléphone : ${analysis.recruitmentResponsiblePhone || '-'}`);
                doc.text(`E-mail : ${analysis.recruitmentResponsibleEmail || '-'}`);
                doc.text(`Zone Géographique : ${analysis.localisation}`);
                doc.moveDown(1.5);

                // --- 2. PROFIL DU POSTE & MISSIONS ---
                doc.fillColor(primaryColor).fontSize(14).text("2. Profil du poste & Missions", { underline: false });
                doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y + 2).lineTo(560, doc.y + 2).stroke();
                doc.moveDown(0.8);

                doc.fillColor(textColor).fontSize(11);
                doc.text(`Intitulé du poste : ${analysis.jobTitle}`);
                doc.text(`Nombre de poste(s) à pourvoir : ${analysis.positionsCount}`);
                doc.text(`Domaine de formation : ${analysis.trainingDomain === 'VENTE' ? 'Commerce / Vente' : 'Secrétariat / Gestion'}`);
                doc.moveDown(0.5);

                doc.fillColor(textColor).fontSize(11).text('Missions confiées à l\'apprenti :', { underline: true });
                if (analysis.selectedMissions && analysis.selectedMissions.length > 0) {
                    analysis.selectedMissions.forEach((mission) => {
                        doc.text(`- ${mission}`);
                    });
                } else {
                    doc.text('- Aucune mission type sélectionnée');
                }
                if (analysis.otherMissions) {
                    doc.text(`Spécificités additionnelles : ${analysis.otherMissions}`);
                }
                doc.moveDown(1.5);

                // --- 3. EXIGENCES ET FILTRES APPRENTI ---
                doc.fillColor(primaryColor).fontSize(14).text("3. Exigences et profil de l'apprenti", { underline: false });
                doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y + 2).lineTo(560, doc.y + 2).stroke();
                doc.moveDown(0.8);

                doc.fillColor(textColor).fontSize(11);
                doc.text(`Niveau d'études requis : ${analysis.educationLevel}`);
                doc.text(`Permis de conduire B requis : ${analysis.drivingLicense === 'OUI' ? 'Oui, obligatoire' : 'Non requis'}`);
                doc.text(`Expérience requise : ${analysis.experienceRequired === 'DEBUTANT' ? 'Débutant accepté' : 'Expérience minimale obligatoire'}`);
                if (analysis.ageRequirements && analysis.ageRequirements.length > 0) {
                    doc.text(`Tranches d'âge cibles : ${analysis.ageRequirements.join(', ')}`);
                }
                if (analysis.softSkills) {
                    doc.text(`Soft skills / Qualités clés attendues : ${analysis.softSkills}`);
                }
                doc.moveDown(1.5);

                // --- 4. ORGANISATION & RYTHME D'ALTERNANCE ---
                doc.fillColor(primaryColor).fontSize(14).text("4. Organisation & Rythme d'alternance", { underline: false });
                doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y + 2).lineTo(560, doc.y + 2).stroke();
                doc.moveDown(0.8);

                doc.fillColor(textColor).fontSize(11);
                doc.text(`Période d'immersion préalable (PMSMP) : ${analysis.immersionPeriod === 'OUI' ? 'Oui' : analysis.immersionPeriod === 'NON' ? 'Non' : 'À discuter'}`);
                
                doc.moveDown(0.5);
                doc.fillColor(textColor).fontSize(11).text('Jours de présence prévus en entreprise :', { underline: true });
                try {
                    const days = typeof analysis.trainingDays === 'string' ? JSON.parse(analysis.trainingDays) : analysis.trainingDays;
                    const daysFrench: Record<string, string> = {
                        monday: 'Lundi',
                        tuesday: 'Mardi',
                        wednesday: 'Mercredi',
                        thursday: 'Jeudi',
                        friday: 'Vendredi'
                    };
                    Object.keys(daysFrench).forEach((dayKey) => {
                        const dayPeriods: string[] = days[dayKey] || [];
                        const periodsStr = dayPeriods.length === 2 
                            ? 'Journée entière' 
                            : dayPeriods.length === 1 
                            ? dayPeriods[0] === 'MATIN' ? 'Matinée uniquement' : 'Après-midi uniquement'
                            : 'Absent (CFA ou Repos)';
                        doc.text(`- ${daysFrench[dayKey]} : ${periodsStr}`);
                    });
                } catch (e) {
                    doc.text('- Grille des horaires indisponible ou non configurée');
                }
                doc.moveDown(2);

                // --- 5. CADRE D'ENGAGEMENT ---
                doc.fillColor(textColor).fontSize(9);
                doc.text("Le présent document formalise la demande d'analyse de besoin en apprentissage initiée par l'entreprise cliente pour le centre de formation Disciplina. La signature numérique apposée ci-dessous confirme l'intention d'engager un parcours d'alternance sous réserve d'éligibilité et d'accord de financement OPCO.", { align: 'justify' });
                doc.moveDown(2);

                // --- SIGNATURE SPACE ---
                doc.fontSize(10).fillColor(textColor);
                doc.text("Pour l'Entreprise Cliente (Bon pour accord)", 50, doc.y);
                doc.text('Pour Disciplina CFA', 350, doc.y - 12);
                
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}
