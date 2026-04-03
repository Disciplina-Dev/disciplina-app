// Sélection / création de la DB
db = db.getSiblingDB('needs_analysis');

// =========================
// Collection: companies
// =========================
db.createCollection('companies', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "created_at", "status", "company_snapshot"],
      properties: {
        _id: { bsonType: "string" },
        created_at: { bsonType: "date" },
        created_by: { bsonType: "string" },
        status: {
          enum: ["DRAFT", "SUBMITTED", "MATCHED", "CLOSED"]
        },

        company_snapshot: {
          bsonType: "object",
          required: ["company_id", "name"],
          properties: {
            company_id: { bsonType: "string" },
            name: { bsonType: "string" },
            siret: { bsonType: "string" },
            main_activity: { bsonType: "string" },

            sector: {
              bsonType: "object",
              properties: {
                id: { bsonType: "string" },
                name: { bsonType: "string" },
                code: { bsonType: "string" }
              }
            },

            referents: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  referent_id: { bsonType: "string" },
                  first_name: { bsonType: "string" },
                  last_name: { bsonType: "string" },
                  function: { bsonType: "string" },
                  phone: { bsonType: "string" },
                  email: { bsonType: "string" },
                  type: {
                    enum: ["LEGAL_REP", "RECRUITMENT_MANAGER"]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

// =========================
// Collection: candidates
// =========================
db.createCollection('candidates', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "candidate_id", "status"],
      properties: {
        _id: { bsonType: "string" },
        candidate_id: { bsonType: "string" },
        created_at: { bsonType: "date" },
        created_by: { bsonType: "string" },
        status: {
          enum: ["DRAFT", "ACTIVE", "MATCHED", "CLOSED"]
        },

        desired_job_profile: {
          bsonType: "object",
          properties: {
            domain: { enum: ["SECRETARIAT", "VENTE"] },
            level: { enum: ["BAC", "BAC+2", "BAC+3"] },
            preferred_missions: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            preferred_sectors: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            localisation_preferences: {
              bsonType: "array",
              items: { bsonType: "string" }
            }
          }
        },

        candidate_profile: {
          bsonType: "object",
          properties: {
            formation_domain: { enum: ["SECRETARIAT", "VENTE"] },
            formation_level: { enum: ["BAC", "BAC+2", "BAC+3"] },
            has_experience: { bsonType: "bool" },
            driving_license: { bsonType: "bool" },
            age_range: { enum: ["18-20", "21-25", "26-29"] },

            availability: {
              bsonType: "object",
              properties: {
                monday: { bsonType: "bool" },
                tuesday: { bsonType: "bool" },
                wednesday: { bsonType: "bool" },
                thursday: { bsonType: "bool" },
                friday: { bsonType: "bool" }
              }
            },

            immersion_ok: { bsonType: "bool" }
          }
        },

        skills: {
          bsonType: "object",
          properties: {
            hard: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            soft: {
              bsonType: "array",
              items: { bsonType: "string" }
            }
          }
        }
      }
    }
  }
});