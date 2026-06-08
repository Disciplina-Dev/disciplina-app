import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Save, Edit2, ExternalLink, ClipboardCheck,
  QrCode, User, Loader2, AlertCircle, X, FolderPlus, Upload, FileText,
} from 'lucide-react'
import { useCandidateById, useUpdateCandidate, useCreateCandidateDriveFolder } from '@/graphql/hooks'
import { useAuthStore } from '@/store/authStore'
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal'
import CandidateTestScore from '@/components/rh/CandidateTestScore'
import { splitFullName } from '@/utils/classmarker'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CandidateStatus, string> = {
  [CandidateStatus.SEEKING]:     'En recherche',
  [CandidateStatus.NOT_SEEKING]: 'Indisponible',
  [CandidateStatus.CANCELLED]:   'Rupture',
  [CandidateStatus.MATCHED]:     'Immersion',
  [CandidateStatus.CONTRACTED]:  'Sous contrat',
  [CandidateStatus.BANNED]:      'Banni',
}

const STATUS_COLORS: Record<CandidateStatus, string> = {
  [CandidateStatus.SEEKING]:     'bg-blue text-white',
  [CandidateStatus.NOT_SEEKING]: 'bg-gray-400 text-white',
  [CandidateStatus.CANCELLED]:   'bg-warning text-white',
  [CandidateStatus.MATCHED]:     'bg-purple text-white',
  [CandidateStatus.CONTRACTED]:  'bg-success text-white',
  [CandidateStatus.BANNED]:      'bg-danger text-white',
}

const TP_COLORS: Record<TitleProfessionalType, string> = {
  [TitleProfessionalType.AD]:  'bg-teal-50 text-teal-700 ring-teal-200',
  [TitleProfessionalType.CC]:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
  [TitleProfessionalType.NTC]: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  [TitleProfessionalType.REM]: 'bg-lime-50 text-lime-700 ring-lime-200',
  [TitleProfessionalType.SA]:  'bg-slate-50 text-slate-700 ring-slate-200',
}

const TRAINING_SITE_LABELS: Record<TrainingSite, string> = {
  [TrainingSite.NORD_SAINTE_MARIE]: 'Nord – Sainte-Marie',
  [TrainingSite.OUEST_SAINT_PAUL]:  'Ouest – Saint-Paul',
  [TrainingSite.SUD_SAINT_PIERRE]:  'Sud – Saint-Pierre',
}

const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  [SchoolLevel.CAP_BEP_WITH_1Y_EXP]:          'CAP/BEP + 1 an exp.',
  [SchoolLevel.PREMIERE_TERMINALE]:            '1ère / Terminale',
  [SchoolLevel.PREMIERE_TERMINALE_WITH_1Y_EXP]:'1ère / Term. + 1 an exp.',
  [SchoolLevel.BAC]:                           'Bac',
  [SchoolLevel.BAC_WITH_1Y_EXP]:               'Bac + 1 an exp.',
  [SchoolLevel.BAC_PLUS]:                      'Bac +1',
  [SchoolLevel.BAC_PLUS_2]:                    'Bac +2',
  [SchoolLevel.BAC_PLUS_2_PLUS]:               'Bac +2 ou plus',
  [SchoolLevel.BAC_PLUS_3_PLUS]:               'Bac +3 ou plus',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputCls = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/20 transition-colors'
const selectCls = inputCls
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500'
const valueCls = 'mt-1 text-sm font-medium text-gray-900'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-wider pb-2 mb-4 border-b border-purple/10"
      style={{ color: 'var(--color-purple)' }}>
      {children}
    </h3>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-5 ${className}`}>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FicheCandidat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { candidate, loading, error } = useCandidateById(id ?? '')
  const { update } = useUpdateCandidate()
  const { createDriveFolder } = useCreateCandidateDriveFolder()
  const token = useAuthStore((s) => s.token)

  const [formData, setFormData] = useState<Candidate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [showClassMarker, setShowClassMarker] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploadingCV, setUploadingCV] = useState(false)

  useEffect(() => {
    if (candidate && !formData) setFormData(structuredClone(candidate))
  }, [candidate])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-400 text-sm">
        <Loader2 size={20} className="animate-spin" />
        Chargement…
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center px-4">
        <AlertCircle size={32} className="text-danger" />
        <p className="text-sm font-medium text-gray-700">Candidat introuvable</p>
        {error && <p className="text-xs text-gray-400 max-w-md">{error}</p>}
        <p className="text-xs text-gray-400 font-mono">{id}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>Retour</Button>
      </div>
    )
  }

  if (!formData) return null

  const updateIdentity = (key: keyof Candidate['identity'], value: unknown) =>
    setFormData(prev => prev ? { ...prev, identity: { ...prev.identity, [key]: value } } : prev)

  const updateProfile = (key: keyof NonNullable<Candidate['profile']>, value: unknown) =>
    setFormData(prev => prev ? { ...prev, profile: { ...(prev.profile ?? {}), [key]: value } } : prev)

  const handleSave = async () => {
    if (!formData) return
    setSaving(true)
    setSaveError(null)
    try {
      await update(formData._id, formData)
      setIsEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    if (!formData) return
    const updated = { ...formData, status: newStatus }
    setFormData(updated)
    try { await update(formData._id, updated) } catch { /* ignore */ }
  }

  const handleCancel = () => {
    setFormData(structuredClone(candidate))
    setIsEditing(false)
    setSaveError(null)
  }

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !formData) return
    e.target.value = ''
    setUploadingCV(true)
    try {
      const res = await fetch(`http://localhost:4000/api/candidates/${formData._id}/cv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          Authorization: `Bearer ${token}`,
        },
        body: file,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur upload CV')
      }
      const { fileLink } = await res.json()
      setFormData(prev => prev ? { ...prev, cv_link: fileLink } : prev)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur upload CV')
    } finally {
      setUploadingCV(false)
    }
  }

  const handleCreateDriveFolder = async () => {
    if (!formData) return
    setCreatingFolder(true)
    try {
      const result = await createDriveFolder(formData._id)
      if (result) {
        setFormData(prev => prev ? {
          ...prev,
          pdf_link: result.pdfLink ?? prev.pdf_link,
          drive_folder_id: result.driveFolderId ?? prev.drive_folder_id,
        } : prev)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la création du dossier Drive')
    } finally {
      setCreatingFolder(false)
    }
  }

  const { first, last } = splitFullName(formData.identity.full_name)

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--color-purple-light)' }}
              >
                <User size={22} style={{ color: 'var(--color-purple)' }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {formData.identity.full_name}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="relative group">
                    <select
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      value={formData.status}
                      onChange={e => handleStatusChange(e.target.value as CandidateStatus)}
                    >
                      {Object.values(CandidateStatus).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[formData.status]}`}>
                      {STATUS_LABELS[formData.status]}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ring-1 ${TP_COLORS[formData.tp_type]}`}>
                    {formData.tp_type}
                  </span>
                  {formData.training_site && (
                    <span className="text-xs text-gray-400">
                      {TRAINING_SITE_LABELS[formData.training_site]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isEditing ? (
              <Button size="sm" variant="secondary" leftIcon={<Edit2 size={15} />} onClick={() => setIsEditing(true)}>
                Modifier
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" leftIcon={<X size={15} />} onClick={handleCancel}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  isLoading={saving}
                  leftIcon={<Save size={15} />}
                  onClick={handleSave}
                  style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}
                  className="hover:opacity-90"
                >
                  Enregistrer
                </Button>
              </>
            )}
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <AlertCircle size={16} className="shrink-0" />
            {saveError}
          </div>
        )}

        {/* ── Actions rapides ── */}
        <div className="flex flex-wrap gap-2">
          {formData.drive_folder_id ? (
            <Button variant="secondary" size="sm" leftIcon={<ExternalLink size={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => window.open(`https://drive.google.com/drive/folders/${formData.drive_folder_id}`, '_blank')}>
              Drive
            </Button>
          ) : (
            <Button variant="secondary" size="sm" isLoading={creatingFolder}
              leftIcon={<FolderPlus size={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={handleCreateDriveFolder}>
              Créer dossier Drive
            </Button>
          )}
          {formData.drive_folder_id && (
            <>
              <input id="cv-upload" type="file" accept="application/pdf" className="hidden" onChange={handleCVUpload} />
              <Button variant="secondary" size="sm" isLoading={uploadingCV}
                leftIcon={<Upload size={15} style={{ color: 'var(--color-purple)' }} />}
                onClick={() => document.getElementById('cv-upload')?.click()}>
                Importer CV
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" leftIcon={<ClipboardCheck size={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={() => navigate(`/rh/candidats/${formData._id}/questionnaire`)}>
            Analyse de Besoin
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Mail size={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={() => setMailOpen(true)}>
            Envoyer un mail
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<QrCode size={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={() => setShowClassMarker(true)}>
            Liens de test
          </Button>
        </div>

        {/* ── Grid sections ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Identité & Contact */}
          <Card>
            <SectionTitle>Identité & Contact</SectionTitle>
            <div className="space-y-4">
              <Field label="Nom complet">
                {isEditing ? (
                  <input className={inputCls} value={formData.identity.full_name}
                    onChange={e => updateIdentity('full_name', e.target.value)} />
                ) : <p className={valueCls}>{formData.identity.full_name || '—'}</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  {isEditing ? (
                    <input type="email" className={inputCls} value={formData.identity.email}
                      onChange={e => updateIdentity('email', e.target.value)} />
                  ) : <p className={valueCls + ' truncate'}>{formData.identity.email || '—'}</p>}
                </Field>
                <Field label="Téléphone">
                  {isEditing ? (
                    <input type="tel" className={inputCls} value={formData.identity.phone}
                      onChange={e => updateIdentity('phone', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.phone || '—'}</p>}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Âge">
                  {isEditing ? (
                    <input type="number" className={inputCls} value={formData.identity.age ?? ''}
                      onChange={e => updateIdentity('age', e.target.value ? Number(e.target.value) : undefined)} />
                  ) : <p className={valueCls}>{formData.identity.age ? `${formData.identity.age} ans` : '—'}</p>}
                </Field>
                <Field label="Ville">
                  {isEditing ? (
                    <input className={inputCls} value={formData.identity.city ?? ''}
                      onChange={e => updateIdentity('city', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.city || '—'}</p>}
                </Field>
              </div>
              <Field label="Code postal">
                {isEditing ? (
                  <input className={inputCls} value={formData.identity.postal_code ?? ''}
                    onChange={e => updateIdentity('postal_code', e.target.value)} />
                ) : <p className={valueCls}>{formData.identity.postal_code || '—'}</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Permis B">
                  {isEditing ? (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!formData.identity.driving_license_b}
                        onChange={e => updateIdentity('driving_license_b', e.target.checked)} />
                      <span className="text-sm text-gray-700">Oui</span>
                    </label>
                  ) : <p className={valueCls}>{formData.identity.driving_license_b ? 'Oui' : 'Non'}</p>}
                </Field>
                <Field label="Moyen de transport">
                  {isEditing ? (
                    <input className={inputCls} value={formData.identity.transport_means ?? ''}
                      onChange={e => updateIdentity('transport_means', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.transport_means || '—'}</p>}
                </Field>
              </div>
            </div>
          </Card>

          {/* Formation & Parcours */}
          <Card>
            <SectionTitle>Formation & Parcours</SectionTitle>
            <div className="space-y-4">
              <Field label="Niveau d'études">
                {isEditing ? (
                  <select className={selectCls}
                    value={formData.education?.school_level ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, education: { ...prev.education, school_level: e.target.value as SchoolLevel || undefined }
                    } : prev)}>
                    <option value="">Non renseigné</option>
                    {Object.entries(SCHOOL_LEVEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : <p className={valueCls}>{formData.education?.school_level ? SCHOOL_LEVEL_LABELS[formData.education.school_level] : '—'}</p>}
              </Field>
              <Field label="Dernier diplôme">
                {isEditing ? (
                  <input className={inputCls} value={formData.background?.last_diploma ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, background: { ...prev.background, last_diploma: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.background?.last_diploma || '—'}</p>}
              </Field>
              <Field label="Formations précédentes">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.background?.previous_trainings ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, background: { ...prev.background, previous_trainings: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.background?.previous_trainings || '—'}</p>}
              </Field>
              <Field label="Secteur de formation">
                {isEditing ? (
                  <select className={selectCls}
                    value={formData.training_site ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, training_site: e.target.value as TrainingSite || undefined
                    } : prev)}>
                    <option value="">Non renseigné</option>
                    {Object.entries(TRAINING_SITE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : <p className={valueCls}>{formData.training_site ? TRAINING_SITE_LABELS[formData.training_site] : '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Profil & Compétences */}
          <Card>
            <SectionTitle>Profil & Compétences</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Français (/10)">
                  {isEditing ? (
                    <input type="number" min={1} max={10} className={inputCls}
                      value={formData.profile?.french_level ?? ''}
                      onChange={e => updateProfile('french_level', e.target.value ? Number(e.target.value) : undefined)} />
                  ) : <p className={valueCls}>{formData.profile?.french_level != null ? `${formData.profile.french_level}/10` : '—'}</p>}
                </Field>
                <Field label="Anglais (/10)">
                  {isEditing ? (
                    <input type="number" min={1} max={10} className={inputCls}
                      value={formData.profile?.english_level ?? ''}
                      onChange={e => updateProfile('english_level', e.target.value ? Number(e.target.value) : undefined)} />
                  ) : <p className={valueCls}>{formData.profile?.english_level != null ? `${formData.profile.english_level}/10` : '—'}</p>}
                </Field>
              </div>
              <Field label="Qualités (séparées par virgule)">
                {isEditing ? (
                  <input className={inputCls}
                    value={(formData.profile?.qualities ?? []).join(', ')}
                    onChange={e => updateProfile('qualities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.profile?.qualities?.length ? formData.profile.qualities.map((q, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">{q}</span>
                    )) : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Points d'amélioration (séparés par virgule)">
                {isEditing ? (
                  <input className={inputCls}
                    value={(formData.profile?.defects ?? []).join(', ')}
                    onChange={e => updateProfile('defects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.profile?.defects?.length ? formData.profile.defects.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">{d}</span>
                    )) : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Compétences numériques (séparées par virgule)">
                {isEditing ? (
                  <input className={inputCls}
                    value={(formData.profile?.digital_skills ?? []).join(', ')}
                    onChange={e => updateProfile('digital_skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.profile?.digital_skills?.length ? formData.profile.digital_skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--color-blue-light)', color: 'var(--color-blue)' }}>{s}</span>
                    )) : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Forces & axes d'amélioration">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.profile?.strengths_and_improvements ?? ''}
                    onChange={e => updateProfile('strengths_and_improvements', e.target.value)} />
                ) : <p className={valueCls}>{formData.profile?.strengths_and_improvements || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Projets professionnels */}
          <Card>
            <SectionTitle>Projets professionnels</SectionTitle>
            <div className="space-y-4">
              <Field label="Objectifs de carrière">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.professional_projects?.career_objectives ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, professional_projects: { ...prev.professional_projects, career_objectives: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.professional_projects?.career_objectives || '—'}</p>}
              </Field>
              <Field label="Motivation pour l'alternance">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.professional_projects?.apprenticeship_motivation ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, professional_projects: { ...prev.professional_projects, apprenticeship_motivation: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.professional_projects?.apprenticeship_motivation || '—'}</p>}
              </Field>
              <Field label="Attentes de la formation">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.professional_projects?.training_expectations ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, professional_projects: { ...prev.professional_projects, training_expectations: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.professional_projects?.training_expectations || '—'}</p>}
              </Field>
              <Field label="Compétences souhaitées">
                {isEditing ? (
                  <input className={inputCls}
                    value={formData.professional_projects?.desired_skills ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, professional_projects: { ...prev.professional_projects, desired_skills: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.professional_projects?.desired_skills || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Évaluation des compétences */}
          {formData.skills_assessment && formData.skills_assessment.length > 0 && (
            <Card className="md:col-span-2">
              <SectionTitle>Évaluation des compétences</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formData.skills_assessment.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <span className="text-sm font-medium text-gray-800">{a.competence}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md border" style={{ color: 'var(--color-purple)', borderColor: 'var(--color-purple-light)', backgroundColor: 'var(--color-purple-light)' }}>
                      {a.level}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Expériences professionnelles */}
          {formData.background?.professional_experiences && formData.background.professional_experiences.length > 0 && (
            <Card className="md:col-span-2">
              <SectionTitle>Expériences professionnelles</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.background.professional_experiences.map((exp, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">{exp.position || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {exp.company}{exp.duration ? ` · ${exp.duration}` : ''}
                    </p>
                    {exp.responsibilities && (
                      <p className="text-xs text-gray-600 mt-2">{exp.responsibilities}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Synthèse */}
          <Card className="md:col-span-2">
            <SectionTitle>Synthèse</SectionTitle>
            <div className="space-y-4">
              <Field label="Conclusion de faisabilité">
                {isEditing ? (
                  <textarea rows={3} className={inputCls + ' resize-none'}
                    value={formData.synthesis?.feasibility_conclusion ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, feasibility_conclusion: e.target.value }
                    } : prev)} />
                ) : (
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                    {formData.synthesis?.feasibility_conclusion || 'Aucune synthèse renseignée.'}
                  </p>
                )}
              </Field>
              <Field label="Pertinence du parcours">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.synthesis?.pathway_relevance ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, pathway_relevance: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.synthesis?.pathway_relevance || '—'}</p>}
              </Field>
              <Field label="Besoins spécifiques">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.synthesis?.special_needs ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, special_needs: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.synthesis?.special_needs || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Résultat ClassMarker */}
          {id && <div className="md:col-span-2"><CandidateTestScore candidateId={id} /></div>}

          {/* Visualisation CV */}
          {formData.drive_folder_id && (
            <Card className="md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Visualisation du CV</SectionTitle>
                <div className="flex items-center gap-2">
                  <input id="cv-upload-bottom" type="file" accept="application/pdf" className="hidden" onChange={handleCVUpload} />
                  <Button variant="secondary" size="sm" isLoading={uploadingCV}
                    leftIcon={<Upload size={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => document.getElementById('cv-upload-bottom')?.click()}>
                    {formData.cv_link ? 'Remplacer' : 'Importer CV'}
                  </Button>
                </div>
              </div>
              {formData.cv_link ? (
                <iframe
                  src={formData.cv_link.replace('/view', '/preview')}
                  className="w-full rounded-lg border border-gray-100"
                  style={{ height: '80vh' }}
                  allow="autoplay"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                  <FileText size={32} className="text-gray-300" />
                  <p className="text-sm text-gray-400">Aucun CV importé</p>
                </div>
              )}
            </Card>
          )}

        </div>
      </div>

      {mailOpen && (
        <MailModal
          defaultTo={formData.identity.email}
          candidateName={formData.identity.full_name}
          onClose={() => setMailOpen(false)}
        />
      )}

      {showClassMarker && (
        <ClassMarkerLinksModal
          open={showClassMarker}
          onClose={() => setShowClassMarker(false)}
          firstName={first}
          lastName={last}
          tpType={formData.tp_type}
          candidateId={formData._id}
        />
      )}
    </>
  )
}
