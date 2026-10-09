import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconAlert, IconArrowLeft, IconCamera, IconClipboardCheck, IconDownload, IconEdit, IconExternalLink, IconEye, IconEyeOff, IconFile, IconFolderPlus, IconImage, IconLoader, IconMail, IconQrCode, IconRefresh, IconSpreadsheet, IconTrash, IconUpload, IconUser } from '@/components/ui/icons'
import WebcamCaptureModal from '@/components/rh/WebcamCaptureModal'
import CandidateAvatar from '@/components/rh/CandidateAvatar'
import MatchedJobsList from '@/features/candidats/components/MatchedJobsList'
import CandidateSentCompaniesCallout from '@/features/candidats/components/CandidateSentCompaniesCallout'
import CandidateHistory from '@/features/candidats/components/CandidateHistory'
import ContractModal from '@/features/candidats/components/ContractModal'
import CandidateFormModal from '@/components/rh/CandidateFormModal'
import { useCandidateById, useUpdateCandidate, useCreateCandidateDriveFolder, useDeleteCandidate, useAddCandidateHistoryEntry } from '@/graphql/hooks'
import { offerGraphqlClient, graphqlClient, candidateGraphqlClient } from '@/graphql/client'
import { GET_CANDIDATE_MATCHED_OFFER_IDS, GET_CANDIDATE_PLACEMENT, GET_CANDIDATE_SENT_COMPANIES, GET_COMPANY_OPTIONS, MATCH_OFFER, UNMASK_SSN, UPDATE_CANDIDATE_FULL } from '@/graphql/queries'
import { useMailTemplatesStore, type MailAttachment } from '@/store/mailTemplatesStore'
import { apiFetch, apiJson } from '@/api/httpClient'
import { CandidateStatus, TrainingSite, TitleProfessionalType, SchoolLevel, SCHOOL_LEVEL_LABELS } from '@/types/candidate'
import { formatCommune } from '@/data/reunionCommunes'
import { DISCOVERY_SOURCE_LABELS, ALL_DESIRED_SECTORS } from '@/data/candidateTemplates'
import { SECTEUR_LABELS } from '@/constants/secteurs'
import type { Candidate, DiscoverySource, PedagogicalRecommendations } from '@/types/candidate'
import type { ScheduleSlot } from '@/types/needsAnalysis'
import { computeAge, isSenior } from '@/utils/age'
import { gateThresholdForTps } from '@/utils/testGateThreshold'
import {
  TEST_FAILURE_NO_SHARE_VALUE,
  TEST_FAILURE_ORIENTATION_OPTIONS,
  buildTestFailureComment,
  buildTestFailureRedirectionBody,
} from '@/constants/testFailureOrientation'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'
import ClassMarkerLinksModal from '@/components/rh/ClassMarkerLinksModal'
import FilizFolderModal from '@/components/rh/FilizFolderModal'
import ConfirmDeleteModal from '@/components/rh/ConfirmDeleteModal'
import CandidateTestScore from '@/components/rh/CandidateTestScore'
import PdfViewer from '@/components/rh/PdfViewer'
import { useClassMarkerResult } from '@/hooks/useClassMarkerResult'
import { splitFullName } from '@/utils/classmarker'
import { CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_BADGE_CLASS } from '@/constants/candidateStatus'
import { useRegionStore } from '@/store/regionStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PEDA_RECO_OPTIONS: [keyof PedagogicalRecommendations, string][] = [
  ['office_tools_reinforcement', 'Renforcement en bureautique et outils numériques'],
  ['written_communication_support', 'Soutien en communication écrite'],
  ['oral_confidence_development', "Développement de la confiance à l'oral"],
  ['time_management_support', 'Accompagnement en gestion du temps et organisation'],
  ['professional_posture_work', 'Travail sur la posture professionnelle'],
  ['enhanced_company_immersion', 'Immersion renforcée en entreprise'],
  ['psh_specific_support', 'Accompagnement spécifique PSH'],
  ['individual_follow_up', 'Suivi individualisé'],
  ['language_training', 'Formation complémentaire en langue'],
  ['stress_management_follow_up', 'Suivi sur la gestion du stress et la confiance en soi'],
]

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
  [TrainingSite.NORD_SAINTE_MARIE]: `${SECTEUR_LABELS.NORD} – Sainte-Marie`,
  [TrainingSite.OUEST_SAINT_PAUL]:  `${SECTEUR_LABELS.OUEST} – Saint-Paul`,
  [TrainingSite.SUD_SAINT_PIERRE]:  `${SECTEUR_LABELS.SUD} – Saint-Pierre`,
}

// Met en forme un enum SCREAMING_SNAKE en libellé lisible ("SAINT_DENIS" → "Saint Denis").
function prettyEnum(v: string): string {
  return v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Résumé "matching" généré depuis les champs de la fiche (déterministe, sans IA).
// Assemble uniquement les infos renseignées en 2-4 phrases.
function buildCandidateSummary(c: Candidate): string {
  const parts: string[] = []

  // Profil : nom, âge, ville, titre(s) visé(s), niveau d'études.
  const age = computeAge(c.identity.date_of_birth) ?? c.identity.age
  const tps = (c.tp_types ?? []).join(', ')
  const profil = [
    c.identity.full_name,
    age != null ? `${age} ans` : null,
    c.identity.city || null,
  ].filter(Boolean).join(', ')
  const level = c.education?.school_level ? SCHOOL_LEVEL_LABELS[c.education.school_level] : null
  let s1 = profil
  if (tps) s1 += ` — vise ${tps}`
  if (level) s1 += `, niveau ${level}`
  if (s1.trim()) parts.push(s1 + '.')

  // Parcours : diplômes.
  const dipl: string[] = []
  if (c.background?.last_diploma) dipl.push(`dernier diplôme obtenu : ${c.background.last_diploma}`)
  if (c.background?.last_diploma_prepared) dipl.push(`préparé : ${c.background.last_diploma_prepared}`)
  if (dipl.length) parts.push(dipl.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.')

  // Mobilité / disponibilité.
  const dispo: string[] = []
  const mob = c.job_info?.geographic_mobility?.map(prettyEnum).join(', ')
  if (mob) dispo.push(`mobilité : ${mob}`)
  if (c.job_info?.availability_date) {
    dispo.push(`disponible le ${new Date(c.job_info.availability_date).toLocaleDateString('fr-FR')}`)
  }
  if (dispo.length) parts.push(dispo.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.')

  // Atouts / projet.
  const atouts: string[] = []
  if (c.profile?.qualities?.length) atouts.push(`points forts : ${c.profile.qualities.join(', ')}`)
  if (c.professional_projects?.career_objectives) {
    atouts.push(`objectif : ${c.professional_projects.career_objectives}`)
  }
  if (atouts.length) parts.push(atouts.join(' ; ').replace(/^./, (ch) => ch.toUpperCase()) + '.')

  return parts.join(' ')
}

// Placement courant (immersion/contrat) renvoyé par le endpoint jobs.
interface CandidatePlacement {
  companyName: string | null
  kind: 'IMMERSING' | 'CONTRACT'
  since: string | null
  immersionEndDate: string | null
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

// Types prévisualisables via le proxy backend (rendu natif navigateur depuis un blob) :
// Types Office / OpenDocument convertis en PDF côté backend (via Google Drive).
const CONVERTIBLE_OFFICE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
])

// PDF, images, Google Docs natifs et fichiers Office (tous rendus en PDF/blob côté backend).
// SVG exclu : chargé comme document dans une iframe, il exécute ses scripts — et un blob:
// hérite de l'origine du front, donc du localStorage où vit le JWT.
function isProxyablePreview(mimeType: string): boolean {
  if (mimeType === 'image/svg+xml') return false
  return (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('application/vnd.google-apps.') ||
    CONVERTIBLE_OFFICE_MIMES.has(mimeType)
  )
}

// Fallback pour les types que le navigateur ne sait pas rendre (Office binaire, etc.) :
// on retombe sur l'embed Google Drive (nécessite la session Google du navigateur).
function googleEmbedUrl(file: DriveFile): string {
  if (file.webViewLink) {
    return file.webViewLink
      .replace('/edit?', '/preview?')
      .replace('/view?', '/preview?')
      .replace('/edit', '/preview')
      .replace('/view', '/preview')
  }
  return `https://drive.google.com/file/d/${file.id}/preview`
}

function DriveFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <IconFile width={15} height={15} className="shrink-0 text-red-400" />
  if (mimeType.startsWith('image/')) return <IconImage width={15} height={15} className="shrink-0 text-blue-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <IconSpreadsheet width={15} height={15} className="shrink-0 text-[var(--ds-success)]" />
  return <IconFile width={15} height={15} className="shrink-0 text-[var(--ds-text-subtle)]" />
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputCls = 'mt-1 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text)] focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/20 transition-colors'
const selectCls = inputCls
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-[var(--ds-text-subtle)]'
const valueCls = 'mt-1 text-sm font-medium text-[var(--ds-text)]'

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
    <div className={`rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 ${className}`}>
      {children}
    </div>
  )
}

const IMMERSION_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// Éditeur compact des horaires d'immersion (jours activables + créneau début/fin).
// Même forme que ScheduleSlot (day/startHour/endHour) : seuls les jours activés sont persistés.
function ImmersionScheduleEditor({ value, onChange }: {
  value: ScheduleSlot[]
  onChange: (slots: ScheduleSlot[]) => void
}) {
  const slotFor = (day: string) => value.find((s) => s.day === day)
  const setHour = (day: string, field: 'startHour' | 'endHour', hour: string) => {
    onChange(value.map((s) => (s.day === day ? { ...s, [field]: hour } : s)))
  }
  const setEnabled = (day: string, on: boolean) => {
    const others = value.filter((s) => s.day !== day)
    onChange(on ? [...others, { day, startHour: '08:00', endHour: '17:00' }] : others)
  }
  return (
    <div className="flex flex-col gap-1.5">
      {IMMERSION_DAYS.map((day) => {
        const slot = slotFor(day)
        const enabled = !!slot
        return (
          <div key={day} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEnabled(day, !enabled)}
              className={[
                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors',
                enabled ? 'border-blue bg-blue' : 'border-[var(--ds-border-strong)] bg-[var(--ds-surface)]',
              ].join(' ')}
              aria-label={`${enabled ? 'Désactiver' : 'Activer'} ${day}`}
            >
              {enabled && <span className="text-[11px] font-bold text-white">✓</span>}
            </button>
            <span className={enabled ? 'w-20 text-sm font-medium text-[var(--ds-text)]' : 'w-20 text-sm text-[var(--ds-text-subtle)]'}>
              {day}
            </span>
            <input
              type="time"
              disabled={!enabled}
              value={slot?.startHour ?? ''}
              onChange={(e) => setHour(day, 'startHour', e.target.value)}
              className="w-28 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1.5 text-sm text-[var(--ds-text)] outline-none focus:border-blue disabled:cursor-not-allowed disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
            />
            <span className="text-xs text-[var(--ds-text-subtle)]">→</span>
            <input
              type="time"
              disabled={!enabled}
              value={slot?.endHour ?? ''}
              onChange={(e) => setHour(day, 'endHour', e.target.value)}
              className="w-28 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 py-1.5 text-sm text-[var(--ds-text)] outline-none focus:border-blue disabled:cursor-not-allowed disabled:bg-[var(--ds-surface-sunken)] disabled:text-[var(--ds-text-subtle)]"
            />
          </div>
        )
      })}
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
  // Verdict du test : la moyenne est à 50%. L'AB n'est possible que si le candidat
  // a réussi au moins un test (>= 50%).
  const { result: testResult } = useClassMarkerResult(id)
  const testPassed =
    !!testResult && typeof testResult.percentage === 'number' && testResult.percentage >= 50

  // Tenant Annemasse : pas de sites de formation (cf. ListeCandidats) — les
  // badges et champs Réunion (Sainte-Marie / Saint-Paul / Saint-Pierre) sont
  // masqués, la granularité passe par la mobilité (6 secteurs Annemasse).
  const region = useRegionStore((s) => s.region)
  const isAnnemasse = region === 'annemasse'

  // Modèles RH (chargés une fois, dédupés par le store) : sert à préremplir le
  // mail d'import CV avec le modèle « Import CV » par défaut.
  const { templates: rhTemplates, load: loadRhTemplates } = useMailTemplatesStore('rh')
  useEffect(() => { loadRhTemplates() }, [loadRhTemplates])
  const cvImportTemplateId = rhTemplates.find((t) => t.name === 'Import CV')?.id

  const [formData, setFormData] = useState<Candidate | null>(null)
  // Édition de la fiche = même formulaire que la création (modal). L'édition inline
  // n'est plus déclenchable : isEditing reste false (branches d'affichage uniquement).
  const [isEditing] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mailMode, setMailMode] = useState<'regular' | 'cv-import' | null>(null)
  const [cvChoiceOpen, setCvChoiceOpen] = useState<'top' | 'bottom' | null>(null)
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [confirmedJobIds, setConfirmedJobIds] = useState<Set<string>>(new Set())
  const [placement, setPlacement] = useState<CandidatePlacement | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [immersionModalOpen, setImmersionModalOpen] = useState(false)
  const [immersionStart, setImmersionStart] = useState('')
  const [immersionEnd, setImmersionEnd] = useState('')
  const [immersionCompanyId, setImmersionCompanyId] = useState('')
  const [immersionConventionNumber, setImmersionConventionNumber] = useState('')
  const [immersionSchedule, setImmersionSchedule] = useState<ScheduleSlot[]>([])
  const [companyOptions, setCompanyOptions] = useState<{ id: number; name: string }[]>([])
  const [companyQuery, setCompanyQuery] = useState('')
  const [unavailableModalOpen, setUnavailableModalOpen] = useState(false)
  const [availabilityDate, setAvailabilityDate] = useState('')
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [companyListOpen, setCompanyListOpen] = useState(false)
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryText, setAiSummaryText] = useState('')
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null)
  const [revealedSsn, setRevealedSsn] = useState<string | null>(null)
  const [revealingSsn, setRevealingSsn] = useState(false)
  const [ssnError, setSsnError] = useState<string | null>(null)
  const [showPendingComment, setShowPendingComment] = useState(false)
  const [pendingComment, setPendingComment] = useState('')
  const [pendingOrientations, setPendingOrientations] = useState<string[]>([])
  const [sendPendingMail, setSendPendingMail] = useState(false)
  const [pendingMailError, setPendingMailError] = useState<string | null>(null)
  const [pendingCommentSaved, setPendingCommentSaved] = useState(false)
  const [pendingCommentLoading, setPendingCommentLoading] = useState(false)
  const [pendingCommentError, setPendingCommentError] = useState<string | null>(null)
  const { addHistoryEntry } = useAddCandidateHistoryEntry()

  const togglePendingOrientation = (value: string) =>
    setPendingOrientations((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  const openPendingComment = () => {
    setPendingComment('')
    setPendingOrientations([])
    setSendPendingMail(false)
    setPendingMailError(null)
    setPendingCommentSaved(false)
    setPendingCommentError(null)
    setShowPendingComment(true)
  }

  const handlePendingCommentSubmit = async () => {
    if (!pendingComment.trim() || !id || !formData) return
    setPendingCommentLoading(true)
    setPendingCommentError(null)
    setPendingMailError(null)
    try {
      // Évite un doublon d'historique si l'envoi du mail a échoué au premier
      // essai et que l'utilisateur réessaie sans fermer le modal.
      if (!pendingCommentSaved) {
        const addRes = await addHistoryEntry(id, buildTestFailureComment(pendingComment, pendingOrientations))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((addRes as any)?.error) throw new Error(((addRes as any).error.message?.replace(/^\[GraphQL\]\s*/, '') ?? 'Erreur'))
        setPendingCommentSaved(true)
      }
      if (sendPendingMail) {
        const to = formData.identity.email?.trim() ?? ''
        if (!to) {
          setPendingMailError('Aucun email candidat : le mail de redirection n’a pas été envoyé.')
          return
        }
        if (pendingOrientations.includes(TEST_FAILURE_NO_SHARE_VALUE)) {
          setPendingMailError('Le candidat ne souhaite pas que sa candidature soit partagée : aucun mail envoyé.')
          return
        }
        const firstName = formData.identity.full_name.split(' ')[0] ?? ''
        try {
          await apiJson('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to,
              subject: 'Votre candidature a été redirigée',
              body: buildTestFailureRedirectionBody(firstName, pendingOrientations),
            }),
          })
        } catch (err) {
          setPendingMailError(err instanceof Error ? err.message : 'Échec de l’envoi du mail.')
          return
        }
      }
      const upd = await candidateGraphqlClient.mutation(UPDATE_CANDIDATE_FULL, { id, input: { testFailurePending: false } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((upd as any)?.error) throw new Error(((upd as any).error.message?.replace(/^\[GraphQL\]\s*/, '') ?? 'Erreur'))
      setFormData(prev => prev ? { ...prev, test_failure_pending: false } as Candidate : prev)
      setShowPendingComment(false)
      setPendingComment('')
    } catch (err) {
      setPendingCommentError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setPendingCommentLoading(false)
    }
  }

  useEffect(() => {
    if (candidate && !formData) setFormData(structuredClone(candidate))
  }, [candidate])

  // Ne jamais laisser le SSN en clair d'une fiche fuiter sur une autre.
  useEffect(() => {
    setRevealedSsn(null)
    setSsnError(null)
  }, [id])

  const handleRevealSsn = async () => {
    if (!formData) return
    setRevealingSsn(true)
    setSsnError(null)
    try {
      const result = await candidateGraphqlClient.query(UNMASK_SSN, { id: formData._id }).toPromise()
      // Sans ce contrôle, une erreur serveur laissait le champ sur "[chiffré]" sans
      // aucun signal, ni en console, ni à l'écran.
      if (result.error) {
        setSsnError(result.error.graphQLErrors[0]?.message ?? 'Échec du déchiffrement du numéro de sécurité sociale.')
        return
      }
      const ssn = result.data?.unmaskCandidateSsn ?? null
      if (!ssn) {
        setSsnError('Aucun numéro de sécurité sociale déchiffrable pour cette fiche.')
        return
      }
      setRevealedSsn(ssn)
    } catch (err) {
      setSsnError(err instanceof Error ? err.message : 'Échec du déchiffrement du numéro de sécurité sociale.')
    } finally {
      setRevealingSsn(false)
    }
  }

  const fetchDriveFiles = async (candidateId: string) => {
    setLoadingFiles(true)
    try {
      const res = await apiFetch(`/api/candidates/${candidateId}/drive-files`)
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

  // Aperçu : on récupère le fichier via le backend (token OAuth serveur) plutôt que
  // d'embarquer drive.google.com — l'iframe Google exige la session Google dans
  // l'iframe (bloquée par les cookies tiers → "Connectez-vous à votre compte Google").
  useEffect(() => {
    // Types non-proxyables (Office binaire…) : pas de blob, on utilisera l'embed Google.
    if (!id || !selectedFile || !isProxyablePreview(selectedFile.mimeType)) {
      setPreviewUrl(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    // Sans ça, l'ancienne blob: URL (déjà révoquée par le cleanup ci-dessous) reste
    // dans previewUrl le temps du fetch suivant : en passant d'une image à un PDF,
    // PdfViewer se montait avec cette URL morte → pdf.js échouait avec
    // "Invalid PDF structure" (#841). Un PDF ouvert en premier ne reproduisait pas
    // le bug : previewUrl valait encore null au premier rendu.
    setPreviewUrl(null)
    setPreviewLoading(true)
    setPreviewError(null)
    apiFetch(`/api/candidates/${id}/drive-files/${selectedFile.id}/content`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Aperçu indisponible (${res.status})`)
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Aperçu indisponible')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, selectedFile])

  useEffect(() => {
    if (!id) return
    offerGraphqlClient.query(GET_CANDIDATE_MATCHED_OFFER_IDS, { candidateId: id }).toPromise().then((result) => {
      if (result.data?.candidateMatchedOfferIds) {
        setConfirmedJobIds(new Set(result.data.candidateMatchedOfferIds as string[]))
      }
    })
  }, [id])

  // Placement courant (immersion/contrat) dérivé des offres, seulement si le statut le justifie.
  useEffect(() => {
    if (!id || !formData) return
    if (formData.status !== CandidateStatus.IMMERSING && formData.status !== CandidateStatus.CONTRACT) {
      setPlacement(null)
      return
    }
    offerGraphqlClient.query(GET_CANDIDATE_PLACEMENT, { candidateId: id }).toPromise().then((result) => {
      setPlacement(result.data?.candidatePlacement ?? null)
    })
  }, [id, formData?.status])

  const handleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length === 0 || !formData || !id) return
    e.target.value = ''
    setUploadingFiles(true)
    try {
      const body = new FormData()
      files.forEach(f => body.append('files', f))
      const res = await apiFetch(`/api/candidates/${id}/drive-upload`, {
        method: 'POST',
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
      const res = await apiFetch(`/api/candidates/${id}/drive-files/${file.id}`, {
        method: 'DELETE',
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
      <div className="flex h-64 items-center justify-center gap-3 text-[var(--ds-text-subtle)] text-sm">
        <IconLoader width={20} height={20} className="animate-spin" />
        Chargement…
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center px-4">
        <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
        <p className="text-sm font-medium text-[var(--ds-text-muted)]">Candidat introuvable</p>
        {error && <p className="text-xs text-[var(--ds-text-subtle)] max-w-md">{error}</p>}
        <p className="text-xs text-[var(--ds-text-subtle)] font-mono">{id}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>Retour</Button>
      </div>
    )
  }

  if (!formData) return null

  const updateIdentity = (key: keyof Candidate['identity'], value: unknown) =>
    setFormData(prev => prev ? { ...prev, identity: { ...prev.identity, [key]: value } } : prev)

  const updateProfile = (key: keyof NonNullable<Candidate['profile']>, value: unknown) =>
    setFormData(prev => prev ? { ...prev, profile: { ...(prev.profile ?? {}), [key]: value } } : prev)

  const persistStatus = async (updated: Candidate) => {
    setFormData(updated)
    try { await update(updated._id, updated) } catch { /* ignore */ }
  }

  // Génère un résumé "matching" depuis les champs de la fiche et le dépose dans
  // la Description. Ne régénère pas si une description existe déjà (sauf confirmation).
  const handleGenerateDescription = async () => {
    if (!formData) return
    if (formData.identity.description?.trim() &&
        !window.confirm('Une description existe déjà. La remplacer par un résumé généré ?')) {
      return
    }
    const summary = buildCandidateSummary(formData)
    if (!summary.trim()) {
      setSaveError('Pas assez d\'informations sur la fiche pour générer un résumé.')
      return
    }
    const updated = { ...formData, identity: { ...formData.identity, description: summary } }
    setFormData(updated)
    try { await update(updated._id, updated) } catch { setSaveError('Erreur lors de l\'enregistrement du résumé') }
  }

  const handleGenerateAiSummary = async () => {
    if (!formData) return
    setAiSummaryLoading(true)
    setAiSummaryError(null)
    setAiSummaryText('')
    try {
      const res = await apiFetch(`/api/candidates/${formData._id}/generate-summary`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        throw new Error(err.error || `Échec (${res.status})`)
      }
      const data = await res.json()
      setAiSummaryText(data.summary)
      setAiSummaryOpen(true)
    } catch (err) {
      setAiSummaryError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setAiSummaryLoading(false)
    }
  }

  const handleSaveAiSummary = async () => {
    if (!formData || !aiSummaryText.trim()) return
    const updated = { ...formData, identity: { ...formData.identity, description: aiSummaryText } }
    setFormData(updated)
    try {
      await update(updated._id, updated)
      setAiSummaryOpen(false)
    } catch {
      setAiSummaryError('Erreur lors de l\'enregistrement')
    }
  }

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    if (!formData) return
    // Passage en immersion : demander entreprise, convention, horaires et dates via un modal.
    if (newStatus === CandidateStatus.IMMERSING) {
      setImmersionStart(formData.immersion_start_date?.slice(0, 10) ?? '')
      setImmersionEnd(formData.immersion_end_date?.slice(0, 10) ?? '')
      setImmersionCompanyId(formData.immersion_company_id != null ? String(formData.immersion_company_id) : '')
      setImmersionConventionNumber(formData.immersion_convention_number ?? '')
      setImmersionSchedule(formData.immersion_schedule ?? [])
      const initialCompanyName = formData.immersion_company_name ?? ''
      setCompanyQuery(initialCompanyName)
      setCompanyListOpen(false)
      // Charge la liste des entreprises (MySQL) une seule fois pour le sélecteur.
      let options = companyOptions
      if (options.length === 0) {
        try {
          const res = await graphqlClient.query(GET_COMPANY_OPTIONS, {}).toPromise()
          if (res.data?.companyOptions) {
            options = res.data.companyOptions as { id: number; name: string }[]
            setCompanyOptions(options)
          }
        } catch { /* best-effort */ }
      }
      setImmersionModalOpen(true)
      // Auto-remplissage de l'entreprise (+ horaires) depuis le matching si vide :
      // 1ère entreprise où le candidat a été envoyé, avec les horaires de l'offre.
      if (!initialCompanyName && id) {
        try {
          const sentRes = await offerGraphqlClient.query(GET_CANDIDATE_SENT_COMPANIES, { candidateId: id }).toPromise()
          const sent = sentRes.data?.candidateSentCompanies as { offerId: string; companyName: string | null }[] | undefined
          const first = sent?.[0]
          let matchedByName = false
          if (first?.companyName) {
            setCompanyQuery(first.companyName)
            const matchByName = options.find(c => c.name?.toLowerCase() === first.companyName!.toLowerCase())
            if (matchByName) {
              setImmersionCompanyId(String(matchByName.id))
              matchedByName = true
            }
          }
          if (first?.offerId && (formData.immersion_schedule ?? []).length === 0) {
            const offerRes = await offerGraphqlClient.query(MATCH_OFFER, { id: first.offerId }).toPromise()
            const offer = offerRes.data?.matchOffer
            if (offer) {
              if (!matchedByName && offer.companyInfos?.id) {
                setImmersionCompanyId(String(offer.companyInfos.id))
                if (offer.companyInfos?.name) setCompanyQuery(offer.companyInfos.name)
              }
              const schedule = (offer.schedule as ScheduleSlot[] | undefined)?.filter(s => s?.day) ?? []
              if (schedule.length > 0) setImmersionSchedule(schedule)
            }
          }
        } catch { /* best-effort : l'utilisateur renseigne manuellement */ }
      }
      return
    }
    // Passage en indisponible : demander une date de disponibilité avant d'enregistrer.
    if (newStatus === CandidateStatus.UNAVAILABLE) {
      setAvailabilityDate(formData.job_info?.availability_date?.slice(0, 10) ?? '')
      setUnavailableModalOpen(true)
      return
    }
    // Passage en contrat : renseigner l'offre (ou l'entreprise trouvée par le candidat) et la date de début.
    if (newStatus === CandidateStatus.CONTRACT) {
      setContractModalOpen(true)
      return
    }
    await persistStatus({ ...formData, status: newStatus })
  }

  const confirmUnavailable = async () => {
    if (!formData) return
    await persistStatus({
      ...formData,
      status: CandidateStatus.UNAVAILABLE,
      job_info: {
        ...formData.job_info,
        availability_date: availabilityDate || undefined,
      },
    })
    setUnavailableModalOpen(false)
  }

  const confirmImmersion = async () => {
    if (!formData) return
    const companyIdNum = immersionCompanyId ? Number(immersionCompanyId) : undefined
    // Le nom peut venir du sélecteur (options) ou d'un auto-remplissage libre (matching) :
    // on retombe sur le texte saisi pour ne jamais perdre l'entreprise affichée.
    const companyName = companyOptions.find(c => c.id === companyIdNum)?.name ?? (companyQuery.trim() || undefined)
    await persistStatus({
      ...formData,
      status: CandidateStatus.IMMERSING,
      immersion_start_date: immersionStart || undefined,
      immersion_end_date: immersionEnd || undefined,
      immersion_company_id: companyIdNum,
      immersion_company_name: companyName,
      immersion_convention_number: immersionConventionNumber.trim() || undefined,
      immersion_schedule: immersionSchedule.length > 0 ? immersionSchedule : undefined,
    })
    setImmersionModalOpen(false)
  }

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !formData) return
    e.target.value = ''
    setUploadingCV(true)
    try {
      const res = await apiFetch(`/api/candidates/${formData._id}/cv`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
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

  async function handleSendCvImportMail(mail: { to: string; subject: string; body: string; attachments: MailAttachment[] }) {
    const res = await apiFetch('/api/external/cv-import/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateUuid: formData?._id,
        subject: mail.subject,
        body: mail.body,
        attachments: mail.attachments.length ? mail.attachments : undefined,
      }),
    })
    if (!res.ok) {
      // Un 413 (corps trop volumineux) ou une coupure de proxy peut renvoyer un
      // corps vide : ne jamais parser sans garde, sinon l'erreur affichée est
      // « Unexpected end of JSON input » au lieu de la vraie cause.
      const body = (await res.json().catch(() => null)) as { error?: string | { message?: string } } | null
      const raw = body?.error
      const message = typeof raw === 'string' ? raw : raw?.message
      throw new Error(message ?? `L'envoi du mail a échoué (${res.status})`)
    }
  }

  const handleDownloadPdf = async () => {
    if (!formData) return
    setDownloadingPdf(true)
    setSaveError(null)
    try {
      const res = await apiFetch(`/api/candidates/${formData._id}/pdf`)
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
      const res = await apiFetch(`/api/candidates/${formData._id}/ab-to-drive`, {
        method: 'POST',
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)] transition-colors"
            >
              <IconArrowLeft width={18} height={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0">
                <CandidateAvatar
                  candidateId={id!}
                  fullName={formData.identity.full_name}
                  hasPhoto={Boolean(
                    formData.identity.avatar_updated_at ||
                      formData.identity.drive_avatar_file_id ||
                      formData.photo_link,
                  )}
                  version={formData.identity.avatar_updated_at ?? formData.identity.drive_avatar_file_id}
                  className="h-12 w-12 rounded-full"
                  iconSize={22}
                />
                <button
                  title="Prendre une photo"
                  onClick={() => setCapturingPhoto(true)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple text-white flex items-center justify-center ring-2 ring-white hover:bg-purple/90"
                >
                  <IconCamera width={11} height={11} />
                </button>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--ds-text)] leading-tight">
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
                  {(formData.tp_types ?? []).map(t => (
                    <span key={t} className={`px-2 py-0.5 rounded-md text-xs font-bold ring-1 ${TP_COLORS[t]}`}>
                      {t}
                    </span>
                  ))}
                  {isSenior(computeAge(formData.identity.date_of_birth) ?? formData.identity.age) && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-[var(--ds-warning-bg)] text-[var(--ds-warning)] ring-1 ring-amber-200">
                      Senior
                    </span>
                  )}
                  {formData.identity.psh_referral_request && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-purple-light text-purple ring-1 ring-purple-light/30">
                      RQTH
                    </span>
                  )}
                  {placement ? (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-info/10 text-info ring-1 ring-info/20">
                      {placement.kind === 'IMMERSING' ? (
                        <>
                          En immersion{placement.companyName ? ` chez ${placement.companyName}` : ''}
                          {placement.since ? ` depuis le ${new Date(placement.since).toLocaleDateString('fr-FR')}` : ''}
                          {placement.immersionEndDate ? ` (fin le ${new Date(placement.immersionEndDate).toLocaleDateString('fr-FR')})` : ''}
                        </>
                      ) : (
                        <>
                          En contrat{placement.companyName ? ` avec ${placement.companyName}` : ''}
                          {placement.since ? ` depuis le ${new Date(placement.since).toLocaleDateString('fr-FR')}` : ''}
                          {formData.contract_trial_end_date ? ` (fin de période d'essai le ${new Date(formData.contract_trial_end_date).toLocaleDateString('fr-FR')})` : ''}
                          {formData.contract_session_name ? ` · Session ${formData.contract_session_name}` : ''}
                        </>
                      )}
                    </span>
                  ) : formData.status === CandidateStatus.IMMERSING && (formData.immersion_company_name || formData.immersion_start_date || formData.immersion_end_date) ? (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-info/10 text-info ring-1 ring-info/20">
                      Immersion{formData.immersion_company_name ? ` chez ${formData.immersion_company_name}` : ''} : {formData.immersion_start_date ? new Date(formData.immersion_start_date).toLocaleDateString('fr-FR') : '?'} → {formData.immersion_end_date ? new Date(formData.immersion_end_date).toLocaleDateString('fr-FR') : '?'}
                      {formData.immersion_convention_number ? ` · Conv. ${formData.immersion_convention_number}` : ''}
                    </span>
                  ) : formData.status === CandidateStatus.CONTRACT && (formData.contract_company_name || formData.contract_start_date) && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-info/10 text-info ring-1 ring-info/20">
                      En contrat{formData.contract_company_name ? ` avec ${formData.contract_company_name}` : ''}
                      {formData.contract_start_date ? ` depuis le ${new Date(formData.contract_start_date).toLocaleDateString('fr-FR')}` : ''}
                      {formData.contract_trial_end_date ? ` (fin de période d'essai le ${new Date(formData.contract_trial_end_date).toLocaleDateString('fr-FR')})` : ''}
                      {formData.contract_session_name ? ` · Session ${formData.contract_session_name}` : ''}
                    </span>
                  )}
                  {!isAnnemasse && (() => {
                    const sites = formData.training_sites?.length
                      ? formData.training_sites
                      : formData.training_site
                        ? [formData.training_site]
                        : []
                    return sites.length ? (
                      <span className="text-xs text-[var(--ds-text-subtle)]">
                        {sites.map((s) => TRAINING_SITE_LABELS[s] ?? prettyEnum(s)).join(' · ')}
                      </span>
                    ) : null
                  })()}
                  {formData.status === CandidateStatus.IMMERSING && formData.immersion_agreement && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--ds-success-bg)] text-[var(--ds-success)] ring-1 ring-[var(--ds-success)]">
                      Convention immersion signée
                    </span>
                  )}
                  {formData.owner && (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--ds-text-subtle)]">
                      <IconUser width={12} height={12} />
                      Créé par {formData.owner.name}
                      {formData.owner.sector && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)] font-medium">
                          {formData.owner.sector}
                        </span>
                      )}
                    </span>
                  )}
                  {formData.created_at && (
                    <span className="text-xs text-[var(--ds-text-subtle)]">
                      Créé le {new Date(formData.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {formData.last_relance_at && (
                    <span className="text-xs text-[var(--ds-warning)]">
                      Dernière relance : {new Date(formData.last_relance_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {formData.relance_response_at && (
                    <span className="text-xs text-[var(--ds-success)]">
                      Réponse à la relance : {new Date(formData.relance_response_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" leftIcon={<IconEdit width={15} height={15} />} onClick={() => setEditOpen(true)}>
              Compléter
            </Button>
            <Button
              size="sm"
              leftIcon={<IconTrash width={15} height={15} />}
              onClick={() => setShowDeleteModal(true)}
              style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
            >
              Supprimer
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            <IconAlert width={16} height={16} className="shrink-0" />
            {saveError}
          </div>
        )}

        {/* ── Déjà envoyé en entreprise via le matching ── */}
        {id && <CandidateSentCompaniesCallout candidateId={id} />}

        {formData.status === CandidateStatus.TEST_FAILED && formData.test_failure_pending && (
          <div className="rounded-xl border border-[var(--ds-warning)] bg-[var(--ds-warning-bg)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[var(--ds-warning)] font-bold text-sm">
              <IconAlert width={16} height={16} /> En attente de finalisation
            </div>
            <p className="text-sm text-[var(--ds-text-muted)]">
              Ce candidat est en « Test non réussi » (moyenne {formData.test_average != null ? `${Number(formData.test_average).toFixed(2)} / 20` : `< ${gateThresholdForTps(formData.tp_types)} / 20`}). Un commentaire sur les actions entreprises doit être saisi pour finaliser la fiche. Tant que ce commentaire n’est pas enregistré, la fiche reste en attente.
            </p>
            <p className="text-xs text-[var(--ds-text-subtle)]">
              Moyenne calculée à partir de l’épreuve écrite ({formData.written_test_score ?? '—'} / 20) et du score ClassMarker. Vous pouvez compléter à tout moment.
            </p>
            <div>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={openPendingComment}>
                Ajouter le commentaire
              </Button>
            </div>
          </div>
        )}

        {/* ── Actions rapides ── */}
        <div className="flex flex-wrap gap-2">
          {formData.drive_folder_id ? (
            <Button variant="secondary" size="sm" leftIcon={<IconExternalLink width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => window.open(`https://drive.google.com/drive/folders/${formData.drive_folder_id}`, '_blank')}>
              Drive
            </Button>
          ) : (
            <Button variant="secondary" size="sm" isLoading={creatingFolder}
              leftIcon={<IconFolderPlus width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={handleCreateDriveFolder}>
              Créer dossier Drive
            </Button>
          )}
          {formData.drive_folder_id && (
            <>
              <input id="cv-upload" type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={handleCVUpload} />
              <div className="relative">
                <Button variant="secondary" size="sm" isLoading={uploadingCV}
                  leftIcon={<IconUpload width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
                  onClick={() => setCvChoiceOpen(cvChoiceOpen === 'top' ? null : 'top')}>
                  Importer CV
                </Button>
                {cvChoiceOpen === 'top' && (
                  <CvChoiceDropdown
                    onUpload={() => { setCvChoiceOpen(null); document.getElementById('cv-upload')?.click() }}
                    onSendMail={() => { setCvChoiceOpen(null); setMailMode('cv-import') }}
                    onClose={() => setCvChoiceOpen(null)}
                  />
                )}
              </div>
            </>
          )}
          {formData.filiz_folder_id ? (
            <Button variant="secondary" size="sm" leftIcon={<IconExternalLink width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => window.open(`https://app.filiz.io/folders/${formData.filiz_folder_id}`, '_blank')}>
              Dossier Filiz
            </Button>
          ) : (
            <Button variant="secondary" size="sm" leftIcon={<IconFolderPlus width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
              onClick={() => setShowFilizModal(true)}>
              Créer dossier Filiz
            </Button>
          )}
          <Button variant="secondary" size="sm" leftIcon={<IconClipboardCheck width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
            disabled={!testPassed}
            title={testPassed ? undefined : "Indisponible : le candidat n'a réussi aucun test (moyenne < 50%)"}
            onClick={() => navigate(`/rh/candidats/${formData._id}/questionnaire`)}>
            Analyse de Besoin
          </Button>
          <Button variant="secondary" size="sm" isLoading={downloadingPdf}
            leftIcon={<IconDownload width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={handleDownloadPdf}>
            Télécharger le PDF
          </Button>
          <Button variant="secondary" size="sm" isLoading={savingAbToDrive}
            disabled={!formData.drive_folder_id}
            title={formData.drive_folder_id ? undefined : "Crée d'abord le dossier Drive du candidat"}
            leftIcon={<IconUpload width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={handleSaveAbToDrive}>
            Enregistrer l'AB dans le Drive
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<IconMail width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={() => setMailMode('regular')}>
            Envoyer un mail
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<IconQrCode width={15} height={15} style={{ color: 'var(--color-purple)' }} />}
            onClick={() => setShowClassMarker(true)}>
            Liens de test
          </Button>
        </div>

        {/* ── Grid sections ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Offres correspondantes */}
          <div className="md:col-span-2">
            <MatchedJobsList
              candidateId={id ?? ''}
              confirmedJobIds={confirmedJobIds}
              candidateTpTypes={formData.tp_types ?? []}
            />
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
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={valueCls}>{revealedSsn ?? formData.identity.social_security_number ?? '—'}</p>
                      {formData.identity.social_security_number && (
                        <button
                          type="button"
                          disabled={revealingSsn}
                          onClick={() => revealedSsn ? setRevealedSsn(null) : handleRevealSsn()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple hover:underline disabled:opacity-40">
                          {revealingSsn ? (
                            <IconLoader width={12} height={12} className="animate-spin" />
                          ) : revealedSsn ? (
                            <IconEyeOff width={12} height={12} />
                          ) : (
                            <IconEye width={12} height={12} />
                          )}
                          {revealedSsn ? 'Masquer' : 'Afficher'}
                        </button>
                      )}
                    </div>
                    {ssnError && <p className="mt-1 text-xs text-[var(--ds-danger)]">{ssnError}</p>}
                  </div>
                )}
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
                  ) : <p className={valueCls}>{formatCommune(formData.identity.city)}</p>}
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
              <Field label="Permis B">
                {isEditing ? (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={!!formData.identity.driving_license_b}
                      onChange={e => updateIdentity('driving_license_b', e.target.checked)} />
                    <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                  </label>
                ) : <p className={valueCls}>{formData.identity.driving_license_b ? 'Oui' : 'Non'}</p>}
              </Field>
              <div className="ml-3 pl-4 border-l-2 border-[var(--ds-border)]">
                <Field label="Véhiculé">
                  {isEditing ? (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!formData.identity.has_vehicle}
                        onChange={e => updateIdentity('has_vehicle', e.target.checked)} />
                      <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                    </label>
                  ) : <p className={valueCls}>{formData.identity.has_vehicle ? 'Oui' : 'Non'}</p>}
                </Field>
              </div>
              <Field label="Moyen de transport">
                {isEditing ? (
                  <input className={inputCls} value={formData.identity.transport_means ?? ''}
                    onChange={e => updateIdentity('transport_means', e.target.value)} />
                ) : <p className={valueCls}>{formData.identity.transport_means || '—'}</p>}
              </Field>
              <Field label="A déjà eu un contrat d'apprentissage">
                {isEditing ? (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={!!formData.identity.had_apprenticeship_contract}
                      onChange={e => updateIdentity('had_apprenticeship_contract', e.target.checked)} />
                    <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                  </label>
                ) : <p className={valueCls}>{formData.identity.had_apprenticeship_contract ? 'Oui' : 'Non'}</p>}
              </Field>
              {formData.identity.had_apprenticeship_contract && (
                <Field label="Détails du contrat d'apprentissage">
                  {isEditing ? (
                    <textarea rows={2} className={inputCls + ' resize-none'}
                      value={formData.identity.apprenticeship_contract_details ?? ''}
                      onChange={e => updateIdentity('apprenticeship_contract_details', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.apprenticeship_contract_details || '—'}</p>}
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lieu de naissance">
                  {isEditing ? (
                    <input className={inputCls} value={formData.identity.place_of_birth ?? ''}
                      onChange={e => updateIdentity('place_of_birth', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.place_of_birth || '—'}</p>}
                </Field>
                <Field label="Département de naissance">
                  {isEditing ? (
                    <input className={inputCls} value={formData.identity.department_of_birth ?? ''}
                      onChange={e => updateIdentity('department_of_birth', e.target.value)} />
                  ) : <p className={valueCls}>{formData.identity.department_of_birth || '—'}</p>}
                </Field>
              </div>
              <Field label="Sexe">
                {isEditing ? (
                  <select className={selectCls} value={formData.identity.sex ?? ''}
                    onChange={e => updateIdentity('sex', e.target.value)}>
                    <option value="">Non renseigné</option>
                    <option value="FILLE">Femme</option>
                    <option value="GARCON">Homme</option>
                  </select>
                ) : <p className={valueCls}>{formData.identity.sex === 'FILLE' ? 'Femme' : formData.identity.sex === 'GARCON' ? 'Homme' : '—'}</p>}
              </Field>
              <div>
                <div className="flex items-center justify-between">
                    <span className={labelCls}>Description</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateDescription}
                        className="text-[11px] font-semibold text-purple hover:underline">
                        {formData.identity.description?.trim() ? 'Régénérer' : 'Générer le résumé'}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateAiSummary}
                        disabled={aiSummaryLoading}
                        className="text-[11px] font-semibold text-purple hover:underline disabled:opacity-40">
                        {aiSummaryLoading ? 'IA…' : 'Résumé IA'}
                      </button>
                    </div>
                  </div>
                {aiSummaryError && (
                  <p className="mt-1 text-xs text-[var(--ds-danger)]">{aiSummaryError}</p>
                )}
                {isEditing ? (
                  <textarea className={inputCls} rows={4} value={formData.identity.description ?? ''}
                    onChange={e => updateIdentity('description', e.target.value)} />
                ) : <p className={`${valueCls} whitespace-pre-wrap`}>{formData.identity.description || '—'}</p>}
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
              <Field label="Justification du niveau">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.education?.justification ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, education: { ...prev.education, justification: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.education?.justification || '—'}</p>}
              </Field>
              <Field label="Dernier diplôme obtenu">
                {isEditing ? (
                  <input className={inputCls} value={formData.background?.last_diploma ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, background: { ...prev.background, last_diploma: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.background?.last_diploma || '—'}</p>}
              </Field>
              <Field label="Dernier diplôme préparé">
                {isEditing ? (
                  <input className={inputCls} value={formData.background?.last_diploma_prepared ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, background: { ...prev.background, last_diploma_prepared: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.background?.last_diploma_prepared || '—'}</p>}
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
              {!isAnnemasse && (
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
              )}
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
                      <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-xs font-medium rounded-md">{q}</span>
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
                      <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-xs rounded-md">{d}</span>
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
              <Field label="Autres langues">
                {isEditing ? (
                  <input className={inputCls}
                    value={(formData.profile?.other_languages ?? []).join(', ')}
                    onChange={e => updateProfile('other_languages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.profile?.other_languages?.length ? formData.profile.other_languages.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-xs font-medium rounded-md">{l}</span>
                    )) : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Prêt à relever des défis">
                {isEditing ? (
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" checked={!!formData.profile?.ready_for_challenges}
                      onChange={e => updateProfile('ready_for_challenges', e.target.checked)} />
                    <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                  </label>
                ) : <p className={valueCls}>{formData.profile?.ready_for_challenges ? 'Oui' : 'Non'}</p>}
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
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] px-3 py-2">
                    <span className="text-sm font-medium text-[var(--ds-text)]">{a.competence}</span>
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
                  <div key={i} className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] p-3">
                    <p className="text-sm font-semibold text-[var(--ds-text)]">{exp.position || '—'}</p>
                    <p className="text-xs text-[var(--ds-text-subtle)] mt-0.5">
                      {exp.company}{exp.duration ? ` · ${exp.duration}` : ''}
                    </p>
                    {exp.responsibilities && (
                      <p className="text-xs text-[var(--ds-text-muted)] mt-2">{exp.responsibilities}</p>
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
                  <p className="mt-1 text-sm text-[var(--ds-text)] bg-[var(--ds-surface-sunken)] p-3 rounded-lg border border-[var(--ds-border)] whitespace-pre-wrap">
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

              <Field label="Préconisations pédagogiques">
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    {PEDA_RECO_OPTIONS.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-blue-600 h-4 w-4"
                          checked={!!formData.synthesis?.pedagogical_recommendations?.[key]}
                          onChange={() => setFormData(prev => prev ? {
                            ...prev,
                            synthesis: {
                              ...prev.synthesis,
                              pedagogical_recommendations: {
                                ...prev.synthesis?.pedagogical_recommendations,
                                [key]: !prev.synthesis?.pedagogical_recommendations?.[key],
                              },
                            },
                          } : prev)}
                        />
                        <span className="text-sm text-[var(--ds-text-muted)]">{label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const on = PEDA_RECO_OPTIONS
                      .filter(([key]) => formData.synthesis?.pedagogical_recommendations?.[key])
                      .map(([, label]) => label)
                    return on.length
                      ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--ds-text)]">{on.map(l => <li key={l}>{l}</li>)}</ul>
                      : <p className={valueCls}>—</p>
                  })()
                )}
              </Field>

              <Field label="Autres préconisations">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.synthesis?.other_recommendations ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, other_recommendations: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.synthesis?.other_recommendations || '—'}</p>}
              </Field>
              <Field label="Note importante">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.synthesis?.important_note ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, important_note: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.synthesis?.important_note || '—'}</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lieu">
                  {isEditing ? (
                    <input className={inputCls} value={formData.synthesis?.location ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, synthesis: { ...prev.synthesis, location: e.target.value }
                      } : prev)} />
                  ) : <p className={valueCls}>{formData.synthesis?.location || '—'}</p>}
                </Field>
                <Field label="Date">
                  {isEditing ? (
                    <input type="date" className={inputCls}
                      value={formData.synthesis?.date?.slice(0, 10) ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, synthesis: { ...prev.synthesis, date: e.target.value }
                      } : prev)} />
                  ) : <p className={valueCls}>{formData.synthesis?.date ? new Date(formData.synthesis.date).toLocaleDateString('fr-FR') : '—'}</p>}
                </Field>
              </div>
              <Field label="Interviewé par">
                {isEditing ? (
                  <input className={inputCls} value={formData.synthesis?.interviewed_by ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, synthesis: { ...prev.synthesis, interviewed_by: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.synthesis?.interviewed_by || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Suivi France Travail / Mission Locale */}
          <Card>
            <SectionTitle>Suivi France Travail & Mission Locale</SectionTitle>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inscrit France Travail">
                  {isEditing ? (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!formData.support?.france_travail_registered}
                        onChange={e => setFormData(prev => prev ? {
                          ...prev, support: { ...prev.support, france_travail_registered: e.target.checked }
                        } : prev)} />
                      <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                    </label>
                  ) : <p className={valueCls}>{formData.support?.france_travail_registered ? 'Oui' : 'Non'}</p>}
                </Field>
                <Field label="Inscrit Mission Locale">
                  {isEditing ? (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!formData.support?.mission_locale_registered}
                        onChange={e => setFormData(prev => prev ? {
                          ...prev, support: { ...prev.support, mission_locale_registered: e.target.checked }
                        } : prev)} />
                      <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                    </label>
                  ) : <p className={valueCls}>{formData.support?.mission_locale_registered ? 'Oui' : 'Non'}</p>}
                </Field>
              </div>
              <Field label="Agence France Travail">
                {isEditing ? (
                  <input className={inputCls} value={formData.support?.france_travail_agency ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, support: { ...prev.support, france_travail_agency: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.support?.france_travail_agency || '—'}</p>}
              </Field>
              <Field label="Ville Mission Locale">
                {isEditing ? (
                  <input className={inputCls} value={formData.support?.mission_locale_city ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, support: { ...prev.support, mission_locale_city: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.support?.mission_locale_city || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Projet professionnel & Recherche */}
          <Card>
            <SectionTitle>Projet professionnel & Recherche</SectionTitle>
            <div className="space-y-4">
              <Field label="Secteurs d'activité souhaités">
                {isEditing ? (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                    {ALL_DESIRED_SECTORS.map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" className="accent-blue-600 h-4 w-4"
                          checked={formData.desired_sectors?.includes(s) ?? false}
                          onChange={() => setFormData(prev => prev ? {
                            ...prev,
                            desired_sectors: prev.desired_sectors?.includes(s)
                              ? prev.desired_sectors.filter(x => x !== s)
                              : [...(prev.desired_sectors ?? []), s],
                          } : prev)} />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.desired_sectors?.length
                      ? formData.desired_sectors.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-xs font-medium rounded-md">{s}</span>
                        ))
                      : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Compétences attendues de l'entreprise">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.expected_company_skills?.join(', ') ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, expected_company_skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    } : prev)} />
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.expected_company_skills?.length
                      ? formData.expected_company_skills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] text-xs font-medium rounded-md">{s}</span>
                        ))
                      : <p className={valueCls}>—</p>}
                  </div>
                )}
              </Field>
              <Field label="Motivation pour le domaine">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.job_info?.domain_motivation ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, job_info: { ...prev.job_info, domain_motivation: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.job_info?.domain_motivation || '—'}</p>}
              </Field>
              <Field label="Questions / préoccupations">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.job_info?.questions_concerns ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, job_info: { ...prev.job_info, questions_concerns: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.job_info?.questions_concerns || '—'}</p>}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Disponible le week-end">
                  {isEditing ? (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!formData.job_info?.weekend_work}
                        onChange={e => setFormData(prev => prev ? {
                          ...prev, job_info: { ...prev.job_info, weekend_work: e.target.checked }
                        } : prev)} />
                      <span className="text-sm text-[var(--ds-text-muted)]">Oui</span>
                    </label>
                  ) : <p className={valueCls}>{formData.job_info?.weekend_work ? 'Oui' : 'Non'}</p>}
                </Field>
                <Field label="Source de découverte">
                  {isEditing ? (
                    <select className={selectCls} value={formData.job_info?.discovery_source ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, job_info: { ...prev.job_info, discovery_source: (e.target.value || undefined) as DiscoverySource }
                      } : prev)}>
                      <option value="">Non renseigné</option>
                      {Object.entries(DISCOVERY_SOURCE_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  ) : <p className={valueCls}>{formData.job_info?.discovery_source ? DISCOVERY_SOURCE_LABELS[formData.job_info.discovery_source] || prettyEnum(formData.job_info.discovery_source) : '—'}</p>}
                </Field>
              </div>
              <Field label="Sites / plateformes de recherche d'alternance">
                {isEditing ? (
                  <textarea rows={2} className={inputCls + ' resize-none'}
                    value={formData.job_info?.job_search_platforms ?? ''}
                    onChange={e => setFormData(prev => prev ? {
                      ...prev, job_info: { ...prev.job_info, job_search_platforms: e.target.value }
                    } : prev)} />
                ) : <p className={valueCls}>{formData.job_info?.job_search_platforms || '—'}</p>}
              </Field>
            </div>
          </Card>

          {/* Contact d'urgence */}
          {formData.emergency_contact && (formData.emergency_contact.last_name || formData.emergency_contact.first_name || formData.emergency_contact.phone) && (
            <Card>
              <SectionTitle>Contact d'urgence</SectionTitle>
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Signature recruteur">
                  {isEditing ? (
                    <input className={inputCls} value={formData.synthesis?.recruiter_signature ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, synthesis: { ...prev.synthesis, recruiter_signature: e.target.value }
                      } : prev)} />
                  ) : formData.synthesis?.recruiter_signature?.startsWith('data:image/') ? (
                    <img src={formData.synthesis.recruiter_signature} alt="Signature recruteur" className="mt-1 max-h-16 object-contain" />
                  ) : <p className={valueCls}>{formData.synthesis?.recruiter_signature || '—'}</p>}
                </Field>
                <Field label="Signature candidat">
                  {isEditing ? (
                    <input className={inputCls} value={formData.synthesis?.candidate_signature ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, synthesis: { ...prev.synthesis, candidate_signature: e.target.value }
                      } : prev)} />
                  ) : formData.synthesis?.candidate_signature?.startsWith('data:image/') ? (
                    <img src={formData.synthesis.candidate_signature} alt="Signature candidat" className="mt-1 max-h-16 object-contain" />
                  ) : <p className={valueCls}>{formData.synthesis?.candidate_signature || '—'}</p>}
                </Field>
              </div>
                <Field label="Lien avec le candidat">
                  {isEditing ? (
                    <input className={inputCls} value={formData.emergency_contact?.relationship ?? ''}
                      onChange={e => setFormData(prev => prev ? {
                        ...prev, emergency_contact: { ...prev.emergency_contact, relationship: e.target.value }
                      } : prev)} />
                  ) : <p className={valueCls}>{formData.emergency_contact?.relationship || '—'}</p>}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Téléphone">
                    {isEditing ? (
                      <input type="tel" className={inputCls} value={formData.emergency_contact?.phone ?? ''}
                        onChange={e => setFormData(prev => prev ? {
                          ...prev, emergency_contact: { ...prev.emergency_contact, phone: e.target.value }
                        } : prev)} />
                    ) : <p className={valueCls}>{formData.emergency_contact?.phone || '—'}</p>}
                  </Field>
                  <Field label="Email">
                    {isEditing ? (
                      <input type="email" className={inputCls} value={formData.emergency_contact?.email ?? ''}
                        onChange={e => setFormData(prev => prev ? {
                          ...prev, emergency_contact: { ...prev.emergency_contact, email: e.target.value }
                        } : prev)} />
                    ) : <p className={valueCls}>{formData.emergency_contact?.email || '—'}</p>}
                  </Field>
                </div>
              </div>
            </Card>
          )}

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
                  <input id="cv-upload-bottom" type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={handleCVUpload} />
                  <div className="relative">
                    <Button variant="secondary" size="sm" isLoading={uploadingCV}
                      leftIcon={<IconUpload width={14} height={14} style={{ color: 'var(--color-purple)' }} />}
                      onClick={() => setCvChoiceOpen(cvChoiceOpen === 'bottom' ? null : 'bottom')}>
                      {formData.cv_link ? 'Remplacer CV' : 'Importer CV'}
                    </Button>
                    {cvChoiceOpen === 'bottom' && (
                      <CvChoiceDropdown
                        onUpload={() => { setCvChoiceOpen(null); document.getElementById('cv-upload-bottom')?.click() }}
                        onSendMail={() => { setCvChoiceOpen(null); setMailMode('cv-import') }}
                        onClose={() => setCvChoiceOpen(null)}
                      />
                    )}
                  </div>
                  <input id="drive-upload" type="file" multiple className="hidden" onChange={handleDriveUpload} />
                  <Button variant="secondary" size="sm" isLoading={uploadingFiles}
                    leftIcon={<IconUpload width={14} height={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => document.getElementById('drive-upload')?.click()}>
                    Ajouter fichiers
                  </Button>
                  <Button variant="secondary" size="sm" isLoading={loadingFiles}
                    leftIcon={<IconRefresh width={14} height={14} style={{ color: 'var(--color-purple)' }} />}
                    onClick={() => id && fetchDriveFiles(id)}>
                    Actualiser
                  </Button>
                </div>
              </div>

              <div className="flex gap-4" style={{ height: '75vh' }}>
                {/* Preview */}
                <div className="flex-1 min-w-0">
                  {selectedFile ? (
                    !isProxyablePreview(selectedFile.mimeType) ? (
                      <iframe
                        key={selectedFile.id}
                        src={googleEmbedUrl(selectedFile)}
                        title={selectedFile.name}
                        className="w-full h-full rounded-lg border border-[var(--ds-border)]"
                      />
                    ) : previewLoading ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)] text-[var(--ds-text-subtle)]">
                        <IconLoader width={24} height={24} className="animate-spin" />
                        <p className="text-sm">Chargement de l'aperçu…</p>
                      </div>
                    ) : previewError ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 rounded-lg border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
                        <IconAlert width={28} height={28} className="text-[var(--ds-text-subtle)]" />
                        <p className="text-sm text-[var(--ds-text-subtle)]">{previewError}</p>
                        {selectedFile.webViewLink && (
                          <a href={selectedFile.webViewLink} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-purple hover:underline">Ouvrir dans Google Drive</a>
                        )}
                      </div>
                    ) : previewUrl ? (
                      selectedFile.mimeType.startsWith('image/') ? (
                        <div className="flex h-full w-full items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
                          <img
                            key={selectedFile.id}
                            src={previewUrl}
                            alt={selectedFile.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        // PDF (et Office/Google Docs convertis en PDF côté backend) :
                        // rendu par pdf.js en canvas. Cf. PdfViewer pour le pourquoi.
                        <PdfViewer key={selectedFile.id} fileUrl={previewUrl} />
                      )
                    ) : null
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 rounded-lg border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
                      <IconFile width={32} height={32} className="text-[var(--ds-text-subtle)]" />
                      <p className="text-sm text-[var(--ds-text-subtle)]">Sélectionner un fichier</p>
                    </div>
                  )}
                </div>

                {/* File list */}
                <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-sunken)]">
                  {loadingFiles ? (
                    <div className="flex items-center justify-center h-20 gap-2 text-[var(--ds-text-subtle)] text-xs">
                      <IconLoader width={14} height={14} className="animate-spin" />
                      Chargement…
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 gap-2 text-[var(--ds-text-subtle)] text-xs">
                      <IconFile width={20} height={20} />
                      Dossier vide
                    </div>
                  ) : (
                    <ul className="divide-y divide-[var(--ds-border)]">
                      {driveFiles.map(file => (
                        <li key={file.id} className={`group flex items-center transition-colors hover:bg-[var(--ds-surface)] ${
                          selectedFile?.id === file.id ? 'bg-[var(--ds-surface)] shadow-sm' : ''
                        }`}>
                          <button
                            onClick={() => setSelectedFile(file)}
                            className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-start gap-2"
                          >
                            <DriveFileIcon mimeType={file.mimeType} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[var(--ds-text)] truncate leading-tight">{file.name}</p>
                              {file.modifiedTime && (
                                <p className="text-[10px] text-[var(--ds-text-subtle)] mt-0.5">
                                  {new Date(file.modifiedTime).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file)}
                            title="Supprimer"
                            className="shrink-0 p-2 text-[var(--ds-text-subtle)] hover:text-[var(--ds-danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <IconTrash width={14} height={14} />
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
          requireGate
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setFormData(null)
            refetch()
          }}
        />
      )}

      {mailMode && (
        <MailModal
          defaultTo={formData.identity.email}
          candidateName={formData.identity.full_name}
          defaultTemplateId={mailMode === 'cv-import' ? cvImportTemplateId : undefined}
          onCustomSend={mailMode === 'cv-import' ? handleSendCvImportMail : undefined}
          onClose={() => setMailMode(null)}
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
          tpTypes={formData.tp_types ?? []}
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

      {immersionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImmersionModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Passage en immersion</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Renseigne l'entreprise, le numéro de convention, les horaires et les dates de l'immersion.</p>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <label className={labelCls} htmlFor="imm-company">Entreprise</label>
                <input
                  id="imm-company"
                  type="text"
                  autoComplete="off"
                  className={inputCls}
                  placeholder="Rechercher une entreprise…"
                  value={companyQuery}
                  onChange={e => { setCompanyQuery(e.target.value); setImmersionCompanyId(''); setCompanyListOpen(true) }}
                  onFocus={() => setCompanyListOpen(true)}
                />
                {companyListOpen && (() => {
                  const filtered = companyOptions.filter(c => c.name?.toLowerCase().includes(companyQuery.toLowerCase()))
                  return (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-lg">
                      {filtered.slice(0, 50).map(c => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--ds-surface-sunken)]"
                            onClick={() => { setImmersionCompanyId(String(c.id)); setCompanyQuery(c.name); setCompanyListOpen(false) }}
                          >
                            {c.name}
                          </button>
                        </li>
                      ))}
                      {filtered.length === 0 && (
                        <li className="px-3 py-1.5 text-sm text-[var(--ds-text-subtle)]">Aucune entreprise</li>
                      )}
                    </ul>
                  )
                })()}
              </div>
              <div>
                <label className={labelCls} htmlFor="imm-convention">Numéro de convention</label>
                <input
                  id="imm-convention"
                  type="text"
                  className={inputCls}
                  placeholder="N° de convention…"
                  value={immersionConventionNumber}
                  onChange={e => setImmersionConventionNumber(e.target.value)}
                />
              </div>
              <div>
                <span className={labelCls}>Horaires</span>
                <div className="mt-1">
                  <ImmersionScheduleEditor value={immersionSchedule} onChange={setImmersionSchedule} />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="imm-start">Date de début</label>
                <input id="imm-start" type="date" className={inputCls} value={immersionStart} onChange={e => setImmersionStart(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="imm-end">Date de fin</label>
                <input id="imm-end" type="date" className={inputCls} value={immersionEnd} min={immersionStart || undefined} onChange={e => setImmersionEnd(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setImmersionModalOpen(false)}>Annuler</Button>
              <Button variant="primary" size="sm" disabled={!immersionStart || !immersionEnd} onClick={confirmImmersion}>Confirmer</Button>
            </div>
          </div>
        </div>
      )}

      {unavailableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setUnavailableModalOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Indisponible jusqu'au</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Le candidat repassera automatiquement en « Recherche » à cette date.</p>
            <div className="mt-4">
              <label className={labelCls} htmlFor="fiche-avail-date">Date de disponibilité</label>
              <input id="fiche-avail-date" type="date" className={inputCls} value={availabilityDate} onChange={e => setAvailabilityDate(e.target.value)} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setUnavailableModalOpen(false)}>Annuler</Button>
              <Button variant="primary" size="sm" disabled={!availabilityDate} onClick={confirmUnavailable}>Confirmer</Button>
            </div>
          </div>
        </div>
      )}

      {contractModalOpen && (
        <ContractModal
          candidate={formData}
          onSuccess={(updated) => {
            setFormData(updated)
            setContractModalOpen(false)
          }}
          onClose={() => setContractModalOpen(false)}
        />
      )}

      {aiSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAiSummaryOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Résumé IA</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Modifie le résumé généré par l'IA si nécessaire, puis enregistre.</p>
            <div className="mt-4">
              <textarea className={inputCls} rows={6} value={aiSummaryText}
                onChange={e => setAiSummaryText(e.target.value)} />
            </div>
            {aiSummaryError && <p className="mt-2 text-xs text-[var(--ds-danger)]">{aiSummaryError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAiSummaryOpen(false)}>Annuler</Button>
              <Button variant="primary" size="sm" disabled={!aiSummaryText.trim()} onClick={handleSaveAiSummary}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {showPendingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPendingComment(false)}>
          <div className="w-full max-w-lg rounded-xl bg-[var(--ds-surface)] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--ds-text)]">Finaliser le test – commentaire</h3>
            <p className="mt-1 text-sm text-[var(--ds-text-subtle)]">Décris les actions prises suite à l’échec (recontact, orientation, remédiation...). Ce commentaire sera enregistré dans l’historique du candidat.</p>
            <div className="mt-4">
              <textarea className={inputCls + ' resize-none'} rows={4} value={pendingComment} onChange={e => setPendingComment(e.target.value)} placeholder="Ex: Candidat informé de l’échec, proposé atelier de remise à niveau, suivi prévu..." />
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <span id="pending-orientation-label" className="text-sm font-medium text-[var(--ds-text-muted)]">Orientation vers…</span>
              <div role="group" aria-labelledby="pending-orientation-label" className="flex flex-col gap-2 rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2.5">
                {TEST_FAILURE_ORIENTATION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--ds-text-muted)]">
                    <input
                      type="checkbox"
                      className="accent-blue-600 h-4 w-4"
                      checked={pendingOrientations.includes(opt.value)}
                      onChange={() => togglePendingOrientation(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 cursor-pointer text-sm text-[var(--ds-text-muted)]">
              <input
                type="checkbox"
                className="accent-blue-600 h-4 w-4"
                checked={sendPendingMail}
                onChange={(e) => setSendPendingMail(e.target.checked)}
              />
              Envoyer un mail au candidat (« Votre candidature a été redirigée vers… »)
            </label>
            {pendingMailError && <p className="mt-2 text-xs text-[var(--ds-warning)]">{pendingMailError}</p>}
            {pendingCommentError && <p className="mt-2 text-xs text-[var(--ds-danger)]">{pendingCommentError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowPendingComment(false)}>Annuler</Button>
              <Button size="sm" isLoading={pendingCommentLoading} disabled={!pendingComment.trim()} onClick={handlePendingCommentSubmit} className="bg-purple hover:bg-purple-dark text-white">
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CvChoiceDropdown({ onUpload, onSendMail, onClose }: {
  onUpload: () => void; onSendMail: () => void; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-lg overflow-hidden">
        <button onClick={onUpload} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors">
          <IconUpload width={16} height={16} className="text-[var(--ds-text-subtle)]" />
          <span>Uploader un fichier</span>
        </button>
        <button onClick={onSendMail} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] transition-colors border-t border-[var(--ds-border)]">
          <IconMail width={16} height={16} className="text-[var(--ds-text-subtle)]" />
          <span>Envoyer un mail au candidat</span>
        </button>
      </div>
    </>
  )
}
