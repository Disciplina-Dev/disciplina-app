import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Edit2, ExternalLink, ClipboardCheck,
  QrCode, User, Loader2, AlertCircle, FolderPlus, Upload, Download, FileText,
  File, FileImage, FileSpreadsheet, RefreshCw, Trash2, Camera, HardDriveUpload,
} from 'lucide-react'
import WebcamCaptureModal from '@/components/rh/WebcamCaptureModal'
import MatchedJobsList from '@/features/candidats/components/MatchedJobsList'
import CandidateHistory from '@/features/candidats/components/CandidateHistory'
import CandidateFormModal from '@/components/rh/CandidateFormModal'
import { useCandidateById, useUpdateCandidate, useCreateCandidateDriveFolder, useDeleteCandidate } from '@/graphql/hooks'
import { jobGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATE_MATCHED_JOB_IDS } from '@/graphql/queries'
import { useAuthStore } from '@/store/authStore'
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SCHOOL_LEVEL_LABELS } from '@/types/candidate'
import type { Candidate } from '@/types/candidate'
import { computeAge, isSenior } from '@/utils/age'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal'
import FilizFolderModal from '@/components/rh/FilizFolderModal'
import ConfirmDeleteModal from '@/components/rh/ConfirmDeleteModal'
import CandidateTestScore from '@/components/rh/CandidateTestScore'
import { useClassMarkerResult } from '@/hooks/useClassMarkerResult'
import { splitFullName } from '@/utils/classmarker'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_BADGE_CLASS } from '@/constants/candidateStatus'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TP_COLORS: Record<TitleProfessionalType, string> = {
  [TitleProfessionalType.AD]:  'bg-teal-50 text-teal-700 ring-teal-200',
  [TitleProfessionalType.CC]:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
  [TitleProfessionalType.NTC]: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  [TitleProfessionalType.REM]: 'bg-lime-50 text-lime-700 ring-lime-200',
  [TitleProfessionalType.SA]:  'bg-slate-50 text-slate-700 ring-slate-200',
}

const getStatusLabel = (status: CandidateStatus): string => CANDIDATE_STATUS_LABELS[status]

const getStatusColor = (status: CandidateStatus): string => CANDIDATE_STATUS_BADGE_CLASS[status]

const TRAINING_SITE_LABELS: Record<TrainingSite, string> = {
  [TrainingSite.NORD_SAINTE_MARIE]: 'Nord – Sainte-Marie',
  [TrainingSite.OUEST_SAINT_PAUL]:  'Ouest – Saint-Paul',
  [TrainingSite.SUD_SAINT_PIERRE]:  'Sud – Saint-Pierre',
}

// ─── Drive file types ─────────────────────────────────────────────────────────

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

function drivePreviewUrl(file: DriveFile): string {
  if (file.webViewLink) {
    return file.webViewLink.replace('/edit?', '/preview?').replace('/view?', '/preview?').replace('/edit', '/preview').replace('/view', '/preview')
  }
  return `https://drive.google.com/file/d/${file.id}/preview`
}

function DriveFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <FileText size={15} className="shrink-0 text-red-400" />
  if (mimeType.startsWith('image/')) return <FileImage size={15} className="shrink-0 text-blue-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={15} className="shrink-0 text-green-500" />
  return <File size={15} className="shrink-0 text-gray-400" />
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
  const { candidate, loading, error, refetch } = useCandidateById(id ?? '')
  const { update } = useUpdateCandidate()
  const { createDriveFolder } = useCreateCandidateDriveFolder()
  const { deleteCandidate } = useDeleteCandidate()
  const token = useAuthStore((s) => s.token)
  // Verdict du test : la moyenne est à 50%. L'AB n'est possible que si le candidat
  // a réussi au moins un test (>= 50%).
  const { result: testResult } = useClassMarkerResult(id)
  const testPassed =
    !!testResult && typeof testResult.percentage === 'number' && testResult.percentage >= 50

  const [formData, setFormData] = useState<Candidate | null>(null)
  // Édition de la fiche = même formulaire que la création (modal). L'édition inline
  // n'est plus déclenchable : isEditing reste false (branches d'affichage uniquement).
  const [isEditing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [showClassMarker, setShowClassMarker] = useState(false)
  const [showFilizModal, setShowFilizModal] = useState(false)
  const [capturingPhoto, setCapturingPhoto] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploadingCV, setUploadingCV] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [savingAbToDrive, setSavingAbToDrive] = useState(false)
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)
  const [confirmedJobIds, setConfirmedJobIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (candidate && !formData) setFormData(structuredClone(candidate))
  }, [candidate])

  const fetchDriveFiles = async (candidateId: string) => {
    setLoadingFiles(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${candidateId}/drive-files`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDriveFiles(data.files ?? [])
        setSelectedFile(prev => prev ?? data.files?.[0] ?? null)
      }
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    if (formData?.drive_folder_id && id) {
      fetchDriveFiles(id)
    }
  }, [formData?.drive_folder_id])

  useEffect(() => {
    if (!id) return
    jobGraphqlClient.query(GET_CANDIDATE_MATCHED_JOB_IDS, { candidateId: id }).toPromise().then((result) => {
      if (result.data?.candidateMatchedJobIds) {
        setConfirmedJobIds(new Set(result.data.candidateMatchedJobIds as string[]))
      }
    })
  }, [id])

  const handleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0 || !formData || !id) return
    e.target.value = ''
    setUploadingFiles(true)
    try {
      const body = new FormData()
      files.forEach(f => body.append('files', f))
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${id}/drive-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur upload')
      }
      await fetchDriveFiles(id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur upload fichiers')
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleDeleteFile = async (file: DriveFile) => {
    if (!id) return
    if (!window.confirm(`Supprimer "${file.name}" du Drive ? Action irréversible.`)) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${id}/drive-files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur suppression')
      }
      setDriveFiles(prev => prev.filter(f => f.id !== file.id))
      setSelectedFile(prev => (prev?.id === file.id ? null : prev))
      setFormData(prev => (prev && file.webViewLink === prev.cv_link ? { ...prev, cv_link: '' } : prev))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur suppression fichier')
    }
  }

  const handleDeleteCandidate = async () => {
    if (!id) return
    setIsDeleting(true)
    try {
      const result = await deleteCandidate(id)
      if (result.data?.deleteCandidate) {
        navigate(-1)
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

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

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    if (!formData) return
    const updated = { ...formData, status: newStatus }
    setFormData(updated)
    try { await update(formData._id, updated) } catch { /* ignore */ }
  }

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !formData) return
    e.target.value = ''
    setUploadingCV(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${formData._id}/cv`, {
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

  const handleDownloadPdf = async () => {
    if (!formData) return
    setDownloadingPdf(true)
    setSaveError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${formData._id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur lors de la génération du PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `AB_${formData.identity.full_name.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la génération du PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Génère le résumé AB et le dépose dans le dossier Drive du candidat
  // (remplace l'AB précédent côté serveur).
  const handleSaveAbToDrive = async () => {
    if (!formData) return
    setSavingAbToDrive(true)
    setSaveError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/candidates/${formData._id}/ab-to-drive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Échec de l'enregistrement dans le Drive")
      }
      if (formData.drive_folder_id) await fetchDriveFiles(formData._id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Échec de l'enregistrement dans le Drive")
    } finally {
      setSavingAbToDrive(false)
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
              <div className="relative h-12 w-12 shrink-0">
                {formData.identity.avatar_url ? (
                  <img
                    src={formData.identity.avatar_url}
                    alt={formData.identity.full_name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-purple-light)' }}
                  >
                    <User size={22} style={{ color: 'var(--color-purple)' }} />
                  </div>
                )}
                <button
                  title="Prendre une photo"
                  onClick={() => setCapturingPhoto(true)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple text-white flex items-center justify-center ring-2 ring-white hover:bg-purple/90"
                >
                  <Camera size={11} />
                </button>
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
                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                      ))}
                    </select>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(formData.status)}`}>
                      {getStatusLabel(formData.status)}
                    </span>
                  </div>
                  {(formData.tp_types?.length ? formData.tp_types : [formData.tp_type]).map(t => (
                    <span key={t} className={`px-2 py-0.5 rounded-md text-xs font-bold ring-1 ${TP_COLORS[t]}`}>
                      {t}
                    </span>
                  ))}
                  {isSenior(computeAge(formData.identity.date_of_birth) ?? formData.identity.age) && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                      Senior
                    </span>
                  )}
                  {(() => {
                    const sites = formData.training_sites?.length
                      ? formData.training_sites
                      : formData.training_site
                        ? [formData.training_site]
                        : []
                    return sites.length ? (
                      <span className="text-xs text-gray-400">
                        {sites.map((s) => TRAINING_SITE_LABELS[s]).join(' · ')}
                      </span>
                    ) : null
                  })()}
                  {formData.owner && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <User size={12} />
                      Créé par {formData.owner.name}
                      {formData.owner.sector && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                          {formData.owner.sector}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" leftIcon={<Edit2 size={15} />} onClick={() => setEditOpen(true)}>
              Modifier
            </Button>
            <Button
              size="sm"
              leftIcon={<Trash2 size={15} />}
              onClick={() => setShowDeleteModal(true)}
              style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
            >
              Supprimer
            </Button>
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
          {formData.filiz_folder_id ? (
            <Button variant="secondary" size="sm" leftIcon={<ExternalLink size={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => window.open(`https://app.filiz.io/folders/${formData.filiz_folder_id}`, '_blank')}>
              Dossier Filiz
            </Button>
          ) : (
            <Button variant="secondary" size="sm" leftIcon={<FolderPlus size={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => setShowFilizModal(true)}>
              Créer dossier Filiz
            </Button>
          )}
          <Button variant="secondary" size="sm" leftIcon={<ClipboardCheck size={15} style={{ color: 'var(--color-purple)' }} />}
            disabled={!testPassed}
            title={testPassed ? undefined : "Indisponible : le candidat n'a réussi aucun test (moyenne < 50%)"}
            onClick={() => navigate(`/rh/candidats/${formData._id}/questionnaire`)}>
            Analyse de Besoin
          </Button>
          <Button variant="secondary" size="sm" isLoading={downloadingPdf}
            leftIcon={<Download size={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={handleDownloadPdf}>
            Télécharger le PDF
          </Button>
          <Button variant="secondary" size="sm" isLoading={savingAbToDrive}
            disabled={!formData.drive_folder_id}
            title={formData.drive_folder_id ? undefined : "Crée d'abord le dossier Drive du candidat"}
            leftIcon={<HardDriveUpload size={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={handleSaveAbToDrive}>
            Enregistrer l'AB dans le Drive
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

          {/* Offres correspondantes */}
          <div className="md:col-span-2">
            <MatchedJobsList candidateId={id ?? ''} confirmedJobIds={confirmedJobIds} />
          </div>

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
              <Field label="Numéro de sécurité sociale">
                {isEditing ? (
                  <input className={inputCls} value={formData.identity.social_security_number ?? ''}
                    onChange={e => updateIdentity('social_security_number', e.target.value)} />
                ) : <p className={valueCls}>{formData.identity.social_security_number || '—'}</p>}
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
                  {(() => {
                    const liveAge = computeAge(formData.identity.date_of_birth) ?? formData.identity.age
                    return <p className={valueCls}>{liveAge != null ? `${liveAge} ans` : '—'}</p>
                  })()}
                </Field>
                <Field label="Ville">
                  {isEditing ? (
                    <input className={inputCls} value={formData.identity.city ?? ''}
                      onChange={e => updateIdentity('city', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.city || '—'}</p>}
                </Field>
              </div>
              <Field label="Adresse (numéro et rue)">
                {isEditing ? (
                  <input className={inputCls} value={formData.identity.address ?? ''}
                    onChange={e => updateIdentity('address', e.target.value)} />
                ) : <p className={valueCls}>{formData.identity.address || '—'}</p>}
              </Field>
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
              <Field label="A déjà eu un contrat d'apprentissage">
                {isEditing ? (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={!!formData.identity.had_apprenticeship_contract}
                      onChange={e => updateIdentity('had_apprenticeship_contract', e.target.checked)} />
                    <span className="text-sm text-gray-700">Oui</span>
                  </label>
                ) : <p className={valueCls}>{formData.identity.had_apprenticeship_contract ? 'Oui' : 'Non'}</p>}
              </Field>
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
              <Field label="Site(s) de formation">
                {isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    {(Object.entries(TRAINING_SITE_LABELS) as [TrainingSite, string][]).map(([k, v]) => {
                      const current = formData.training_sites ?? (formData.training_site ? [formData.training_site] : [])
                      const checked = current.includes(k)
                      return (
                        <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" className="accent-blue-600 h-4 w-4" checked={checked}
                            onChange={() => setFormData(prev => prev ? {
                              ...prev,
                              training_sites: checked ? current.filter(s => s !== k) : [...current, k],
                            } : prev)} />
                          <span>{v}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (() => {
                  const sites = formData.training_sites?.length
                    ? formData.training_sites
                    : formData.training_site ? [formData.training_site] : []
                  return <p className={valueCls}>{sites.length ? sites.map(s => TRAINING_SITE_LABELS[s]).join(' · ') : '—'}</p>
                })()}
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

          {/* Historique du candidat */}
          {id && <div className="md:col-span-2"><CandidateHistory candidateId={id} /></div>}

          {/* Résultat ClassMarker */}
          {id && <div className="md:col-span-2"><CandidateTestScore candidateId={id} /></div>}

          {/* Dossier Drive */}
          {formData.drive_folder_id && (
            <Card className="md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Dossier Drive</SectionTitle>
                <div className="flex items-center gap-2">
                  <input id="cv-upload-bottom" type="file" accept="application/pdf" className="hidden" onChange={handleCVUpload} />
                  <Button variant="secondary" size="sm" isLoading={uploadingCV}
                    leftIcon={<Upload size={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => document.getElementById('cv-upload-bottom')?.click()}>
                    {formData.cv_link ? 'Remplacer CV' : 'Importer CV'}
                  </Button>
                  <input id="drive-upload" type="file" multiple className="hidden" onChange={handleDriveUpload} />
                  <Button variant="secondary" size="sm" isLoading={uploadingFiles}
                    leftIcon={<Upload size={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => document.getElementById('drive-upload')?.click()}>
                    Ajouter fichiers
                  </Button>
                  <Button variant="secondary" size="sm" isLoading={loadingFiles}
                    leftIcon={<RefreshCw size={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => id && fetchDriveFiles(id)}>
                    Actualiser
                  </Button>
                </div>
              </div>

              <div className="flex gap-4" style={{ height: '75vh' }}>
                {/* Preview */}
                <div className="flex-1 min-w-0">
                  {selectedFile ? (
                    <iframe
                      key={selectedFile.id}
                      src={drivePreviewUrl(selectedFile)}
                      className="w-full h-full rounded-lg border border-gray-100"
                      allow="autoplay"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                      <FileText size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-400">Sélectionner un fichier</p>
                    </div>
                  )}
                </div>

                {/* File list */}
                <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50">
                  {loadingFiles ? (
                    <div className="flex items-center justify-center h-20 gap-2 text-gray-400 text-xs">
                      <Loader2 size={14} className="animate-spin" />
                      Chargement…
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 gap-2 text-gray-400 text-xs">
                      <File size={20} />
                      Dossier vide
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {driveFiles.map(file => (
                        <li key={file.id} className={`group flex items-center transition-colors hover:bg-white ${
                          selectedFile?.id === file.id ? 'bg-white shadow-sm' : ''
                        }`}>
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-start gap-2"
                          >
                            <DriveFileIcon mimeType={file.mimeType} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate leading-tight">{file.name}</p>
                              {file.modifiedTime && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(file.modifiedTime).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file)}
                            title="Supprimer"
                            className="shrink-0 p-2 text-gray-300 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>

      {editOpen && (
        <CandidateFormModal
          candidate={formData}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setFormData(null)
            refetch()
          }}
        />
      )}

      {mailOpen && (
        <MailModal
          defaultTo={formData.identity.email}
          candidateName={formData.identity.full_name}
          onClose={() => setMailOpen(false)}
        />
      )}

      {capturingPhoto && id && (
        <WebcamCaptureModal
          candidateId={id}
          candidateName={formData.identity.full_name}
          onClose={() => setCapturingPhoto(false)}
          onUploaded={(updatedAt) => {
            const url = `${import.meta.env.VITE_API_URL}/api/candidates/${id}/avatar?v=${encodeURIComponent(updatedAt)}`
            setFormData(prev => prev ? {
              ...prev,
              identity: { ...prev.identity, avatar_updated_at: updatedAt, avatar_url: url },
            } : prev)
          }}
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

      <FilizFolderModal
        open={showFilizModal}
        onClose={() => setShowFilizModal(false)}
        candidateId={formData._id}
        onSuccess={(filizFolderId) => setFormData(prev => prev ? { ...prev, filiz_folder_id: filizFolderId } : prev)}
      />
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCandidate}
        candidateName={formData.identity.full_name}
        isDeleting={isDeleting}
      />
    </>
  )
}
