import { Candidate } from '../../types/candidate.types';
import { Job } from '../../types/job.types';

export function camelToSnakeCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(camelToSnakeCase);
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            result[snakeKey] = camelToSnakeCase(obj[key]);
        }
    }
    return result;
}

export function snakeToCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(snakeToCamelCase);
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            result[camelKey] = snakeToCamelCase(obj[key]);
        }
    }
    return result;
}

export function candidateToGql(candidate: Candidate): any {
    return {
        id: candidate._id,
        status: candidate.status,
        tpType: candidate.tp_type,
        trainingSite: candidate.training_site,
        immersionAgreement: candidate.immersion_agreement,
        desiredSectors: candidate.desired_sectors,
        expectedCompanySkills: candidate.expected_company_skills,
        identity: candidate.identity ? snakeToCamelCase(candidate.identity) : null,
        education: candidate.education ? snakeToCamelCase(candidate.education) : null,
        support: candidate.support ? snakeToCamelCase(candidate.support) : null,
        background: candidate.background ? snakeToCamelCase(candidate.background) : null,
        profile: candidate.profile ? snakeToCamelCase(candidate.profile) : null,
        professionalProjects: candidate.professional_projects
            ? snakeToCamelCase(candidate.professional_projects)
            : null,
        skillsAssessment: candidate.skills_assessment
            ? candidate.skills_assessment.map((s) => snakeToCamelCase(s))
            : null,
        jobInfo: candidate.job_info ? snakeToCamelCase(candidate.job_info) : null,
        synthesis: candidate.synthesis ? snakeToCamelCase(candidate.synthesis) : null,
        pdfLink: candidate.pdf_link || null,
        cvLink: candidate.cv_link || null,
        driveFolderId: candidate.drive_folder_id || null,
        driveFolderLink: candidate.drive_folder_link || null,
        photoLink: candidate.photo_link || null,
    };
}

export function jobToMatchedJobGql(job: Job): object {
    return {
        id: job._id,
        companyName: job.company_name,
        sector: job.sector,
        localisation: job.localisation,
        desiredTP: job.desired_tp,
        ageRange: job.age_range,
        status: job.status,
    };
}
