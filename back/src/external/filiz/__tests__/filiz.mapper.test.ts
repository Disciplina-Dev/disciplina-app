import { describe, it, expect } from 'vitest';
import {
    isAdult,
    mapCandidateToFilizStudent,
    missingFilizBasicFields,
    missingFilizStudentFields,
    parseFilizPhone,
    splitFullName,
} from '../../../services/mappers/candidate.mapper';

describe('parseFilizPhone', () => {
    it('reads a French international number', () => {
        expect(parseFilizPhone('+33612345678')).toEqual({ dialCode: '33', number: '612345678' });
        expect(parseFilizPhone('0033 6 12 34 56 78')).toEqual({ dialCode: '33', number: '612345678' });
    });
    it('reads a 3-digit DOM dial code', () => {
        expect(parseFilizPhone('+262692000004')).toEqual({ dialCode: '262', number: '692000004' });
    });
    it('keeps local numbers and picks the dial code from the prefix', () => {
        expect(parseFilizPhone('0692 00 00 04')).toEqual({ dialCode: '262', number: '0692000004' });
        expect(parseFilizPhone('0612345678')).toEqual({ dialCode: '33', number: '0612345678' });
    });
});

describe('splitFullName', () => {
    it('splits on the first uppercase word', () => {
        expect(splitFullName('Marie Claire DUPONT')).toEqual({ firstName: 'Marie Claire', lastName: 'DUPONT' });
        expect(splitFullName('Jean DE LA FONTAINE')).toEqual({ firstName: 'Jean', lastName: 'DE LA FONTAINE' });
    });
    it('falls back to first word as first name', () => {
        expect(splitFullName('Jean Dupont')).toEqual({ firstName: 'Jean', lastName: 'Dupont' });
        expect(splitFullName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
    });
});

describe('Filiz student mapping', () => {
    const complete: any = {
        identity: {
            full_name: 'Jean DUPONT',
            email: 'jean@test.local',
            phone: '+33612345678',
            date_of_birth: new Date('2000-05-02T00:00:00Z'),
            place_of_birth: 'Paris',
            department_of_birth: '75',
            born_in_france: true,
            nationality: 1,
            sex: 'GARCON',
            address: '1 rue des Fleurs',
            postal_code: '97400',
            city: 'Saint-Denis',
            country: 'France',
        },
    };

    it('formats the birth date as MM/DD/YYYY in UTC', () => {
        expect(mapCandidateToFilizStudent(complete).birthDate).toBe('05/02/2000');
    });

    it('maps the form values without inventing any', () => {
        const student = mapCandidateToFilizStudent(complete);
        expect(student).toMatchObject({
            departmentOfBirth: '75',
            bornInFrance: true,
            nationality: 1,
            sexe: 1,
            address: { street: '1 rue des Fleurs', city: 'Saint-Denis', country: 'France', postcode: '97400' },
        });
        expect(student).not.toHaveProperty('residencePermit');
    });

    it('accepts both sex encodings', () => {
        const woman = (sex: string) =>
            mapCandidateToFilizStudent({ identity: { ...complete.identity, sex } } as any).sexe;
        expect([woman('FILLE'), woman('F'), woman('GARCON'), woman('M')]).toEqual([2, 2, 1, 1]);
    });

    it('sends the residence permit only for a non-European nationality', () => {
        const foreign = { identity: { ...complete.identity, nationality: 3, residence_permit: true } } as any;
        expect(mapCandidateToFilizStudent(foreign).residencePermit).toBe(true);
    });

    it('reports nothing missing for a complete identity', () => {
        expect(missingFilizBasicFields(complete)).toEqual([]);
        expect(missingFilizStudentFields(complete)).toEqual([]);
    });

    it('reports the fields that cannot be guessed', () => {
        const minimal = { identity: { full_name: 'Jean DUPONT', email: 'a@b.c', phone: '' } } as any;
        expect(missingFilizBasicFields(minimal)).toEqual(['date_of_birth']);
        expect(missingFilizStudentFields(minimal)).toEqual([
            'date_of_birth',
            'place_of_birth',
            'department_of_birth',
            'born_in_france',
            'nationality',
            'sex',
            'phone',
            'address',
            'postal_code',
            'city',
            'country',
        ]);
    });

    it('requires the residence permit for a non-European nationality', () => {
        const foreign = { identity: { ...complete.identity, nationality: 3 } } as any;
        expect(missingFilizStudentFields(foreign)).toEqual(['residence_permit']);
    });

    it('rejects a department name instead of its code', () => {
        const named = { identity: { ...complete.identity, department_of_birth: 'La Réunion' } } as any;
        expect(missingFilizStudentFields(named)).toEqual(['department_of_birth']);
        const corsica = { identity: { ...complete.identity, department_of_birth: '2A' } } as any;
        expect(missingFilizStudentFields(corsica)).toEqual([]);
    });

    it('requires a last name', () => {
        const mononym = { identity: { ...complete.identity, full_name: 'Madonna' } } as any;
        expect(missingFilizBasicFields(mononym)).toEqual(['full_name']);
    });
});

describe('isAdult', () => {
    const born = (iso: string) => ({ identity: { date_of_birth: new Date(iso) } }) as any;
    const now = new Date('2026-10-25T10:00:00Z');

    it('switches on the 18th birthday', () => {
        expect(isAdult(born('2008-10-25T00:00:00Z'), now)).toBe(true);
        expect(isAdult(born('2008-10-26T00:00:00Z'), now)).toBe(false);
    });
    it('returns null without a usable birth date', () => {
        expect(isAdult({ identity: {} } as any, now)).toBeNull();
    });
});
