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
          enum: ["SEEKING", "NOT_SEEKING", "CANCELLED", "MATCHED", "CONTRACTED", "IMMERSING", "BANNED"]
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
            date_of_birth: { bsonType: "date" },
            place_of_birth: { bsonType: "string" },
            age: { bsonType: "int" },
            sex: { enum: ["FILLE", "GARCON"] },
            postal_code: { bsonType: "string" },
            city: { bsonType: "string" },
            email: { bsonType: "string" },
            phone: { bsonType: "string" },
            driving_license_b: { bsonType: "bool" },
            transport_means: { bsonType: "string" },
            psh_referral_request: { bsonType: "bool" }
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
            geographic_mobility: { bsonType: "string" },
            weekend_work: { bsonType: "bool" },
            discovery_source: {
              enum: [
                "SOCIAL_MEDIA",
                "FRANCE_TRAVAIL",
                "MISSION_LOCALE",
                "WORD_OF_MOUTH",
                "KOANN",
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
            candidate_signature: { bsonType: "string" }
          }
        }
      }
    }
  }
});

db.createCollection('jobs', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        _id: { bsonType: "string" },
        company_name: { bsonType: "string" },
        age_range: { bsonType: "string" },
        desired_tp: { enum: ["AD", "CC", "NTC", "REM", "SA"] },
        desired_sex: { enum: ["MIXTE", "FILLE", "GARCON"] },
        driving_license_b: { bsonType: "bool" },
        professional_experience: { bsonType: "bool" },
        sector: {
          enum: [
            "BOULANGERIE",
            "RESTAURATION",
            "STATION",
            "PAP",
            "LIBRE_SERVICE",
            "TELEPHONIE",
            "AUTO",
            "COMMERCIAL",
            "BIJOUX",
            "COSMETIQUE",
            "IMMOBILIER",
            "ASSURANCE",
            "ANIMAUX",
            "SPORT",
            "ENFANT",
            "PHARMACIE",
            "BAZAR",
            "NONE"
          ]
        },
        status: { enum: ["NOT_MATCHED", "MATCHED", "ZERO_MATCHED", "CV_SEND", "IMMERSING", "CONTRACT"] },
        localisation: {
          bsonType: "array",
          items: {
            enum: [
              "SAINT_DENIS",
              "SAINTE_MARIE",
              "SAINTE_SUZANNE",
              "SAINT_PAUL",
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
        matched_candidate: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              id: { bsonType: "string" },
              full_name: { bsonType: "string" },
              age: { bsonType: "int" },
              sex: { enum: ["FILLE", "GARCON"] },
              city: { bsonType: "string" },
              email: { bsonType: "string" },
              phone: { bsonType: "string" }
            }
          }
        }
      }
    }
  }
})
