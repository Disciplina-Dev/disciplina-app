import puppeteer from 'puppeteer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Candidate } from '../types/candidate.types';
import { Companies } from '../types/company.types';
import { NeedsAnalysis } from '../types/needsAnalysis.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
    if (!v) return '';
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function label(v: string | null | undefined): string {
    const MAP: Record<string, string> = {
        NORD: 'Nord',
        OUEST: 'Ouest',
        SUD: 'Sud',
        SECRETARIAT: 'Secrétariat',
        VENTE: 'Vente',
        BAC: 'Niveau Bac',
        BAC_PLUS_2: 'Niveau Bac + 2',
        BAC_PLUS_3: 'Niveau Bac + 3',
        OUI: 'Oui',
        NON: 'Non',
        OPTIONNEL: 'Optionnel',
        DEBUTANT: 'Débutant',
        OBLIGATOIRE: 'Obligatoire',
        ALL_CV: 'Réception de tous les CV',
        PRESELECTION: 'Présélection des CV par le centre de formation',
        PRE_INTERVIEW: 'Pré-entretien des CV par le centre de formation',
        A_DISCUTER: 'A discuter ensemble',
    };
    return MAP[v ?? ''] ?? esc(v);
}

function parseDays(raw: string): Record<string, string> {
    try {
        const days: Record<string, string[]> = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const FR: Record<string, string> = {
            monday: 'Lundi',
            tuesday: 'Mardi',
            wednesday: 'Mercredi',
            thursday: 'Jeudi',
            friday: 'Vendredi',
        };
        const result: Record<string, string> = {};
        for (const [key, frLabel] of Object.entries(FR)) {
            const periods: string[] = days[key] ?? [];
            if (periods.includes('PREFERE')) result[frLabel] = 'Préféré';
            else if (periods.length === 2) result[frLabel] = 'Oui';
            else if (periods.includes('MATIN')) result[frLabel] = 'Matin';
            else if (periods.includes('APRES_MIDI')) result[frLabel] = 'Après-midi';
            else result[frLabel] = 'Non';
        }
        return result;
    } catch {
        return {};
    }
}

function chk(selected: boolean): string {
    return selected ? '●' : '○';
}

function chkIn(value: string, arr: string[]): string {
    return (arr ?? []).includes(value) ? '●' : '○';
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function getLogoDataUrl(): string {
    try {
        const logoPath = path.join(__dirname, '../../assets/logo-disciplina.svg');
        const svgBase64 = fs.readFileSync(logoPath).toString('base64');
        return `data:image/svg+xml;base64,${svgBase64}`;
    } catch {
        return '';
    }
}

// ─── Header / Footer templates ────────────────────────────────────────────────

function buildHeaderTemplate(logoDataUrl: string): string {
    const logoHtml = logoDataUrl
        ? `<img src="${logoDataUrl}" style="height:38px;display:block;" />`
        : `<div style="font-size:22px;font-weight:bold;color:#1130A7;">Disciplina</div>`;
    return `
    <div style="width:100%;padding:6px 18mm 0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;">
        ${logoHtml}
        <div style="font-size:8px;color:#C41E3A;font-style:italic;margin-top:2px;">Notre passion, votre progression</div>
    </div>`;
}

function buildFooterTemplate(): string {
    return `
    <div style="width:100%;padding:0 18mm 4px;font-family:Arial,Helvetica,sans-serif;font-size:7px;text-align:center;color:#333;-webkit-print-color-adjust:exact;">
        <div style="border-top:1px solid #999;padding-top:4px;">
            <strong>DISCIPLINA</strong> | 71 rue Roger Payet, Sainte-Marie 97438 | Numéro SIRET : <em>97828986600011</em><br/>
            Déclaration d'activité enregistrée sous le n° 04973484197 auprès du Préfet de région de Réunion. Cet enregistrement ne vaut pas agrément de l'Etat<br/>
            Mis à jour le 25/02/2026
        </div>
    </div>`;
}

// ─── HTML builder (pages 1-5) ─────────────────────────────────────────────────

function fr(lbl: string, value: string | null | undefined): string {
    return `
    <div class="field-row">
        <span class="field-label">${lbl}</span> <span class="field-value">${esc(value)}</span>
    </div>`;
}

function sh(title: string): string {
    return `<div class="section-header">${title}</div>`;
}

function buildHtml(analysis: NeedsAnalysis, company: Companies): string {
    const days = parseDays(analysis.trainingDays);

    const legalRepFunction = analysis.legalRepFunction ?? '';
    const secteurs = (analysis.companySectors ?? []).join(', ');
    const descriptionActivite = analysis.companyDescription ?? '';
    const missionsType = (analysis.jobDescriptionMissions ?? []).join(', ');
    const descriptifMissions = analysis.jobDescriptionOther ?? '';
    const conditions = (analysis.scheduleOptions ?? []).join(', ');
    const commentaires = analysis.additionalComments ?? '';

    const daysRows = Object.entries(days)
        .map(
            ([day, val]) =>
                `<div class="day-row"><span class="bullet">●</span>&nbsp;<strong>${day}&nbsp;:</strong> ${val}</div>`,
        )
        .join('');

    const missionItems = (analysis.selectedMissions ?? []).map((m) => `<li>${esc(m)}</li>`).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    color: #000;
    background: #fff;
  }

  h1.main-title {
    text-align: center;
    font-size: 15pt;
    font-weight: bold;
    margin-bottom: 20px;
  }

  .section-header {
    background: #EBEBEB;
    border: 1px solid #888;
    padding: 5px 10px;
    font-weight: bold;
    font-size: 10.5pt;
    margin: 18px 0 12px;
  }

  .field-row { margin-bottom: 15px; }
  .field-label { font-weight: bold; }
  .field-value { font-weight: normal; }

  .hint {
    font-size: 9pt;
    color: #555;
    font-style: italic;
    display: block;
    margin-bottom: 4px;
  }

  .text-area {
    min-height: 36px;
    border-bottom: 1px solid #888;
    padding-bottom: 4px;
    white-space: pre-wrap;
    font-size: 10.5pt;
    line-height: 1.6;
  }

  .inline-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 15px;
  }
  .option { margin-right: 20px; white-space: nowrap; }

  .option-block { margin-left: 20px; line-height: 1.9; font-size: 10.5pt; }
  .day-row      { margin-left: 18px; line-height: 2;   font-size: 10.5pt; }

  .legal-text p {
    font-size: 10pt;
    margin-bottom: 10px;
    text-align: justify;
    line-height: 1.5;
  }

  .contacts-section { font-size: 9pt; margin-top: 14px; line-height: 1.6; }
  .contacts-section .contacts-title { font-size: 10.5pt; font-weight: bold; margin-bottom: 10px; }
  .contacts-section .site-title { font-weight: bold; margin: 10px 0 3px; }
  .contacts-section ul { margin-left: 16px; list-style: none; }
  .contacts-section ul li::before { content: "- "; }
  .contacts-section ul li { margin-bottom: 2px; }

  .missions-list { margin: 6px 0 6px 20px; list-style: disc; font-size: 10pt; line-height: 1.8; }

  .sig-section { margin-top: 50px; }
  .sig-section p { font-weight: bold; font-size: 11pt; margin-bottom: 24px; }

  .page-break { break-before: page; }
</style>
</head>
<body>

<!-- ═══ PAGE 1 — Identités ═══ -->
<h1 class="main-title">Analyse du besoin de l'entreprise</h1>

${sh("Identité de l'entreprise")}
${fr('Dénomination ou raison sociale :', company.name)}
${fr('Numéro SIRET du siège social :', company.siret)}
${fr('Adresse du siège social :', company.address)}
${company.ape ? fr('Code APE :', company.ape) : ''}
${company.idcc ? fr('IDCC :', company.idcc) : ''}

${sh('Informations du représentant légal')}
${fr('Nom et prénom du représentant légal :', company.legalReferent)}
${legalRepFunction ? fr('Fonction du représentant légal :', legalRepFunction) : ''}
${fr('Téléphone du représentant légal :', company.phone)}
${fr('Courriel du représentant légal :', company.email)}

${sh(
    'Informations du responsable de recrutement <em style="font-weight:normal;font-size:9.5pt;">(si différent du représentant légal)</em>',
)}
${fr('Nom et prénom du responsable de recrutement :', analysis.recruitmentResponsibleName)}
${fr('Téléphone du responsable de recrutement :', analysis.recruitmentResponsiblePhone)}
${fr('Courriel du responsable de recrutement :', analysis.recruitmentResponsibleEmail)}

<!-- ═══ PAGE 2 — Entreprise & Poste ═══ -->
<div class="page-break">
${sh("A propos de l'entreprise")}
<div class="field-row">
    <span class="field-label">Présentation de l'activité de l'entreprise :</span><br/>
    <span class="hint">(Brève description de l'activité principale de l'entreprise, des secteurs concernés, et de sa mission globale.)</span>
    <div class="text-area">${
        [esc(company.mainActivity), esc(descriptionActivite)].filter(Boolean).join('\n') || '&nbsp;'
    }</div>
</div>
${secteurs ? fr("Secteur(s) d'activité :", secteurs) : company.sector ? fr("Secteur d'activité :", company.sector) : ''}
${fr('Nombre de poste à pourvoir :', analysis.positionsCount?.toString())}
${fr('Localisation du poste à pourvoir :', label(analysis.localisation))}

${sh('Exigences du poste à pourvoir')}
${fr('Intitulé du métier :', analysis.jobTitle)}
<div class="field-row">
    <span class="field-label">Description des missions :</span><br/>
    <span class="hint">(Détailler les principales responsabilités et tâches associées au poste)</span>
    ${missionItems ? `<ul class="missions-list">${missionItems}</ul>` : ''}
    ${missionsType ? `<div class="text-area" style="margin-top:4px;">${esc(missionsType)}</div>` : ''}
    ${descriptifMissions ? `<div class="text-area" style="margin-top:4px;">${esc(descriptifMissions)}</div>` : ''}
    ${!missionItems && !missionsType && !descriptifMissions ? '<div class="text-area">&nbsp;</div>' : ''}
</div>
<div class="field-row">
    <span class="field-label">Profils recherchés, compétences et savoir-être requises (techniques, comportementales, soft skills) :</span><br/>
    <span class="hint">(Préciser les formations et expériences professionnelles souhaitées, compétences techniques spécifiques requises, qualités personnelles recherchées, etc.)</span>
    <div class="text-area">${esc(analysis.softSkills) || '&nbsp;'}</div>
</div>
<div class="field-row">
    <span class="field-label">Commentaires supplémentaires :</span><br/>
    <span class="hint">(Précisions sur les horaires, les salaires, les avantages éventuels, etc.)</span>
    <div class="text-area">${[esc(conditions), esc(commentaires)].filter(Boolean).join('\n') || '&nbsp;'}</div>
</div>
</div>

<!-- ═══ PAGE 3 — Exigences apprenti ═══ -->
<div class="page-break">
${sh("Exigences de l'apprenti")}

<div class="inline-row">
    <span class="field-label">Domaine de formation :</span>
    <span class="option">${chk(analysis.trainingDomain === 'SECRETARIAT')}&nbsp;Secrétariat</span>
    <span class="option">${chk(analysis.trainingDomain === 'VENTE')}&nbsp;Vente</span>
</div>

<div class="inline-row">
    <span class="field-label">Niveau de formation</span>
    <span class="option">${chk(analysis.educationLevel === 'BAC')}&nbsp;Niveau Bac</span>
    <span class="option">${chk(analysis.educationLevel === 'BAC_PLUS_2')}&nbsp;Niveau Bac + 2</span>
    <span class="option">${chk(analysis.educationLevel === 'BAC_PLUS_3')}&nbsp;Niveau Bac + 3</span>
</div>

<div class="field-row">
    <span class="field-label">Permis :</span><br/>
    <div class="option-block">${chk(analysis.drivingLicense === 'OUI')}&nbsp;Oui</div>
    <div class="option-block">${chk(analysis.drivingLicense === 'OPTIONNEL')}&nbsp;Optionnel</div>
</div>

<div class="field-row">
    <span class="field-label">Expérience requis :</span><br/>
    <div class="option-block">${chk(analysis.experienceRequired === 'DEBUTANT')}&nbsp;Débutant</div>
    <div class="option-block">${chk(analysis.experienceRequired === 'OBLIGATOIRE')}&nbsp;Obligatoire</div>
</div>

<div class="field-row">
    <span class="field-label">Âge exigé de l'apprenti :</span><br/>
    <div class="option-block">${chkIn('18 à 20 ans', analysis.ageRequirements ?? [])}&nbsp;18 à 20 ans</div>
    <div class="option-block">${chkIn('21 à 25 ans', analysis.ageRequirements ?? [])}&nbsp;21 à 25 ans</div>
    <div class="option-block">${chkIn('26 à 29 ans', analysis.ageRequirements ?? [])}&nbsp;26 à 29 ans</div>
</div>

<div class="field-row">
    <span class="field-label">Méthode de recrutement :</span><br/>
    <div class="option-block">${chk(analysis.recruitmentMethod === 'ALL_CV')}&nbsp;Réception de tous les CV</div>
    <div class="option-block">${chk(
        analysis.recruitmentMethod === 'PRESELECTION',
    )}&nbsp;Présélection des CV par le centre de formation</div>
    <div class="option-block">${chk(
        analysis.recruitmentMethod === 'PRE_INTERVIEW',
    )}&nbsp;Pré-entretien des CV par le centre de formation</div>
</div>

<div class="field-row">
    <span class="field-label">Souhaitez-vous proposer une période d'immersion (PMSMP) avant la signature du contrat d'apprentissage :</span><br/>
    <div class="option-block">${chk(analysis.immersionPeriod === 'OUI')}&nbsp;Oui</div>
    <div class="option-block">${chk(analysis.immersionPeriod === 'NON')}&nbsp;Non</div>
    <div class="option-block">${chk(analysis.immersionPeriod === 'A_DISCUTER')}&nbsp;A discuter ensemble</div>
</div>

<div class="field-row">
    <span class="field-label">Jours de formation possible : (Oui / Non / Préféré)</span><br/>
    <div style="margin-top:4px;">${daysRows}</div>
</div>

${sh("Engagement sur l'évolution des missions")}
<div class="field-row">
    <p style="font-weight:bold;margin-bottom:8px;">L'entreprise reconnaît que les missions confiées à l'apprenti pourront :</p>
    <div class="option-block">○&nbsp;<strong>Évoluer progressivement</strong> en fonction de sa montée en compétences.</div>
    <div class="option-block">○&nbsp;<strong>Être adaptées</strong> afin de rester en cohérence avec le parcours de formation suivi.</div>
    <div class="option-block" style="max-width:95%;">○&nbsp;<strong>Faire l'objet de réajustements</strong> en accord avec le centre de formation, dans un souci de complémentarité entre la pratique en entreprise et les enseignements dispensés.</div>
</div>
</div>

<!-- ═══ PAGE 4 — Clause légale & Contacts ═══ -->
<div class="page-break">
${sh('Clause de non-engagement et de confidentialité')}
<div class="legal-text">
    <p>Ce document est fourni à titre informatif et ne constitue en aucun cas un engagement obligatoire de la part de l'entreprise. DISCIPLINA s'engage à respecter la confidentialité des données reçues et garantit que celles-ci ne seront utilisées que dans le cadre du processus de recrutement décrit.</p>
    <p>Les informations contenues dans ce document, ainsi que toutes les données échangées (y compris, mais sans s'y limiter, les CV, les lettres de motivation et autres documents personnels transmis), sont strictement confidentielles. Les informations personnelles, notamment les CV, ne peuvent être utilisées à d'autres fins ni être partagées avec des tiers sans le consentement explicite des personnes concernées.</p>
    <p>De la même manière, nous demandons aux destinataires de ce document et des données transmises de respecter ces mêmes obligations de confidentialité. Toute utilisation non autorisée des données personnelles, y compris l'utilisation des CV à des fins autres que celles définies dans le cadre de cette collaboration, est formellement interdite et pourrait donner lieu à des sanctions.</p>
    <p>Ce texte clarifie que le document n'a pas de caractère contraignant tout en soulignant l'importance de la confidentialité des données, notamment celles relatives aux candidats.</p>
</div>

<div class="contacts-section">
    <p class="contacts-title">Contacts</p>
    <p class="site-title">Fonction centrale : 8 rue Pondichéry, ZI La Mare, 97438 Ste Marie</p>
    <ul>
        <li>Lorenzo ENCATASSAMY en qualité de Directeur : direction@disciplina.re / 0693 85 59 91</li>
    </ul>
    <p class="site-title">DISCIPLINA Nord : 8 rue Pondichéry, ZI La Mare, 97438 Ste Marie</p>
    <ul>
        <li>Amanda SINAMAN en qualité de Responsable Commerciale : sinaman.commercial@disciplina.re / 0693 00 76 91</li>
        <li>Brandon GALMAR en qualité de Commercial : galmar.commercial@disciplina.re / 0693 39 52 07</li>
        <li>Emile LEBON en qualité de Commercial : lebon.commercial@disciplina.re / 0692 39 66 29</li>
        <li>Loïc GRONDIN en qualité de Responsable de recrutement : grondin.rh@disciplina.re / 0693 88 00 20</li>
        <li>Marion GOUARD en qualité d'Assistante de recrutement : gouard.rh@disciplina.re / 0692 44 37 99</li>
        <li>Séverine DUGAIN en qualité de Responsable administrative : dugain.administration@disciplina.re / 0693 88 00 20</li>
        <li>Sébastien COUVIN en qualité de Responsable pédagogique CFA et OF : couvin.pedagogie@disciplina.re / 0692 23 22 98</li>
        <li>Emmanuella MAONDA en qualité de Coordinatrice pédagogique CFA : maonda.pedagogie@disciplina.re / 0692 40 42 93</li>
        <li>Samantha BERTILLE en qualité d'Assistante pédagogique CFA : bertille.pedagogie@disciplina.re / 0692 52 38 75</li>
        <li>Rachelle ADAVAMIS en qualité d'Assistante pédagogique OF : adavamis.of@disciplina.re / 0693 06 23 12</li>
    </ul>
    <p class="site-title">DISCIPLINA Ouest : 14 rue Jules Thirel, 97460 Saint-Paul</p>
    <ul>
        <li>Marion LAURET en qualité de Responsable Commerciale : lauret.commercial@disciplina.re / 0693 06 92 01</li>
        <li>Martin HARDIER en qualité de Commercial : hardier.commercial@disciplina.re / 0693 06 92 04</li>
        <li>Lucas MADELEINE en qualité de Commercial : madeleine.commercial@disciplina.re / 0693 06 92 03</li>
        <li>Célia GALAIS en qualité de Responsable de recrutement : galais.rh@disciplina.re / 0693 06 92 20</li>
        <li>Alice NATIVEL en qualité d'Assistante de recrutement : nativel.rh@disciplina.re / 0692 44 37 99</li>
        <li>Mayli ARMOUET en qualité d'Assistante de recrutement : armouet.rh@disciplina.re / 0693 06 92 21</li>
        <li>Alexia TURPIN en qualité de Responsable administrative : turpin.administration@disciplina.re / 06 93 06 92 13</li>
        <li>Emma NIRLO en qualité de Coordinatrice pédagogique CFA : nirlo.pedagogie@disciplina.re / 0693 06 92 17</li>
        <li>Nolwenn ALEX en qualité d'Assistante pédagogique CFA : alex.pedagogie@disciplina.re / 0692 51 78 51</li>
    </ul>
    <p class="site-title">DISCIPLINA Sud : 249 avenue du Général de Gaulle, 97410 Saint-Pierre</p>
    <ul>
        <li>Céline BOYER en qualité de Responsable de recrutement : boyer.rh@disciplina.re / 0693 88 80 23</li>
    </ul>
</div>

<div style="display:flex;justify-content:flex-end;margin-top:36px;">
    <div style="width:48%;border-top:1px solid #888;padding-top:12px;">
        <p style="font-weight:bold;font-size:10.5pt;margin-bottom:14px;">Fait à :</p>
        <p style="font-weight:bold;font-size:10.5pt;margin-bottom:32px;">Le :</p>
        <p style="font-weight:bold;font-size:10.5pt;">Signature et cachet de l'entreprise</p>
        <div style="height:60px;"></div>
    </div>
</div>
</div>


</body>
</html>`;
}

// ─── PdfService ───────────────────────────────────────────────────────────────

export class PdfService {
    static generateCandidatePdf(candidate: Candidate): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                doc.fontSize(20).text(`Dossier Candidat : ${candidate.identity.full_name}`, { align: 'center' });
                doc.moveDown();

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

                if (candidate.education?.school_level || candidate.background?.last_diploma) {
                    doc.fontSize(16).text('Parcours', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    if (candidate.education?.school_level)
                        doc.text(`Niveau d'étude : ${candidate.education.school_level}`);
                    if (candidate.background?.last_diploma)
                        doc.text(`Dernier diplôme : ${candidate.background.last_diploma}`);
                    doc.moveDown();
                }

                if (candidate.profile) {
                    doc.fontSize(16).text('Profil', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    if (candidate.profile.qualities?.length)
                        doc.text(`Qualités : ${candidate.profile.qualities.join(', ')}`);
                    if (candidate.profile.defects?.length)
                        doc.text(`Axes d'amélioration : ${candidate.profile.defects.join(', ')}`);
                    doc.moveDown();
                }

                if (candidate.professional_projects?.career_objectives) {
                    doc.fontSize(16).text('Projet Professionnel', { underline: true });
                    doc.fontSize(12).moveDown(0.5);
                    doc.text(`Objectifs : ${candidate.professional_projects.career_objectives}`);
                    doc.moveDown();
                }

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

    static async generateNeedsAnalysisPdf(analysis: NeedsAnalysis, company: Companies): Promise<Buffer> {
        const logoDataUrl = getLogoDataUrl();
        const html = buildHtml(analysis, company);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        let dynamicPdfBytes: Buffer;
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'domcontentloaded' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: buildHeaderTemplate(logoDataUrl),
                footerTemplate: buildFooterTemplate(),
                margin: { top: '38mm', right: '18mm', bottom: '25mm', left: '18mm' },
            });

            dynamicPdfBytes = Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }

        return dynamicPdfBytes;
    }
}
