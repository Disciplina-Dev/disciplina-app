import { useState, useCallback, useEffect } from 'react'
import type {
  ABFormState, ABContent, ABPayload, ReferentDB,
  JourFormation, Domaine, Niveau, Permis,
  Experience, AgeRange, PMSMP, MethodeRecrutement,
} from '../types/ab'
import { MISSIONS_VENTE, MISSIONS_SECRETARIAT } from '../types/ab'
import './ABForm.css'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Identité',   sub: 'SIRET, adresse' },
  { id: 2, label: 'Contacts',   sub: 'Représentants' },
  { id: 3, label: 'Entreprise', sub: 'Activité, postes' },
  { id: 4, label: 'Poste',      sub: 'Missions, profil' },
  { id: 5, label: 'Apprenti',   sub: 'Critères, jours' },
  { id: 6, label: 'Missions',   sub: 'Tableau de tâches' },
  { id: 7, label: 'Signature',  sub: 'Lieu et date' },
]

// ─── État initial ─────────────────────────────────────────────────────────────

const INITIAL: ABFormState = {
  company:             { name: '', siret: '', address: '', code_postal: '', commune: '' },
  legal_rep:           { nom_prenom: '', fonction: '', telephone: '', courriel: '' },
  same_manager:        true,
  recruitment_manager: { nom_prenom: '', fonction: '', telephone: '', courriel: '' },
  content: {
    entreprise: { presentation_activite: '', nombre_postes: '', localisation_poste: '' },
    poste: {
      intitule_metier: '', description_missions: '',
      profils_recherches: '', competences_savoir_etre: '', commentaires: '',
    },
    apprenti: {
      domaine: '', niveau: '', permis: '', experience: '',
      age: '', methode_recrutement: '', pmsmp: '',
      jours_formation: [], engagement_evolution: false,
    },
    tableau_missions: [],
    signature: { lieu: '', date: new Date().toISOString().split('T')[0] ?? '' },
  },
}

const JOURS: JourFormation[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']

// ─── Payload helpers ──────────────────────────────────────────────────────────

function buildPayload(form: ABFormState): ABPayload {
  return {
    db: {
      company:             form.company,
      legal_rep:           { ...form.legal_rep, type: 'LEGAL_REP' },
      recruitment_manager: form.same_manager ? null : { ...form.recruitment_manager, type: 'RECRUITMENT_MANAGER' },
    },
    json: form.content,
  }
}

function downloadJson(form: ABFormState) {
  const { json } = buildPayload(form)
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `ab_${form.company.siret || 'brouillon'}_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ABForm() {
  const [step, setStep]         = useState(1)
  const [form, setForm]         = useState<ABFormState>(INITIAL)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  type SiretStatus = 'idle' | 'loading' | 'found_sirene' | 'found_db' | 'not_found' | 'rate_limited' | 'error'
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle')

  // Auto-complétion SIRET
  useEffect(() => {
    const siret = form.company.siret.replace(/\D/g, '')
    if (siret.length !== 14) { setSiretStatus('idle'); return }
    setSiretStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/companies/siret/${siret}`)
        if (res.status === 404) { setSiretStatus('not_found');    return }
        if (res.status === 429) { setSiretStatus('rate_limited'); return }
        if (!res.ok) throw new Error()
        const { source, data } = await res.json() as {
          source: 'db' | 'sirene'
          data: { name: string; address: string; code_postal: string; commune: string; main_activity?: string }
        }
        setForm(f => ({
          ...f,
          company: {
            ...f.company,
            name:        data.name        || f.company.name,
            address:     data.address     || f.company.address,
            code_postal: data.code_postal || f.company.code_postal,
            commune:     data.commune     || f.company.commune,
          },
          content: {
            ...f.content,
            entreprise: {
              ...f.content.entreprise,
              presentation_activite: data.main_activity && !f.content.entreprise.presentation_activite
                ? data.main_activity
                : f.content.entreprise.presentation_activite,
            },
          },
        }))
        setSiretStatus(source === 'db' ? 'found_db' : 'found_sirene')
      } catch { setSiretStatus('error') }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.company.siret])

  // Setters
  const setCompany     = (p: Partial<ABFormState['company']>)     => setForm(f => ({ ...f, company:             { ...f.company,             ...p } }))
  const setLegalRep    = (p: Partial<ReferentDB>)                  => setForm(f => ({ ...f, legal_rep:           { ...f.legal_rep,           ...p } }))
  const setRecManager  = (p: Partial<ReferentDB>)                  => setForm(f => ({ ...f, recruitment_manager: { ...f.recruitment_manager, ...p } }))
  const setEntreprise  = (p: Partial<ABContent['entreprise']>)     => setForm(f => ({ ...f, content: { ...f.content, entreprise:  { ...f.content.entreprise,  ...p } } }))
  const setPoste       = (p: Partial<ABContent['poste']>)          => setForm(f => ({ ...f, content: { ...f.content, poste:       { ...f.content.poste,       ...p } } }))
  const setApprenti    = (p: Partial<ABContent['apprenti']>)       => setForm(f => ({ ...f, content: { ...f.content, apprenti:    { ...f.content.apprenti,    ...p } } }))
  const setSignature   = (p: Partial<ABContent['signature']>)      => setForm(f => ({ ...f, content: { ...f.content, signature:   { ...f.content.signature,   ...p } } }))

  const toggleJour = (jour: JourFormation) => {
    const jours = form.content.apprenti.jours_formation
    setApprenti({ jours_formation: jours.includes(jour) ? jours.filter(j => j !== jour) : [...jours, jour] })
  }

  const toggleMission = (m: string) => {
    const ms = form.content.tableau_missions
    setForm(f => ({ ...f, content: { ...f.content, tableau_missions: ms.includes(m) ? ms.filter(x => x !== m) : [...ms, m] } }))
  }

  const handleSubmit = useCallback(async () => {
    setLoading(true); setApiError(null)
    try {
      const res = await fetch(`${API_URL}/api/ab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `Erreur ${res.status}`)
      }
      setSubmitted(true)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally { setLoading(false) }
  }, [form])

  const isAutoFilled     = siretStatus === 'found_sirene' || siretStatus === 'found_db'
  const availableMissions = form.content.apprenti.domaine === 'vente'       ? MISSIONS_VENTE
                          : form.content.apprenti.domaine === 'secretariat' ? MISSIONS_SECRETARIAT
                          : []

  // ─── Success ───────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="ab-page">
        <div className="ab-success-card">
          <div className="ab-success-icon">✓</div>
          <h2>Analyse de Besoin soumise</h2>
          <p className="ab-muted">{form.company.name} — {form.content.poste.intitule_metier}</p>
          <div className="ab-success-actions">
            <button className="ab-btn ab-btn-ghost" onClick={() => downloadJson(form)}>Télécharger JSON</button>
            <button className="ab-btn ab-btn-primary" onClick={() => { setForm(INITIAL); setStep(1); setSubmitted(false) }}>Nouvelle AB</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="ab-page">
      <div className="ab-layout">

        {/* Sidebar */}
        <aside className="ab-sidebar">
          <div className="ab-sidebar-brand">
            <div className="ab-logo">D</div>
            <div>
              <div className="ab-brand-title">Analyse de Besoin</div>
              <div className="ab-brand-sub">Disciplina CFA</div>
            </div>
          </div>
          <div className="ab-sidebar-progress">
            <div className="ab-sidebar-progress-track">
              <div className="ab-sidebar-progress-fill" style={{ width: `${Math.round(((step - 1) / (STEPS.length - 1)) * 100)}%` }} />
            </div>
            <span className="ab-sidebar-progress-label">Étape {step} sur {STEPS.length}</span>
          </div>
          <nav className="ab-sidebar-nav">
            {STEPS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`ab-nav-item ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}
                onClick={() => { if (step > s.id) setStep(s.id) }}
              >
                <span className="ab-nav-dot">{step > s.id ? '✓' : s.id}</span>
                <span className="ab-nav-info">
                  <span className="ab-nav-label">{s.label}</span>
                  <span className="ab-nav-sub">{s.sub}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenu */}
        <div className="ab-main">
          <div className="ab-body">

            {/* 1 — Identité */}
            {step === 1 && (
              <Section num="01" title="Identité de l'entreprise" tag="Base de données" tagType="db">
                <Field label="Dénomination ou raison sociale" req>
                  <input type="text" value={form.company.name}
                    onChange={e => setCompany({ name: e.target.value })}
                    placeholder="Ex : SAS Martin Distribution"
                    className={isAutoFilled ? 'autofilled' : ''} />
                </Field>
                <Field label="Numéro SIRET du siège social" req>
                  <div className="siret-wrap">
                    <input type="text" value={form.company.siret}
                      onChange={e => { setSiretStatus('idle'); setCompany({ siret: e.target.value.replace(/\D/g, '') }) }}
                      placeholder="14 chiffres" maxLength={14} />
                    <SiretHint status={siretStatus} />
                  </div>
                </Field>

                <Divider label="Coordonnées du siège" />

                <Field label="Adresse du siège social" req>
                  <input type="text" value={form.company.address}
                    onChange={e => setCompany({ address: e.target.value })}
                    placeholder="Numéro et nom de la rue"
                    className={isAutoFilled ? 'autofilled' : ''} />
                </Field>
                <div className="ab-row">
                  <Field label="Code postal" req>
                    <input type="text" value={form.company.code_postal}
                      onChange={e => setCompany({ code_postal: e.target.value })}
                      placeholder="974XX" maxLength={5}
                      className={isAutoFilled ? 'autofilled' : ''} />
                  </Field>
                  <Field label="Commune" req>
                    <input type="text" value={form.company.commune}
                      onChange={e => setCompany({ commune: e.target.value })}
                      placeholder="Ex : Saint-Denis"
                      className={isAutoFilled ? 'autofilled' : ''} />
                  </Field>
                </div>
              </Section>
            )}

            {/* 2 — Contacts */}
            {step === 2 && (
              <Section num="02" title="Contacts" tag="Base de données" tagType="db">
                <SubTitle>Informations du représentant légal</SubTitle>
                <ReferentFields values={form.legal_rep} onChange={setLegalRep} />

                <hr className="ab-hr" />

                <SubTitle>Informations du responsable de recrutement</SubTitle>
                <label className="ab-check-line">
                  <input type="checkbox" checked={form.same_manager}
                    onChange={e => setForm(f => ({ ...f, same_manager: e.target.checked }))} />
                  <span>Même personne que le représentant légal</span>
                </label>
                {!form.same_manager
                  ? <div className="mt-1"><ReferentFields values={form.recruitment_manager} onChange={setRecManager} /></div>
                  : <p className="ab-note">Les coordonnées du représentant légal seront utilisées pour le recrutement.</p>
                }
              </Section>
            )}

            {/* 3 — Entreprise */}
            {step === 3 && (
              <Section num="03" title="À propos de l'entreprise" tag="JSON" tagType="json">
                <Field label="Présentation de l'activité" req>
                  <textarea value={form.content.entreprise.presentation_activite}
                    onChange={e => setEntreprise({ presentation_activite: e.target.value })}
                    rows={4} placeholder="Décrivez l'activité principale de l'entreprise..." />
                </Field>
                <div className="ab-row">
                  <Field label="Nombre de postes à pourvoir" req>
                    <input type="number" min={1}
                      value={form.content.entreprise.nombre_postes}
                      onChange={e => setEntreprise({ nombre_postes: e.target.value === '' ? '' : Number(e.target.value) })}
                      placeholder="1" />
                  </Field>
                  <Field label="Localisation du poste">
                    <input type="text" value={form.content.entreprise.localisation_poste}
                      onChange={e => setEntreprise({ localisation_poste: e.target.value })}
                      placeholder="Ville ou adresse du lieu de travail" />
                  </Field>
                </div>
              </Section>
            )}

            {/* 4 — Poste */}
            {step === 4 && (
              <Section num="04" title="Exigences du poste" tag="JSON" tagType="json">
                <Field label="Intitulé du métier" req>
                  <input type="text" value={form.content.poste.intitule_metier}
                    onChange={e => setPoste({ intitule_metier: e.target.value })}
                    placeholder="Ex : Conseiller(ère) commercial(e)" />
                </Field>
                <Field label="Description des missions" req>
                  <textarea value={form.content.poste.description_missions}
                    onChange={e => setPoste({ description_missions: e.target.value })}
                    rows={4} placeholder="Décrivez les missions principales du poste..." />
                </Field>
                <Field label="Profils recherchés">
                  <textarea value={form.content.poste.profils_recherches}
                    onChange={e => setPoste({ profils_recherches: e.target.value })}
                    rows={3} placeholder="Formation, expérience, qualités personnelles attendues..." />
                </Field>
                <Field label="Compétences et savoir-être requis">
                  <textarea value={form.content.poste.competences_savoir_etre}
                    onChange={e => setPoste({ competences_savoir_etre: e.target.value })}
                    rows={3} placeholder="Compétences techniques et comportementales..." />
                </Field>
                <Field label="Commentaires supplémentaires">
                  <textarea value={form.content.poste.commentaires}
                    onChange={e => setPoste({ commentaires: e.target.value })}
                    rows={3} placeholder="Horaires, rémunération, avantages, conditions particulières..." />
                </Field>
              </Section>
            )}

            {/* 5 — Apprenti */}
            {step === 5 && (
              <Section num="05" title="Exigences de l'apprenti" tag="JSON" tagType="json">
                <div className="ab-grid2">
                  <Field label="Domaine de formation" req>
                    <Radios
                      opts={[{ v: 'secretariat', l: 'Secrétariat' }, { v: 'vente', l: 'Vente' }]}
                      value={form.content.apprenti.domaine}
                      onChange={v => setApprenti({ domaine: v as Domaine | '' })} />
                  </Field>
                  <Field label="Niveau de formation" req>
                    <Radios
                      opts={[{ v: 'BAC', l: 'Bac' }, { v: 'BAC+2', l: 'Bac+2' }, { v: 'BAC+3', l: 'Bac+3' }]}
                      value={form.content.apprenti.niveau}
                      onChange={v => setApprenti({ niveau: v as Niveau | '' })} />
                  </Field>
                  <Field label="Permis de conduire">
                    <Radios
                      opts={[{ v: 'oui', l: 'Oui' }, { v: 'optionnel', l: 'Optionnel' }]}
                      value={form.content.apprenti.permis}
                      onChange={v => setApprenti({ permis: v as Permis | '' })} />
                  </Field>
                  <Field label="Expérience requise">
                    <Radios
                      opts={[{ v: 'debutant', l: 'Débutant accepté' }, { v: 'obligatoire', l: 'Obligatoire' }]}
                      value={form.content.apprenti.experience}
                      onChange={v => setApprenti({ experience: v as Experience | '' })} />
                  </Field>
                  <Field label="Âge exigé">
                    <Radios
                      opts={[{ v: '18-20', l: '18–20 ans' }, { v: '21-25', l: '21–25 ans' }, { v: '26-29', l: '26–29 ans' }]}
                      value={form.content.apprenti.age}
                      onChange={v => setApprenti({ age: v as AgeRange | '' })} />
                  </Field>
                  <Field label="Méthode de recrutement">
                    <Radios
                      opts={[
                        { v: 'entretien_disciplina', l: 'Via Disciplina' },
                        { v: 'cv_envoye',            l: 'CV envoyés' },
                        { v: 'entretien_direct',     l: 'Entretien direct' },
                      ]}
                      value={form.content.apprenti.methode_recrutement}
                      onChange={v => setApprenti({ methode_recrutement: v as MethodeRecrutement | '' })} />
                  </Field>
                  <Field label="Période d'immersion PMSMP">
                    <Radios
                      opts={[{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'a_discuter', l: 'À discuter' }]}
                      value={form.content.apprenti.pmsmp}
                      onChange={v => setApprenti({ pmsmp: v as PMSMP | '' })} />
                  </Field>
                </div>
                <Field label="Jours de formation possibles">
                  <div className="ab-days">
                    {JOURS.map(j => (
                      <button key={j} type="button"
                        className={`ab-day ${form.content.apprenti.jours_formation.includes(j) ? 'on' : ''}`}
                        onClick={() => toggleJour(j)}>
                        {j.slice(0, 2).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </Field>
                <label className="ab-engagement">
                  <input type="checkbox"
                    checked={form.content.apprenti.engagement_evolution}
                    onChange={e => setApprenti({ engagement_evolution: e.target.checked })} />
                  <span>
                    <strong>Engagement d'évolution des missions</strong>
                    <small>L'entreprise s'engage à faire évoluer progressivement les missions confiées à l'apprenti</small>
                  </span>
                </label>
              </Section>
            )}

            {/* 6 — Missions */}
            {step === 6 && (
              <Section num="06" title="Tableau des missions" tag="JSON" tagType="json">
                {availableMissions.length === 0
                  ? (
                    <div className="ab-missions-empty">
                      <p>Sélectionnez un domaine à l'étape <strong>Apprenti</strong> pour afficher les missions correspondantes.</p>
                      <button className="ab-btn ab-btn-ghost" onClick={() => setStep(5)}>← Étape Apprenti</button>
                    </div>
                  )
                  : (
                    <>
                      <p className="ab-missions-lead">
                        Cochez les missions que l'apprenti sera amené à réaliser en entreprise.
                        <span className={`ab-domain-tag ${form.content.apprenti.domaine}`}>
                          {form.content.apprenti.domaine === 'vente' ? 'Vente' : 'Secrétariat'}
                        </span>
                      </p>
                      <div className="ab-missions-grid">
                        {availableMissions.map(m => (
                          <label key={m} className={`ab-mission ${form.content.tableau_missions.includes(m) ? 'checked' : ''}`}>
                            <input type="checkbox"
                              checked={form.content.tableau_missions.includes(m)}
                              onChange={() => toggleMission(m)} />
                            <span>{m}</span>
                          </label>
                        ))}
                      </div>
                      <p className="ab-missions-count">
                        {form.content.tableau_missions.length} mission{form.content.tableau_missions.length !== 1 ? 's' : ''} sélectionnée{form.content.tableau_missions.length !== 1 ? 's' : ''}
                      </p>
                    </>
                  )
                }
              </Section>
            )}

            {/* 7 — Signature */}
            {step === 7 && (
              <Section num="07" title="Signature finale" tag="JSON" tagType="json">
                <p className="ab-sign-intro">
                  En signant ce document, l'entreprise confirme les informations renseignées
                  et son engagement à accueillir un apprenti dans les conditions décrites.
                </p>
                <div className="ab-row">
                  <Field label="Fait à" req>
                    <input type="text" value={form.content.signature.lieu}
                      onChange={e => setSignature({ lieu: e.target.value })}
                      placeholder="Ville" />
                  </Field>
                  <Field label="Le" req>
                    <input type="date" value={form.content.signature.date}
                      onChange={e => setSignature({ date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Signature et cachet de l'entreprise">
                  <div className="ab-sign-box">
                    <span>Apposer ici la signature et le cachet</span>
                  </div>
                </Field>
                {apiError && <div className="ab-error">{apiError}</div>}
              </Section>
            )}

          </div>

          {/* Footer */}
          <div className="ab-footer">
            <button className="ab-btn ab-btn-ghost" onClick={() => setStep(s => s - 1)} disabled={step === 1}>
              ← Précédent
            </button>
            <span className="ab-counter">{step} / {STEPS.length}</span>
            {step < STEPS.length
              ? <button className="ab-btn ab-btn-primary" onClick={() => setStep(s => s + 1)}>Suivant →</button>
              : <button className="ab-btn ab-btn-submit" onClick={() => { void handleSubmit() }} disabled={loading}>
                  {loading ? 'Envoi...' : 'Soumettre l\'AB'}
                </button>
            }
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({ num, title, tag, tagType, children }: {
  num: string; title: string; tag: string; tagType: 'db' | 'json'; children: React.ReactNode
}) {
  return (
    <div className="ab-section">
      <div className="ab-section-head">
        <div>
          <span className="ab-section-num">{num}</span>
          <h2 className="ab-section-title">{title}</h2>
        </div>
        <span className={`ab-tag ab-tag-${tagType}`}>{tag}</span>
      </div>
      {children}
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="ab-subtitle">{children}</div>
}

function Divider({ label }: { label: string }) {
  return <div className="ab-divider"><span>{label}</span></div>
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="ab-field">
      <label>{label}{req && <span className="ab-req"> *</span>}</label>
      {children}
    </div>
  )
}

function Radios({ opts, value, onChange }: {
  opts: { v: string; l: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="ab-radios">
      {opts.map(o => (
        <button key={o.v} type="button"
          className={`ab-radio ${value === o.v ? 'on' : ''}`}
          onClick={() => onChange(value === o.v ? '' : o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

function ReferentFields({ values, onChange }: { values: ReferentDB; onChange: (p: Partial<ReferentDB>) => void }) {
  return (
    <>
      <Field label="Nom et prénom" req>
        <input type="text" value={values.nom_prenom}
          onChange={e => onChange({ nom_prenom: e.target.value })} placeholder="Prénom NOM" />
      </Field>
      <Field label="Fonction" req>
        <input type="text" value={values.fonction}
          onChange={e => onChange({ fonction: e.target.value })} placeholder="Ex : Gérant(e), DRH..." />
      </Field>
      <div className="ab-row">
        <Field label="Téléphone" req>
          <input type="tel" value={values.telephone}
            onChange={e => onChange({ telephone: e.target.value })} placeholder="0692 XX XX XX" />
        </Field>
        <Field label="Courriel" req>
          <input type="email" value={values.courriel}
            onChange={e => onChange({ courriel: e.target.value })} placeholder="contact@entreprise.re" />
        </Field>
      </div>
    </>
  )
}

function SiretHint({ status }: { status: string }) {
  const MAP: Record<string, { cls: string; text: string }> = {
    loading:      { cls: 'loading', text: 'Recherche en cours...' },
    found_sirene: { cls: 'ok',      text: '✓ Données SIRENE récupérées — champs pré-remplis' },
    found_db:     { cls: 'ok',      text: '✓ Entreprise déjà connue' },
    not_found:    { cls: 'warn',    text: 'SIRET introuvable — remplissez manuellement' },
    rate_limited: { cls: 'warn',    text: 'Trop de requêtes — réessayez dans quelques secondes' },
    error:        { cls: 'warn',    text: 'Service indisponible — remplissez manuellement' },
  }
  const entry = MAP[status]
  if (!entry) return null
  return <span className={`ab-siret-hint ab-siret-${entry.cls}`}>{entry.text}</span>
}
