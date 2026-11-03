import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import {
    AttestationDto,
    AttendanceExportDto,
    AttendanceExportRow,
    GroupSummaryDto,
    HistoryExportDto,
    SeanceDetailDto,
} from './EmargementService';
import { EmargementPdfTheme, EMARGEMENT_PDF_THEME_SPECS, EmargementPdfThemeSpec } from './emargementPdfThemes';
import {
    EmargementHalf,
    EmargementHistoryAction,
    EmargementHistorySource,
    EmargementStatus,
} from '../types/emargement.types';

/**
 * Rendu des exports d'émargement (#955, §8) : feuille de séance en PDF,
 * attestation d'assiduité, présences / heures en CSV ou Excel, journal d'audit
 * en CSV. Le rendu ne fait aucune requête : il travaille sur les DTO produits
 * par `EmargementService`, ce qui garde les mêmes règles de calcul (heures,
 * validation) entre l'écran et les documents.
 */

const HALF_LABELS: Record<EmargementHalf, string> = { morning: 'Matin', afternoon: 'Après-midi' };

const STATUS_LABELS: Record<EmargementStatus, string> = {
    na: 'Non renseigné',
    present: 'Présent',
    absent: 'Absent',
    late: 'En retard',
    left_early: 'Parti en avance',
};

const HISTORY_ACTION_LABELS: Record<EmargementHistoryAction, string> = {
    seance_created: 'Feuille créée',
    attendance_set: 'Statut modifié',
    attendance_signed: 'Signature tracée',
    qr_signed: 'Signature par QR code',
    half_signed: 'Demi-journée signée',
    half_validated: 'Validée par le pédagogique',
};

const SOURCE_LABELS: Record<EmargementHistorySource, string> = {
    peda: 'Service pédagogique',
    formateur: 'Formateur',
    alternant: 'Alternant',
    system: 'Système',
};

const PAGE_MARGIN = 40;

function longDate(isoDate: string | null | undefined): string {
    if (!isoDate) return '—';
    const date = new Date(`${isoDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

function shortDate(isoDate: string | null | undefined): string {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function shortDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/** « 3 h 30 », « 4 h », « 0 h » — durée lisible dans un document officiel. */
export function formatHours(minutes: number): string {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Heures décimales pour un tableur (« 3,50 » en CSV, 3.5 en Excel). */
export function hoursDecimal(minutes: number): number {
    return Math.round((Math.max(0, minutes) / 60) * 100) / 100;
}

function percent(attended: number, planned: number): string {
    if (planned <= 0) return '—';
    return `${Math.round((attended / planned) * 100)} %`;
}

function dataUrlToBuffer(dataUrl: string | null | undefined): Buffer | null {
    if (!dataUrl) return null;
    const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    try {
        return Buffer.from(match[2], 'base64');
    } catch {
        return null;
    }
}

function signatureLabel(signedAt: string): string {
    return `Signé le ${shortDateTime(signedAt)}`;
}

// ─── PDF : briques communes ──────────────────────────────────────────────────

function createPdf(): { doc: PDFKit.PDFDocument; done: Promise<Buffer> } {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
        bufferPages: true,
        info: { Title: 'Émargement', Author: 'Disciplina' },
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
    return { doc, done };
}

function contentWidth(doc: PDFKit.PDFDocument): number {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/** Bandeau d'en-tête : mention de charte, titre du document et filet d'accent. */
function drawHeaderBand(doc: PDFKit.PDFDocument, theme: EmargementPdfThemeSpec, title: string, subtitle: string): void {
    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    const top = doc.y;

    doc.rect(left, top, width, 58).fill(theme.soft);
    doc.rect(left, top, 4, 58).fill(theme.accent);

    doc.font('Helvetica-Bold')
        .fillColor(theme.accent)
        .fontSize(8)
        .text(theme.brandLabel.toUpperCase(), left + 14, top + 10, { width: width - 28, characterSpacing: 0.6 });
    doc.font('Helvetica-Bold')
        .fillColor('#111827')
        .fontSize(17)
        .text(title, left + 14, top + 22, { width: width - 28 });
    doc.font('Helvetica')
        .fillColor('#4b5563')
        .fontSize(9)
        .text(subtitle, left + 14, top + 43, { width: width - 28, lineBreak: false });

    doc.y = top + 58;
    doc.moveDown(0.8);

    if (theme.band) {
        doc.font('Helvetica-Oblique').fillColor(theme.accent).fontSize(7.5).text(theme.band, left, doc.y, { width });
        doc.moveDown(0.6);
    }
}

function drawKeyValueRows(
    doc: PDFKit.PDFDocument,
    rows: { label: string; value: string }[],
    theme: EmargementPdfThemeSpec,
): void {
    const left = doc.page.margins.left;
    const labelWidth = 120;
    const width = contentWidth(doc);
    for (const row of rows) {
        const y = doc.y;
        doc.font('Helvetica-Bold').fillColor('#374151').fontSize(8.5).text(row.label, left, y, {
            width: labelWidth,
        });
        doc.font('Helvetica')
            .fillColor('#111827')
            .fontSize(8.5)
            .text(row.value || '—', left + labelWidth, y, {
                width: width - labelWidth,
            });
        doc.y = Math.max(doc.y, y + 12);
    }
    doc.moveDown(0.4);
    doc.moveTo(left, doc.y)
        .lineTo(left + width, doc.y)
        .lineWidth(0.5)
        .strokeColor(theme.accent)
        .stroke();
    doc.moveDown(0.6);
}

function drawFooters(doc: PDFKit.PDFDocument, theme: EmargementPdfThemeSpec): void {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const left = doc.page.margins.left;
        const width = contentWidth(doc);
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        let y = doc.page.height - 46;
        doc.font('Helvetica').fillColor('#6b7280').fontSize(6.2);
        for (const line of theme.footerLines) {
            doc.text(line, left, y, { width: width - 40, align: 'left', lineBreak: false });
            y += 7.5;
        }
        doc.font('Helvetica')
            .fillColor('#6b7280')
            .fontSize(6.5)
            .text(`Page ${i - range.start + 1} / ${range.count}`, left, y, {
                width,
                align: 'right',
                lineBreak: false,
            });
        doc.page.margins.bottom = savedBottom;
    }
}

/** Ajoute une page si le bloc à venir ne tient pas, puis rejoue l'en-tête de tableau. */
function ensureSpace(doc: PDFKit.PDFDocument, height: number, onNewPage?: () => void): void {
    const bottom = doc.page.height - doc.page.margins.bottom - 58; // réserve le pied de page
    if (doc.y + height <= bottom) return;
    doc.addPage();
    onNewPage?.();
}

// ─── PDF : feuille de séance ─────────────────────────────────────────────────

function attendanceColumns(hasAfternoon: boolean): number[] {
    return hasAfternoon ? [195, 160, 160] : [255, 260];
}

function drawAttendanceTableHeader(
    doc: PDFKit.PDFDocument,
    theme: EmargementPdfThemeSpec,
    hasAfternoon: boolean,
): void {
    const left = doc.page.margins.left;
    const widths = attendanceColumns(hasAfternoon);
    const headers = hasAfternoon ? ['Alternant', 'Matin', 'Après-midi'] : ['Alternant', 'Matin'];
    const y = doc.y;
    doc.rect(
        left,
        y,
        widths.reduce((a, b) => a + b, 0),
        18,
    ).fill(theme.soft);
    doc.font('Helvetica-Bold').fillColor(theme.accent).fontSize(8.5);
    let x = left;
    headers.forEach((header, index) => {
        doc.text(header, x + 6, y + 5, { width: widths[index] - 12, lineBreak: false });
        x += widths[index];
    });
    doc.y = y + 18;
}

function drawAttendanceRow(
    doc: PDFKit.PDFDocument,
    dto: SeanceDetailDto,
    row: SeanceDetailDto['alternants'][number],
    theme: EmargementPdfThemeSpec,
): void {
    const left = doc.page.margins.left;
    const hasAfternoon = Boolean(dto.afternoonStart);
    const widths = attendanceColumns(hasAfternoon);
    const hasImages = Boolean(
        row.attendance.morning?.signatureImage || (hasAfternoon && row.attendance.afternoon?.signatureImage),
    );
    const rowHeight = hasImages ? 62 : 30;
    ensureSpace(doc, rowHeight, () => drawAttendanceTableHeader(doc, theme, hasAfternoon));

    const y = doc.y;
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    doc.rect(left, y, totalWidth, rowHeight).lineWidth(0.4).strokeColor('#e5e7eb').stroke();

    // Nom + financeur (le financeur figure sur la feuille : exigence OPCO).
    doc.font('Helvetica-Bold')
        .fillColor('#111827')
        .fontSize(8.5)
        .text(`${row.firstName} ${row.lastName}`, left + 6, y + 6, {
            width: widths[0] - 12,
        });
    if (row.financeur) {
        doc.font('Helvetica')
            .fillColor('#6b7280')
            .fontSize(6.8)
            .text(`Financeur : ${row.financeur}`, left + 6, y + 18, {
                width: widths[0] - 12,
            });
    }

    let x = left + widths[0];
    const halves: EmargementHalf[] = hasAfternoon ? ['morning', 'afternoon'] : ['morning'];
    for (const half of halves) {
        const width = half === 'morning' ? widths[1] : widths[2];
        const record = row.attendance[half];
        const validation = dto.validations[half];
        doc.moveTo(x, y)
            .lineTo(x, y + rowHeight)
            .lineWidth(0.4)
            .strokeColor('#e5e7eb')
            .stroke();

        if (record) {
            const status = STATUS_LABELS[record.status] + (record.statusTime ? ` · ${record.statusTime}` : '');
            doc.font('Helvetica-Bold')
                .fillColor('#111827')
                .fontSize(8)
                .text(status, x + 6, y + 6, {
                    width: width - 12,
                });
            doc.font('Helvetica')
                .fillColor('#6b7280')
                .fontSize(6.8)
                .text(signatureLabel(record.signedAt), x + 6, y + 18, {
                    width: width - 12,
                });
            const buffer = dataUrlToBuffer(record.signatureImage);
            if (buffer) {
                try {
                    doc.image(buffer, x + 6, y + 28, { fit: [90, 22] });
                } catch {
                    // Tracé illisible : la mention de signature reste la preuve.
                }
            }
        } else {
            doc.font('Helvetica')
                .fillColor('#9ca3af')
                .fontSize(8)
                .text('Non renseigné', x + 6, y + 6, {
                    width: width - 12,
                });
        }

        if (validation) {
            doc.font('Helvetica-Oblique')
                .fillColor(theme.accent)
                .fontSize(6.4)
                .text(
                    validation.source === 'peda' ? 'Validée par le pédagogique' : 'Demi-journée signée',
                    x + 6,
                    y + rowHeight - 10,
                    { width: width - 12, lineBreak: false },
                );
        }
        x += width;
    }
    doc.y = y + rowHeight;
}

function drawValidationBlocks(doc: PDFKit.PDFDocument, dto: SeanceDetailDto): void {
    const halves: EmargementHalf[] = dto.afternoonStart ? ['morning', 'afternoon'] : ['morning'];
    ensureSpace(doc, 70 + halves.length * 46, () => undefined);
    doc.font('Helvetica-Bold')
        .fillColor('#111827')
        .fontSize(10)
        .text('Signatures du formateur', doc.page.margins.left, doc.y, {
            width: contentWidth(doc),
        });
    doc.moveDown(0.4);

    for (const half of halves) {
        const validation = dto.validations[half];
        ensureSpace(doc, 46);
        const left = doc.page.margins.left;
        const width = contentWidth(doc);
        const y = doc.y;
        doc.rect(left, y, width, 42).lineWidth(0.4).strokeColor('#e5e7eb').stroke();

        doc.font('Helvetica-Bold')
            .fillColor('#374151')
            .fontSize(8)
            .text(HALF_LABELS[half], left + 8, y + 6, {
                width: 70,
            });

        if (validation) {
            const source =
                validation.source === 'peda' ? 'Validée par le service pédagogique' : 'Signée par le formateur';
            doc.font('Helvetica')
                .fillColor('#111827')
                .fontSize(8)
                .text(
                    `${source} — ${validation.signedByName} — ${shortDateTime(validation.signedAt)}`,
                    left + 78,
                    y + 6,
                    { width: width - 160 },
                );
            const buffer = dataUrlToBuffer(validation.signatureImage);
            if (buffer) {
                try {
                    doc.image(buffer, left + width - 130, y + 6, { fit: [120, 30] });
                } catch {
                    // Signature illisible : l'identité + l'horodatage restent la preuve.
                }
            }
            if (dto.validationNote) {
                doc.font('Helvetica-Oblique')
                    .fillColor('#6b7280')
                    .fontSize(6.8)
                    .text(`Motif : ${dto.validationNote}`, left + 78, y + 20, { width: width - 160 });
            }
        } else {
            doc.font('Helvetica-Oblique')
                .fillColor('#b45309')
                .fontSize(8)
                .text('Demi-journée non signée à la date d’édition.', left + 78, y + 6, { width: width - 130 });
        }
        doc.y = y + 42;
        doc.moveDown(0.3);
    }
}

function seancePdf(dto: SeanceDetailDto, themeKey: EmargementPdfTheme): Promise<Buffer> {
    const theme = EMARGEMENT_PDF_THEME_SPECS[themeKey];
    const { doc, done } = createPdf();

    drawHeaderBand(doc, theme, 'FEUILLE D’ÉMARGEMENT', `${dto.sessionNom} — ${longDate(dto.date)}`);
    drawKeyValueRows(
        doc,
        [
            { label: 'Titre professionnel', value: dto.degreeTitle ?? '—' },
            { label: 'Module / séquence', value: dto.module ?? '—' },
            { label: 'Horaires', value: `${dto.startTime} – ${dto.endTime}` },
            { label: 'Site / modalité', value: `${dto.site} · ${dto.mode === 'salle' ? 'En salle' : 'Distanciel'}` },
            { label: 'Lieu', value: dto.location ?? '—' },
            { label: 'Formateur', value: dto.formateurName },
            {
                label: 'Créneaux de signature',
                value: dto.afternoonStart
                    ? `Matin ${dto.morningStart}–${dto.morningEnd} · Après-midi ${dto.afternoonStart}–${dto.afternoonEnd}`
                    : `Matin ${dto.morningStart}–${dto.morningEnd}`,
            },
            {
                label: 'État de la feuille',
                value:
                    dto.validationStatus === 'validated'
                        ? 'Validée'
                        : dto.validationStatus === 'to_validate'
                          ? 'À valider (créneaux fermés)'
                          : dto.validationStatus === 'anomaly'
                            ? 'Anomalie (lien expiré, demi-journée non signée)'
                            : 'En cours',
            },
        ],
        theme,
    );

    drawAttendanceTableHeader(doc, theme, Boolean(dto.afternoonStart));
    for (const row of dto.alternants) drawAttendanceRow(doc, dto, row, theme);

    if (dto.alternants.length === 0) {
        doc.font('Helvetica-Oblique')
            .fillColor('#6b7280')
            .fontSize(9)
            .text('Aucun alternant rattaché à cette session.', doc.page.margins.left, doc.y, {
                width: contentWidth(doc),
            });
    }

    doc.moveDown(1);
    drawValidationBlocks(doc, dto);
    drawFooters(doc, theme);
    doc.end();
    return done;
}

// ─── PDF : attestation d'assiduité ──────────────────────────────────────────

function attestationPdf(attestation: AttestationDto, themeKey: EmargementPdfTheme): Promise<Buffer> {
    const theme = EMARGEMENT_PDF_THEME_SPECS[themeKey];
    const { doc, done } = createPdf();
    const fullName = `${attestation.firstName} ${attestation.lastName}`;

    drawHeaderBand(
        doc,
        theme,
        'ATTESTATION D’ASSIDUITÉ',
        `${attestation.sessionNom} — ${longDate(attestation.from)} au ${longDate(attestation.to)}`,
    );

    doc.font('Helvetica')
        .fillColor('#111827')
        .fontSize(9.5)
        .text(
            `Le centre de formation Disciplina atteste que ${fullName} a suivi la formation ` +
                `${attestation.degreeTitle ?? attestation.sessionNom} pour la période du ` +
                `${longDate(attestation.from)} au ${longDate(attestation.to)}.`,
            doc.page.margins.left,
            doc.y,
            { width: contentWidth(doc), align: 'justify' },
        );
    doc.moveDown(0.9);

    drawKeyValueRows(
        doc,
        [
            { label: 'Bénéficiaire', value: fullName },
            { label: 'Formation', value: attestation.degreeTitle ?? '—' },
            { label: 'Session', value: attestation.sessionNom },
            { label: 'Financeur', value: attestation.financeur ?? '—' },
            {
                label: 'Période',
                value: `${longDate(attestation.from)} au ${longDate(attestation.to)}`,
            },
        ],
        theme,
    );

    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    const y = doc.y;
    doc.rect(left, y, width, 46).fill(theme.soft);
    const cellWidth = width / 3;
    const totals: { label: string; value: string }[] = [
        { label: 'Heures prévues', value: formatHours(attestation.plannedMinutes) },
        { label: 'Heures réalisées', value: formatHours(attestation.attendedMinutes) },
        {
            label: 'Taux d’assiduité',
            value: percent(attestation.attendedMinutes, attestation.plannedMinutes),
        },
    ];
    totals.forEach((total, index) => {
        const x = left + index * cellWidth;
        doc.font('Helvetica')
            .fillColor('#6b7280')
            .fontSize(7)
            .text(total.label, x + 8, y + 10, {
                width: cellWidth - 16,
            });
        doc.font('Helvetica-Bold')
            .fillColor(theme.accent)
            .fontSize(14)
            .text(total.value, x + 8, y + 22, {
                width: cellWidth - 16,
            });
    });
    doc.y = y + 46;
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(10).text('Détail des séances', left, doc.y, { width });
    doc.moveDown(0.4);

    const columns = [70, 150, 100, 100, 95];
    const headers = ['Date', 'Module', 'Matin', 'Après-midi', 'Heures'];
    const drawHeader = () => {
        const top = doc.y;
        doc.rect(
            left,
            top,
            columns.reduce((a, b) => a + b, 0),
            18,
        ).fill(theme.soft);
        doc.font('Helvetica-Bold').fillColor(theme.accent).fontSize(7.5);
        let x = left;
        headers.forEach((header, index) => {
            doc.text(header, x + 5, top + 5, { width: columns[index] - 10, lineBreak: false });
            x += columns[index];
        });
        doc.y = top + 18;
    };

    drawHeader();
    for (const seance of attestation.seances) {
        ensureSpace(doc, 26, drawHeader);
        const top = doc.y;
        const values = [
            shortDate(seance.date),
            seance.module ?? '—',
            halfLabel(seance.halves.find((h) => h.half === 'morning')),
            halfLabel(seance.halves.find((h) => h.half === 'afternoon')),
            `${formatHours(seance.attendedMinutes)} / ${formatHours(seance.plannedMinutes)}`,
        ];
        doc.font('Helvetica').fillColor('#111827').fontSize(7.8);
        let x = left;
        values.forEach((value, index) => {
            doc.text(value, x + 5, top + 6, { width: columns[index] - 10, lineBreak: false });
            x += columns[index];
        });
        doc.moveTo(left, top + 24)
            .lineTo(left + columns.reduce((a, b) => a + b, 0), top + 24)
            .lineWidth(0.3)
            .strokeColor('#e5e7eb')
            .stroke();
        doc.y = top + 26;
    }

    if (attestation.seances.length === 0) {
        doc.font('Helvetica-Oblique')
            .fillColor('#6b7280')
            .fontSize(8.5)
            .text('Aucune séance d’émargement sur la période.', left, doc.y, { width: contentWidth(doc) });
    }

    doc.moveDown(1.4);
    ensureSpace(doc, 90);
    doc.font('Helvetica')
        .fillColor('#111827')
        .fontSize(9)
        .text(`Fait à Sainte-Marie, le ${shortDate(attestation.generatedAt)}.`, left, doc.y, {
            width: contentWidth(doc),
        });
    doc.moveDown(1.6);
    const signY = doc.y;
    doc.font('Helvetica-Bold')
        .fillColor('#374151')
        .fontSize(8)
        .text('Le service pédagogique', left + width - 190, signY, {
            width: 190,
            align: 'center',
        });
    doc.moveTo(left + width - 170, signY + 40)
        .lineTo(left + width - 20, signY + 40)
        .lineWidth(0.6)
        .strokeColor('#9ca3af')
        .stroke();

    drawFooters(doc, theme);
    doc.end();
    return done;
}

function halfLabel(
    half: { half: EmargementHalf; status: EmargementStatus; statusTime: string | null } | undefined,
): string {
    if (!half) return '—';
    if (half.status === 'na') return 'Non renseigné';
    return `${STATUS_LABELS[half.status]}${half.statusTime ? ` · ${half.statusTime}` : ''}`;
}

// ─── PDF : récapitulatif de groupe ──────────────────────────────────────────

function groupPdf(summary: GroupSummaryDto, themeKey: EmargementPdfTheme): Promise<Buffer> {
    const theme = EMARGEMENT_PDF_THEME_SPECS[themeKey];
    const { doc, done } = createPdf();
    const left = doc.page.margins.left;
    const width = contentWidth(doc);

    drawHeaderBand(
        doc,
        theme,
        'RÉCAPITULATIF D’ASSIDUITÉ — GROUPE',
        `${summary.sessionNom} — ${longDate(summary.from)} au ${longDate(summary.to)}`,
    );

    doc.font('Helvetica')
        .fillColor('#111827')
        .fontSize(9.5)
        .text(
            `Synthèse des présences et des heures de la session ${summary.sessionNom}` +
                (summary.degreeTitle ? ` (${summary.degreeTitle})` : '') +
                ` sur la période du ${longDate(summary.from)} au ${longDate(summary.to)}.`,
            left,
            doc.y,
            { width, align: 'justify' },
        );
    doc.moveDown(0.9);

    const y = doc.y;
    doc.rect(left, y, width, 46).fill(theme.soft);
    const cellWidth = width / 4;
    const totals = [
        { label: 'Alternants', value: String(summary.rows.length) },
        { label: 'Heures prévues', value: formatHours(summary.plannedMinutes) },
        { label: 'Heures réalisées', value: formatHours(summary.attendedMinutes) },
        {
            label: 'Taux d’assiduité',
            value: percent(summary.attendedMinutes, summary.plannedMinutes),
        },
    ];
    totals.forEach((total, index) => {
        const x = left + index * cellWidth;
        doc.font('Helvetica')
            .fillColor('#6b7280')
            .fontSize(7)
            .text(total.label, x + 8, y + 10, {
                width: cellWidth - 16,
            });
        doc.font('Helvetica-Bold')
            .fillColor(theme.accent)
            .fontSize(14)
            .text(total.value, x + 8, y + 22, {
                width: cellWidth - 16,
            });
    });
    doc.y = y + 46;
    doc.moveDown(1);

    const columns = [170, 105, 55, 55, 65, 65];
    const headers = ['Alternant', 'Financeur', 'Séances', 'Absences', 'Prévu', 'Réalisé'];
    const drawHeader = () => {
        const top = doc.y;
        doc.rect(
            left,
            top,
            columns.reduce((a, b) => a + b, 0),
            18,
        ).fill(theme.soft);
        doc.font('Helvetica-Bold').fillColor(theme.accent).fontSize(7.5);
        let x = left;
        headers.forEach((header, index) => {
            doc.text(header, x + 5, top + 5, { width: columns[index] - 10, lineBreak: false });
            x += columns[index];
        });
        doc.y = top + 18;
    };

    drawHeader();
    for (const row of summary.rows) {
        ensureSpace(doc, 26, drawHeader);
        const top = doc.y;
        const values = [
            `${row.firstName} ${row.lastName}`,
            row.financeur ?? '—',
            String(row.sessions),
            String(row.absences),
            formatHours(row.plannedMinutes),
            formatHours(row.attendedMinutes),
        ];
        doc.font('Helvetica').fillColor('#111827').fontSize(7.8);
        let x = left;
        values.forEach((value, index) => {
            doc.text(value, x + 5, top + 6, { width: columns[index] - 10, lineBreak: false });
            x += columns[index];
        });
        doc.moveTo(left, top + 24)
            .lineTo(left + columns.reduce((a, b) => a + b, 0), top + 24)
            .lineWidth(0.3)
            .strokeColor('#e5e7eb')
            .stroke();
        doc.y = top + 26;
    }

    if (summary.rows.length === 0) {
        doc.font('Helvetica-Oblique')
            .fillColor('#6b7280')
            .fontSize(8.5)
            .text('Aucun alternant émargé sur la période.', left, doc.y, { width });
    }

    doc.moveDown(1.4);
    ensureSpace(doc, 90);
    doc.font('Helvetica')
        .fillColor('#111827')
        .fontSize(9)
        .text(`Fait à Sainte-Marie, le ${shortDate(summary.generatedAt)}.`, left, doc.y, { width });
    doc.moveDown(1.6);
    const signY = doc.y;
    doc.font('Helvetica-Bold')
        .fillColor('#374151')
        .fontSize(8)
        .text('Le service pédagogique', left + width - 190, signY, {
            width: 190,
            align: 'center',
        });
    doc.moveTo(left + width - 170, signY + 40)
        .lineTo(left + width - 20, signY + 40)
        .lineWidth(0.6)
        .strokeColor('#9ca3af')
        .stroke();

    drawFooters(doc, theme);
    doc.end();
    return done;
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    // BOM + `;` : ouverture directe dans Excel français sans assistant d'import.
    return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

const ATTENDANCE_HEADERS = [
    'Date',
    'Début séance',
    'Fin séance',
    'Session',
    'Titre professionnel',
    'Module',
    'Formateur',
    'Site',
    'Modalité',
    'Alternant',
    'Prénom',
    'Nom',
    'Financeur',
    'Demi-journée',
    'Statut',
    'Heure',
    'Heures prévues',
    'Heures réalisées',
    'Signature',
    'Signé le',
    'Validation',
    'État feuille',
];

function attendanceRowValues(row: AttendanceExportRow): (string | number | null)[] {
    return [
        row.date,
        row.startTime,
        row.endTime,
        row.sessionNom,
        row.degreeTitle,
        row.module,
        row.formateurName,
        row.site,
        row.mode === 'salle' ? 'En salle' : 'Distanciel',
        `${row.firstName} ${row.lastName}`,
        row.firstName,
        row.lastName,
        row.financeur,
        HALF_LABELS[row.half],
        STATUS_LABELS[row.status],
        row.statusTime,
        hoursDecimal(row.plannedMinutes).toFixed(2).replace('.', ','),
        hoursDecimal(row.attendedMinutes).toFixed(2).replace('.', ','),
        signatureSourceLabel(row.signatureMode),
        row.signedAt ? shortDateTime(row.signedAt) : null,
        validationLabel(row),
        validationStatusLabel(row.validationStatus),
    ];
}

function signatureSourceLabel(mode: AttendanceExportRow['signatureMode']): string {
    if (!mode) return '';
    return mode === 'qr' ? 'QR code' : mode === 'handwritten' ? 'Signature tracée' : 'Saisie manuelle';
}

function validationStatusLabel(status: AttendanceExportRow['validationStatus']): string {
    switch (status) {
        case 'validated':
            return 'Validée';
        case 'to_validate':
            return 'À valider';
        case 'anomaly':
            return 'Anomalie';
        default:
            return 'En cours';
    }
}

/** Texte de la colonne « Validation » : qui a signé, ou que la demi-journée manque. */
function validationLabel(row: AttendanceExportRow): string {
    if (!row.validation) return 'Non signée';
    return row.validation.source === 'peda'
        ? `Régularisée par le pédagogique (${row.validation.signedByName})`
        : `Signée par le formateur (${row.validation.signedByName})`;
}

function attendanceCsv(data: AttendanceExportDto): string {
    const rows = data.rows.map(attendanceRowValues);
    const summaryHeader = [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Synthèse par alternant',
        '',
        '',
        '',
        '',
        '',
        '',
        'Heures prévues',
        'Heures réalisées',
        'Taux',
        'Absences',
        'Séances',
        '',
    ];
    const summaryRows = data.summaries.map((summary) => [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${summary.firstName} ${summary.lastName}`,
        summary.firstName,
        summary.lastName,
        summary.financeur,
        '',
        '',
        '',
        hoursDecimal(summary.plannedMinutes).toFixed(2).replace('.', ','),
        hoursDecimal(summary.attendedMinutes).toFixed(2).replace('.', ','),
        percent(summary.attendedMinutes, summary.plannedMinutes),
        summary.absences,
        summary.sessions,
        '',
    ]);
    return toCsv(ATTENDANCE_HEADERS, [...rows, summaryHeader, ...summaryRows]);
}

const HISTORY_HEADERS = [
    'Horodatage',
    'Date séance',
    'Session',
    'Séance',
    'Action',
    'Alternant',
    'Demi-journée',
    'Statut avant',
    'Statut après',
    'Heure avant',
    'Heure après',
    'Auteur',
    'Source',
    'Motif',
];

function historyCsv(data: HistoryExportDto): string {
    return toCsv(
        HISTORY_HEADERS,
        data.rows.map((row) => [
            shortDateTime(row.at),
            row.date,
            row.sessionNom,
            row.seanceId,
            HISTORY_ACTION_LABELS[row.action],
            row.alternantName,
            row.half ? HALF_LABELS[row.half] : null,
            row.fromStatus ? STATUS_LABELS[row.fromStatus] : null,
            row.toStatus ? STATUS_LABELS[row.toStatus] : null,
            row.fromStatusTime,
            row.toStatusTime,
            row.actorName,
            SOURCE_LABELS[row.source],
            row.note,
        ]),
    );
}

// ─── Excel ──────────────────────────────────────────────────────────────────

function styleHeaderRow(sheet: ExcelJS.Worksheet, columns: number): void {
    const row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1130A7' } };
    row.alignment = { vertical: 'middle' };
    row.height = 20;
    for (let i = 1; i <= columns; i += 1) {
        sheet.getColumn(i).alignment = { vertical: 'top', wrapText: true };
    }
}

async function attendanceXlsx(data: AttendanceExportDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Disciplina';
    workbook.created = new Date(data.generatedAt);

    const detail = workbook.addWorksheet('Présences');
    detail.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Début', key: 'startTime', width: 8 },
        { header: 'Fin', key: 'endTime', width: 8 },
        { header: 'Session', key: 'sessionNom', width: 28 },
        { header: 'Titre professionnel', key: 'degreeTitle', width: 24 },
        { header: 'Module', key: 'module', width: 28 },
        { header: 'Formateur', key: 'formateurName', width: 22 },
        { header: 'Site', key: 'site', width: 10 },
        { header: 'Modalité', key: 'mode', width: 12 },
        { header: 'Alternant', key: 'alternant', width: 26 },
        { header: 'Financeur', key: 'financeur', width: 18 },
        { header: 'Demi-journée', key: 'half', width: 12 },
        { header: 'Statut', key: 'status', width: 15 },
        { header: 'Heure', key: 'statusTime', width: 8 },
        { header: 'Heures prévues', key: 'planned', width: 14 },
        { header: 'Heures réalisées', key: 'attended', width: 15 },
        { header: 'Signature', key: 'signature', width: 18 },
        { header: 'Signé le', key: 'signedAt', width: 17 },
        { header: 'Validation', key: 'validation', width: 34 },
        { header: 'État feuille', key: 'validationStatus', width: 13 },
    ];
    for (const row of data.rows) {
        detail.addRow({
            date: row.date,
            startTime: row.startTime,
            endTime: row.endTime,
            sessionNom: row.sessionNom,
            degreeTitle: row.degreeTitle ?? '',
            module: row.module ?? '',
            formateurName: row.formateurName,
            site: row.site,
            mode: row.mode === 'salle' ? 'En salle' : 'Distanciel',
            alternant: `${row.firstName} ${row.lastName}`,
            financeur: row.financeur ?? '',
            half: HALF_LABELS[row.half],
            status: STATUS_LABELS[row.status],
            statusTime: row.statusTime ?? '',
            planned: hoursDecimal(row.plannedMinutes),
            attended: hoursDecimal(row.attendedMinutes),
            signature: signatureSourceLabel(row.signatureMode),
            signedAt: row.signedAt ? shortDateTime(row.signedAt) : '',
            validation: validationLabel(row),
            validationStatus: validationStatusLabel(row.validationStatus),
        });
    }
    styleHeaderRow(detail, detail.columns.length);
    detail.getColumn('planned').numFmt = '0.00';
    detail.getColumn('attended').numFmt = '0.00';
    detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: detail.columns.length } };
    detail.views = [{ state: 'frozen', ySplit: 1 }];

    const summary = workbook.addWorksheet('Synthèse');
    summary.columns = [
        { header: 'Alternant', key: 'alternant', width: 30 },
        { header: 'Financeur', key: 'financeur', width: 20 },
        { header: 'Séances', key: 'sessions', width: 10 },
        { header: 'Demi-journées', key: 'halves', width: 15 },
        { header: 'Absences', key: 'absences', width: 11 },
        { header: 'Heures prévues', key: 'planned', width: 15 },
        { header: 'Heures réalisées', key: 'attended', width: 16 },
        { header: "Taux d'assiduité", key: 'rate', width: 16 },
    ];
    for (const row of data.summaries) {
        summary.addRow({
            alternant: `${row.firstName} ${row.lastName}`,
            financeur: row.financeur ?? '',
            sessions: row.sessions,
            halves: row.halves,
            absences: row.absences,
            planned: hoursDecimal(row.plannedMinutes),
            attended: hoursDecimal(row.attendedMinutes),
            rate: row.plannedMinutes > 0 ? Math.round((row.attendedMinutes / row.plannedMinutes) * 100) / 100 : null,
        });
    }
    styleHeaderRow(summary, summary.columns.length);
    summary.getColumn('planned').numFmt = '0.00';
    summary.getColumn('attended').numFmt = '0.00';
    summary.getColumn('rate').numFmt = '0 %';
    summary.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
}

// ─── API du service ────────────────────────────────────────────────────────

export class EmargementExportService {
    /** Feuille d'émargement d'une séance, prête à signer / archiver. */
    seancePdf(seance: SeanceDetailDto, theme: EmargementPdfTheme = 'disciplina'): Promise<Buffer> {
        return seancePdf(seance, theme);
    }

    /** Attestation d'assiduité d'un alternant sur une période. */
    attestationPdf(attestation: AttestationDto, theme: EmargementPdfTheme = 'disciplina'): Promise<Buffer> {
        return attestationPdf(attestation, theme);
    }

    /** Récapitulatif d'assiduité d'un groupe (session, période). */
    groupPdf(summary: GroupSummaryDto, theme: EmargementPdfTheme = 'disciplina'): Promise<Buffer> {
        return groupPdf(summary, theme);
    }

    attendanceCsv(data: AttendanceExportDto): string {
        return attendanceCsv(data);
    }

    attendanceXlsx(data: AttendanceExportDto): Promise<Buffer> {
        return attendanceXlsx(data);
    }

    historyCsv(data: HistoryExportDto): string {
        return historyCsv(data);
    }
}
