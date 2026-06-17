# MongoDB — human_ressources

The `human_ressources` database stores candidate profiles and job listings for apprenticeship matching. Two collections: `candidates` (detailed candidate information, Titre Professionnel type, skills assessment, synthesis) and `jobs` (company job postings with matching candidate references).

---

## Collection: candidates

Stores complete candidate profiles including identity, education, support systems, background, skills assessment, and recruiter synthesis.

### Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| _id | string | yes | Auto-generated UUID |
| candidate_id | string | yes | Unique candidate identifier |
| tp_type | string | yes | enum: TitleProfessionalType (AD, CC, NTC, REM, SA) |
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
| transport_means | string | — | How candidate commutes |
| psh_referral_request | bool | — | Person with disabilities support request |

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

## Collection: jobs

Stores company job postings for apprenticeships with candidate matching information.

### Top-level fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| _id | string | — | Auto-generated UUID |
| company_name | string | — | Company hiring |
| age_range | string | — | Required age range for candidate |
| desired_tp | string | — | enum: TitleProfessionalType |
| desired_sex | string | — | enum: DesiredSex |
| driving_license_b | bool | — | Category B license required |
| professional_experience | bool | — | Professional experience required |
| sector | string | — | enum: Sector |
| status | string | — | enum: JobStatus |
| localisation | string[] | — | Cities where job is located (enum: Localisation) |
| matched_candidate | array of objects | — | Candidates matched to this job (see below) |

### matched_candidate[] (array of objects)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | — | Candidate _id |
| full_name | string | — | Candidate name |
| age | int | — | Candidate age |
| sex | string | — | enum: Sex (FILLE, GARCON, MIXTE) |
| city | string | — | enum: Localisation |
| email | string | — | Candidate email |
| phone | string | — | Candidate phone |
| status | string | — | enum: MatchedCandidateStatus |

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
