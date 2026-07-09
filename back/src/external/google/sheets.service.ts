import { google } from 'googleapis';
import { googleOAuth, GoogleOAuthClient } from './oauth-client';
import { GoogleTokens, GoogleTokenRefreshHandler } from './types';

/**
 * Lecture seule des Google Sheets (suivi d'absences Peda).
 * Aucune méthode d'écriture : le Sheet source ne doit jamais être modifié.
 */
export class GoogleSheetsService {
    constructor(private readonly oauth: GoogleOAuthClient = googleOAuth) {}

    /**
     * Valeurs d'une plage (ex: `'Abs NTC'!A7:AN`). Lignes/cellules vides possibles.
     * `renderOption` :
     *  - `FORMATTED_VALUE` (défaut) → ce que l'utilisateur voit (une cellule liée affiche son libellé, ex. « ✉ »)
     *  - `FORMULA` → le contenu source, qui révèle `=HYPERLINK("mailto:…";"✉")`
     */
    async readRange(
        creds: GoogleTokens,
        spreadsheetId: string,
        range: string,
        onTokenRefresh?: GoogleTokenRefreshHandler,
        renderOption: 'FORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE',
    ): Promise<unknown[][]> {
        const auth = this.oauth.forCredentials(creds, onTokenRefresh);
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption: renderOption,
        });
        return (res.data.values ?? []) as unknown[][];
    }

    /**
     * Liens d'une plage, indexés par ligne (0 = première ligne de la plage).
     *
     * Un lien posé via « Insertion > Lien » n'est ni dans la valeur affichée ni
     * dans la formule : il vit dans les métadonnées de la cellule (`hyperlink`,
     * ou `textFormatRuns[].format.link` quand seule une partie du texte est liée).
     * On ne demande que les champs utiles pour ne pas rapatrier toute la grille.
     */
    async readLinks(
        creds: GoogleTokens,
        spreadsheetId: string,
        range: string,
        onTokenRefresh?: GoogleTokenRefreshHandler,
    ): Promise<(string | null)[]> {
        const auth = this.oauth.forCredentials(creds, onTokenRefresh);
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.get({
            spreadsheetId,
            ranges: [range],
            includeGridData: true,
            fields: 'sheets.data.rowData.values(hyperlink,textFormatRuns.format.link.uri)',
        });

        const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
        return rowData.map((row) => {
            const cell = row.values?.[0];
            if (!cell) return null;
            if (cell.hyperlink) return cell.hyperlink;
            const runLink = cell.textFormatRuns?.find((r) => r.format?.link?.uri)?.format?.link?.uri;
            return runLink ?? null;
        });
    }
}
