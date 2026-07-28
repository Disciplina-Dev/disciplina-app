import { useState, useEffect } from 'react'
import { FileEdit } from 'lucide-react'
import { useCompanyBySiret } from '@/graphql/hooks'
import NeedsAnalysisModal from '@/features/abEntreprise/components/NeedsAnalysisModal'
import type { AppUser } from '@/store/authStore'
import type { Entreprise } from '@/types/entreprise'
import type { NeedsAnalysis } from '@/types/needsAnalysis'

interface AbCompany {
  id?: number | string | null
  name?: string | null
  userID?: number | null
  legalReferent?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  sector?: string | null
  mainActivity?: string | null
  siret?: string | null
  idcc?: string | null
  notes?: string | null
  conclusion?: string | null
  status?: string | null
}

interface EditNeedsAnalysisButtonProps {
  needsAnalysisData: NeedsAnalysis
  currentUser: AppUser
  companyId?: number | null
  companyName?: string | null
  onSuccess: () => void
}

function toEntreprise(abCompany: AbCompany | undefined, ab: NeedsAnalysis, companyId?: number | null, companyName?: string | null): Entreprise {
  return {
    id: String(abCompany?.id ?? companyId ?? ''),
    nom_commercial: abCompany?.name ?? companyName ?? null,
    proprietaire_contact: null,
    commercial: null,
    proprietaire_id: abCompany?.userID ?? null,
    representant_legal: abCompany?.legalReferent ?? ab.referents?.legalReferents?.name ?? null,
    telephone: abCompany?.phone ?? ab.referents?.legalReferents?.phone ?? null,
    email: abCompany?.email ?? ab.referents?.legalReferents?.email ?? null,
    adresse: abCompany?.address ?? null,
    secteur: abCompany?.sector ?? ab.companyInfos?.activities?.join(', ') ?? null,
    metier: abCompany?.mainActivity ?? null,
    siret: abCompany?.siret ?? ab.companyInfos?.siret ?? null,
    idcc: abCompany?.idcc ?? ab.companyInfos?.idcc ?? null,
    note: abCompany?.notes ?? ab.companyInfos?.description ?? null,
    conclusion: abCompany?.conclusion ?? null,
    status: (abCompany?.status as Entreprise['status']) || (ab.status as Entreprise['status']) || 'À Réfléchir',
    date_insertion: null,
    date_relance: null,
    type_relance: null,
    relance_template_id: null,
    relance_channel: null,
  }
}

export function EditNeedsAnalysisButton({
  needsAnalysisData,
  currentUser,
  companyId,
  companyName,
  onSuccess,
}: EditNeedsAnalysisButtonProps) {
  const [open, setOpen] = useState(false)
  const { result: abCompanyResult, searchBySiret } = useCompanyBySiret()
  const abCompany = abCompanyResult.data?.companyBySiret

  useEffect(() => {
    if (open && needsAnalysisData.companyInfos?.siret) {
      searchBySiret(needsAnalysisData.companyInfos.siret)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needsAnalysisData.companyInfos?.siret])

  const handleSuccess = () => {
    setOpen(false)
    onSuccess()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-blue/20 hover:text-blue hover:bg-blue-light/30 md:px-4"
        title="Modifier l'analyse du besoin"
      >
        <FileEdit size={16} />
        <span className="hidden md:inline">Modifier l'AB</span>
      </button>

      {open && (
        <NeedsAnalysisModal
          entreprise={toEntreprise(abCompany, needsAnalysisData, companyId, companyName)}
          currentUser={currentUser}
          initialData={needsAnalysisData}
          onClose={() => setOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
