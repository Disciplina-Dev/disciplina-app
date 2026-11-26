import { describe, it, expect } from 'vitest';
import { TENANT_TIMEZONE, tenantTimezone } from '../tenant';
import { syncWithRegion, getRegion } from '../../db/tenant';
import { VALID_REGIONS } from '../../types/tenant';

/**
 * Verrou de la source de unique des fuseaux (TZ-01/TZ-02/TZ-07).
 *
 * Les assertions portent sur des LITTÉRAUX, jamais sur `tenantTimezone()` : la
 * table doit être fausse ici pour que le test échoue. Un test qui comparerait
 * `tenantTimezone()` à `TENANT_TIMEZONE.reunion` passerait quoi qu'il arrive.
 */
describe('TENANT_TIMEZONE', () => {
    it('associe Indian/Reunion à la Réunion et Europe/Paris à Annemasse', () => {
        expect(TENANT_TIMEZONE.reunion).toBe('Indian/Reunion');
        expect(TENANT_TIMEZONE.annemasse).toBe('Europe/Paris');
    });

    it('couvre toutes les régions valides', () => {
        for (const region of VALID_REGIONS) {
            expect(TENANT_TIMEZONE[region]).toBeTruthy();
        }
    });

    it('expose des fuseaux acceptés par Intl', () => {
        // Un fuseau mal orthographié ne throw pas au build : `Intl` l'ignore et le
        // formatage retombe silencieusement sur l'UTC du runtime.
        for (const region of VALID_REGIONS) {
            expect(() =>
                new Intl.DateTimeFormat('fr-FR', { timeZone: TENANT_TIMEZONE[region] }).format(new Date()),
            ).not.toThrow();
        }
    });
});

describe('tenantTimezone', () => {
    it("lit la région courante de l'ALS", () => {
        expect(syncWithRegion('reunion', () => tenantTimezone())).toBe('Indian/Reunion');
        expect(syncWithRegion('annemasse', () => tenantTimezone())).toBe('Europe/Paris');
    });

    it("accepte une région explicite qui prime sur l'ALS", () => {
        expect(syncWithRegion('reunion', () => tenantTimezone('annemasse'))).toBe('Europe/Paris');
    });

    it('retombe sur le tenant par défaut hors ALS', () => {
        // Conditionnel plutôt qu'assertion figée : DB_DEFAULT_TENANT est
        // configurable par l'environnement (cf. config/env.ts).
        expect(tenantTimezone()).toBe(TENANT_TIMEZONE[getRegion()]);
    });

    /**
     * Régression TZ-07 : `const DEFAULT_TZ = tenantTimezone()` au niveau module
     * figerait le fuseau du tenant par défaut pour TOUS les tenants, parce que
     * l'ALS est vide au chargement des modules. `tenantTimezone()` doit donc être
     * évaluée à chaque appel, jamais mémorisée.
     */
    it("est évaluée à chaque appel et non à l'import du module", () => {
        const read = () => syncWithRegion('annemasse', () => tenantTimezone());
        // Le module est chargé depuis bien avant ces appels, dans le tenant par
        // défaut : si la valeur était mémorisée à l'import, Annemasse renverrait
        // le fuseau du tenant par défaut.
        expect(read()).toBe('Europe/Paris');
        expect(read()).toBe('Europe/Paris');
    });
});
