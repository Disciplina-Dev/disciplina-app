import { describe, it, expect } from 'vitest';
import {
    mapCandidateToFilizStudent,
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
    const base: any = {
        identity: {
            full_name: 'Jean DUPONT',
            email: 'jean@test.local',
            phone: '+33612345678',
            date_of_birth: new Date('2000-05-02T00:00:00Z'),
            place_of_birth: 'Paris',
            sex: 'M',
        },
    };

    it('formats the birth date as MM/DD/YYYY in UTC', () => {
        expect(mapCandidateToFilizStudent(base).birthDate).toBe('05/02/2000');
    });

    it('reports fields that cannot be guessed', () => {
        expect(missingFilizStudentFields(base)).toEqual([]);
        const incomplete = { identity: { full_name: 'Jean DUPONT', email: 'a@b.c', phone: '' } } as any;
        expect(missingFilizStudentFields(incomplete)).toEqual(['date_of_birth', 'place_of_birth', 'sex']);
    });
});
