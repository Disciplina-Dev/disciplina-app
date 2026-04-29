import { Schema, model, Document } from 'mongoose';
import {
    Candidate,
    TitleProfessionalType,
    CandidateStatus,
    SchoolLevel,
    TrainingSite,
    SkillLevel,
    DiscoverySource,
    Identity,
    Education,
    Support,
    ProfessionalExperience,
    Background,
    Profile,
    ProfessionalProjects,
    SkillsAssessment,
    JobInfo,
    PedagogicalRecommendations,
    Synthesis,
    Job,
    JobStatus,
    DesiredSex,
    Localisation,
    MatchingCandidate
} from './interface';

const matchingCandidateSchema = new Schema<MatchingCandidate>({
    full_name: { type: String },
    age: { type: Number },
    sex: { type: Boolean },
    city: { type: String, enum: Object.values(Localisation) },
    email: { type: String },
    phone: { type: String }
}, { _id: false });

const identitySchema = new Schema<Identity>({
    full_name: { type: String, required: true },
    date_of_birth: { type: Date },
    place_of_birth: { type: String },
    age: { type: Number },
    postal_code: { type: String },
    city: { type: String },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    driving_license_b: { type: Boolean },
    transport_means: { type: String },
    psh_referral_request: { type: Boolean }
}, { _id: false });

const educationSchema = new Schema<Education>({
    school_level: {
        type: String,
        enum: Object.values(SchoolLevel)
    },
    justification: { type: String }
}, { _id: false });

const supportSchema = new Schema<Support>({
    france_travail_registered: { type: Boolean },
    france_travail_agency: { type: String },
    mission_locale_registered: { type: Boolean },
    mission_locale_city: { type: String }
}, { _id: false });

const professionalExperienceSchema = new Schema<ProfessionalExperience>({
    position: { type: String },
    duration: { type: String },
    responsibilities: { type: String },
    company: { type: String }
}, { _id: false });

const backgroundSchema = new Schema<Background>({
    last_diploma: { type: String },
    previous_trainings: { type: String },
    professional_experiences: { type: [professionalExperienceSchema] }
}, { _id: false });

const profileSchema = new Schema<Profile>({
    french_level: { type: Number, min: 1, max: 10 },
    english_level: { type: Number, min: 1, max: 10 },
    other_languages: { type: [String] },
    strengths_and_improvements: { type: String },
    qualities: { type: [String], maxlength: 3 },
    defects: { type: [String], maxlength: 3 },
    digital_skills: { type: [String] },
    ready_for_challenges: { type: Boolean },
    hobbies: { type: String }
}, { _id: false });

const professionalProjectsSchema = new Schema<ProfessionalProjects>({
    career_objectives: { type: String },
    desired_skills: { type: String },
    apprenticeship_motivation: { type: String },
    training_expectations: { type: String }
}, { _id: false });

const skillsAssessmentSchema = new Schema<SkillsAssessment>({
    competence: { type: String, required: true },
    level: {
        type: String,
        enum: Object.values(SkillLevel),
        required: true
    }
}, { _id: false });

const jobInfoSchema = new Schema<JobInfo>({
    domain_motivation: { type: String },
    questions_concerns: { type: String },
    availability_date: { type: Date },
    geographic_mobility: { type: String },
    weekend_work: { type: Boolean },
    discovery_source: {
        type: String,
        enum: Object.values(DiscoverySource)
    }
}, { _id: false });

const pedagogicalRecommendationsSchema = new Schema<PedagogicalRecommendations>({
    office_tools_reinforcement: { type: Boolean },
    written_communication_support: { type: Boolean },
    oral_confidence_development: { type: Boolean },
    time_management_support: { type: Boolean },
    professional_posture_work: { type: Boolean },
    enhanced_company_immersion: { type: Boolean },
    psh_specific_support: { type: Boolean },
    individual_follow_up: { type: Boolean },
    language_training: { type: Boolean },
    stress_management_follow_up: { type: Boolean }
}, { _id: false });

const synthesisSchema = new Schema<Synthesis>({
    feasibility_conclusion: { type: String },
    pathway_relevance: { type: String },
    special_needs: { type: String },
    pedagogical_recommendations: { type: pedagogicalRecommendationsSchema },
    other_recommendations: { type: String },
    location: { type: String },
    date: { type: Date },
    recruiter_signature: { type: String },
    candidate_signature: { type: String }
}, { _id: false });

const candidateSchema = new Schema<Candidate & Document>(
    {
        _id: { type: String, required: true },
        candidate_id: { type: String, required: true },
        tp_type: {
            type: String,
            enum: Object.values(TitleProfessionalType),
            required: true
        },
        identity: { type: identitySchema, required: true },
        status: {
            type: String,
            enum: Object.values(CandidateStatus),
            required: true
        },
        training_site: {
            type: String,
            enum: Object.values(TrainingSite)
        },
        immersion_agreement: { type: Boolean },
        desired_sectors: { type: [String] },
        expected_company_skills: { type: [String] },
        education: { type: educationSchema },
        support: { type: supportSchema },
        background: { type: backgroundSchema },
        profile: { type: profileSchema },
        professional_projects: { type: professionalProjectsSchema },
        skills_assessment: { type: [skillsAssessmentSchema] },
        job_info: { type: jobInfoSchema },
        synthesis: { type: synthesisSchema },
        pdf_link: { type: String }
    },
    { collection: 'candidates' }
);

export const CandidateModel = model<Candidate & Document>('Candidate', candidateSchema);

const jobSchema = new Schema<Job & Document>(
    {
        _id: { type: String },
        company_name: { type: String },
        age_range: { type: String },
        desired_tp: { type: String, enum: Object.values(TitleProfessionalType) },
        desired_sex: { type: String, enum: Object.values(DesiredSex) },
        driving_license_b: { type: Boolean },
        professional_experience: { type: Boolean },
        status: { type: String, enum: Object.values(JobStatus) },
        localisation: { type: [String], enum: Object.values(Localisation) },
        matched: { type: Boolean },
        matched_candidate: { type: [matchingCandidateSchema] }
    },
    { collection: 'jobs' }
);

export const JobModel = model<Job & Document>('Job', jobSchema);
