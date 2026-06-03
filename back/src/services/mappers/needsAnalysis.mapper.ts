import { NeedsAnalysisRow } from '../../types/db-rows.types';
import { NeedsAnalysis } from '../../types/needsAnalysis.types';

export function toNeedsAnalysis(row: NeedsAnalysisRow): NeedsAnalysis {
    let selectedMissions: string[] = [];
    try {
        selectedMissions = typeof row.selected_missions === 'string'
            ? JSON.parse(row.selected_missions)
            : (row.selected_missions || []);
    } catch (e) {
        selectedMissions = [];
    }

    let ageRequirements: string[] = [];
    try {
        ageRequirements = typeof row.age_requirements === 'string'
            ? JSON.parse(row.age_requirements)
            : (row.age_requirements || []);
    } catch (e) {
        ageRequirements = [];
    }

    let trainingDays = '{}';
    if (row.training_days) {
        trainingDays = typeof row.training_days === 'string'
            ? row.training_days
            : JSON.stringify(row.training_days);
    }

    let companySectors: string[] = [];
    try {
        companySectors = typeof row.company_sectors === 'string'
            ? JSON.parse(row.company_sectors)
            : (row.company_sectors || []);
    } catch { companySectors = []; }

    let jobDescriptionMissions: string[] = [];
    try {
        jobDescriptionMissions = typeof row.job_description_missions === 'string'
            ? JSON.parse(row.job_description_missions)
            : (row.job_description_missions || []);
    } catch { jobDescriptionMissions = []; }

    let scheduleOptions: string[] = [];
    try {
        scheduleOptions = typeof row.schedule_options === 'string'
            ? JSON.parse(row.schedule_options)
            : (row.schedule_options || []);
    } catch { scheduleOptions = []; }

    return {
        id: row.id,
        companyID: row.company_id,
        userID: row.user_id,
        legalRepFunction: row.legal_rep_function,
        recruitmentResponsibleName: row.recruitment_responsible_name,
        recruitmentResponsiblePhone: row.recruitment_responsible_phone,
        recruitmentResponsibleEmail: row.recruitment_responsible_email,
        recruitmentResponsibleFunction: row.recruitment_responsible_function,
        companySectors,
        companyDescription: row.company_description,
        positionsCount: row.positions_count,
        localisation: row.localisation,
        trainingDomain: row.training_domain,
        jobTitle: row.job_title,
        selectedMissions,
        otherMissions: row.other_missions,
        jobDescriptionMissions,
        jobDescriptionOther: row.job_description_other,
        educationLevel: row.education_level,
        drivingLicense: row.driving_license,
        experienceRequired: row.experience_required,
        ageRequirements,
        softSkills: row.soft_skills,
        scheduleOptions,
        additionalComments: row.additional_comments,
        recruitmentMethod: row.recruitment_method,
        immersionPeriod: row.immersion_period,
        trainingDays,
        yousignSignatureRequestID: row.yousign_signature_request_id,
        status: row.status,
        createdAt: row.created_at ? row.created_at.toISOString() : undefined,
        updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    };
}

export function toNeedsAnalysisRow(input: Partial<NeedsAnalysis>): Partial<NeedsAnalysisRow> {
    const row: Partial<NeedsAnalysisRow> = {};

    if (input.id !== undefined) row.id = input.id;
    if (input.companyID !== undefined) row.company_id = input.companyID;
    if (input.userID !== undefined) row.user_id = input.userID;
    if (input.legalRepFunction !== undefined) row.legal_rep_function = input.legalRepFunction;
    if (input.recruitmentResponsibleName !== undefined) row.recruitment_responsible_name = input.recruitmentResponsibleName;
    if (input.recruitmentResponsiblePhone !== undefined) row.recruitment_responsible_phone = input.recruitmentResponsiblePhone;
    if (input.recruitmentResponsibleEmail !== undefined) row.recruitment_responsible_email = input.recruitmentResponsibleEmail;
    if (input.recruitmentResponsibleFunction !== undefined) row.recruitment_responsible_function = input.recruitmentResponsibleFunction;
    if (input.companyDescription !== undefined) row.company_description = input.companyDescription;
    if (input.positionsCount !== undefined) row.positions_count = input.positionsCount;
    if (input.localisation !== undefined) row.localisation = input.localisation;
    if (input.trainingDomain !== undefined) row.training_domain = input.trainingDomain;
    if (input.jobTitle !== undefined) row.job_title = input.jobTitle;
    if (input.otherMissions !== undefined) row.other_missions = input.otherMissions;
    if (input.jobDescriptionOther !== undefined) row.job_description_other = input.jobDescriptionOther;
    if (input.educationLevel !== undefined) row.education_level = input.educationLevel;
    if (input.drivingLicense !== undefined) row.driving_license = input.drivingLicense;
    if (input.experienceRequired !== undefined) row.experience_required = input.experienceRequired;
    if (input.softSkills !== undefined) row.soft_skills = input.softSkills;
    if (input.additionalComments !== undefined) row.additional_comments = input.additionalComments;
    if (input.recruitmentMethod !== undefined) row.recruitment_method = input.recruitmentMethod;
    if (input.immersionPeriod !== undefined) row.immersion_period = input.immersionPeriod;
    if (input.yousignSignatureRequestID !== undefined) row.yousign_signature_request_id = input.yousignSignatureRequestID;
    if (input.status !== undefined) row.status = input.status;

    if (input.selectedMissions !== undefined) {
        row.selected_missions = JSON.stringify(input.selectedMissions);
    }
    if (input.companySectors !== undefined) {
        row.company_sectors = JSON.stringify(input.companySectors);
    }
    if (input.jobDescriptionMissions !== undefined) {
        row.job_description_missions = JSON.stringify(input.jobDescriptionMissions);
    }
    if (input.ageRequirements !== undefined) {
        row.age_requirements = JSON.stringify(input.ageRequirements);
    }
    if (input.scheduleOptions !== undefined) {
        row.schedule_options = JSON.stringify(input.scheduleOptions);
    }
    if (input.trainingDays !== undefined) {
        row.training_days = typeof input.trainingDays === 'string'
            ? input.trainingDays
            : JSON.stringify(input.trainingDays);
    }

    return row;
}
