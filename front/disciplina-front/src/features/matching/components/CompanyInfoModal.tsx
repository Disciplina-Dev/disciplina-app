import { useEffect, useState } from 'react'
import { X, Building2, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { offerGraphqlClient } from '@/graphql/client'
import { GET_OFFER_COMPANY_INFO } from '@/graphql/queries'
import { ABDetailContent, type AbDetail } from '@/features/abEntreprise/components/ABDetailContent'

interface CompanyInfoModalProps {
  offerId: string
  onClose: () => void
}

interface Position {
  trainingDomain?: string
  jobTitle?: string
  selectedMissions?: string[]
  localisation?: string[]
}

interface Ab {
  id?: number
  legalRepFunction?: string
  recruitmentResponsibleName?: string
  recruitmentResponsiblePhone?: string
  recruitmentResponsibleEmail?: string
  recruitmentResponsibleFunction?: string
  companySectors?: string[]
  companyDescription?: string
  opco?: string
  referralSource?: string
  positionsCount?: number
  positions?: Position[]
  trainingDomain?: string
  jobTitle?: string
  selectedMissions?: string[]
  localisation?: string
  otherMissions?: string
  jobDescriptionMissions?: string[]
  jobDescriptionOther?: string
  educationLevel?: string
  drivingLicense?: string
  experienceRequired?: string
  ageRequirements?: string[]
  ageMin?: number
  ageMax?: number
  softSkills?: string
  scheduleOptions?: string[]
  conditions?: string
  additionalComments?: string
  recruitmentMethod?: string
  immersionPeriod?: string
  trainingDays?: string
  yousignSignatureRequestID?: string
  status?: string
  createdAt?: string
}

interface Company {
  id?: number
  name?: string
  legalReferent?: string
  phone?: string
  email?: string
  address?: string
  sector?: string
  mainActivity?: string
  siret?: string
  idcc?: string
  ape?: string
  notes?: string
  conclusion?: string
  status?: string
}

interface JobCompanyInfo {
  companyName?: string
  company?: Company | null
  ab?: Ab | null
}

const ENUM_LABELS: Record<string, string> = {
  SECRETARIAT: 'Secrétariat', VENTE: 'Vente',
  NORD: 'Nord', OUEST: 'Ouest', SUD: 'Sud',
  OUI: 'Oui', NON: 'Non', OPTIONNEL: 'Optionnel', A_DISCUTER: 'À discuter',
  DEBUTANT: 'Débutant', OBLIGATOIRE: 'Obligatoire',
  BAC: 'Bac', BAC_PLUS_2: 'Bac +2', BAC_PLUS_3: 'Bac +3',
  ALL_CV: 'Réception de tous les CV', PRESELECTION: 'Présélection par le centre', PRE_INTERVIEW: 'Pré-entretien par le centre',
  KOANN: 'Koann', E2CR: 'E2CR', FRANCE_TRAVAIL: 'France Travail', TELEVISION_PUB: 'Télévision / Pub',
  BOUCHE_A_OREILLE: 'Bouche à oreille', MISSION_LOCALE: 'Mission Locale', SALON: 'Salon', RSMA: 'RSMA', RESEAUX_SOCIAUX: 'Réseaux sociaux',
  BROUILLON: 'Brouillon', EN_ATTENTE_SIGNATURE: 'En attente de signature', SIGNE: 'Signé', EXPIRE: 'Expiré',
}
const lbl = (v?: string | null) => (v ? ENUM_LABELS[v] ?? v : '')

function Row({ label, value }: { label: string; value?: string | number | null }) {
  const v = value === 0 ? '0' : value
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 whitespace-pre-wrap">{v ? String(v) : '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue">{title}</p>
      {children}
    </div>
  )
}

export default function CompanyInfoModal({ offerId, onClose }: CompanyInfoModalProps) {
  const [data, setData] = useState<JobCompanyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    offerGraphqlClient
      .query(GET_OFFER_COMPANY_INFO, { offerId })
      .toPromise()
      .then((res) => {
        if (cancelled) return
        if (res.error) setError(res.error.message)
        else setData(res.data?.offerCompanyInfo ?? null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [offerId])

  const company = data?.company
  const ab = data?.ab

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-gray-50 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light text-blue">
              <Building2 size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900 truncate">
              {data?.companyName || company?.name || 'Entreprise'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

          {!loading && !error && !company && !ab && (
            <p className="text-sm text-gray-500">Aucune information entreprise liée à cette offre.</p>
          )}

          {company && (
            <Section title="Fiche entreprise">
              <Row label="Raison sociale" value={company.name} />
              <Row label="SIRET" value={company.siret} />
              <Row label="Code APE" value={company.ape} />
              <Row label="IDCC" value={company.idcc} />
              <Row label="Adresse" value={company.address} />
              <Row label="Secteur" value={company.sector} />
              <Row label="Activité principale" value={company.mainActivity} />
              <Row label="Représentant légal" value={company.legalReferent} />
              <Row label="Téléphone" value={company.phone} />
              <Row label="Email" value={company.email} />
              <Row label="Statut" value={company.status} />
              <Row label="Conclusion" value={company.conclusion} />
              <Row label="Notes" value={company.notes} />
            </Section>
          )}

          {ab && (
            <>
              <Section title="Analyse du besoin">
                <Row label="OPCO" value={ab.opco} />
                <Row label="Comment a connu DISCIPLINA" value={lbl(ab.referralSource)} />
                <Row label="Statut AB" value={lbl(ab.status)} />
              </Section>
              <ABDetailContent ab={ab as AbDetail} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
