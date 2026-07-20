// Valeur de colonne acceptée par mysql2 en paramètre préparé.
type SqlValue = string | number | boolean | Date | null;

// Construit un INSERT paramétré à partir d'un objet : colonnes = clés, `?` par
// valeur. Factorise le même bloc `Object.keys(...).join` recopié dans chaque
// repository (CompanyRepository, CompanyBlacklistRepository, CompanyHistoryRepository)
// et le service blacklist. Les clés viennent du code (noms de colonnes typés),
// jamais d'entrées utilisateur — pas de risque d'injection.
export function buildInsert(table: string, data: Record<string, SqlValue>): { sql: string; values: SqlValue[] } {
    const columns = Object.keys(data);
    const fields = columns.join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    return {
        sql: `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`,
        values: Object.values(data),
    };
}
