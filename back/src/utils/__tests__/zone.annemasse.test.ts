import { describe, expect, it } from 'vitest';
import { candidateZones, communesForZones, offerZones } from '../zone';
import { CompanyRegion } from '../../types/needsAnalysisNoSql.types';
import { Localisation } from '../../types/matching.types';

describe('zone ANNEMASSE (SEED-01 / GEO-05..08)', () => {
    it('une offre au secteur ANNEMASSE porte la zone ANNEMASSE et elle seule', () => {
        const zones = offerZones({
            company_infos: { sector: CompanyRegion.ANNEMASSE },
            localisation: [Localisation.ANNEMASSE],
        });
        expect([...zones]).toEqual(['ANNEMASSE']);
        expect(communesForZones(zones)).toEqual(['ANNEMASSE']);
    });

    it("un candidat Annemasse recoupe la zone de l'offre Annemasse", () => {
        const offer = offerZones({ company_infos: { sector: CompanyRegion.ANNEMASSE } });
        const candidate = candidateZones({
            training_site: 'ANNEMASSE',
            job_info: { geographic_mobility: ['ANNEMASSE'] },
        });
        expect([...offer].some((z) => candidate.has(z))).toBe(true);
    });

    it("un candidat Annemasse ne recoupe aucune zone d'une offre Réunion", () => {
        const offer = offerZones({
            company_infos: { sector: CompanyRegion.NORD },
            localisation: [Localisation.SAINT_DENIS],
        });
        const candidate = candidateZones({
            training_site: 'ANNEMASSE',
            job_info: { geographic_mobility: ['ANNEMASSE'] },
        });
        expect([...offer].some((z) => candidate.has(z))).toBe(false);
    });
});
