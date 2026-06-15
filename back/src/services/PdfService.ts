import type { Browser } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { Candidate } from '../types/candidate.types';
import { Companies } from '../types/company.types';
import { NeedsAnalysis } from '../types/needsAnalysis.types';

// ─── Browser launcher ─────────────────────────────────────────────────────────
// Sur Vercel/Lambda (pas de Chromium système), on utilise @sparticuz/chromium
// avec puppeteer-core. En local, on garde le Chromium fourni par puppeteer.
async function launchBrowser(): Promise<Browser> {
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

    if (isServerless) {
        const chromium = (await import('@sparticuz/chromium')).default;
        const puppeteerCore = (await import('puppeteer-core')).default;
        return puppeteerCore.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        }) as unknown as Promise<Browser>;
    }

    // Indirection volontaire: empêche le bundler Vercel (nft) d'embarquer le
    // gros paquet `puppeteer` dans la fonction serverless (jamais utilisé là-bas).
    const localModule = 'puppeteer';
    const puppeteer = (await import(localModule)).default;
    return puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    }) as unknown as Promise<Browser>;
}

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
    const conditions = analysis.conditions ?? (analysis.scheduleOptions ?? []).join(', ');
    const commentaires = analysis.additionalComments ?? '';

    // Legacy rows have no positions array: rebuild one from the single-position columns
    const positions = (analysis.positions?.length ? analysis.positions : [{
        trainingDomain: analysis.trainingDomain,
        jobTitle: analysis.jobTitle,
        selectedMissions: analysis.selectedMissions ?? [],
        localisation: analysis.localisation,
    }]);

    const positionBlocks = positions.map((p, i) => {
        const title = positions.length > 1 ? `Poste ${i + 1} sur ${positions.length}` : 'Exigences du poste à pourvoir';
        const missionItems = (p.selectedMissions ?? []).map((m) => `<li>${esc(m)}</li>`).join('');
        return `
${sh(title)}
${fr('Intitulé de la formation :', p.jobTitle)}
<div class="inline-row">
    <span class="field-label">Domaine de formation :</span>
    <span class="option">${chk(p.trainingDomain === 'SECRETARIAT')}&nbsp;Secrétariat</span>
    <span class="option">${chk(p.trainingDomain === 'VENTE')}&nbsp;Vente</span>
</div>
${fr('Localisation du poste :', label(p.localisation))}
<div class="field-row">
    <span class="field-label">Description des missions :</span><br/>
    <span class="hint">(Détailler les principales responsabilités et tâches associées au poste)</span>
    ${missionItems ? `<ul class="missions-list">${missionItems}</ul>` : '<div class="text-area">&nbsp;</div>'}
</div>`;
    }).join('');

    const ageLine = analysis.ageMin || analysis.ageMax
        ? [analysis.ageMin ? `de ${analysis.ageMin} ans` : '', analysis.ageMax ? `à ${analysis.ageMax} ans` : ''].filter(Boolean).join(' ')
        : (analysis.ageRequirements ?? []).join(', ');

    const daysRows = Object.entries(days)
        .map(
            ([day, val]) =>
                `<div class="day-row"><span class="bullet">●</span>&nbsp;<strong>${day}&nbsp;:</strong> ${val}</div>`,
        )
        .join('');

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

${positionBlocks}
${missionsType || descriptifMissions ? `
<div class="field-row">
    <span class="field-label">Description complémentaire des missions :</span><br/>
    ${missionsType ? `<div class="text-area" style="margin-top:4px;">${esc(missionsType)}</div>` : ''}
    ${descriptifMissions ? `<div class="text-area" style="margin-top:4px;">${esc(descriptifMissions)}</div>` : ''}
</div>` : ''}
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

${ageLine ? fr("Âge exigé de l'apprenti :", ageLine) : ''}

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

</div>

<!-- ═══ PAGE 4 — Contacts ═══ -->
<div class="page-break">
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
</div>

<!-- ═══ PAGE 5 — Engagement, clause & signature ═══ -->
<div class="page-break">
${sh("Engagement sur l'évolution des missions")}
<div class="field-row">
    <p style="font-weight:bold;margin-bottom:8px;">L'entreprise reconnaît que les missions confiées à l'apprenti pourront :</p>
    <div class="option-block">●&nbsp;<strong>Évoluer progressivement</strong> en fonction de sa montée en compétences.</div>
    <div class="option-block">●&nbsp;<strong>Être adaptées</strong> afin de rester en cohérence avec le parcours de formation suivi.</div>
    <div class="option-block" style="max-width:95%;">●&nbsp;<strong>Faire l'objet de réajustements</strong> en accord avec le centre de formation, dans un souci de complémentarité entre la pratique en entreprise et les enseignements dispensés.</div>
</div>

${sh('Clause de non-engagement et de confidentialité')}
<div class="legal-text">
    <p>Les informations recueillies dans ce document sont strictement confidentielles et ne seront utilisées qu'à des fins de recrutement en apprentissage. La présente analyse du besoin ne constitue pas un engagement ferme de l'entreprise ni du centre de formation. Elle formalise uniquement l'intention d'explorer un parcours d'alternance sous réserve d'éligibilité des candidats et d'accord de financement OPCO. Toute diffusion des informations contenues dans ce document à des tiers est interdite sans accord préalable écrit des deux parties.</p>
    <p>En signant ce document, l'entreprise reconnaît avoir pris connaissance de l'engagement sur l'évolution des missions et de la présente clause, et les accepte.</p>
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

// ─── Candidate AB (Analyse du Besoin) HTML builder ────────────────────────────

const TP_LABELS: Record<string, string> = {
    AD: 'AD — Assistant de Direction',
    CC: 'CC — Conseiller Commercial',
    NTC: 'NTC — Négociateur Technico-Commercial',
    REM: "REM — Responsable d'Établissement Marchand",
    SA: 'SA — Secrétaire Assistant',
};

const STATUS_LABELS: Record<string, string> = {
    SEEKING: 'En recherche',
    NOT_SEEKING: 'Ne recherche pas',
    CANCELLED: 'Rupture',
    MATCHED: 'En relation',
    CONTRACTED: 'Sous contrat',
    IMMERSING: 'En immersion',
    BANNED: 'Banni',
};

const SCHOOL_LEVEL_LABELS: Record<string, string> = {
    CAP_BEP_WITH_1Y_EXP: "CAP / BEP avec 1 an d'expérience",
    PREMIERE_TERMINALE: 'Première / Terminale',
    PREMIERE_TERMINALE_WITH_1Y_EXP: "Première / Terminale avec 1 an d'expérience",
    BAC: 'Bac',
    BAC_WITH_1Y_EXP: "Bac avec 1 an d'expérience",
    BAC_PLUS: 'Bac +',
    BAC_PLUS_2: 'Bac + 2',
    BAC_PLUS_2_PLUS: 'Bac + 2 et plus',
    BAC_PLUS_3_PLUS: 'Bac + 3 et plus',
};

const TRAINING_SITE_LABELS: Record<string, string> = {
    NORD_SAINTE_MARIE: 'Nord — Sainte-Marie',
    OUEST_SAINT_PAUL: 'Ouest — Saint-Paul',
    SUD_SAINT_PIERRE: 'Sud — Saint-Pierre',
};

const DISCOVERY_LABELS: Record<string, string> = {
    SOCIAL_MEDIA: 'Réseaux sociaux',
    FRANCE_TRAVAIL: 'France Travail',
    MISSION_LOCALE: 'Mission Locale',
    WORD_OF_MOUTH: 'Bouche à oreille',
    KOANN: 'Koann',
    OTHER: 'Autre',
};

const SKILL_LEVEL_LABELS: Record<string, string> = {
    A: 'Acquis',
    ECA: "En cours d'acquisition",
    NA: 'Non acquis',
    NE: 'Non évalué',
};

const LOCALISATION_LABELS: Record<string, string> = {
    SAINT_DENIS: 'Saint-Denis', SAINTE_MARIE: 'Sainte-Marie', SAINTE_SUZANNE: 'Sainte-Suzanne',
    SAINT_PAUL: 'Saint-Paul', LA_POSSESSION: 'La Possession', LE_PORT: 'Le Port',
    TROIS_BASSINS: 'Trois-Bassins', SAINT_LEU: 'Saint-Leu', SAINT_PIERRE: 'Saint-Pierre',
    CILAOS: 'Cilaos', ETANG_SALE: "L'Étang-Salé", SAINT_LOUIS: 'Saint-Louis',
    ENTRE_DEUX: 'Entre-Deux', LES_AVIRONS: 'Les Avirons', LE_TAMPON: 'Le Tampon',
    SAINT_PHILLIPE: 'Saint-Philippe', SAINT_JOSEPH: 'Saint-Joseph', PETIT_ILE: 'Petite-Île',
    SAINTE_ROSE: 'Sainte-Rose', SAINT_BENOIT: 'Saint-Benoît', BRAS_PANON: 'Bras-Panon',
    SAINT_ANDRE: 'Saint-André', LA_PLAINE_DES_PALMISTES: 'La Plaine-des-Palmistes',
    SALAZIE: 'Salazie', SAINTE_ANNE: 'Sainte-Anne',
};

function fmtDate(d?: Date | string | null): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function yn(v?: boolean | null): string {
    if (v === true) return 'Oui';
    if (v === false) return 'Non';
    return '—';
}

function buildCandidateHtml(c: Candidate): string {
    const id = c.identity;
    const skillRows = (c.skills_assessment ?? [])
        .map(s => `<tr><td>${esc(s.competence)}</td><td class="lvl lvl-${s.level}">${SKILL_LEVEL_LABELS[s.level] ?? s.level}</td></tr>`)
        .join('');

    const expBlocks = (c.background?.professional_experiences ?? [])
        .filter(e => e.position || e.company || e.duration || e.responsibilities)
        .map(e => `
            <div class="exp">
                <div class="exp-head">${esc(e.position) || 'Poste'} ${e.company ? `— <span class="exp-co">${esc(e.company)}</span>` : ''}</div>
                ${e.duration ? `<div class="exp-meta">${esc(e.duration)}</div>` : ''}
                ${e.responsibilities ? `<div class="exp-resp">${esc(e.responsibilities)}</div>` : ''}
            </div>`)
        .join('');

    const chips = (arr?: string[], cls = '') =>
        (arr ?? []).filter(Boolean).map(v => `<span class="chip ${cls}">${esc(v)}</span>`).join('');

    const mobility = (c.job_info?.geographic_mobility ?? []).map(m => LOCALISATION_LABELS[m] ?? m).join(', ');

    const reco = c.synthesis?.pedagogical_recommendations;
    const recoItems: Array<[boolean | undefined, string]> = reco ? [
        [reco.office_tools_reinforcement, 'Renforcement des outils bureautiques'],
        [reco.written_communication_support, 'Soutien à la communication écrite'],
        [reco.oral_confidence_development, "Développement de la confiance à l'oral"],
        [reco.time_management_support, 'Soutien à la gestion du temps'],
        [reco.professional_posture_work, 'Travail sur la posture professionnelle'],
        [reco.enhanced_company_immersion, "Immersion renforcée en entreprise"],
        [reco.psh_specific_support, 'Accompagnement spécifique PSH'],
        [reco.individual_follow_up, 'Suivi individualisé'],
        [reco.language_training, 'Formation linguistique'],
        [reco.stress_management_follow_up, 'Suivi en gestion du stress'],
    ] : [];
    const recoHtml = recoItems.filter(([on]) => on).map(([, lbl]) => `<li>${lbl}</li>`).join('');

    // Construit une ligne d'info "label : value" seulement si value présente
    const row = (lbl: string, val: string | number | null | undefined): string => {
        const v = val === 0 ? '0' : (val ? String(val) : '');
        if (!v) return '';
        return `<div class="info-item"><span class="info-label">${lbl}</span><span class="info-value">${esc(v)}</span></div>`;
    };

    const block = (title: string, body: string): string =>
        body.trim() ? `<div class="section"><div class="section-header">${title}</div>${body}</div>` : '';

    const textField = (lbl: string, val?: string | null): string =>
        val && val.trim() ? `<div class="field"><div class="field-title">${lbl}</div><div class="field-text">${esc(val)}</div></div>` : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #1a1a1a; background: #fff; -webkit-print-color-adjust: exact; }

  .title-band { background: #1130A7; color: #fff; padding: 14px 18px; border-radius: 8px; margin-bottom: 6px; }
  .title-band h1 { font-size: 16pt; font-weight: bold; }
  .title-band .sub { font-size: 9.5pt; opacity: .92; margin-top: 3px; }
  .badges { margin-top: 8px; }
  .badge { display: inline-block; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 8.5pt; font-weight: bold; padding: 2px 9px; border-radius: 20px; margin-right: 6px; }

  .section { margin-top: 16px; break-inside: avoid; }
  .section-header { background: #EEF1FB; border-left: 4px solid #1130A7; color: #1130A7; padding: 6px 12px; font-weight: bold; font-size: 11pt; margin-bottom: 10px; border-radius: 0 4px 4px 0; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 22px; padding: 0 4px; }
  .info-item { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid #ececec; font-size: 10pt; }
  .info-label { color: #666; }
  .info-value { font-weight: bold; text-align: right; }

  .field { padding: 0 4px 8px; }
  .field-title { font-size: 9pt; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 2px; }
  .field-text { font-size: 10pt; line-height: 1.55; white-space: pre-wrap; text-align: justify; }

  .chips { padding: 2px 4px 4px; }
  .chip { display: inline-block; background: #F0F0F0; color: #333; font-size: 9pt; padding: 3px 10px; border-radius: 20px; margin: 0 5px 5px 0; }
  .chip.good { background: #E5F4EA; color: #1f7a3d; }
  .chip.bad  { background: #FBEAEA; color: #b3261e; }
  .chip.tech { background: #EAF0FB; color: #1130A7; }

  table.skills { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.skills td { border: 1px solid #e2e2e2; padding: 6px 10px; }
  table.skills td:first-child { width: 70%; }
  .lvl { font-weight: bold; text-align: center; }
  .lvl-A   { color: #1f7a3d; }
  .lvl-ECA { color: #b8860b; }
  .lvl-NA  { color: #b3261e; }
  .lvl-NE  { color: #888; }

  .exp { border: 1px solid #e8e8e8; border-radius: 6px; padding: 8px 11px; margin-bottom: 7px; break-inside: avoid; }
  .exp-head { font-weight: bold; font-size: 10pt; }
  .exp-co { color: #1130A7; }
  .exp-meta { font-size: 9pt; color: #777; margin-top: 1px; }
  .exp-resp { font-size: 9.5pt; margin-top: 4px; line-height: 1.5; }

  ul.reco { margin: 0 4px; padding-left: 18px; line-height: 1.8; font-size: 10pt; }
</style>
</head>
<body>

  <div class="title-band">
    <h1>${esc(id.full_name)}</h1>
    <div class="sub">Analyse du Besoin — Dossier candidat${id.email ? ` · ${esc(id.email)}` : ''}${id.phone ? ` · ${esc(id.phone)}` : ''}</div>
    <div class="badges">
      <span class="badge">${TP_LABELS[c.tp_type] ? esc(c.tp_type) : esc(c.tp_type)}</span>
      <span class="badge">${esc(STATUS_LABELS[c.status] ?? c.status)}</span>
      ${c.training_site ? `<span class="badge">${esc(TRAINING_SITE_LABELS[c.training_site] ?? c.training_site)}</span>` : ''}
    </div>
  </div>

  ${block('Identité &amp; contact', `<div class="info-grid">
    ${row('Titre professionnel', TP_LABELS[c.tp_type] ?? c.tp_type)}
    ${row('Statut', STATUS_LABELS[c.status] ?? c.status)}
    ${row('Email', id.email)}
    ${row('Téléphone', id.phone)}
    ${row('Date de naissance', fmtDate(id.date_of_birth))}
    ${row('Lieu de naissance', id.place_of_birth)}
    ${row('Âge', id.age ? `${id.age} ans` : '')}
    ${row('Ville', id.city)}
    ${row('Code postal', id.postal_code)}
    ${row('Permis B', id.driving_license_b == null ? '' : yn(id.driving_license_b))}
    ${row('Moyen de transport', id.transport_means)}
    ${row('Accompagnement PSH', id.psh_referral_request == null ? '' : yn(id.psh_referral_request))}
  </div>`)}

  ${block('Parcours &amp; prérequis', `<div class="info-grid">
    ${row('Niveau de formation', c.education?.school_level ? (SCHOOL_LEVEL_LABELS[c.education.school_level] ?? c.education.school_level) : '')}
    ${row('Justificatif', c.education?.justification)}
    ${row('Dernier diplôme', c.background?.last_diploma)}
    ${row('Site de formation', c.training_site ? (TRAINING_SITE_LABELS[c.training_site] ?? c.training_site) : '')}
  </div>${textField('Formations suivies auparavant', c.background?.previous_trainings)}`)}

  ${block('Accompagnement &amp; dispositifs', `<div class="info-grid">
    ${row('Inscrit à France Travail', c.support?.france_travail_registered == null ? '' : yn(c.support.france_travail_registered))}
    ${row('Agence France Travail', c.support?.france_travail_agency)}
    ${row('Inscrit à la Mission Locale', c.support?.mission_locale_registered == null ? '' : yn(c.support.mission_locale_registered))}
    ${row('Ville Mission Locale', c.support?.mission_locale_city)}
    ${row("Accord pour une immersion", c.immersion_agreement == null ? '' : yn(c.immersion_agreement))}
  </div>`)}

  ${block('Expériences professionnelles', expBlocks)}

  ${block('Profil', `<div class="info-grid">
    ${row('Niveau de français', c.profile?.french_level != null ? `${c.profile.french_level}/10` : '')}
    ${row('Niveau d\'anglais', c.profile?.english_level != null ? `${c.profile.english_level}/10` : '')}
    ${row('Autres langues', (c.profile?.other_languages ?? []).join(', '))}
    ${row('Prêt(e) à relever des défis', c.profile?.ready_for_challenges == null ? '' : yn(c.profile.ready_for_challenges))}
  </div>
  ${c.profile?.qualities?.length ? `<div class="field"><div class="field-title">Qualités</div><div class="chips">${chips(c.profile.qualities, 'good')}</div></div>` : ''}
  ${c.profile?.defects?.length ? `<div class="field"><div class="field-title">Axes d'amélioration</div><div class="chips">${chips(c.profile.defects, 'bad')}</div></div>` : ''}
  ${c.profile?.digital_skills?.length ? `<div class="field"><div class="field-title">Compétences numériques</div><div class="chips">${chips(c.profile.digital_skills, 'tech')}</div></div>` : ''}
  ${textField('Points forts &amp; axes d\'amélioration', c.profile?.strengths_and_improvements)}
  ${textField('Hobbies / passions', c.profile?.hobbies)}`)}

  ${block('Projets professionnels', `
    ${textField('Objectifs de carrière', c.professional_projects?.career_objectives)}
    ${textField('Compétences souhaitées', c.professional_projects?.desired_skills)}
    ${textField("Motivations pour l'apprentissage", c.professional_projects?.apprenticeship_motivation)}
    ${textField('Attentes vis-à-vis de la formation', c.professional_projects?.training_expectations)}`)}

  ${block('Analyse des compétences', skillRows ? `<table class="skills"><tbody>${skillRows}</tbody></table>` : '')}

  ${block('Informations sur le poste', `<div class="info-grid">
    ${row('Date de disponibilité', fmtDate(c.job_info?.availability_date))}
    ${row('Mobilité géographique', mobility)}
    ${row('Travail le week-end gênant', c.job_info?.weekend_work == null ? '' : yn(c.job_info.weekend_work))}
    ${row('Comment a connu Disciplina', c.job_info?.discovery_source ? (DISCOVERY_LABELS[c.job_info.discovery_source] ?? c.job_info.discovery_source) : '')}
  </div>
  ${textField('Motivation pour ce domaine', c.job_info?.domain_motivation)}
  ${textField('Questions / préoccupations', c.job_info?.questions_concerns)}
  ${(c.desired_sectors?.length) ? `<div class="field"><div class="field-title">Secteurs souhaités</div><div class="chips">${chips(c.desired_sectors)}</div></div>` : ''}
  ${(c.expected_company_skills?.length) ? `<div class="field"><div class="field-title">Compétences attendues en entreprise</div><div class="chips">${chips(c.expected_company_skills, 'tech')}</div></div>` : ''}`)}

  ${block('Synthèse', `
    ${textField('Conclusion de faisabilité', c.synthesis?.feasibility_conclusion)}
    ${textField('Pertinence du parcours', c.synthesis?.pathway_relevance)}
    ${textField('Besoins spécifiques', c.synthesis?.special_needs)}
    ${recoHtml ? `<div class="field"><div class="field-title">Recommandations pédagogiques</div><ul class="reco">${recoHtml}</ul></div>` : ''}
    ${textField('Autres recommandations', c.synthesis?.other_recommendations)}`)}

</body>
</html>`;
}

// ─── PdfService ───────────────────────────────────────────────────────────────

export class PdfService {
    static async generateCandidatePdf(candidate: Candidate): Promise<Buffer> {
        const logoDataUrl = getLogoDataUrl();
        const html = buildCandidateHtml(candidate);

        const browser = await launchBrowser();

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'domcontentloaded' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: buildHeaderTemplate(logoDataUrl),
                footerTemplate: buildFooterTemplate(),
                margin: { top: '38mm', right: '16mm', bottom: '25mm', left: '16mm' },
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    static async generateNeedsAnalysisPdf(analysis: NeedsAnalysis, company: Companies): Promise<Buffer> {
        const logoDataUrl = getLogoDataUrl();
        const html = buildHtml(analysis, company);

        const browser = await launchBrowser();

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
