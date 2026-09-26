import { describe, expect, it } from 'vitest';
import { syncWithRegion } from '../../../db/tenant';
import { mapCandidateToFilizStudent } from '../candidate.mapper';
import type { Candidate } from '../../../types/candidate.types';

const candidate = (identity: Record<string, unknown>) =>
    ({ _id: 'c1', identity: { full_name: 'Jane Doe', ...identity } }) as unknown as Candidate;

describe('mapCandidateToFilizStudent par tenant (COS-07)', () => {
    it('réunion : indicatif 262, département 97400 par défaut', () => {
        const s = syncWithRegion('reunion', () =>
            mapCandidateToFilizStudent(candidate({ phone: '+262 692 12 34 56' })),
        );
        expect(s.phoneNumber).toEqual({ dialCode: '262', number: '692123456' });
        expect(s.departmentOfBirth).toBe('97400');
    });

    it('annemasse : indicatif 33 (2 chiffres, pas de troncature), département 74 par défaut', () => {
        const s = syncWithRegion('annemasse', () =>
            mapCandidateToFilizStudent(candidate({ phone: '+33 6 12 34 56 78' })),
        );
        expect(s.phoneNumber).toEqual({ dialCode: '33', number: '612345678' });
        expect(s.departmentOfBirth).toBe('74');
    });

    it('un département saisi prime toujours sur le défaut du tenant', () => {
        const s = syncWithRegion('annemasse', () =>
            mapCandidateToFilizStudent(candidate({ department_of_birth: '69' })),
        );
        expect(s.departmentOfBirth).toBe('69');
    });
});
