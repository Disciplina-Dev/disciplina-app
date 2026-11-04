#!/usr/bin/env node
// Rend le rapport JSON de Vitest (reporter `json`) en Markdown pour le résumé d'un run
// GitHub Actions ($GITHUB_STEP_SUMMARY) : totaux, échecs en tête, détail repliable par fichier.
//
//   node .github/scripts/vitest-summary.mjs back/test-results/vitest.json >> "$GITHUB_STEP_SUMMARY"
//
// Aperçu en local : node .github/scripts/vitest-summary.mjs back/test/output.json > summary.md
//
// Sans dépendance (Node ≥18). Ne fait jamais échouer le job : c'est l'étape de tests
// qui porte le statut, ce script ne fait que l'afficher.

import { readFileSync } from 'node:fs';

// GitHub refuse un résumé de plus de 1 MiB : on retire le détail par fichier au-delà.
const MAX_SUMMARY_BYTES = 900 * 1024;
const MAX_FAILURE_LINES = 20;

const ICON = { passed: '✅', failed: '❌', skipped: '⏭️', pending: '⏭️', todo: '📝' };

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeCell = (s) => escapeHtml(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Chemin lisible : `src/…` ou `test/…` plutôt que le chemin absolu du conteneur. */
function relativePath(file) {
    const match = /(?:^|\/)((?:src|test)\/.*)$/.exec(file);
    return match ? match[1] : file.split('/').pop();
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)} s`;
    const rounded = Math.round(s);
    return `${Math.floor(rounded / 60)} min ${String(rounded % 60).padStart(2, '0')} s`;
}

function firstLines(text, max) {
    const lines = stripAnsi(text).trim().split('\n');
    return lines.length > max
        ? [...lines.slice(0, max), `… (${lines.length - max} lignes de plus)`].join('\n')
        : lines.join('\n');
}

function render(report) {
    const files = [...(report.testResults ?? [])]
        .map((f) => {
            const tests = f.assertionResults ?? [];
            const count = (status) => tests.filter((t) => t.status === status).length;
            return {
                path: relativePath(f.name ?? ''),
                status: f.status,
                message: f.message ?? '',
                tests,
                passed: count('passed'),
                failed: count('failed'),
                skipped: tests.length - count('passed') - count('failed'),
                startTime: f.startTime,
                endTime: f.endTime,
                duration: (f.endTime ?? 0) - (f.startTime ?? 0),
            };
        })
        .sort((a, b) => a.path.localeCompare(b.path));

    const total = report.numTotalTests ?? 0;
    const passed = report.numPassedTests ?? 0;
    const failed = report.numFailedTests ?? 0;
    const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
    // Fichier en échec sans test en échec = erreur au chargement (import, connexion DB…).
    const brokenFiles = files.filter((f) => f.status === 'failed' && f.failed === 0);
    const ok = report.success === true && failed === 0 && brokenFiles.length === 0;
    // Durée réelle du run : du premier démarrage au dernier fichier terminé.
    const starts = files.map((f) => f.startTime).filter(Number.isFinite);
    const ends = files.map((f) => f.endTime).filter(Number.isFinite);
    const duration = starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : NaN;

    const out = [];
    out.push(
        ok
            ? `## ✅ Tests backend : ${passed} réussis, 0 échec${skipped ? ` (${skipped} ignorés)` : ''}`
            : `## ❌ Tests backend : ${failed} test(s) en échec, ${brokenFiles.length} fichier(s) en erreur`,
        '',
        '| Fichiers | Tests | ✅ Réussis | ❌ Échecs | ⏭️ Ignorés | ⏱️ Durée |',
        '|---:|---:|---:|---:|---:|---:|',
        `| ${files.length} | ${total} | ${passed} | ${failed} | ${skipped} | ${formatDuration(duration)} |`,
        '',
    );

    if (!ok) {
        out.push('### ❌ Échecs', '');
        for (const f of brokenFiles) {
            out.push(
                `**\`${f.path}\`** : le fichier n'a pas pu s'exécuter`,
                '',
                '````text',
                firstLines(f.message, MAX_FAILURE_LINES),
                '````',
                '',
            );
        }
        for (const f of files) {
            for (const t of f.tests.filter((x) => x.status === 'failed')) {
                const name = [...(t.ancestorTitles ?? []), t.title].join(' › ');
                out.push(
                    `**\`${f.path}\`** › ${escapeHtml(name)}`,
                    '',
                    '````text',
                    firstLines((t.failureMessages ?? []).join('\n'), MAX_FAILURE_LINES),
                    '````',
                    '',
                );
            }
        }
    }

    const head = out.join('\n');
    const details = ['### Détail par fichier', '', '_Cliquer sur un fichier pour voir ses tests._', ''];
    for (const f of files) {
        const icon = f.status === 'failed' ? ICON.failed : f.passed === 0 && f.skipped > 0 ? ICON.skipped : ICON.passed;
        const counts = [
            `${f.passed}/${f.tests.length}`,
            f.failed ? `${f.failed} ❌` : '',
            f.skipped ? `${f.skipped} ⏭️` : '',
        ]
            .filter(Boolean)
            .join(' · ');
        details.push(
            '<details>',
            `<summary>${icon} <code>${escapeHtml(f.path)}</code> : ${counts} (${formatDuration(f.duration)})</summary>`,
            '',
            ...(f.tests.length === 0
                ? ['_Aucun test exécuté : voir « Échecs » ci-dessus._']
                : [
                      '| | Test | Durée |',
                      '|:-:|---|---:|',
                      ...f.tests.map((t) => {
                          const name = [...(t.ancestorTitles ?? []).slice(1), t.title].join(' › ');
                          return `| ${ICON[t.status] ?? '•'} | ${escapeCell(name)} | ${formatDuration(t.duration)} |`;
                      }),
                  ]),
            '',
            '</details>',
            '',
        );
    }
    const full = `${head}\n${details.join('\n')}`;
    return Buffer.byteLength(full) > MAX_SUMMARY_BYTES
        ? `${head}\n_Détail par fichier omis : résumé trop volumineux pour GitHub._\n`
        : full;
}

const [, , reportPath] = process.argv;
if (!reportPath) {
    console.error('Usage : node vitest-summary.mjs <vitest.json>');
    process.exit(0);
}

let report;
try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
    // Les tests n'ont pas démarré (build, DB injoignable…) : le log de l'étape fait foi.
    console.log(
        `## ⚠️ Tests backend : aucun rapport\n\n\`${reportPath}\` illisible (${error.code ?? error.message}). Voir le log de l'étape « Run backend tests ».\n`,
    );
    process.exit(0);
}
console.log(render(report));
