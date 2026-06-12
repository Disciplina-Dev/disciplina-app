import { NeedsAnalysisRepository } from '../repositories/mysql/NeedsAnalysisRepository';
import { NeedsAnalysis } from '../types/needsAnalysis.types';
import { toNeedsAnalysis, toNeedsAnalysisRow } from './mappers/needsAnalysis.mapper';
import { CompaniesService } from './CompaniesService';
import { PdfService } from './PdfService';
import { logger } from '../external/logger';

export class NeedsAnalysisService {
    private repository: NeedsAnalysisRepository;
    private companiesService: CompaniesService;

    constructor() {
        this.repository = new NeedsAnalysisRepository();
        this.companiesService = new CompaniesService();
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
        // Legacy single-position columns are NOT NULL: mirror the first position into them
        const firstPosition = data.positions?.[0];
        const initialData = {
            ...data,
            ...(firstPosition
                ? {
                      trainingDomain: data.trainingDomain ?? firstPosition.trainingDomain,
                      jobTitle: data.jobTitle ?? firstPosition.jobTitle,
                      selectedMissions: data.selectedMissions ?? firstPosition.selectedMissions,
                      localisation: data.localisation ?? firstPosition.localisation,
                      positionsCount: data.positionsCount ?? data.positions!.length,
                  }
                : {}),
            ageRequirements: data.ageRequirements ?? [],
            status: 'BROUILLON' as const
        };
        const rowData = toNeedsAnalysisRow(initialData);
        const id = await this.repository.create(rowData);
        logger.info({ id }, '[NeedsAnalysis] Brouillon created in DB');

        const created = await this.repository.findById(id);
        if (!created) {
            throw new Error('Failed to retrieve created needs analysis');
        }
        logger.info({ id, status: created.status }, '[NeedsAnalysis] create() complete');
        return toNeedsAnalysis(created);
    }

    // Yousign sending is intentionally not wired up yet: the AB stays BROUILLON
    // and the commercial downloads the PDF instead.
    async generatePdf(id: number): Promise<{ buffer: Buffer; filename: string }> {
        const row = await this.repository.findById(id);
        if (!row) {
            throw new Error('Needs analysis not found');
        }
        const analysis = toNeedsAnalysis(row);
        const company = await this.companiesService.findById(analysis.companyID);
        if (!company) {
            throw new Error(`Company with ID ${analysis.companyID} not found`);
        }
        const buffer = await PdfService.generateNeedsAnalysisPdf(analysis, company);
        const filename = `Analyse_Besoin_${company.name?.replace(/\s+/g, '_') || 'Entreprise'}_${id}.pdf`;
        return { buffer, filename };
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
        if (!data.jobTitle && !data.positions?.[0]?.jobTitle) {
            throw new Error('Job title is required');
        }
    }
}
