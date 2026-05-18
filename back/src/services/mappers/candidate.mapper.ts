import { Candidate } from '../../types/candidate.types';

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
            ? candidate.skills_assessment.map(s => snakeToCamelCase(s))
            : null,
        jobInfo: candidate.job_info ? snakeToCamelCase({
            ...candidate.job_info,
            geographic_mobility: Array.isArray((candidate.job_info as any).geographic_mobility)
                ? ((candidate.job_info as any).geographic_mobility as string[]).join(', ')
                : (candidate.job_info as any).geographic_mobility,
        }) : null,
        synthesis: candidate.synthesis ? snakeToCamelCase(candidate.synthesis) : null,
        pdfLink: candidate.pdf_link || null,
    };
}
