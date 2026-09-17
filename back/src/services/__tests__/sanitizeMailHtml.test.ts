import { describe, it, expect } from 'vitest';
import { sanitizeMailHtml } from '../sanitizeMailHtml';

describe('sanitizeMailHtml', () => {
    it('retire les balises actives (script, onerror, onclick)', () => {
        expect(sanitizeMailHtml('<script>alert(1)</script><p>hi</p>')).toBe('<p>hi</p>');
        expect(sanitizeMailHtml('<img src="data:image/png;base64,AAAA" onerror="alert(1)">')).toBe(
            '<img src="data:image/png;base64,AAAA" />',
        );
        expect(sanitizeMailHtml('<p onclick="steal()">hi</p>')).toBe('<p>hi</p>');
    });

    it('retire les URLs javascript: sur les liens', () => {
        const out = sanitizeMailHtml('<a href="javascript:alert(1)">clic</a>');
        expect(out).not.toContain('javascript:');
        expect(out).not.toContain('href=');
    });

    it('conserve les couleurs hexadécimales sur les span/liens', () => {
        const html = '<span style="color:#1130A7">texte</span>';
        expect(sanitizeMailHtml(html)).toContain('color:#1130A7');
    });

    it('retire les styles CSS dangereux (expression/url)', () => {
        const html = '<span style="width:expression(alert(1))">x</span>';
        expect(sanitizeMailHtml(html)).not.toContain('expression');
    });

    it('conserve les images en data: (nécessaires pour les images inline)', () => {
        const html = '<img src="data:image/png;base64,AAAA" alt="logo">';
        expect(sanitizeMailHtml(html)).toContain('src="data:image/png;base64,AAAA"');
    });

    it('conserve les titres h2/h3', () => {
        expect(sanitizeMailHtml('<h2>Titre</h2><h3>Sous-titre</h3>')).toBe('<h2>Titre</h2><h3>Sous-titre</h3>');
    });

    it('force target=_blank et rel sécurisé sur les liens', () => {
        const html = '<a href="https://exemple.fr">lien</a>';
        const out = sanitizeMailHtml(html);
        expect(out).toContain('target="_blank"');
        expect(out).toContain('rel="noopener noreferrer nofollow"');
    });

    it('conserve un bouton CTA stylé (couleur de fond, padding, coins arrondis, sans soulignement)', () => {
        const html =
            '<a href="https://exemple.fr" style="display:inline-block;background-color:#1130A7;color:#ffffff;padding:10px 20px;border-radius:6px;font-weight:600;text-decoration:none">Voir</a>';
        const out = sanitizeMailHtml(html);
        expect(out).toContain('display:inline-block');
        expect(out).toContain('background-color:#1130A7');
        expect(out).toContain('border-radius:6px');
        expect(out).toContain('text-decoration:none');
    });

    it('conserve les couleurs au format rgb() — ce que le navigateur produit réellement depuis l’éditeur', () => {
        const html =
            '<a href="https://exemple.fr" style="background-color: rgb(17, 48, 167); color: rgb(255, 255, 255);">Voir</a>';
        const out = sanitizeMailHtml(html);
        expect(out).toContain('background-color:rgb(17, 48, 167)');
        expect(out).toContain('color:rgb(255, 255, 255)');
    });
});
