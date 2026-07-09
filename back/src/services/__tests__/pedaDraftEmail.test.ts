import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../PedaDraftService';

describe('normalizeEmail', () => {
    it('garde une adresse déjà propre', () => {
        expect(normalizeEmail('marie.dupont@exemple.re')).toBe('marie.dupont@exemple.re');
    });

    it('retire les espaces insécables et zero-width collés au copier-coller', () => {
        expect(normalizeEmail(' marie.dupont@exemple.re​')).toBe('marie.dupont@exemple.re');
        expect(normalizeEmail('﻿marie.dupont@exemple.re')).toBe('marie.dupont@exemple.re');
    });

    it('extrait l’adresse de la forme « Prénom Nom <mail> »', () => {
        expect(normalizeEmail('Marie Dupont <marie.dupont@exemple.re>')).toBe('marie.dupont@exemple.re');
    });

    it('prend la première adresse d’une cellule multi-adresses', () => {
        expect(normalizeEmail('a@x.re, b@y.re')).toBe('a@x.re');
        expect(normalizeEmail('a@x.re\nb@y.re')).toBe('a@x.re');
    });

    it('extrait l’adresse d’une formule HYPERLINK (cellule affichant « ✉ »)', () => {
        expect(normalizeEmail('=HYPERLINK("mailto:marie.dupont@exemple.re";"✉")')).toBe('marie.dupont@exemple.re');
        expect(normalizeEmail('=HYPERLINK("mailto:marie.dupont@exemple.re","✉")')).toBe('marie.dupont@exemple.re');
    });

    it('extrait l’adresse d’une URL mailto (lien posé sur la cellule)', () => {
        expect(normalizeEmail('mailto:marie.dupont@exemple.re')).toBe('marie.dupont@exemple.re');
        expect(normalizeEmail('mailto:marie.dupont@exemple.re?subject=Absence')).toBe('marie.dupont@exemple.re');
    });

    it('renvoie null quand la cellule ne contient pas d’adresse', () => {
        expect(normalizeEmail('')).toBeNull();
        expect(normalizeEmail('   ')).toBeNull();
        expect(normalizeEmail('pas de mail')).toBeNull();
        expect(normalizeEmail('marie.dupont@')).toBeNull();
        expect(normalizeEmail('✉')).toBeNull();
        expect(normalizeEmail(null)).toBeNull();
    });
});
