import { Candidate } from '../../types/candidate.types';
import { Job } from '../../types/job.types';
import { FilizStudentInfos } from '../../external/filiz/type';

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
        owner: candidate.owner
            ? {
                  userId: candidate.owner.user_id,
                  name: candidate.owner.name,
                  sector: candidate.owner.sector ?? null,
              }
            : null,
        status: candidate.status,
        tpType: candidate.tp_type,
        tpTypes: candidate.tp_types ?? (candidate.tp_type ? [candidate.tp_type] : []),
        trainingSite: candidate.training_site,
        trainingSites: candidate.training_sites ?? (candidate.training_site ? [candidate.training_site] : []),
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
        filizFolderId: candidate.filiz_folder_id || null,
        photoLink: candidate.photo_link || null,
        resume: candidate.resume || null,
        resumeGeneratedAt: candidate.resume_generated_at?.toISOString() || null,
    };
}

export function mapCandidateToFilizStudent(candidate: Candidate): FilizStudentInfos {
    const fullName = candidate.identity.full_name ?? '';
    const spaceIndex = fullName.indexOf(' ');
    const firstName = spaceIndex >= 0 ? fullName.slice(0, spaceIndex) : fullName;
    const lastName = spaceIndex >= 0 ? fullName.slice(spaceIndex + 1) : '';

    const rawPhone = candidate.identity.phone ?? '';
    const phoneNumber = rawPhone.replace(/\s/g, '').replace(/^(\+|00)\d{3}/, '');

    const birthDate = candidate.identity.date_of_birth
        ? new Date(candidate.identity.date_of_birth).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
          })
        : '';

    const sexe = candidate.identity.sex === 'F' ? 2 : 1;

    return {
        firstName,
        lastName,
        mailAddress: candidate.identity.email,
        address: {
            street: candidate.identity.address ?? '',
            city: candidate.identity.city ?? '',
            country: 'France',
            postcode: candidate.identity.postal_code ?? '',
        },
        birthDate,
        cityOfBirth: candidate.identity.place_of_birth ?? '',
        departmentOfBirth: candidate.identity.department_of_birth ?? '97400',
        nationality: 1,
        phoneNumber: { dialCode: '262', number: phoneNumber },
        sexe,
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
