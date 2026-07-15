// Sélection / création de la DB
const ROOT = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
db = db.getSiblingDB('admin')
db.auth(ROOT, PASSWORD)

db = db.getSiblingDB('human_ressources');

// =========================
// Collection: candidates
// =========================
db.createCollection('candidates', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["status", "tp_type"],
      properties: {
        _id: { bsonType: "string" },
        created_at: { bsonType: "date" },
        created_by: { bsonType: "string" },
        status: {
          enum: ["SEEKING", "NOT_SEEKING", "UNAVAILABLE", "CANCELLED", "MATCHED", "CONTRACT", "IMMERSING", "BANNED"]
        },

        // Titre Professionnel visé
        tp_type: {
          enum: ["AD", "CC", "NTC", "REM", "SA"]
        },
        formation_type: {
          enum: ["VENTE", "SECRETARIAT"]
        },

        // ===========================
        // Identité du candidat
        // ===========================
        identity: {
          bsonType: "object",
          required: ["full_name", "email", "phone"],
          properties: {
            full_name: { bsonType: "string" },
            social_security_number: { bsonType: "string" },
            date_of_birth: { bsonType: "date" },
            place_of_birth: { bsonType: "string" },
            age: { bsonType: "int" },
            sex: { enum: ["FILLE", "GARCON"] },
            address: { bsonType: "string" },
            postal_code: { bsonType: "string" },
            city: { bsonType: "string" },
            email: { bsonType: "string" },
            phone: { bsonType: "string" },
            driving_license_b: { bsonType: "bool" },
            has_vehicle: { bsonType: "bool" },
            transport_means: { bsonType: "string" },
            psh_referral_request: { bsonType: "bool" },
            had_apprenticeship_contract: { bsonType: "bool" },
            apprenticeship_contract_details: { bsonType: "string" },
            description: { bsonType: "string" }
          }
        },

        // ===========================
        // Parcours et prérequis
        // ===========================
        education: {
          bsonType: "object",
          properties: {
            school_level: {
              enum: [
                "CAP_BEP_WITH_1Y_EXP",
                "PREMIERE_TERMINALE",
                "PREMIERE_TERMINALE_WITH_1Y_EXP",
                "BAC",
                "BAC_WITH_1Y_EXP",
                "BAC_PLUS",
                "BAC_PLUS_2",
                "BAC_PLUS_2_PLUS",
                "BAC_PLUS_3_PLUS"
              ]
            },
            justification: { bsonType: "string" }
          }
        },

        // ===========================
        // Positionnement sur les sites de formation
        // ===========================
        training_site: {
          enum: [
            "NORD_SAINTE_MARIE",
            "OUEST_SAINT_PAUL",
            "SUD_SAINT_PIERRE"
          ]
        },

        // ===========================
        // Contact d'urgence
        // ===========================
        emergency_contact: {
          bsonType: "object",
          properties: {
            last_name: { bsonType: "string" },
            first_name: { bsonType: "string" },
            relationship: { bsonType: "string" },
            phone: { bsonType: "string" },
            email: { bsonType: "string" }
          }
        },

        // ===========================
        // Accompagnement et dispositifs
        // ===========================
        support: {
          bsonType: "object",
          properties: {
            france_travail_registered: { bsonType: "bool" },
            france_travail_agency: { bsonType: "string" },
            mission_locale_registered: { bsonType: "bool" },
            mission_locale_city: { bsonType: "string" }
          }
        },

        // ===========================
        // Immersion professionnelle
        // ===========================
        immersion_agreement: { bsonType: "bool" },

        // ===========================
        // Parcours antérieurs
        // ===========================
        background: {
          bsonType: "object",
          properties: {
            last_diploma: { bsonType: "string" },
            previous_trainings: { bsonType: "string" },
            professional_experiences: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  position: { bsonType: "string" },
                  duration: { bsonType: "string" },
                  responsibilities: { bsonType: "string" },
                  company: { bsonType: "string" }
                }
              }
            }
          }
        },

        // ===========================
        // Caractéristiques du profil
        // ===========================
        profile: {
          bsonType: "object",
          properties: {

            // Compétences linguistiques
            french_level: { bsonType: "int", minimum: 1, maximum: 10 },
            english_level: { bsonType: "int", minimum: 1, maximum: 10 },
            other_languages: {
              bsonType: "array",
              items: { bsonType: "string" }
            },

            // Savoir-être et savoir-faire
            strengths_and_improvements: { bsonType: "string" },
            qualities: {
              bsonType: "array",
              maxItems: 3,
              items: { bsonType: "string" }
            },
            defects: {
              bsonType: "array",
              maxItems: 3,
              items: { bsonType: "string" }
            },
            digital_skills: {
              bsonType: "array",
              items: { bsonType: "string" }
            },

            // Ouverture et personnalité
            ready_for_challenges: { bsonType: "bool" },
            hobbies: { bsonType: "string" }
          }
        },

        // ===========================
        // Projets professionnels
        // ===========================
        professional_projects: {
          bsonType: "object",
          properties: {
            career_objectives: { bsonType: "string" },
            desired_skills: { bsonType: "string" },
            apprenticeship_motivation: { bsonType: "string" },
            training_expectations: { bsonType: "string" }
          }
        },

        // ===========================
        // Analyse des compétences (spécifique au TP)
        // ===========================
        skills_assessment: {
          bsonType: "array",
          items: {
            bsonType: "object",
            // required: ["competence", "level"],
            properties: {
              competence: { bsonType: "string" },
              level: {
                enum: ["A", "ECA", "NA", "NE"]
              }
            }
          }
        },

        // ===========================
        // Champs spécifiques au TP
        // ===========================
        desired_sectors: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        expected_company_skills: {
          bsonType: "array",
          items: { bsonType: "string" }
        },

        // ===========================
        // Informations sur le poste
        // ===========================
        job_info: {
          bsonType: "object",
          properties: {
            domain_motivation: { bsonType: "string" },
            questions_concerns: { bsonType: "string" },
            availability_date: { bsonType: "date" },
            geographic_mobility: {
              bsonType: "array",
              items: {
                enum: [
                  "SAINT_DENIS",
                  "SAINTE_MARIE",
                  "SAINTE_SUZANNE",
                  "SAINT_PAUL",
                  "SAINT_GILLES",
                  "LA_POSSESSION",
                  "LE_PORT",
                  "TROIS_BASSINS",
                  "SAINT_LEU",
                  "SAINT_PIERRE",
                  "CILAOS",
                  "ETANG_SALE",
                  "SAINT_LOUIS",
                  "ENTRE_DEUX",
                  "LES_AVIRONS",
                  "LE_TAMPON",
                  "SAINT_PHILLIPE",
                  "SAINT_JOSEPH",
                  "PETIT_ILE",
                  "SAINTE_ROSE",
                  "SAINT_BENOIT",
                  "BRAS_PANON",
                  "SAINT_ANDRE",
                  "LA_PLAINE_DES_PALMISTES",
                  "SALAZIE",
                  "SAINTE_ANNE"
                ]
              }
            },
            weekend_work: { bsonType: "bool" },
            discovery_source: {
              enum: [
                "SOCIAL_MEDIA",
                "FRANCE_TRAVAIL",
                "MISSION_LOCALE",
                "WORD_OF_MOUTH",
                "KOANN",
                "E2CR",
                "TELEVISION_PUB",
                "SALON",
                "RSMA",
                "OTHER"
              ]
            }
          }
        },

        // ===========================
        // Synthèse (remplie par le chargé de recrutement)
        // ===========================
        synthesis: {
          bsonType: "object",
          properties: {
            feasibility_conclusion: { bsonType: "string" },
            pathway_relevance: { bsonType: "string" },
            special_needs: { bsonType: "string" },

            pedagogical_recommendations: {
              bsonType: "object",
              properties: {
                office_tools_reinforcement: { bsonType: "bool" },
                written_communication_support: { bsonType: "bool" },
                oral_confidence_development: { bsonType: "bool" },
                time_management_support: { bsonType: "bool" },
                professional_posture_work: { bsonType: "bool" },
                enhanced_company_immersion: { bsonType: "bool" },
                psh_specific_support: { bsonType: "bool" },
                individual_follow_up: { bsonType: "bool" },
                language_training: { bsonType: "bool" },
                stress_management_follow_up: { bsonType: "bool" }
              }
            },

            other_recommendations: { bsonType: "string" },
            location: { bsonType: "string" },
            date: { bsonType: "date" },
            recruiter_signature: { bsonType: "string" },
            candidate_signature: { bsonType: "string" },
            interviewed_by: { bsonType: "string" }
          }
        }
      }
    }
  }
});

// =========================
// Collection: needs_analysis (Analyse de Besoin entreprise / AB)
// =========================
// Remplace l'ancienne table MySQL `needs_analysis`. Le lien entreprise → AB se
// fait via companies.ab_id (MySQL) = _id (UUID applicatif de ce document).
const AB_COMMUNES = [
  "SAINT_DENIS", "SAINTE_MARIE", "SAINTE_SUZANNE", "SAINT_PAUL", "SAINT_GILLES", "LA_POSSESSION",
  "LE_PORT", "TROIS_BASSINS", "SAINT_LEU", "SAINT_PIERRE", "CILAOS", "ETANG_SALE",
  "SAINT_LOUIS", "ENTRE_DEUX", "LES_AVIRONS", "LE_TAMPON", "SAINT_PHILLIPE",
  "SAINT_JOSEPH", "PETIT_ILE", "SAINTE_ROSE", "SAINT_BENOIT", "BRAS_PANON",
  "SAINT_ANDRE", "LA_PLAINE_DES_PALMISTES", "SALAZIE", "SAINTE_ANNE"
];

db.createCollection('needs_analysis', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        _id: { bsonType: "string" },

        // Entreprise (enrichie depuis la fiche CRM companies)
        company_infos: {
          bsonType: "object",
          properties: {
            id: { bsonType: ["int", "long", "double"] },
            name: { bsonType: "string" },
            ape: { bsonType: ["string", "null"] },
            idcc: { bsonType: ["string", "null"] },
            siret: { bsonType: "string" },
            main_activity: { bsonType: ["string", "null"] },
            opco: {
              enum: [
                "AKTO", "ATLAS", "AFDAS", "CONSTRUCTYS", "OCAPIAT", "OPCO_2I",
                "OPCO_EP", "OPCO_MOBILITES", "OPCO_SANTE", "OPCOMMERCE", "UNIFORMATION", null
              ]
            },
            referral_source: {
              enum: [
                "KOANN", "E2CR", "FRANCE_TRAVAIL", "TELEVISION_PUB", "BOUCHE_A_OREILLE",
                "MISSION_LOCALE", "SALON", "RSMA", "RESEAUX_SOCIAUX", null
              ]
            },
            // Grande zone régionale déduite des communes du 1er poste.
            sector: { enum: ["NORD", "OUEST", "SUD", null] },
            // Secteurs d'activité libres de l'entreprise.
            activities: { bsonType: "array", items: { bsonType: "string" } },
            description: { bsonType: ["string", "null"] }
          }
        },

        // Commercial à l'origine de l'AB
        saler_info: {
          bsonType: "object",
          properties: {
            id: { bsonType: ["int", "long", "double"] },
            email: { bsonType: "string" }
          }
        },

        // Référents légal et recrutement
        referents: {
          bsonType: "object",
          properties: {
            is_same: { bsonType: "bool" },
            legal_referents: {
              bsonType: "object",
              properties: {
                name: { bsonType: ["string", "null"] },
                phone: { bsonType: ["string", "null"] },
                email: { bsonType: ["string", "null"] },
                function: { bsonType: ["string", "null"] }
              }
            },
            recruitment_referents: {
              bsonType: "object",
              properties: {
                name: { bsonType: ["string", "null"] },
                phone: { bsonType: ["string", "null"] },
                email: { bsonType: ["string", "null"] },
                function: { bsonType: ["string", "null"] }
              }
            }
          }
        },

        // Postes à pourvoir
        offers: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              // Identifiant stable de l'offre (uuid) : handle du matching (ex-jobId).
              id: { bsonType: "string" },
              localisation: { bsonType: "array", items: { enum: AB_COMMUNES } },
              tp_type: { enum: ["AD", "CC", "NTC", "REM", "SA", null] },
              training_domain: { enum: ["SECRETARIAT", "VENTE", null] },
              title: { bsonType: "string" },
              missions: { bsonType: "array", items: { bsonType: "string" } },
              description_missions: { bsonType: "array", items: { bsonType: "string" } },
              other_description_missions: { bsonType: ["string", "null"] },
              other_missions: { bsonType: ["string", "null"] },
              // État de matching de l'offre (ex-collection jobs).
              matching: {
                bsonType: "object",
                properties: {
                  status: { enum: ["NOT_MATCHED", "MATCHED", "CV_SEND", "IMMERSING", "CONTRACT"] },
                  interview_slots: { bsonType: "array", items: { bsonType: "string" } },
                  interview_location: { bsonType: "string" },
                  candidates: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      properties: {
                        id: { bsonType: "string" },
                        full_name: { bsonType: "string" },
                        age: { bsonType: "int" },
                        sex: { enum: ["FILLE", "GARCON", "MIXTE"] },
                        city: { bsonType: "string" },
                        email: { bsonType: "string" },
                        phone: { bsonType: "string" },
                        status: { enum: ["RETAINED", "OFFER_SEND", "ACCEPTED", "DECLINED"] },
                        description: { bsonType: "string" },
                        cv_webview: { bsonType: "string" },
                        answer: { enum: ["REFUSED", "ACCEPTED", "FAVORITE", null] },
                        comment: { bsonType: "string" },
                        interview_location: { bsonType: "string" },
                        booked_interview_slot: { bsonType: "string" },
                        interview_conclusion: { enum: ["REJECTED", "IMMERSING", "CONTRACT", null] },
                        immersion_start_date: { bsonType: "string" },
                        immersion_end_date: { bsonType: "string" },
                        immersion_location: { bsonType: "string" },
                        immersion_conclusion: { enum: ["REJECTED", "CONTRACT", null] }
                      }
                    }
                  }
                }
              },
              criteria: {
                bsonType: "object",
                properties: {
                  education_level: { enum: ["BAC", "BAC_PLUS_2", "BAC_PLUS_3", null] },
                  driving_license: { bsonType: "bool" },
                  experience_required: { bsonType: "bool" },
                  training_domain: { enum: ["SECRETARIAT", "VENTE", null] },
                  age_min: { bsonType: ["int", "long", "double", "null"] },
                  age_max: { bsonType: ["int", "long", "double", "null"] },
                  soft_skills: { bsonType: ["string", "null"] },
                  schedule_options: { bsonType: "array", items: { bsonType: "string" } },
                  conditions: { bsonType: ["string", "null"] },
                  additional_comments: { bsonType: ["string", "null"] }
                }
              }
            }
          }
        },

        // Process RH & signature
        recruitment_method: { enum: ["ALL_CV", "PRESELECTION", "PRE_INTERVIEW", null] },
        immersion_period: { enum: ["OUI", "NON", "A_DISCUTER", null] },
        training_days: { bsonType: "string" },
        signature_request_id: { bsonType: ["string", "null"] },
        status: { enum: ["BROUILLON", "EN_ATTENTE_SIGNATURE", "SIGNE", "EXPIRE"] },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" }
      }
    }
  }
})
