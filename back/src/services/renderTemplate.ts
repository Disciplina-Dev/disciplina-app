/**
 * Remplace les variables {{cle}} d'un modèle par leurs valeurs.
 * La casse de la clé est ignorée ; les clés inconnues sont remplacées par une
 * chaîne vide (même convention que back/src/rest/booking/service.ts).
 */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? '');
}

/** Vrai si le texte référence la variable {{cle}} (ou {{ CLE }}), insensible à la casse. */
export function usesVariable(tpl: string, key: string): boolean {
    return new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'i').test(tpl);
}
