import mongoose from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../external/logger';

const MONGO_URI =
    env.NODE_ENV === 'production'
        ? env.MONGO_URI!
        : `mongodb://${env.MONGO_ROOT_USERNAME}:${env.MONGO_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB_NAME}?authSource=admin`;

/**
 * Patches the candidates collection validator to fix inconsistencies
 * between the original mongo-init.js schema and the actual application schema.
 */
async function patchCandidatesValidator(): Promise<void> {
    await mongoose.connection.db!.command({
        collMod: 'candidates',
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['status', 'tp_type'],
                properties: {
                    _id: { bsonType: 'string' },
                    candidate_id: { bsonType: 'string' },
                    created_at: { bsonType: 'date' },
                    created_by: { bsonType: 'string' },
                    status: {
                        enum: ['SEEKING', 'NOT_SEEKING', 'CANCELLED', 'MATCHED', 'CONTRACTED', 'IMMERSING', 'BANNED'],
                    },
                    tp_type: { enum: ['AD', 'CC', 'NTC', 'REM', 'SA'] },
                    training_site: { enum: ['NORD_SAINTE_MARIE', 'OUEST_SAINT_PAUL', 'SUD_SAINT_PIERRE'] },
                    immersion_agreement: { bsonType: 'bool' },
                    // Free-text strings — no enum constraint
                    desired_sectors: { bsonType: 'array', items: { bsonType: 'string' } },
                    expected_company_skills: { bsonType: 'array', items: { bsonType: 'string' } },
                    identity: {
                        bsonType: 'object',
                        required: ['full_name', 'email', 'phone'],
                        properties: {
                            full_name: { bsonType: 'string' },
                            date_of_birth: { bsonType: 'date' },
                            place_of_birth: { bsonType: 'string' },
                            age: { bsonType: 'int' },
                            address: { bsonType: 'string' },
                            postal_code: { bsonType: 'string' },
                            city: { bsonType: 'string' },
                            email: { bsonType: 'string' },
                            phone: { bsonType: 'string' },
                            driving_license_b: { bsonType: 'bool' },
                            transport_means: { bsonType: 'string' },
                            psh_referral_request: { bsonType: 'bool' },
                            had_apprenticeship_contract: { bsonType: 'bool' },
                        },
                    },
                    education: {
                        bsonType: 'object',
                        properties: {
                            school_level: {
                                enum: [
                                    'CAP_BEP_WITH_1Y_EXP',
                                    'PREMIERE_TERMINALE',
                                    'PREMIERE_TERMINALE_WITH_1Y_EXP',
                                    'BAC',
                                    'BAC_WITH_1Y_EXP',
                                    'BAC_PLUS',
                                    'BAC_PLUS_2',
                                    'BAC_PLUS_2_PLUS',
                                    'BAC_PLUS_3_PLUS',
                                ],
                            },
                            justification: { bsonType: 'string' },
                        },
                    },
                    support: {
                        bsonType: 'object',
                        properties: {
                            france_travail_registered: { bsonType: 'bool' },
                            france_travail_agency: { bsonType: 'string' },
                            mission_locale_registered: { bsonType: 'bool' },
                            mission_locale_city: { bsonType: 'string' },
                        },
                    },
                    background: {
                        bsonType: 'object',
                        properties: {
                            last_diploma: { bsonType: 'string' },
                            previous_trainings: { bsonType: 'string' },
                            professional_experiences: {
                                bsonType: 'array',
                                items: {
                                    bsonType: 'object',
                                    properties: {
                                        position: { bsonType: 'string' },
                                        duration: { bsonType: 'string' },
                                        responsibilities: { bsonType: 'string' },
                                        company: { bsonType: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    profile: {
                        bsonType: 'object',
                        properties: {
                            french_level: { bsonType: 'int', minimum: 1, maximum: 10 },
                            english_level: { bsonType: 'int', minimum: 1, maximum: 10 },
                            other_languages: { bsonType: 'array', items: { bsonType: 'string' } },
                            strengths_and_improvements: { bsonType: 'string' },
                            qualities: { bsonType: 'array', maxItems: 3, items: { bsonType: 'string' } },
                            defects: { bsonType: 'array', maxItems: 3, items: { bsonType: 'string' } },
                            digital_skills: { bsonType: 'array', items: { bsonType: 'string' } },
                            ready_for_challenges: { bsonType: 'bool' },
                            hobbies: { bsonType: 'string' },
                        },
                    },
                    professional_projects: {
                        bsonType: 'object',
                        properties: {
                            career_objectives: { bsonType: 'string' },
                            desired_skills: { bsonType: 'string' },
                            apprenticeship_motivation: { bsonType: 'string' },
                            training_expectations: { bsonType: 'string' },
                        },
                    },
                    skills_assessment: {
                        bsonType: 'array',
                        items: {
                            bsonType: 'object',
                            properties: {
                                competence: { bsonType: 'string' },
                                level: { enum: ['A', 'ECA', 'NA', 'NE'] },
                            },
                        },
                    },
                    job_info: {
                        bsonType: 'object',
                        properties: {
                            domain_motivation: { bsonType: 'string' },
                            questions_concerns: { bsonType: 'string' },
                            availability_date: { bsonType: 'date' },
                            // Free-text string (not an array of city enums)
                            geographic_mobility: { bsonType: 'array', items: { bsonType: 'string' } },
                            weekend_work: { bsonType: 'bool' },
                            discovery_source: {
                                enum: [
                                    'SOCIAL_MEDIA',
                                    'FRANCE_TRAVAIL',
                                    'MISSION_LOCALE',
                                    'WORD_OF_MOUTH',
                                    'KOANN',
                                    'OTHER',
                                ],
                            },
                        },
                    },
                    synthesis: {
                        bsonType: 'object',
                        properties: {
                            feasibility_conclusion: { bsonType: 'string' },
                            pathway_relevance: { bsonType: 'string' },
                            special_needs: { bsonType: 'string' },
                            pedagogical_recommendations: {
                                bsonType: 'object',
                                properties: {
                                    office_tools_reinforcement: { bsonType: 'bool' },
                                    written_communication_support: { bsonType: 'bool' },
                                    oral_confidence_development: { bsonType: 'bool' },
                                    time_management_support: { bsonType: 'bool' },
                                    professional_posture_work: { bsonType: 'bool' },
                                    enhanced_company_immersion: { bsonType: 'bool' },
                                    psh_specific_support: { bsonType: 'bool' },
                                    individual_follow_up: { bsonType: 'bool' },
                                    language_training: { bsonType: 'bool' },
                                    stress_management_follow_up: { bsonType: 'bool' },
                                },
                            },
                            other_recommendations: { bsonType: 'string' },
                            location: { bsonType: 'string' },
                            date: { bsonType: 'date' },
                            recruiter_signature: { bsonType: 'string' },
                            candidate_signature: { bsonType: 'string' },
                        },
                    },
                    pdf_link: { bsonType: 'string' },
                },
            },
        },
        validationLevel: 'moderate',
    });
}

export async function connectMongoDB(): Promise<void> {
    await mongoose.connect(MONGO_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
    try {
        await patchCandidatesValidator();
    } catch (err) {
        logger.warn({ err }, 'MongoDB: validator patch failed');
    }
}
