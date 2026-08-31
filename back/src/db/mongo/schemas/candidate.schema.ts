import mongoose, { Schema, model, Document } from 'mongoose';
import {
    Candidate,
    TitleProfessionalType,
    CandidateStatus,
    SchoolLevel,
    TrainingSite,
    SkillLevel,
    DiscoverySource,
    Identity,
    EncryptedSsn,
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
    ClassMarkerResult,
    CandidateOwner,
    EmergencyContact,
    CandidateConsentments,
} from '../../../types/candidate.types';
import { Localisation } from '../../../types/matching.types';

const ownerSchema = new Schema<CandidateOwner>(
    {
        user_id: { type: Number, required: true },
        name: { type: String, required: true },
        sector: { type: String },
    },
    { _id: false },
);

const emergencyContactSchema = new Schema<EmergencyContact>(
    {
        last_name: { type: String },
        first_name: { type: String },
        relationship: { type: String },
        phone: { type: String },
        email: { type: String },
    },
    { _id: false },
);

const consentmentsSchema = new Schema<CandidateConsentments>(
    {
        data_processing: { type: Boolean, required: true },
        data_sharing: { type: Boolean, required: true },
        ai_processing: { type: Boolean, required: true },
        photo_processing: { type: Boolean, required: true },
        consent_date: { type: Date, required: true },
        consent_version: { type: String, required: true },
    },
    { _id: false },
);

const encryptedSsnSchema = new Schema<EncryptedSsn>(
    {
        encrypted: { type: String, required: true },
        iv: { type: String, required: true },
        tag: { type: String, required: true },
    },
    { _id: false },
);

const identitySchema = new Schema<Identity>(
    {
        full_name: { type: String, required: true },
        social_security_number: { type: encryptedSsnSchema },
        date_of_birth: { type: Date },
        place_of_birth: { type: String },
        department_of_birth: { type: String },
        age: { type: Number },
        sex: { type: String },
        address: { type: String },
        postal_code: { type: String },
        city: { type: String },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        driving_license_b: { type: Boolean },
        has_vehicle: { type: Boolean },
        transport_means: { type: String },
        psh_referral_request: { type: Boolean },
        had_apprenticeship_contract: { type: Boolean },
        apprenticeship_contract_details: { type: String },
        description: { type: String },
        avatar_updated_at: { type: Date },
        drive_avatar_file_id: { type: String },
    },
    { _id: false },
);

// Unicité applicative de l'email : la base contient encore des doublons
// historiques (cf. database/mongodb/mongo-init.js), donc pas d'index unique
// Mongo pour l'instant — juste ce garde-fou côté Mongoose.
identitySchema.path('email').validate({
    async validator(this: mongoose.Query<unknown, unknown> | Document, email: string) {
        if (!email) return true;
        const normalized = email.trim();
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const selfId =
            this instanceof mongoose.Query
                ? this.getQuery()._id
                : (this as unknown as { $parent: () => { _id?: string } }).$parent()?._id;
        const existing = await CandidateModel.findOne({
            _id: { $ne: selfId },
            'identity.email': { $regex: `^${escaped}$`, $options: 'i' },
        }).lean();
        return !existing;
    },
    message: (props) => `Un candidat existe déjà avec l'email ${props.value}`,
});

const educationSchema = new Schema<Education>(
    {
        school_level: { type: String, enum: Object.values(SchoolLevel) },
        justification: { type: String },
    },
    { _id: false },
);

const supportSchema = new Schema<Support>(
    {
        france_travail_registered: { type: Boolean },
        france_travail_agency: { type: String },
        mission_locale_registered: { type: Boolean },
        mission_locale_city: { type: String },
    },
    { _id: false },
);

const professionalExperienceSchema = new Schema<ProfessionalExperience>(
    {
        position: { type: String },
        duration: { type: String },
        responsibilities: { type: String },
        company: { type: String },
    },
    { _id: false },
);

const backgroundSchema = new Schema<Background>(
    {
        last_diploma: { type: String },
        last_diploma_prepared: { type: String },
        previous_trainings: { type: String },
        professional_experiences: { type: [professionalExperienceSchema] },
    },
    { _id: false },
);

const profileSchema = new Schema<Profile>(
    {
        french_level: { type: Number, min: 1, max: 10 },
        english_level: { type: Number, min: 1, max: 10 },
        other_languages: { type: [String] },
        strengths_and_improvements: { type: String },
        qualities: { type: [String], maxlength: 3 },
        defects: { type: [String], maxlength: 3 },
        digital_skills: { type: [String] },
        ready_for_challenges: { type: Boolean },
        hobbies: { type: String },
    },
    { _id: false },
);

const professionalProjectsSchema = new Schema<ProfessionalProjects>(
    {
        career_objectives: { type: String },
        desired_skills: { type: String },
        apprenticeship_motivation: { type: String },
        training_expectations: { type: String },
    },
    { _id: false },
);

const skillsAssessmentSchema = new Schema<SkillsAssessment>(
    {
        competence: { type: String, required: true },
        level: { type: String, enum: Object.values(SkillLevel), required: true },
    },
    { _id: false },
);

const jobInfoSchema = new Schema<JobInfo>(
    {
        domain_motivation: { type: String },
        questions_concerns: { type: String },
        availability_date: { type: Date },
        geographic_mobility: { type: [String], enum: Object.values(Localisation) },
        weekend_work: { type: Boolean },
        discovery_source: { type: String, enum: Object.values(DiscoverySource) },
    },
    { _id: false },
);

const pedagogicalRecommendationsSchema = new Schema<PedagogicalRecommendations>(
    {
        office_tools_reinforcement: { type: Boolean },
        written_communication_support: { type: Boolean },
        oral_confidence_development: { type: Boolean },
        time_management_support: { type: Boolean },
        professional_posture_work: { type: Boolean },
        enhanced_company_immersion: { type: Boolean },
        psh_specific_support: { type: Boolean },
        individual_follow_up: { type: Boolean },
        language_training: { type: Boolean },
        stress_management_follow_up: { type: Boolean },
    },
    { _id: false },
);

const synthesisSchema = new Schema<Synthesis>(
    {
        feasibility_conclusion: { type: String },
        pathway_relevance: { type: String },
        special_needs: { type: String },
        pedagogical_recommendations: { type: pedagogicalRecommendationsSchema },
        other_recommendations: { type: String },
        important_note: { type: String },
        location: { type: String },
        date: { type: Date },
        recruiter_signature: { type: String },
        candidate_signature: { type: String },
        interviewed_by: { type: String },
    },
    { _id: false },
);

const classMarkerResultSchema = new Schema<ClassMarkerResult>(
    {
        percentage: { type: Number },
        points_scored: { type: Number },
        points_available: { type: Number },
        passed: { type: Boolean },
        test_name: { type: String },
        completed_at: { type: Date },
        duration: { type: String },
        pdf_link: { type: String },
        questions: { type: [Schema.Types.Mixed], default: undefined },
    },
    { _id: false },
);

const candidateSchema = new Schema<Candidate & Document>(
    {
        _id: { type: String, required: true },
        candidate_id: { type: String, required: true },
        owner: { type: ownerSchema },
        tp_types: { type: [String], enum: Object.values(TitleProfessionalType), default: undefined },
        identity: { type: identitySchema, required: true },
        emergency_contact: { type: emergencyContactSchema },
        consentments: { type: consentmentsSchema },
        status: { type: String, enum: Object.values(CandidateStatus), required: true },
        training_site: { type: String, enum: Object.values(TrainingSite) },
        training_sites: { type: [String], enum: Object.values(TrainingSite), default: undefined },
        immersion_agreement: { type: Boolean },
        immersion_start_date: { type: Date },
        immersion_end_date: { type: Date },
        immersion_company_id: { type: Number },
        immersion_company_name: { type: String },
        // Horodatage de l'envoi de la notification « immersion terminée » : évite
        // de re-notifier chaque jour une fois la date de fin passée (dédup scheduler).
        immersion_end_notified_at: { type: Date },
        contract_offer_id: { type: String },
        contract_company_id: { type: Number },
        contract_company_name: { type: String },
        contract_start_date: { type: Date },
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
        pdf_link: { type: String },
        cv_link: { type: String },
        drive_folder_id: { type: String },
        drive_folder_link: { type: String },
        filiz_folder_id: { type: String },
        photo_link: { type: String },
        classmarker: { type: classMarkerResultSchema },
        created_at: { type: Date },
        last_relance_at: { type: Date },
        relance_response_at: { type: Date },
        classmarker_history: { type: [classMarkerResultSchema], default: undefined },
    },
    { collection: 'candidates' },
);

// Tri par défaut (plus récent d'abord) + keyset pagination et filtres de date :
// l'index composite fournit l'ordre directement (pas de tri en mémoire) et un
// seek O(log n) sur les bornes created_at. _id en tie-break déterministe.
candidateSchema.index({ created_at: -1, _id: 1 });

// Index full-text pour la recherche (candidatesPage → search) :
// - pondération 10× sur `identity.full_name` vs `identity.description` (le nom matche en tête)
// - langue française (stemming « boulanger / boulangère », « patissier »)
// - utilisé conjointement au `$regex` tokenisé (AND ordonné-indépendant) dans CandidateRepository.
candidateSchema.index(
    { 'identity.description': 'text', 'identity.full_name': 'text' },
    {
        default_language: 'french',
        weights: { 'identity.full_name': 10, 'identity.description': 1 },
        name: 'candidate_text_search',
    },
);

export const CandidateModel = mongoose.models.Candidate || model<Candidate & Document>('Candidate', candidateSchema);

interface CandidateAvatar {
    candidate_id: string;
    data: Buffer;
    content_type: string;
    updated_at: Date;
}

const candidateAvatarSchema = new Schema<CandidateAvatar & Document>(
    {
        candidate_id: { type: String, required: true, unique: true, index: true },
        data: { type: Buffer, required: true },
        content_type: { type: String, required: true },
        updated_at: { type: Date, required: true },
    },
    { collection: 'candidate_avatars' },
);

export const CandidateAvatarModel =
    mongoose.models.CandidateAvatar || model<CandidateAvatar & Document>('CandidateAvatar', candidateAvatarSchema);
