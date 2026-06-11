import { NeedsAnalysisRepository } from '../repositories/mysql/NeedsAnalysisRepository';
import { NeedsAnalysis } from '../types/needsAnalysis.types';
import { toNeedsAnalysis, toNeedsAnalysisRow } from './mappers/needsAnalysis.mapper';
import { CompaniesService } from './CompaniesService';
import { PdfService } from './PdfService';
import { YousignService } from '../external/yousign/yousign.service';
import { logger } from '../external/logger';
import { PDFDocument } from 'pdf-lib';

export class NeedsAnalysisService {
    private repository: NeedsAnalysisRepository;
    private companiesService: CompaniesService;
    private yousignService: YousignService;

    constructor() {
        this.repository = new NeedsAnalysisRepository();
        this.companiesService = new CompaniesService();
        this.yousignService = new YousignService();
    }

    async findAll(): Promise<NeedsAnalysis[]> {
        const rows = await this.repository.findAll();
        return rows.map(toNeedsAnalysis);
    }

    async findById(id: number): Promise<NeedsAnalysis | null> {
        const row = await this.repository.findById(id);
        return row ? toNeedsAnalysis(row) : null;
    }

    async findByCompanyId(companyId: number): Promise<NeedsAnalysis[]> {
        const rows = await this.repository.findByCompanyId(companyId);
        return rows.map(toNeedsAnalysis);
    }

    async create(data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        logger.info({ companyID: data.companyID, userID: data.userID, jobTitle: data.jobTitle }, '[NeedsAnalysis] create() called');
        this.validateData(data);

        // 1. Fetch Company details
        const company = await this.companiesService.findById(data.companyID!);
        if (!company) {
            logger.error({ companyID: data.companyID }, '[NeedsAnalysis] Company not found');
            throw new Error(`Company with ID ${data.companyID} not found`);
        }
        logger.info(`[NeedsAnalysis] Company found: ${company.name}`);

        // 2. Map input and create initial Brouillon in DB to get an ID
        const initialData = {
            ...data,
            status: 'BROUILLON' as const
        };
        const rowData = toNeedsAnalysisRow(initialData);
        const id = await this.repository.create(rowData);
        logger.info({ id }, '[NeedsAnalysis] Brouillon created in DB');

        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created needs analysis');
        }
        const createdDomain = toNeedsAnalysis(created);

        // 3. Generate PDF Document
        let pdfBuffer: Buffer;
        try {
            logger.info(`[NeedsAnalysis] Generating PDF for analysis #${id}`);
            pdfBuffer = await PdfService.generateNeedsAnalysisPdf(createdDomain, company);
            logger.info({ sizeBytes: pdfBuffer.length }, '[NeedsAnalysis] PDF generated successfully');
        } catch (pdfError: any) {
            logger.error({ err: pdfError }, '[NeedsAnalysis] PDF generation failed');
            throw new Error(`Failed to generate PDF document: ${pdfError.message}`);
        }

        // 4. Initiate Yousign signature procedure
        let yousignRequestId: string | null = null;
        try {
            const nameParts = (createdDomain.recruitmentResponsibleName || 'Responsable Recrutement').trim().split(/\s+/);
            const firstName = nameParts[0] || 'Responsable';
            const lastName = nameParts.slice(1).join(' ') || 'Recrutement';
            const signerEmail = createdDomain.recruitmentResponsibleEmail || company.email || 'recrutement@disciplina.local';
            logger.info({ signerEmail, firstName, lastName }, '[NeedsAnalysis] Initiating Yousign procedure');

            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const lastPage = pdfDoc.getPageCount();

            yousignRequestId = await this.yousignService.initiateSignatureProcedure(
                pdfBuffer,
                `Analyse_Besoin_${company.name?.replace(/\s+/g, '_') || 'Entreprise'}_${id}.pdf`,
                signerEmail,
                firstName,
                lastName,
                lastPage
            );
            logger.info({ yousignRequestId }, '[NeedsAnalysis] Yousign procedure initiated');
        } catch (yousignError: any) {
            logger.error({ err: yousignError }, '[NeedsAnalysis] Yousign failed');
            throw new Error(`Failed to initiate signature request on Yousign: ${yousignError.message}`);
        }

        // 5. Update Needs Analysis with Yousign ID and change status to EN_ATTENTE_SIGNATURE
        if (yousignRequestId) {
            const updatePayload: Partial<NeedsAnalysis> = {
                yousignSignatureRequestID: yousignRequestId,
                status: 'EN_ATTENTE_SIGNATURE' as const
            };
            const updateRowData = toNeedsAnalysisRow(updatePayload);
            await this.repository.update(id, updateRowData);
            logger.info({ id, yousignRequestId }, '[NeedsAnalysis] Status updated to EN_ATTENTE_SIGNATURE');
        }

        const finalCreated = await this.repository.findById(id);
        if (!finalCreated) {
            throw new Error('Failed to retrieve final needs analysis after update');
        }
        logger.info({ id, status: finalCreated.status }, '[NeedsAnalysis] create() complete');
        return toNeedsAnalysis(finalCreated);
    }

    async update(id: number, data: Partial<NeedsAnalysis>): Promise<NeedsAnalysis> {
        if (!id || id <= 0) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }
        const rowData = toNeedsAnalysisRow(data);
        await this.repository.update(id, rowData);
        const updated = await this.repository.findById(id);
        if (!updated) {
            throw new Error('Needs analysis not found after update');
        }
        return toNeedsAnalysis(updated);
    }

    async delete(id: number): Promise<boolean> {
        if (!id || id <= 0) {
            throw new Error('Valid needs analysis ID is required');
        }
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Needs analysis not found');
        }
        return this.repository.delete(id);
    }

    private validateData(data: Partial<NeedsAnalysis>): void {
        if (!data.companyID) {
            throw new Error('Company ID is required');
        }
        if (!data.userID) {
            throw new Error('User ID is required');
        }
        if (!data.jobTitle) {
            throw new Error('Job title is required');
        }
    }
}
