import type { Browser } from 'puppeteer-core';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Candidate } from '../types/candidate.types';
import { Companies } from '../types/company.types';
import { NeedsAnalysisGql } from './mappers/needsAnalysis.mapper';

// ─── Browser launcher ─────────────────────────────────────────────────────────
// On utilise le Chromium natif du système (installé dans l'image Docker via apt)
// piloté par `puppeteer-core`. Le binaire est donc toujours à la bonne
// architecture (amd64 ou arm64), ce qui évite l'erreur Rosetta
// « failed to open elf at /lib64/ld-linux-x86-64.so.2 » sous Apple Silicon.
//
// Le chemin de l'exécutable est configurable via PUPPETEER_EXECUTABLE_PATH
// (défini dans le Dockerfile), avec un fallback sur les emplacements standards.
//
// Import dynamique natif : `puppeteer-core` est un module ESM-only. Avec
// TypeScript en CommonJS, un `import()` classique est transpilé en `require()`
// (→ ERR_REQUIRE_ESM). Passer par `Function` empêche cette transpilation et
// conserve un vrai `import()` ESM à l'exécution.
const nativeImport: (specifier: string) => Promise<any> = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
) => Promise<any>;

async function importEsm(specifier: string): Promise<any> {
    try {
        return await nativeImport(specifier);
    } catch {
        // Fallback pour vitest/VM contextes où new Function + import() ne
        // fonctionne pas (["A dynamic import callback was not specified"]).
        return await import(specifier);
    }
}

function resolveChromiumPath(): string | undefined {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    const candidates = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
    return candidates.find((p) => fs.existsSync(p));
}

async function launchBrowser(): Promise<Browser> {
    const puppeteerCoreMod = await importEsm('puppeteer-core');
    const puppeteerCore = puppeteerCoreMod.default;
    return puppeteerCore.launch({
        executablePath: resolveChromiumPath(),
        headless: true,
        // --no-sandbox est requis pour tourner en conteneur (pas de namespaces user).
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    }) as unknown as Promise<Browser>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(v: string | null | undefined): string {
    if (!v) return '';
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCommunes(communes: readonly string[] | null | undefined): string {
    return (communes ?? [])
        .map((commune) =>
            commune
                .split('_')
                .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
                .join('-'),
        )
        .join(', ');
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
        AKTO: 'AKTO',
        ATLAS: 'ATLAS',
        AFDAS: 'Afdas',
        CONSTRUCTYS: 'Constructys',
        OCAPIAT: 'OCAPIAT',
        OPCO_2I: 'Opco 2i',
        OPCO_EP: 'Opco EP',
        OPCO_MOBILITES: 'Opco Mobilités',
        OPCO_SANTE: 'Opco Santé',
        OPCOMMERCE: "L'Opcommerce",
        UNIFORMATION: 'Uniformation',
        KOANN: 'Koann',
        E2CR: 'E2CR',
        FRANCE_TRAVAIL: 'France Travail',
        TELEVISION_PUB: 'Télévision / Pub',
        BOUCHE_A_OREILLE: 'Bouche à oreille',
        MISSION_LOCALE: 'Missions Locale',
        SALON: 'Salon',
        RSMA: 'RSMA',
        RESEAUX_SOCIAUX: 'Réseaux sociaux',
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

// Marqueur radio dessiné en CSS (et non via les glyphes ●/○ Unicode) : sur un
// Chromium headless sans la police adéquate, ○ retombe sur un glyphe plein et
// les deux options paraissent cochées. Un span stylé rend de façon déterministe.
function chk(selected: boolean): string {
    return `<span class="mark${selected ? ' on' : ''}"></span>`;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function getLogoDataUrl(): string {
    // process.cwd() d'abord (fiable dans la lambda Vercel avec includeFiles),
    // __dirname en repli (dev local / `node dist`).
    const candidates = [
        path.join(process.cwd(), 'assets/logo-disciplina.svg'),
        path.join(__dirname, '../../assets/logo-disciplina.svg'),
    ];
    for (const candidate of candidates) {
        try {
            const svgBase64 = fs.readFileSync(candidate).toString('base64');
            return `data:image/svg+xml;base64,${svgBase64}`;
        } catch {
            // chemin suivant
        }
    }
    return '';
}

// ─── Header / Footer templates ────────────────────────────────────────────────

function buildHeaderTemplate(logoDataUrl: string): string {
    const logoHtml = logoDataUrl
        ? `<img src="${logoDataUrl}" style="height:128px;display:block;" />`
        : `<div style="font-size:22px;font-weight:bold;color:#1130A7;">Disciplina</div>`;
    return `
    <div style="width:100%;padding:6px 18mm 0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;">
        ${logoHtml}
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

type PositionTpGql = NonNullable<NeedsAnalysisGql['positions'][number]['desiredTp']>[number];

function buildTpMissionsBlock(tp: PositionTpGql): string {
    const missionItems = (tp.missions ?? []).map((m) => `<li>${esc(m)}</li>`).join('');
    const missionsType = (tp.descriptionMissions ?? []).join(', ');
    const descriptifMissions = tp.otherDescriptionMissions ?? '';
    const complementaire =
        missionsType || descriptifMissions
            ? `
<div class="field-row">
    <span class="field-label">Description complémentaire des missions :</span><br/>
    ${missionsType ? `<div class="text-area" style="margin-top:4px;">${esc(missionsType)}</div>` : ''}
    ${descriptifMissions ? `<div class="text-area" style="margin-top:4px;">${esc(descriptifMissions)}</div>` : ''}
</div>`
            : '';
    return `
${fr('Titre professionnel visé :', TP_LABELS[tp.tpType ?? ''] ?? tp.tpType ?? '')}
<div class="field-row">
    <span class="field-label">Description des missions :</span><br/>
    <span class="hint">(Détailler les principales responsabilités et tâches associées au poste)</span>
    ${missionItems ? `<ul class="missions-list">${missionItems}</ul>` : '<div class="text-area">&nbsp;</div>'}
</div>${complementaire}`;
}

function buildHtml(analysis: NeedsAnalysisGql, company: Companies): string {
    const days = parseDays(analysis.trainingDays ?? '{}');

    const legalRepFunction = analysis.referents?.legalReferents?.function ?? '';
    const secteurs = (analysis.companyInfos?.activities ?? []).join(', ');
    const descriptionActivite = analysis.companyInfos?.description ?? '';

    const positions = analysis.positions ?? [];

    const positionBlocks = positions
        .map((p, i) => {
            const title =
                positions.length > 1 ? `Poste ${i + 1} sur ${positions.length}` : 'Exigences du poste à pourvoir';
            const tpBlocks = (p.desiredTp ?? []).map(buildTpMissionsBlock).join('');
            return `
${sh(title)}
${p.jobRole ? fr('Intitulé de métier :', p.jobRole) : ''}
${fr('Intitulé de la formation :', p.title)}
<div class="inline-row">
    <span class="field-label">Domaine de formation :</span>
    <span class="option">${chk(p.trainingDomain === 'SECRETARIAT')}&nbsp;Secrétariat</span>
    <span class="option">${chk(p.trainingDomain === 'VENTE')}&nbsp;Vente</span>
</div>
${fr('Localisation du poste :', formatCommunes(p.localisation))}
${tpBlocks}`;
        })
        .join('');

    const criteriaBlocks = positions
        .map((p, i) => {
            const c = p.criteria ?? ({} as NonNullable<typeof p.criteria>);
            const title =
                positions.length > 1 ? `Exigences — Poste ${i + 1} sur ${positions.length}` : "Exigences de l'apprenti";
            const ageLine =
                c.ageMin || c.ageMax
                    ? [c.ageMin ? `de ${c.ageMin} ans` : '', c.ageMax ? `à ${c.ageMax} ans` : '']
                          .filter(Boolean)
                          .join(' ')
                    : '';
            const conditions = c.conditions ?? (c.scheduleOptions ?? []).join(', ');
            const commentaires = c.additionalComments ?? '';
            return `
${sh(title)}
<div class="field-row">
    <span class="field-label">Permis :</span><br/>
    <div class="option-block">${chk(c.drivingLicense === true)}&nbsp;Oui</div>
    <div class="option-block">${chk(c.drivingLicense === false)}&nbsp;Optionnel</div>
</div>

<div class="field-row">
    <span class="field-label">Expérience requis :</span><br/>
    <div class="option-block">${chk(c.experienceRequired === false)}&nbsp;Débutant</div>
    <div class="option-block">${chk(c.experienceRequired === true)}&nbsp;Obligatoire</div>
</div>

${ageLine ? fr("Âge exigé de l'apprenti :", ageLine) : ''}
${c.educationLevel ? fr('Niveau de formation :', label(c.educationLevel)) : ''}

<div class="field-row">
    <span class="field-label">Profils recherchés, compétences et savoir-être requises (techniques, comportementales, soft skills) :</span><br/>
    <span class="hint">(Préciser les formations et expériences professionnelles souhaitées, compétences techniques spécifiques requises, qualités personnelles recherchées, etc.)</span>
    <div class="text-area">${esc(c.softSkills) || '&nbsp;'}</div>
</div>
<div class="field-row">
    <span class="field-label">Commentaires supplémentaires :</span><br/>
    <span class="hint">(Précisions sur les horaires, les salaires, les avantages éventuels, etc.)</span>
    <div class="text-area">${[esc(conditions), esc(commentaires)].filter(Boolean).join('\n') || '&nbsp;'}</div>
</div>`;
        })
        .join('');

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

  .mark {
    display: inline-block;
    width: 9px;
    height: 9px;
    border: 1.3px solid #000;
    border-radius: 50%;
    vertical-align: middle;
    position: relative;
    top: -1px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .mark.on { background: #000; }

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

  /* Page signature dédiée : occupe toute la hauteur imprimable (A4 - marges
     haut/bas = 297 - 38 - 25 = 234mm) et épingle le bloc en bas à droite.
     Garantit que la signature est toujours seule sur la DERNIÈRE page, donc
     que le champ DocuSeal (page = lastPage) tombe au bon endroit. */
  .sig-page {
    break-before: page;
    min-height: 234mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-end;
  }
  .sig-page .sig-block { width: 48%; border-top: 1px solid #888; padding-top: 12px; }
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
${fr('Nom et prénom du responsable de recrutement :', analysis.referents?.recruitmentReferents?.name)}
${fr('Téléphone du responsable de recrutement :', analysis.referents?.recruitmentReferents?.phone)}
${fr('Courriel du responsable de recrutement :', analysis.referents?.recruitmentReferents?.email)}

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
${analysis.companyInfos?.opco ? fr('OPCO :', label(analysis.companyInfos.opco)) : ''}
${
    analysis.companyInfos?.referralSource
        ? fr('Comment a-t-il connu DISCIPLINA ? :', label(analysis.companyInfos.referralSource))
        : ''
}
${fr('Nombre de poste à pourvoir :', analysis.positionsCount?.toString())}

${positionBlocks}
</div>

<!-- ═══ PAGE 3 — Exigences apprenti ═══ -->
<div class="page-break">
${criteriaBlocks}

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
</div>

<!-- ═══ PAGE 6 — Signature (page dédiée) ═══
     Bloc isolé sur sa propre page pour qu'il soit toujours bas-droite de la
     DERNIÈRE page, quelle que soit la longueur du contenu précédent.
     Les coordonnées du champ DocuSeal (docuseal.service.ts) ciblent ce bloc. -->
<div class="sig-page">
    <div class="sig-block">
        <p style="font-weight:bold;font-size:10.5pt;margin-bottom:8px;">Signature électronique de l'entreprise</p>
        <div style="height:120px;"></div>
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
    CONTRACT: 'En contrat',
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
    SAINT_DENIS: 'Saint-Denis',
    SAINTE_MARIE: 'Sainte-Marie',
    SAINTE_SUZANNE: 'Sainte-Suzanne',
    SAINT_PAUL: 'Saint-Paul',
    LA_POSSESSION: 'La Possession',
    LE_PORT: 'Le Port',
    TROIS_BASSINS: 'Trois-Bassins',
    SAINT_LEU: 'Saint-Leu',
    SAINT_PIERRE: 'Saint-Pierre',
    CILAOS: 'Cilaos',
    ETANG_SALE: "L'Étang-Salé",
    SAINT_LOUIS: 'Saint-Louis',
    ENTRE_DEUX: 'Entre-Deux',
    LES_AVIRONS: 'Les Avirons',
    LE_TAMPON: 'Le Tampon',
    SAINT_PHILLIPE: 'Saint-Philippe',
    SAINT_JOSEPH: 'Saint-Joseph',
    PETIT_ILE: 'Petite-Île',
    SAINTE_ROSE: 'Sainte-Rose',
    SAINT_BENOIT: 'Saint-Benoît',
    BRAS_PANON: 'Bras-Panon',
    SAINT_ANDRE: 'Saint-André',
    LA_PLAINE_DES_PALMISTES: 'La Plaine-des-Palmistes',
    SALAZIE: 'Salazie',
    SAINTE_ANNE: 'Sainte-Anne',
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

// ─── Candidate AB PDF (pdfkit, pur JS — fonctionne en serverless) ──────────────

function renderCandidatePdf(doc: PDFKit.PDFDocument, c: Candidate): void {
    const BLUE = '#1130A7';
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;
    const bottom = doc.page.height - doc.page.margins.bottom;
    const id = c.identity;

    const ensure = (h: number) => {
        if (doc.y + h > bottom) doc.addPage();
    };

    const section = (title: string) => {
        ensure(46);
        doc.moveDown(0.5);
        const y = doc.y;
        doc.save().rect(left, y, contentW, 20).fill('#EEF1FB').restore();
        doc.save().rect(left, y, 4, 20).fill(BLUE).restore();
        doc.fillColor(BLUE)
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(title, left + 12, y + 5, { width: contentW - 18 });
        doc.y = y + 27;
        doc.fillColor('#000000').font('Helvetica').fontSize(10);
    };

    const kv = (lbl: string, value?: string | number | null) => {
        const v = value === 0 ? '0' : value ? String(value) : '';
        if (!v) return;
        ensure(16);
        doc.font('Helvetica-Bold')
            .fillColor('#555555')
            .fontSize(10)
            .text(`${lbl} : `, left, doc.y, { continued: true });
        doc.font('Helvetica').fillColor('#111111').text(v);
    };

    const para = (lbl: string, value?: string | null) => {
        if (!value || !value.trim()) return;
        ensure(42);
        doc.font('Helvetica-Bold').fillColor('#666666').fontSize(8.5).text(lbl.toUpperCase(), left, doc.y);
        doc.moveDown(0.15);
        doc.font('Helvetica').fillColor('#111111').fontSize(10).text(value.trim(), { align: 'justify' });
        doc.moveDown(0.4);
    };

    const listLine = (lbl: string, arr?: string[]) => {
        const items = (arr ?? []).filter(Boolean);
        if (items.length) kv(lbl, items.join(' · '));
    };

    // ── Bandeau titre ──
    const bandTop = doc.y;
    const bandH = 58;
    doc.save().rect(left, bandTop, contentW, bandH).fill(BLUE).restore();
    doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(id.full_name, left + 14, bandTop + 10, { width: contentW - 28 });
    const sub = `Analyse du Besoin${id.email ? '   ·   ' + id.email : ''}${id.phone ? '   ·   ' + id.phone : ''}`;
    doc.fillColor('#dfe4f6')
        .font('Helvetica')
        .fontSize(9)
        .text(sub, left + 14, bandTop + 35, { width: contentW - 28 });
    doc.y = bandTop + bandH + 12;

    const trainingSites = c.training_sites?.length ? c.training_sites : c.training_site ? [c.training_site] : [];
    const trainingSitesLabel = trainingSites.map((s) => TRAINING_SITE_LABELS[s] ?? s).join(' · ');
    const tpTypes = c.tp_types?.length ? c.tp_types : c.tp_type ? [c.tp_type] : [];
    const tpTypesLabel = tpTypes.map((t) => TP_LABELS[t] ?? t).join(' · ');
    const badges = [tpTypesLabel || (TP_LABELS[c.tp_type] ?? c.tp_type), STATUS_LABELS[c.status] ?? c.status];
    if (trainingSitesLabel) badges.push(trainingSitesLabel);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE).text(badges.join('      |      '), left, doc.y);
    doc.fillColor('#000000');

    // ── Identité ──
    section('Identité & contact');
    kv(tpTypes.length > 1 ? 'Titres professionnels' : 'Titre professionnel', tpTypesLabel);
    kv('Statut', STATUS_LABELS[c.status] ?? c.status);
    kv('Numéro de sécurité sociale', id.social_security_number);
    kv('Email', id.email);
    kv('Téléphone', id.phone);
    kv('Date de naissance', fmtDate(id.date_of_birth));
    kv('Lieu de naissance', id.place_of_birth);
    kv('Département de naissance', id.department_of_birth);
    kv('Âge', id.age ? `${id.age} ans` : '');
    kv('Adresse', id.address);
    kv('Ville', id.city);
    kv('Code postal', id.postal_code);
    if (id.driving_license_b != null) kv('Permis B', yn(id.driving_license_b));
    kv('Moyen de transport', id.transport_means);
    if (id.psh_referral_request != null) kv('Accompagnement PSH', yn(id.psh_referral_request));
    if (id.had_apprenticeship_contract != null)
        kv("A déjà eu un contrat d'apprentissage", yn(id.had_apprenticeship_contract));
    kv("Détail du contrat d'apprentissage", id.apprenticeship_contract_details);
    para('Description (contexte du candidat)', id.description);

    // ── Contact d'urgence ──
    const ec = c.emergency_contact;
    if (ec && (ec.last_name || ec.first_name || ec.relationship || ec.phone || ec.email)) {
        section("Personne à contacter en cas d'urgence");
        kv('Nom', [ec.first_name, ec.last_name].filter(Boolean).join(' '));
        kv('Rôle pour le candidat', ec.relationship);
        kv('Téléphone', ec.phone);
        kv('Email', ec.email);
    }

    // ── Parcours ──
    section('Parcours & prérequis');
    kv(
        'Niveau de formation',
        c.education?.school_level ? (SCHOOL_LEVEL_LABELS[c.education.school_level] ?? c.education.school_level) : '',
    );
    kv('Justificatif', c.education?.justification);
    kv('Dernier diplôme obtenu', c.background?.last_diploma);
    kv('Dernier diplôme préparé', c.background?.last_diploma_prepared);
    kv(trainingSites.length > 1 ? 'Sites de formation' : 'Site de formation', trainingSitesLabel);
    para('Formations suivies auparavant', c.background?.previous_trainings);

    // ── Accompagnement ──
    section('Accompagnement & dispositifs');
    if (c.support?.france_travail_registered != null)
        kv('Inscrit à France Travail', yn(c.support.france_travail_registered));
    kv('Agence France Travail', c.support?.france_travail_agency);
    if (c.support?.mission_locale_registered != null)
        kv('Inscrit à la Mission Locale', yn(c.support.mission_locale_registered));
    kv('Ville Mission Locale', c.support?.mission_locale_city);
    if (c.immersion_agreement != null) kv('Accord pour une immersion', yn(c.immersion_agreement));

    // ── Expériences ──
    const exps = (c.background?.professional_experiences ?? []).filter(
        (e) => e.position || e.company || e.duration || e.responsibilities,
    );
    if (exps.length) {
        section('Expériences professionnelles');
        exps.forEach((e) => {
            ensure(40);
            const head = [e.position, e.company].filter(Boolean).join(' — ') || 'Poste';
            doc.font('Helvetica-Bold').fillColor('#111111').fontSize(10).text(head, left, doc.y);
            if (e.duration) doc.font('Helvetica-Oblique').fillColor('#777777').fontSize(9).text(e.duration);
            if (e.responsibilities)
                doc.font('Helvetica').fillColor('#333333').fontSize(9.5).text(e.responsibilities, { align: 'justify' });
            doc.moveDown(0.5);
        });
    }

    // ── Profil ──
    section('Profil');
    if (c.profile?.french_level != null) kv('Niveau de français', `${c.profile.french_level}/10`);
    if (c.profile?.english_level != null) kv("Niveau d'anglais", `${c.profile.english_level}/10`);
    listLine('Autres langues', c.profile?.other_languages);
    if (c.profile?.ready_for_challenges != null) kv('Prêt(e) à relever des défis', yn(c.profile.ready_for_challenges));
    listLine('Qualités', c.profile?.qualities);
    listLine("Axes d'amélioration", c.profile?.defects);
    listLine('Compétences numériques', c.profile?.digital_skills);
    para("Points forts & axes d'amélioration", c.profile?.strengths_and_improvements);
    para('Hobbies / passions', c.profile?.hobbies);

    // ── Projets ──
    section('Projets professionnels');
    para('Objectifs de carrière', c.professional_projects?.career_objectives);
    para('Compétences souhaitées', c.professional_projects?.desired_skills);
    para("Motivations pour l'apprentissage", c.professional_projects?.apprenticeship_motivation);
    para('Attentes vis-à-vis de la formation', c.professional_projects?.training_expectations);

    // ── Compétences ──
    const skills = c.skills_assessment ?? [];
    if (skills.length) {
        section('Analyse des compétences');
        const compWidth = contentW - 130;
        skills.forEach((s) => {
            // Hauteur réelle de la compétence (souvent multi-lignes) pour réserver
            // l'espace et éviter un saut de page au milieu d'une ligne.
            const compH = doc.font('Helvetica').fontSize(10).heightOfString(s.competence, { width: compWidth });
            ensure(compH + 8);
            const y = doc.y;
            doc.font('Helvetica').fillColor('#111111').fontSize(10).text(s.competence, left, y, { width: compWidth });
            // Bas de la compétence : on s'aligne dessus pour que le niveau (1 ligne)
            // et la ligne suivante ne chevauchent pas le texte wrappé.
            const afterComp = doc.y;
            const lvlColor =
                s.level === 'A' ? '#1f7a3d' : s.level === 'ECA' ? '#b8860b' : s.level === 'NA' ? '#b3261e' : '#888888';
            doc.font('Helvetica-Bold')
                .fillColor(lvlColor)
                .fontSize(10)
                .text(SKILL_LEVEL_LABELS[s.level] ?? s.level, right - 120, y, { width: 120, align: 'right' });
            doc.y = Math.max(afterComp, doc.y);
            doc.moveDown(0.35);
            doc.fillColor('#000000');
        });
    }

    // ── Infos poste ──
    section('Informations sur le poste');
    kv('Date de disponibilité', fmtDate(c.job_info?.availability_date));
    const mobility = (c.job_info?.geographic_mobility ?? []).map((m) => LOCALISATION_LABELS[m] ?? m).join(', ');
    kv('Mobilité géographique', mobility);
    if (c.job_info?.weekend_work != null) kv('Travail le week-end gênant', yn(c.job_info.weekend_work));
    kv(
        'Comment a connu Disciplina',
        c.job_info?.discovery_source
            ? (DISCOVERY_LABELS[c.job_info.discovery_source] ?? c.job_info.discovery_source)
            : '',
    );
    para('Motivation pour ce domaine', c.job_info?.domain_motivation);
    para('Questions / préoccupations', c.job_info?.questions_concerns);
    listLine('Secteurs souhaités', c.desired_sectors);
    listLine('Compétences attendues en entreprise', c.expected_company_skills);

    // ── Synthèse ──
    section('Synthèse');
    para('Conclusion de faisabilité', c.synthesis?.feasibility_conclusion);
    para('Pertinence du parcours', c.synthesis?.pathway_relevance);
    para('Besoins spécifiques', c.synthesis?.special_needs);
    const reco = c.synthesis?.pedagogical_recommendations;
    if (reco) {
        const items: Array<[boolean | undefined, string]> = [
            [reco.office_tools_reinforcement, 'Renforcement des outils bureautiques'],
            [reco.written_communication_support, 'Soutien à la communication écrite'],
            [reco.oral_confidence_development, "Développement de la confiance à l'oral"],
            [reco.time_management_support, 'Soutien à la gestion du temps'],
            [reco.professional_posture_work, 'Travail sur la posture professionnelle'],
            [reco.enhanced_company_immersion, 'Immersion renforcée en entreprise'],
            [reco.psh_specific_support, 'Accompagnement spécifique PSH'],
            [reco.individual_follow_up, 'Suivi individualisé'],
            [reco.language_training, 'Formation linguistique'],
            [reco.stress_management_follow_up, 'Suivi en gestion du stress'],
        ];
        const on = items.filter(([v]) => v).map(([, l]) => l);
        if (on.length) {
            ensure(28);
            doc.font('Helvetica-Bold')
                .fillColor('#666666')
                .fontSize(8.5)
                .text('RECOMMANDATIONS PÉDAGOGIQUES', left, doc.y);
            doc.moveDown(0.15);
            doc.font('Helvetica').fillColor('#111111').fontSize(10);
            on.forEach((l) => {
                ensure(14);
                doc.text(`•  ${l}`, left, doc.y);
            });
            doc.moveDown(0.4);
        }
    }
    para('Autres recommandations', c.synthesis?.other_recommendations);

    // ── Note importante (encadré mis en évidence) ──
    const importantNote = c.synthesis?.important_note?.trim();
    if (importantNote) {
        const noteH = doc
            .font('Helvetica')
            .fontSize(10)
            .heightOfString(importantNote, { width: contentW - 24 });
        ensure(noteH + 34);
        const y = doc.y;
        doc.save()
            .rect(left, y, contentW, noteH + 26)
            .fill('#FFF7E6')
            .restore();
        doc.save()
            .rect(left, y, 4, noteH + 26)
            .fill('#C9A227')
            .restore();
        doc.font('Helvetica-Bold')
            .fillColor('#8a6d1b')
            .fontSize(8.5)
            .text('NOTE IMPORTANTE', left + 12, y + 7);
        doc.font('Helvetica')
            .fillColor('#111111')
            .fontSize(10)
            .text(importantNote, left + 12, doc.y + 2, {
                width: contentW - 24,
                align: 'justify',
            });
        doc.y = y + noteH + 26 + 6;
    }

    // ── Clôture : lieu + date de l'analyse (saisis dans la synthèse, sans signature) ──
    const synthLocation = c.synthesis?.location?.trim();
    const synthDate = fmtDate(c.synthesis?.date);
    if (synthLocation || synthDate) {
        const closing = [synthLocation ? `Fait à ${synthLocation}` : '', synthDate ? `le ${synthDate}` : '']
            .filter(Boolean)
            .join(', ');
        ensure(34);
        doc.moveDown(0.8);
        doc.font('Helvetica-Oblique')
            .fillColor('#333333')
            .fontSize(10)
            .text(closing, left, doc.y, { width: contentW, align: 'right' });
    }

    // ── Entretien réalisé par (RH sélectionné dans le formulaire) ──
    const interviewer = c.synthesis?.interviewed_by?.trim();
    if (interviewer) {
        ensure(24);
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
            .fillColor('#111111')
            .fontSize(10)
            .text('Entretien réalisé par : ', left, doc.y, { continued: true, width: contentW });
        doc.font('Helvetica').text(interviewer);
    }

    // ── Signature de l'apprenti (dessinée dans le formulaire, data-URL PNG) ──
    const sig = c.synthesis?.candidate_signature;
    if (sig && sig.startsWith('data:image')) {
        try {
            const imgBuf = Buffer.from(sig.split(',')[1] ?? '', 'base64');
            ensure(120);
            doc.moveDown(1.2);
            doc.font('Helvetica-Bold').fillColor('#111111').fontSize(10).text("Signature de l'apprenti", left, doc.y);
            doc.moveDown(0.3);
            doc.image(imgBuf, left, doc.y, { fit: [200, 80] });
            doc.y += 86;
            doc.save()
                .moveTo(left, doc.y)
                .lineTo(left + 200, doc.y)
                .lineWidth(0.5)
                .stroke('#888888')
                .restore();
        } catch {
            // image invalide : on ignore silencieusement
        }
    }
}

// Pied de page sur chaque page : date de génération (centré) + numéro de page
// (à droite). À appeler après le rendu, sur un document ouvert en bufferPages.
function addPageFooters(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const left = doc.page.margins.left;
        const right = doc.page.width - doc.page.margins.right;
        const contentW = right - left;
        const y = doc.page.height - doc.page.margins.bottom + 16;
        // Neutralise la marge basse le temps d'écrire dans la zone de pied de
        // page, sinon pdfkit ajoute une page fantôme.
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica-Oblique')
            .fillColor('#9aa0ab')
            .fontSize(8)
            .text(`Document généré le ${fmtDate(new Date())} — DISCIPLINA`, left, y, {
                width: contentW,
                align: 'center',
                lineBreak: false,
            });
        doc.font('Helvetica')
            .fillColor('#9aa0ab')
            .fontSize(8)
            .text(`Page ${i - range.start + 1} / ${range.count}`, left, y, {
                width: contentW,
                align: 'right',
                lineBreak: false,
            });
        doc.page.margins.bottom = savedBottom;
    }
}

// ─── ClassMarker results PDF (pdfkit, pur JS — fonctionne en serverless) ───────

// Le texte des questions ClassMarker est du HTML (balises + entités). On le
// réduit en texte brut lisible pour le PDF.
function htmlToText(raw?: string | null): string {
    if (!raw) return '';
    return raw
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li)>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function renderClassMarkerPdf(doc: PDFKit.PDFDocument, c: Candidate): void {
    const BLUE = '#1130A7';
    const GREEN = '#1f7a3d';
    const RED = '#b3261e';
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;
    const id = c.identity;
    const r = c.classmarker ?? {};

    // ── Bandeau titre ──
    const bandTop = doc.y;
    const bandH = 58;
    doc.save().rect(left, bandTop, contentW, bandH).fill(BLUE).restore();
    doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(id.full_name, left + 14, bandTop + 10, { width: contentW - 28 });
    const sub = `Résultats du test${id.email ? '   ·   ' + id.email : ''}${id.phone ? '   ·   ' + id.phone : ''}`;
    doc.fillColor('#dfe4f6')
        .font('Helvetica')
        .fontSize(9)
        .text(sub, left + 14, bandTop + 35, { width: contentW - 28 });
    doc.y = bandTop + bandH + 18;

    // ── Nom du test ──
    if (r.test_name) {
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(r.test_name, left, doc.y);
        doc.moveDown(0.6);
    }

    // ── Résultat principal (score + verdict) ──
    const boxTop = doc.y;
    const boxH = 70;
    const passed = r.passed === true;
    const verdictColor = r.passed === undefined ? BLUE : passed ? GREEN : RED;
    doc.save().rect(left, boxTop, contentW, boxH).fill('#F4F6FC').restore();
    doc.save().rect(left, boxTop, 4, boxH).fill(verdictColor).restore();

    const pct = typeof r.percentage === 'number' ? `${r.percentage}%` : '—';
    doc.fillColor(verdictColor)
        .font('Helvetica-Bold')
        .fontSize(34)
        .text(pct, left + 18, boxTop + 14, { width: 160 });

    if (r.passed !== undefined) {
        doc.fillColor(verdictColor)
            .font('Helvetica-Bold')
            .fontSize(13)
            .text(passed ? 'RÉUSSI' : 'ÉCHOUÉ', left + 190, boxTop + 16);
    }
    if (typeof r.points_scored === 'number' && typeof r.points_available === 'number') {
        doc.fillColor('#333333')
            .font('Helvetica')
            .fontSize(11)
            .text(`Score : ${r.points_scored} / ${r.points_available} points`, left + 190, boxTop + 40);
    }
    doc.y = boxTop + boxH + 22;
    doc.fillColor('#000000');

    // ── Détails ──
    const kv = (lbl: string, value?: string | number | null) => {
        const v = value === 0 ? '0' : value ? String(value) : '';
        if (!v) return;
        doc.font('Helvetica-Bold')
            .fillColor('#555555')
            .fontSize(10)
            .text(`${lbl} : `, left, doc.y, { continued: true });
        doc.font('Helvetica').fillColor('#111111').text(v);
        doc.moveDown(0.4);
    };

    kv('Pourcentage', typeof r.percentage === 'number' ? `${r.percentage}%` : null);
    kv('Verdict', r.passed === undefined ? null : passed ? 'Réussi' : 'Échoué');
    kv('Durée', r.duration);
    kv('Date de passage', fmtDate(r.completed_at));

    // ── Questions & réponses ──
    const questions = r.questions ?? [];
    if (questions.length) {
        const bottom = doc.page.height - doc.page.margins.bottom - 24;
        const ensure = (h: number) => {
            if (doc.y + h > bottom) doc.addPage();
        };

        doc.moveDown(0.6);
        ensure(28);
        const hy = doc.y;
        doc.save().rect(left, hy, contentW, 20).fill('#EEF1FB').restore();
        doc.save().rect(left, hy, 4, 20).fill(BLUE).restore();
        doc.fillColor(BLUE)
            .font('Helvetica-Bold')
            .fontSize(11)
            .text('Questions & réponses', left + 12, hy + 5, { width: contentW - 18 });
        doc.y = hy + 28;
        doc.fillColor('#000000');

        questions.forEach((q, i) => {
            const opts = (q.options ?? {}) as Record<string, unknown>;
            const isFreetext = q.question_type === 'freetext' || Array.isArray(opts.exact_match);
            const status = q.result === 'correct' ? 'correct' : q.result === 'unanswered' ? 'unanswered' : 'incorrect';
            const statusColor = status === 'correct' ? GREEN : status === 'unanswered' ? '#888888' : RED;
            const statusIcon = status === 'correct' ? '✓' : status === 'unanswered' ? '○' : '✗';
            const statusLabel =
                status === 'correct' ? 'Correct' : status === 'unanswered' ? 'Sans réponse' : 'Incorrect';

            ensure(54);

            // Intitulé
            doc.font('Helvetica-Bold')
                .fillColor('#111111')
                .fontSize(10)
                .text(`${i + 1}. ${htmlToText(q.question)}`, left, doc.y, { width: contentW });
            doc.moveDown(0.2);

            if (isFreetext) {
                // freetext : réponses acceptées + réponse candidat
                const accepted = Array.isArray(opts.exact_match)
                    ? (opts.exact_match as Array<{ content: string }>).map((e) => e.content).filter(Boolean)
                    : [];
                doc.font('Helvetica').fontSize(9.5);
                if (q.user_response) {
                    doc.fillColor('#333333').text(`Réponse du candidat : ${q.user_response}`, left + 12, doc.y, {
                        width: contentW - 12,
                    });
                }
                if (accepted.length) {
                    doc.fillColor('#555555').text(`Réponse(s) acceptée(s) : ${accepted.join(', ')}`, left + 12, doc.y, {
                        width: contentW - 12,
                    });
                }
            } else {
                // multiplechoice : liste des options, marquage candidat / bonne réponse
                doc.font('Helvetica').fontSize(9.5);
                Object.entries(opts).forEach(([key, val]) => {
                    if (typeof val !== 'string') return;
                    const isCorrect = key === q.correct_option;
                    const isChosen = key === q.user_response;
                    const marks = [isChosen ? 'choix du candidat' : '', isCorrect ? 'bonne réponse' : '']
                        .filter(Boolean)
                        .join(', ');
                    const color = isCorrect ? GREEN : isChosen ? RED : '#333333';
                    ensure(14);
                    doc.fillColor(color).text(
                        `${key}. ${htmlToText(val)}${marks ? `  (${marks})` : ''}`,
                        left + 12,
                        doc.y,
                        { width: contentW - 12 },
                    );
                });
            }

            // Statut + points
            const pts =
                typeof q.points_scored === 'number' && typeof q.points_available === 'number'
                    ? `  —  ${q.points_scored}/${q.points_available} pt`
                    : '';
            ensure(14);
            doc.font('Helvetica-Bold')
                .fillColor(statusColor)
                .fontSize(9)
                .text(`${statusIcon} ${statusLabel}${pts}`, left + 12, doc.y, { width: contentW - 12 });
            doc.moveDown(0.6);
            doc.fillColor('#000000');
        });
    }

    // ── Pied de page ──
    doc.font('Helvetica-Oblique')
        .fillColor('#888888')
        .fontSize(8)
        .text(
            `Document généré le ${fmtDate(new Date())} — DISCIPLINA`,
            left,
            doc.page.height - doc.page.margins.bottom - 14,
            {
                width: contentW,
                align: 'center',
            },
        );
}

// ─── PdfService ───────────────────────────────────────────────────────────────

export class PdfService {
    static generateClassMarkerPdf(candidate: Candidate): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
                const chunks: Buffer[] = [];
                doc.on('data', (d: Buffer) => chunks.push(d));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                renderClassMarkerPdf(doc, candidate);
                doc.end();
            } catch (e) {
                reject(e);
            }
        });
    }

    static generateCandidatePdf(candidate: Candidate): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 },
                    bufferPages: true,
                });
                const chunks: Buffer[] = [];
                doc.on('data', (d: Buffer) => chunks.push(d));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                renderCandidatePdf(doc, candidate);
                addPageFooters(doc);
                doc.end();
            } catch (e) {
                reject(e);
            }
        });
    }

    static async generateNeedsAnalysisPdf(analysis: NeedsAnalysisGql, company: Companies): Promise<Buffer> {
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
