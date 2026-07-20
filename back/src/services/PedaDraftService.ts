import { UserService } from './UserService';
import { MailTemplateService, MailTemplateDTO } from './MailTemplateService';
import { PedaConfigRepository } from '../repositories/mysql/PedaConfigRepository';
import { PedaDraftHistoryRepository } from '../repositories/mysql/PedaDraftHistoryRepository';
import { GoogleSheetsService } from '../external/google/sheets.service';
import { GoogleGmailService } from '../external/google/gmail.service';
import { GoogleTokens, GoogleTokenRefreshHandler } from '../external/google/types';
import { PedaLevel, PEDA_LEVEL_LABELS } from '../types/mailTemplate.types';
import { logger } from '../external/logger';

/** Feuilles du Sheet de suivi à parcourir (une par groupe d'apprenants). */
const SHEET_TABS = ['Abs NTC', 'Abs AD', 'Abs CC', 'Abs REM'];

/** En-têtes ligne 6, données à partir de la ligne 7. */
const FIRST_DATA_ROW = 7;

/**
 * Colonnes "Mail niv" (1-based dans le Sheet) : case cochée = brouillon de
 * relance à générer avec le modèle rattaché au niveau correspondant.
 * Vérifié sur le Sheet réel : M/P = niv.1, S/V = niv.2, Y/AB/AE = niv.3, AH/AK/AN = niv.+
 */
const MAIL_COLUMNS: { col: number; level: PedaLevel }[] = [
    { col: 13, level: 'niv1' }, // M
    { col: 16, level: 'niv1' }, // P
    { col: 19, level: 'niv2' }, // S
    { col: 22, level: 'niv2' }, // V
    { col: 25, level: 'niv3' }, // Y
    { col: 28, level: 'niv3' }, // AB
    { col: 31, level: 'niv3' }, // AE
    { col: 34, level: 'nivPlus' }, // AH
    { col: 37, level: 'nivPlus' }, // AK
    { col: 40, level: 'nivPlus' }, // AN
];

// Colonnes identité (1-based) : 2 = NOM, 3 = Prénom, 4 = Mail.
const COL_NOM = 2;
const COL_PRENOM = 3;
const COL_MAIL = 4;

const LAST_COLUMN_LETTER = 'AN'; // colonne 40

function isChecked(value: unknown): boolean {
    if (value === true || value === 1) return true;
    const s = String(value ?? '')
        .trim()
        .toLowerCase();
    return s === 'true' || s === 'vrai' || s === '1' || s === 'x' || s === 'oui';
}

/**
 * Adresse d'une cellule « Mail » du Sheet, nettoyée pour le header `To:`.
 *
 * La cellule peut contenir, selon la saisie :
 *  - l'adresse brute, parfois polluée d'espaces insécables ou de zero-width (copier-coller) ;
 *  - la forme `Prénom Nom <mail@x.re>` ;
 *  - une formule `=HYPERLINK("mailto:mail@x.re";"✉")` ;
 *  - une URL `mailto:mail@x.re` (lien posé via « Insertion > Lien »).
 *
 * Sans ce nettoyage, Gmail rejette le brouillon avec « Invalid To header ».
 * Renvoie null si aucune adresse n'est exploitable.
 */
// Espaces insécables, zero-width, séparateurs Unicode et BOM : invisibles dans le
// Sheet, mais ils invalident le header `To:`.
const INVISIBLE_CHARS = /[\u00a0\u1680\u2000-\u200d\u202f\u205f\u2060\u3000\ufeff]/g;

export function normalizeEmail(raw: unknown): string | null {
    const cleaned = String(raw ?? '')
        .replace(INVISIBLE_CHARS, ' ')
        .trim();
    if (!cleaned) return null;
    // Forme « Prénom Nom <mail@x.re> » → on garde ce qui est entre chevrons.
    const angled = cleaned.match(/<([^>]+)>/);
    const candidate = angled ? angled[1].trim() : cleaned;
    // Une seule adresse : une cellule multi-adresses est ambiguë, on prend la première.
    // Guillemets exclus pour couvrir `=HYPERLINK("mailto:x@y.re";"✉")`.
    const match = candidate.match(/[^\s,;<>"'()]+@[^\s,;<>"'()]+\.[a-z]{2,}/i);
    if (!match) return null;
    // Un lien mailto porte l'adresse en suffixe, éventuellement avec des paramètres (`?subject=…`).
    return match[0].replace(/^mailto:/i, '').split('?')[0];
}

/** Remplace {nom}/{prenom}/{mail} (et la variante {{…}}) dans un texte de modèle. */
function fillVariables(text: string, vars: { nom: string; prenom: string; mail: string }): string {
    return text
        .replace(/\{\{?\s*nom\s*\}?\}/gi, vars.nom)
        .replace(/\{\{?\s*prenom\s*\}?\}/gi, vars.prenom)
        .replace(/\{\{?\s*mail\s*\}?\}/gi, vars.mail);
}

function htmlToText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
}

/**
 * Bilan d'une exécution. Assez détaillé pour diagnostiquer un « 0 brouillon »
 * depuis l'UI sans relire les logs serveur : on distingue lecture du Sheet,
 * cases cochées trouvées, et chaque motif de non-création.
 */
export interface PedaDraftRunReport {
    pedas: number;
    tabsRead: number;
    tabsFailed: number;
    rowsScanned: number;
    boxesChecked: number;
    created: number;
    skippedExisting: number;
    skippedNoTemplate: number;
    skippedNoMail: number;
    errors: number;
    /** Messages lisibles par le Peda (onglet manquant, niveau sans modèle, …). */
    details: string[];
}

function emptyReport(): PedaDraftRunReport {
    return {
        pedas: 0,
        tabsRead: 0,
        tabsFailed: 0,
        rowsScanned: 0,
        boxesChecked: 0,
        created: 0,
        skippedExisting: 0,
        skippedNoTemplate: 0,
        skippedNoMail: 0,
        errors: 0,
        details: [],
    };
}

/** Un même motif (ex. « niveau 2 : aucun modèle ») ne pollue pas le rapport en boucle. */
function addDetail(report: PedaDraftRunReport, message: string): void {
    if (!report.details.includes(message)) report.details.push(message);
}

/**
 * Job quotidien : lit le Sheet d'absences de chaque Peda (lecture seule) et
 * crée dans sa boîte Gmail un brouillon de relance par case "Mail niv" cochée,
 * avec déduplication en base (jamais deux brouillons pour la même case).
 */
export class PedaDraftService {
    private userService = new UserService();
    private templateService = new MailTemplateService();
    private configRepo = new PedaConfigRepository();
    private historyRepo = new PedaDraftHistoryRepository();
    private sheets = new GoogleSheetsService();
    private gmail = new GoogleGmailService();

    /** Tous les Pedas ayant enregistré un Sheet (job planifié, ou déclenchement ADMIN). */
    async runForAllPedas(): Promise<PedaDraftRunReport> {
        const report = emptyReport();
        const configs = await this.configRepo.findAll();
        for (const config of configs) {
            report.pedas++;
            try {
                await this.runForPeda(config.user_id, config.sheet_id, report);
            } catch (err) {
                report.errors++;
                addDetail(report, `Peda #${config.user_id} : échec de l'exécution`);
                logger.error({ err, userId: config.user_id }, 'peda-draft: échec pour un Peda');
            }
        }
        logger.info(report, 'peda-draft: exécution terminée');
        return report;
    }

    /** Déclenchement manuel par un Peda : ne touche que sa propre boîte Gmail. */
    async runForUser(userId: number): Promise<PedaDraftRunReport> {
        const report = emptyReport();
        const config = await this.configRepo.findByUserId(userId);
        if (!config) {
            addDetail(report, 'Aucun Google Sheet enregistré : renseignez-le ci-dessus.');
            return report;
        }
        report.pedas = 1;
        try {
            await this.runForPeda(userId, config.sheet_id, report);
        } catch (err) {
            report.errors++;
            addDetail(report, "Échec de l'exécution (voir les logs serveur).");
            logger.error({ err, userId }, 'peda-draft: échec pour un Peda');
        }
        logger.info(report, 'peda-draft: exécution manuelle terminée');
        return report;
    }

    /**
     * Résout l'adresse d'une ligne quand la valeur affichée n'en contient pas
     * (cellule liée affichant « ✉ »). Les deux lectures supplémentaires — formule,
     * puis métadonnées de lien — sont faites au plus une fois par onglet, et
     * uniquement si un premier appel échoue à trouver une adresse.
     */
    private lazyMailFallback(
        creds: GoogleTokens,
        sheetId: string,
        tab: string,
        onRefresh: GoogleTokenRefreshHandler,
    ): (rowIndex: number) => Promise<string | null> {
        let loaded: Promise<{ formulas: unknown[][]; links: (string | null)[] }> | null = null;

        const load = () => {
            loaded ??= (async () => {
                const mailColumn = `'${tab}'!D${FIRST_DATA_ROW}:D`;
                const [formulas, links] = await Promise.all([
                    this.sheets
                        .readRange(creds, sheetId, mailColumn, onRefresh, 'FORMULA')
                        .catch(() => [] as unknown[][]),
                    this.sheets.readLinks(creds, sheetId, mailColumn, onRefresh).catch(() => [] as (string | null)[]),
                ]);
                return { formulas, links };
            })();
            return loaded;
        };

        return async (rowIndex: number) => {
            const { formulas, links } = await load();
            return normalizeEmail(formulas[rowIndex]?.[0]) ?? normalizeEmail(links[rowIndex]);
        };
    }

    async runForPeda(userId: number, sheetId: string, report: PedaDraftRunReport): Promise<void> {
        const user = await this.userService.findById(userId);
        if (!user || !user.oauthToken) {
            addDetail(report, 'Compte Google non connecté : reconnectez-le depuis votre profil.');
            logger.warn({ userId }, 'peda-draft: Google non connecté, Peda ignoré');
            return;
        }
        const creds: GoogleTokens = { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined };
        const onRefresh = (refreshed: GoogleTokens) =>
            this.userService.updateGoogleTokens(
                userId,
                refreshed.access_token ?? null,
                refreshed.refresh_token ?? null,
            );

        // Modèles résolus une fois par niveau (et non par ligne du Sheet).
        const templatesByLevel = new Map<PedaLevel, MailTemplateDTO | null>();
        const templateFor = async (level: PedaLevel): Promise<MailTemplateDTO | null> => {
            if (!templatesByLevel.has(level)) {
                templatesByLevel.set(level, await this.templateService.findPedaTemplateByLevel(level));
            }
            return templatesByLevel.get(level) ?? null;
        };
        const signatureHtml = await this.templateService.getSignatureHtml(userId, 'peda');

        for (const tab of SHEET_TABS) {
            let rows: unknown[][];
            try {
                rows = await this.sheets.readRange(
                    creds,
                    sheetId,
                    `'${tab}'!A${FIRST_DATA_ROW}:${LAST_COLUMN_LETTER}`,
                    onRefresh,
                );
                report.tabsRead++;
            } catch (err) {
                report.tabsFailed++;
                const reason =
                    (err as { code?: number }).code === 403
                        ? 'accès refusé (autorisation Google Sheets manquante — reconnectez votre compte Google)'
                        : 'onglet introuvable ou Sheet inaccessible';
                addDetail(report, `Feuille « ${tab} » : ${reason}.`);
                logger.error({ err, userId, tab }, 'peda-draft: lecture de la feuille impossible');
                continue;
            }

            // La colonne Mail contient parfois une cellule liée affichant « ✉ » : l'adresse
            // n'est alors ni dans la valeur affichée, ni forcément dans une formule.
            // On ne paie ces lectures supplémentaires que si une adresse manque réellement.
            const fallback = this.lazyMailFallback(creds, sheetId, tab, onRefresh);

            for (const [index, row] of rows.entries()) {
                const nom = String(row[COL_NOM - 1] ?? '').trim();
                const prenom = String(row[COL_PRENOM - 1] ?? '').trim();
                if (!nom && !prenom) continue; // ligne vide
                report.rowsScanned++;

                const rawMail = String(row[COL_MAIL - 1] ?? '').trim();
                const mail = normalizeEmail(rawMail) ?? (await fallback(index));

                for (const { col, level } of MAIL_COLUMNS) {
                    if (!isChecked(row[col - 1])) continue;
                    report.boxesChecked++;

                    const dedupKey = `${sheetId}|${tab}|${nom}|${prenom}|${col}`;
                    if (await this.historyRepo.exists(dedupKey)) {
                        report.skippedExisting++;
                        continue;
                    }
                    if (!mail) {
                        report.skippedNoMail++;
                        addDetail(
                            report,
                            rawMail
                                ? `${prenom} ${nom} (${tab}) : aucune adresse trouvée dans la cellule « ${rawMail} » (ni texte, ni formule, ni lien).`
                                : `${prenom} ${nom} (${tab}) : adresse mail absente du Sheet.`,
                        );
                        logger.warn(
                            { userId, tab, nom, prenom, rawMail },
                            'peda-draft: case cochée, mail inexploitable',
                        );
                        continue;
                    }
                    const template = await templateFor(level);
                    if (!template) {
                        report.skippedNoTemplate++;
                        addDetail(
                            report,
                            `Aucun modèle rattaché au ${PEDA_LEVEL_LABELS[level]} : créez-le dans « Modèles de mail ».`,
                        );
                        logger.warn({ userId, level }, 'peda-draft: aucun modèle pour ce niveau, brouillon non créé');
                        continue;
                    }

                    const vars = { nom, prenom, mail };
                    const subject = fillVariables(template.subject, vars);
                    const html = fillVariables(template.body, vars) + signatureHtml;
                    try {
                        await this.gmail.createDraft(
                            creds,
                            { to: mail, subject, html, text: htmlToText(html) },
                            onRefresh,
                        );
                        // Marqué traité seulement après création réussie du brouillon.
                        await this.historyRepo.create({ dedupKey, userId, level, recipient: mail });
                        report.created++;
                    } catch (err) {
                        report.errors++;
                        const reason = (err as Error).message || 'erreur inconnue';
                        addDetail(report, `${prenom} ${nom} (${tab}) : brouillon Gmail refusé — ${reason}.`);
                        logger.error(
                            { err, userId, tab, nom, prenom, col, mail },
                            'peda-draft: création du brouillon échouée',
                        );
                    }
                }
            }
        }

        if (report.rowsScanned === 0 && report.tabsRead > 0) {
            addDetail(
                report,
                'Aucun apprenant lu : vérifiez que les données commencent bien ligne 7 (colonnes B/C/D).',
            );
        }
    }
}
