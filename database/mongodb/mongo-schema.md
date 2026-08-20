# MongoDB — human_ressources

The `human_ressources` database stores candidate profiles and company needs analyses for apprenticeship matching. Two collections: `candidates` (detailed candidate information, Titre Professionnel type, skills assessment, synthesis) and `needs_analysis` (the company needs analysis / *Analyse de Besoin* — replaces the former MySQL `needs_analysis` table, linked from `companies.ab_id`). Each AB carries its matching state per position in `offers[].matching` (this replaced the former standalone `jobs` collection).

---

## Collection: candidates

Stores complete candidate profiles including identity, education, support systems, background, skills assessment, and recruiter synthesis.

### Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| _id | string | yes | Auto-generated UUID |
| candidate_id | string | yes | Unique candidate identifier |
| tp_types | string[] | yes | enum: TitleProfessionalType (AD, CC, NTC, REM, SA), multi-select |
| identity | object | yes | Candidate personal information (see below) |
| status | string | yes | enum: CandidateStatus |
| formation_type | string | — | enum: VENTE, SECRETARIAT |
| training_site | string | — | enum: TrainingSite |
| immersion_agreement | bool | — | Whether candidate agreed to immersion period |
| desired_sectors | string[] | — | Sectors candidate is interested in |
| expected_company_skills | string[] | — | Skills candidate expects to develop |
| education | object | — | School level and justification (see below) |
| support | object | — | France Travail and Mission Locale enrollment (see below) |
| background | object | — | Previous training and professional experience (see below) |
| profile | object | — | Language skills, qualities, defects, digital skills (see below) |
| professional_projects | object | — | Career objectives and motivations (see below) |
| skills_assessment | array of objects | — | Competences and levels (see below) |
| job_info | object | — | Job preferences and availability (see below) |
| synthesis | object | — | Recruiter assessment and recommendations (see below) |
| pdf_link | string | — | Link to generated candidate PDF |
| cv_link | string | — | Link to the candidate's CV uploaded to Google Drive |
| drive_folder_id | string | — | Google Drive folder ID holding the candidate's documents |
| classmarker | object | — | ClassMarker test results (see below) |
| created_at | date | — | Candidate creation date (first interview date on CSV import) |

### Embedded object: identity

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| full_name | string | yes | Candidate full name |
| email | string | yes | Email address |
| phone | string | yes | Phone number |
| date_of_birth | date | — | Date of birth |
| place_of_birth | string | — | Birthplace |
| age | int | — | Current age |
| sex | string | — | enum: FILLE, GARCON |
| postal_code | string | — | Postal code |
| city | string | — | City name |
| driving_license_b | bool | — | Has category B driving license |
| has_vehicle | bool | — | Owns a personal vehicle |
| transport_means | string | — | How candidate commutes |
| psh_referral_request | bool | — | Person with disabilities support request |
| description | string | — | Free-text candidate summary (recruiter context for manual matching; text-indexed, used for candidatesPage search) |

### Embedded object: education

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| school_level | string | — | enum: SchoolLevel |
| justification | string | — | Explanation of education level |

### Embedded object: support

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| france_travail_registered | bool | — | Registered with France Travail (employment agency) |
| france_travail_agency | string | — | Which France Travail agency |
| mission_locale_registered | bool | — | Registered with Mission Locale (youth employment) |
| mission_locale_city | string | — | Which Mission Locale branch |

### Embedded object: background

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| last_diploma | string | — | Most recent diploma |
| previous_trainings | string | — | Previous trainings attended |
| professional_experiences | array of objects | — | Work history (see below) |

#### background.professional_experiences[] (array of objects)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| position | string | — | Job title |
| duration | string | — | Length of employment |
| responsibilities | string | — | What candidate did |
| company | string | — | Company name |

### Embedded object: profile

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| french_level | int | — | French proficiency 1–10 |
| english_level | int | — | English proficiency 1–10 |
| other_languages | string[] | — | Other spoken languages |
| strengths_and_improvements | string | — | Personal assessment |
| qualities | string[] | — | Up to 3 positive qualities |
| defects | string[] | — | Up to 3 areas for improvement |
| digital_skills | string[] | — | Computer and software skills |
| ready_for_challenges | bool | — | Openness to challenges |
| hobbies | string | — | Personal interests |

### Embedded object: professional_projects

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| career_objectives | string | — | Long-term career goals |
| desired_skills | string | — | Skills candidate wants to learn |
| apprenticeship_motivation | string | — | Why choose this apprenticeship |
| training_expectations | string | — | What candidate expects from training |

### skills_assessment[] (array of objects)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| competence | string | yes | Competence name (Titre Professionnel specific) |
| level | string | yes | enum: SkillLevel (A, ECA, NA, NE) |

### Embedded object: job_info

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| domain_motivation | string | — | Why interested in this domain |
| questions_concerns | string | — | Concerns or questions about the role |
| availability_date | date | — | When candidate can start |
| geographic_mobility | string[] | — | Preferred cities (enum: Localisation) |
| weekend_work | bool | — | Willing to work weekends |
| discovery_source | string | — | enum: DiscoverySource |

### Embedded object: synthesis

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| feasibility_conclusion | string | — | Recruiter assessment of feasibility |
| pathway_relevance | string | — | Whether path aligns with candidate goals |
| special_needs | string | — | Support needed for this candidate |
| pedagogical_recommendations | object | — | Recommended trainings (see below) |
| other_recommendations | string | — | Additional notes |
| location | string | — | Assessment location |
| date | date | — | Assessment date |
| recruiter_signature | string | — | Recruiter name |
| candidate_signature | string | — | Candidate name |

#### synthesis.pedagogical_recommendations

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| office_tools_reinforcement | bool | — | Train on Office/Excel/Word |
| written_communication_support | bool | — | Writing skills training |
| oral_confidence_development | bool | — | Speaking and presentation skills |
| time_management_support | bool | — | Time/organization coaching |
| professional_posture_work | bool | — | Professional behavior coaching |
| enhanced_company_immersion | bool | — | Extended immersion period |
| psh_specific_support | bool | — | Disability accommodations |
| individual_follow_up | bool | — | One-on-one mentoring |
| language_training | bool | — | French/English lessons |
| stress_management_follow_up | bool | — | Stress/anxiety support |

### Embedded object: classmarker

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| percentage | int | — | Score as percentage |
| points_scored | int | — | Points earned |
| points_available | int | — | Total possible points |
| passed | bool | — | Test passed/failed |
| test_name | string | — | Name of test |
| completed_at | date | — | When test was completed |
| duration | string | — | How long test took |

---

## Collection: needs_analysis

The company needs analysis (*Analyse de Besoin*, AB) filled by a commercial. Replaces the former MySQL `needs_analysis` table; `companies.ab_id` (MySQL) holds this document's `_id`.

### Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| _id | string | — | Application UUID (= `companies.ab_id`) |
| company_infos | object | — | Company data, enriched from the CRM `companies` row (see below) |
| saler_info | object | — | Commercial who created the AB (see below) |
| referents | object | — | Legal and recruitment referents (see below) |
| offers | array of objects | — | One entry per position to fill (see below) |
| recruitment_method | string | — | enum: RecruitmentMethod |
| immersion_period | string | — | enum: ImmersionPeriod |
| training_days | string | — | JSON string of per-day availability (not parsed) |
| signature_request_id | string | — | DocuSeal submission id (e-signature) |
| status | string | — | enum: NeedsAnalysisStatus |
| created_at | date | — | Creation date |
| updated_at | date | — | Last update date |

### Embedded object: company_infos

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | — | `companies.id` (MySQL) |
| name | string | — | Company name |
| ape | string | — | APE code |
| idcc | string | — | IDCC collective agreement code |
| siret | string | — | SIRET |
| main_activity | string | — | Main activity |
| opco | string | — | enum: Opco |
| referral_source | string | — | enum: ReferralSource |
| sector | string | — | enum: CompanyRegion — regional zone, derived from the first position's communes |
| activities | string[] | — | Free-text business activities of the company |
| description | string | — | Company description |

### Embedded object: saler_info

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | int | — | `users.id` of the commercial |
| email | string | — | Commercial email |

### Embedded object: referents

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| is_same | bool | — | Whether recruitment referent is the legal referent |
| legal_referents | object | — | name, phone, email, function |
| recruitment_referents | object | — | name, phone, email, function |

### offers[] (array of objects)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | — | Stable offer UUID — matching handle (replaces the former `jobs._id`) |
| localisation | string[] | — | Réunion communes (enum: Localisation) |
| tp_type | string | — | enum: TitleProfessionalType (derived from training_domain) |
| training_domain | string | — | enum: TrainingDomain |
| title | string | — | Job title |
| missions | string[] | — | Selected missions |
| description_missions | string[] | — | Detailed mission descriptions |
| other_description_missions | string | — | Free-text extra description |
| other_missions | string | — | Free-text extra missions |
| matching | object | — | Matching state for this offer (see below) — replaces the former `jobs` collection |
| criteria | object | — | Apprentice criteria for this position (see below) |

#### offers[].matching

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | — | enum: JobStatus (default NOT_MATCHED) — offer-level matching stage |
| candidates | array of objects | — | Unified candidate list: retained + proposed (see below) |
| interview_slots | string[] | — | Shared pool of interview slots (ISO datetimes) |
| interview_location | string | — | Default interview location |

#### offers[].matching.candidates[]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | — | Candidate _id |
| full_name | string | — | Candidate name |
| age | int | — | Candidate age |
| sex | string | — | enum: Sex |
| city | string | — | enum: Localisation |
| email | string | — | Candidate email |
| phone | string | — | Candidate phone |
| status | string | — | enum: MatchedCandidateStatus (RETAINED once matched, OFFER_SEND once proposed) |
| description | string | — | Candidate description (proposal) |
| cv_webview | string | — | CV web view URL |
| answer | string | — | enum: ProposedCandidateAnswer — company's answer |
| comment | string | — | Company comment |
| interview_location | string | — | Interview location for this candidate |
| booked_interview_slot | string | — | Booked slot (ISO datetime) |
| interview_conclusion | string | — | enum: InterviewConclusion |
| immersion_start_date | string | — | Immersion start |
| immersion_end_date | string | — | Immersion end |
| immersion_location | string | — | Immersion location |
| immersion_conclusion | string | — | enum: ImmersionConclusion |

#### offers[].criteria

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| education_level | string | — | enum: EducationLevel |
| driving_license | bool | — | Category B license required |
| experience_required | bool | — | Professional experience required |
| training_domain | string | — | enum: TrainingDomain |
| age_min | int | — | Minimum age |
| age_max | int | — | Maximum age |
| soft_skills | string | — | Expected soft skills |
| schedule_options | object[] | — | Schedule slots: `{ day, start_hour, end_hour }` |
| conditions | string | — | Work conditions |
| additional_comments | string | — | Additional comments |

---

## Enums reference

### MatchedCandidateStatus

| Value | Meaning |
|-------|---------|
| RETAINED | Candidate retained for the offer |
| OFFER_SEND | Offer email sent, awaiting response |
| ACCEPTED | Candidate accepted the offer |
| DECLINED | Candidate declined the offer |

### CandidateStatus

| Value | Meaning |
|-------|---------|
| SEEKING | Actively looking for apprenticeship |
| NOT_SEEKING | Not looking at this time |
| UNAVAILABLE | Temporarily unavailable until job_info.availability_date; auto-reverts to SEEKING once that date has passed |
| CANCELLED | Candidacy cancelled |
| MATCHED | Matched with a company |
| CONTRACT | Contract signed |
| IMMERSING | In immersion period |
| BANNED | Ineligible for support |

### TitleProfessionalType

| Value | Meaning |
|-------|---------|
| AD | Assistant de Direction |
| CC | Conseiller Commercial |
| NTC | Négociateur Technico-Commercial |
| REM | Responsable d'Exploitation Magasin |
| SA | Secrétaire Assistant |

### SchoolLevel

| Value | Meaning |
|-------|---------|
| CAP_BEP_WITH_1Y_EXP | CAP/BEP + 1 year experience |
| PREMIERE_TERMINALE | First or final year of secondary |
| PREMIERE_TERMINALE_WITH_1Y_EXP | First/final year secondary + 1 year experience |
| BAC | Baccalauréat |
| BAC_WITH_1Y_EXP | Baccalauréat + 1 year experience |
| BAC_PLUS | Post-bac education |
| BAC_PLUS_2 | 2 years post-bac |
| BAC_PLUS_2_PLUS | 2+ years post-bac |
| BAC_PLUS_3_PLUS | 3+ years post-bac |

### TrainingSite

| Value | Meaning |
|-------|---------|
| NORD_SAINTE_MARIE | North campus at Sainte-Marie |
| OUEST_SAINT_PAUL | West campus at Saint-Paul |
| SUD_SAINT_PIERRE | South campus at Saint-Pierre |

### SkillLevel

| Value | Meaning |
|-------|---------|
| A | Acquired — competence mastered |
| ECA | In progress — competence developing |
| NA | Not applicable — competence not relevant |
| NE | Not evaluated — competence not assessed |

### DiscoverySource

| Value | Meaning |
|-------|---------|
| SOCIAL_MEDIA | Found through social media |
| FRANCE_TRAVAIL | Referred by France Travail |
| MISSION_LOCALE | Referred by Mission Locale |
| WORD_OF_MOUTH | Personal recommendation |
| KOANN | KOANN platform |
| OTHER | Other source |

### JobStatus

| Value | Meaning |
|-------|---------|
| NOT_MATCHED | No suitable candidates found |
| MATCHED | Candidates found and pending |
| CV_SEND | Candidates' CVs sent to company |
| IMMERSING | Candidate in immersion |
| CONTRACT | Contract signed |

### DesiredSex

| Value | Meaning |
|-------|---------|
| MIXTE | Open to any gender |
| FILLE | Prefer female |
| GARCON | Prefer male |

### Sector

| Value | Meaning |
|-------|---------|
| BOULANGERIE | Bakery |
| RESTAURATION | Hospitality/Catering |
| STATION | Gas station |
| PAP | Personal services |
| LIBRE_SERVICE | Retail/Self-service |
| TELEPHONIE | Telecommunications |
| AUTO | Automotive |
| COMMERCIAL | Commercial/Sales |
| BIJOUX | Jewelry |
| COSMETIQUE | Cosmetics |
| IMMOBILIER | Real estate |
| ASSURANCE | Insurance |
| ANIMAUX | Pet-related |
| SPORT | Sports |
| ENFANT | Childcare |
| PHARMACIE | Pharmacy |
| BAZAR | General merchandise |
| NONE | No specific sector |

### Localisation

| Value | Meaning |
|-------|---------|
| SAINT_DENIS | Commune in Réunion |
| SAINTE_MARIE | Commune in Réunion |
| SAINTE_SUZANNE | Commune in Réunion |
| SAINT_PAUL | Commune in Réunion |
| LA_POSSESSION | Commune in Réunion |
| LE_PORT | Commune in Réunion |
| TROIS_BASSINS | Commune in Réunion |
| SAINT_LEU | Commune in Réunion |
| SAINT_PIERRE | Commune in Réunion |
| CILAOS | Commune in Réunion |
| ETANG_SALE | Commune in Réunion |
| SAINT_LOUIS | Commune in Réunion |
| ENTRE_DEUX | Commune in Réunion |
| LES_AVIRONS | Commune in Réunion |
| LE_TAMPON | Commune in Réunion |
| SAINT_PHILLIPE | Commune in Réunion |
| SAINT_JOSEPH | Commune in Réunion |
| PETIT_ILE | Commune in Réunion |
| SAINTE_ROSE | Commune in Réunion |
| SAINT_BENOIT | Commune in Réunion |
| BRAS_PANON | Commune in Réunion |
| SAINT_ANDRE | Commune in Réunion |
| LA_PLAINE_DES_PALMISTES | Commune in Réunion |
| SALAZIE | Commune in Réunion |
| SAINTE_ANNE | Commune in Réunion |

### Sex

| Value | Meaning |
|-------|---------|
| FILLE | Female |
| GARCON | Male |
| MIXTE | Any gender |

### CompanyRegion

| Value | Meaning |
|-------|---------|
| NORD | North zone |
| OUEST | West zone |
| SUD | South zone |

### Opco

| Value |
|-------|
| AKTO |
| ATLAS |
| AFDAS |
| CONSTRUCTYS |
| OCAPIAT |
| OPCO_2I |
| OPCO_EP |
| OPCO_MOBILITES |
| OPCO_SANTE |
| OPCOMMERCE |
| UNIFORMATION |

### ReferralSource

| Value |
|-------|
| KOANN |
| E2CR |
| FRANCE_TRAVAIL |
| TELEVISION_PUB |
| BOUCHE_A_OREILLE |
| MISSION_LOCALE |
| SALON |
| RSMA |
| RESEAUX_SOCIAUX |

### EducationLevel

| Value | Meaning |
|-------|---------|
| BAC | Baccalauréat |
| BAC_PLUS_2 | 2 years post-bac |
| BAC_PLUS_3 | 3 years post-bac |

### TrainingDomain

| Value | Meaning |
|-------|---------|
| SECRETARIAT | Secretariat / office |
| VENTE | Sales |

### RecruitmentMethod

| Value | Meaning |
|-------|---------|
| ALL_CV | Send all CVs |
| PRESELECTION | Pre-selected CVs |
| PRE_INTERVIEW | Pre-interviewed candidates |

### ImmersionPeriod

| Value | Meaning |
|-------|---------|
| OUI | Immersion period wanted |
| NON | No immersion period |
| A_DISCUTER | To be discussed |

### NeedsAnalysisStatus

| Value | Meaning |
|-------|---------|
| BROUILLON | Draft |
| EN_ATTENTE_SIGNATURE | Awaiting e-signature |
| SIGNE | Signed |
| EXPIRE | Expired |
