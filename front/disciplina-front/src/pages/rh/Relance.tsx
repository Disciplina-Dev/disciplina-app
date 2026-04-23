import {
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'

// ─── Types ───────────────────────────────────────────────────────────────────

type TpType = 'AD' | 'CC' | 'NTC' | 'REM' | 'SA'
type RelanceResponse = 'OUI' | 'NON' | 'EN_ATTENTE' | 'NON_CONTACTE'

interface ActiveCandidat {
  id: string
  fullName: string
  email: string
  phone: string
  tp: TpType
  lastRelanceDate: string | null
  lastRelanceResponse: RelanceResponse
}

interface RelanceCampaign {
  id: string
  sentAt: string
  total: number
  oui: number
  non: number
  noResponse: number
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_CANDIDATS: ActiveCandidat[] = [
  { id: '1', fullName: 'Axel Fontaine',     email: 'axel.fontaine@gmail.com',     phone: '0692 12 34 56', tp: 'CC',  lastRelanceDate: '2026-04-10', lastRelanceResponse: 'OUI' },
  { id: '2', fullName: 'Léa Grondin',       email: 'lea.grondin@gmail.com',       phone: '0692 23 45 67', tp: 'AD',  lastRelanceDate: '2026-04-10', lastRelanceResponse: 'EN_ATTENTE' },
  { id: '3', fullName: 'Tom Payet',         email: 'tom.payet@gmail.com',         phone: '0693 34 56 78', tp: 'NTC', lastRelanceDate: null,         lastRelanceResponse: 'NON_CONTACTE' },
  { id: '4', fullName: 'Manon Rivière',     email: 'manon.riviere@outlook.fr',    phone: '0692 45 67 89', tp: 'SA',  lastRelanceDate: '2026-04-10', lastRelanceResponse: 'EN_ATTENTE' },
  { id: '5', fullName: 'Dylan Cadet',       email: 'dylan.cadet@gmail.com',       phone: '0693 56 78 90', tp: 'CC',  lastRelanceDate: '2026-03-20', lastRelanceResponse: 'OUI' },
  { id: '6', fullName: 'Céline Hoarau',     email: 'celine.hoarau@gmail.com',     phone: '0692 67 89 01', tp: 'REM', lastRelanceDate: null,         lastRelanceResponse: 'NON_CONTACTE' },
  { id: '7', fullName: 'Nolan Thien Ah Kee',email: 'nolan.tak@gmail.com',         phone: '0693 78 90 12', tp: 'AD',  lastRelanceDate: '2026-04-10', lastRelanceResponse: 'EN_ATTENTE' },
  { id: '8', fullName: 'Sarah Turpin',      email: 'sarah.turpin@hotmail.fr',     phone: '0692 89 01 23', tp: 'NTC', lastRelanceDate: '2026-03-20', lastRelanceResponse: 'NON' },
]

const MOCK_CAMPAIGNS: RelanceCampaign[] = [
  { id: '1', sentAt: '2026-04-10', total: 8, oui: 2, non: 1, noResponse: 5 },
  { id: '2', sentAt: '2026-03-20', total: 10, oui: 5, non: 3, noResponse: 2 },
  { id: '3', sentAt: '2026-02-28', total: 12, oui: 7, non: 4, noResponse: 1 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TP_LABELS: Record<TpType, string> = {
  AD: 'Admin.',
  CC: 'Chef proj.',
  NTC: 'NTC',
  REM: 'REM',
  SA: 'Secrét.',
}

const TP_COLORS: Record<TpType, string> = {
  AD:  'bg-blue-light text-blue',
  CC:  'bg-purple-light text-purple',
  NTC: 'bg-pink-light text-pink',
  REM: 'bg-warning-bg text-warning',
  SA:  'bg-success-bg text-success',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RelanceBadge({ response }: { response: RelanceResponse }) {
  const config = {
    OUI: {
      label: 'Oui',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: 'bg-success-bg text-success border border-success/20',
    },
    NON: {
      label: 'Non',
      icon: <XCircle className="h-3.5 w-3.5" />,
      className: 'bg-danger-bg text-danger border border-danger/20',
    },
    EN_ATTENTE: {
      label: 'En attente',
      icon: <Clock className="h-3.5 w-3.5" />,
      className: 'bg-warning-bg text-warning border border-warning/20',
    },
    NON_CONTACTE: {
      label: 'Jamais contacté',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      className: 'bg-gray-50 text-gray-500 border border-gray-200',
    },
  }[response]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  )
}

function ConfirmModal({
  count,
  onConfirm,
  onCancel,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-light">
          <Send className="h-5 w-5 text-blue" />
        </div>
        <h3 className="text-[18px] font-bold text-gray-900 mb-1">
          Confirmer l'envoi
        </h3>
        <p className="text-[13px] text-gray-500 mb-6">
          Vous allez envoyer un email de relance à{' '}
          <span className="font-semibold text-gray-900">{count} apprenants</span>{' '}
          ayant le statut <span className="font-semibold text-gray-900">Actif</span>.
          Chaque apprenant recevra un lien personnel pour confirmer ou infirmer sa recherche.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button className="flex-1" leftIcon={<Send className="h-4 w-4" />} onClick={onConfirm}>
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: RelanceCampaign }) {
  const responseRate = Math.round(((campaign.oui + campaign.non) / campaign.total) * 100)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-light shrink-0">
          <Send className="h-4 w-4 text-blue" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-900">{formatDate(campaign.sentAt)}</p>
          <p className="text-[11px] text-gray-400">{campaign.total} emails envoyés</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-[13px] font-bold">{campaign.oui}</span>
          <span className="text-[11px] text-success/70">Oui</span>
        </div>
        <div className="flex items-center gap-1.5 text-danger">
          <XCircle className="h-4 w-4" />
          <span className="text-[13px] font-bold">{campaign.non}</span>
          <span className="text-[11px] text-danger/70">Non</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock className="h-4 w-4" />
          <span className="text-[13px] font-bold">{campaign.noResponse}</span>
          <span className="text-[11px] text-gray-400">Sans réponse</span>
        </div>

        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[13px] font-bold text-gray-900">{responseRate}%</span>
          <span className="text-[10px] text-gray-400">taux de réponse</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Relance() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [showHistory, setShowHistory] = useState(true)

  const candidats = MOCK_CANDIDATS
  const campaigns = MOCK_CAMPAIGNS

  const stats = {
    total: candidats.length,
    oui: candidats.filter((c) => c.lastRelanceResponse === 'OUI').length,
    non: candidats.filter((c) => c.lastRelanceResponse === 'NON').length,
    enAttente: candidats.filter((c) => c.lastRelanceResponse === 'EN_ATTENTE').length,
    nonContacte: candidats.filter((c) => c.lastRelanceResponse === 'NON_CONTACTE').length,
  }

  const handleConfirmSend = () => {
    setConfirmOpen(false)
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    }, 1800)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">
              RH · Suivi
            </p>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
              Relance apprenants
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-400">
              {stats.total} apprenant{stats.total > 1 ? 's' : ''} en recherche active d'entreprise.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {sent && (
              <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-bg px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-[13px] font-semibold text-success">Emails envoyés !</span>
              </div>
            )}
            <Button
              leftIcon={sending ? undefined : <Send className="h-4 w-4" />}
              isLoading={sending}
              onClick={() => setConfirmOpen(true)}
              className="rounded-xl shadow-[0_2px_8px_-2px_rgba(17,48,167,0.30)]"
            >
              Envoyer un mail à tous
            </Button>
          </div>
        </div>

        {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Total actifs */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue/5 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-light text-blue">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-gray-500">Apprenants actifs</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-gray-900">{stats.total}</span>
              <span className="text-[12px] font-medium text-gray-400 mb-1">en recherche</span>
            </div>
          </div>

          {/* Oui */}
          <div className="rounded-2xl border border-success/10 bg-success-bg/30 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-success/10 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-success/20 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-success/80">Toujours en recherche</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-success">{stats.oui}</span>
              <span className="text-[12px] font-medium text-success/60 mb-1">confirmés</span>
            </div>
          </div>

          {/* Non */}
          <div className="rounded-2xl border border-danger/10 bg-danger-bg/30 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-danger/10 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-danger/20 text-danger">
                <XCircle className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-danger/80">Plus en recherche</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-danger">{stats.non}</span>
              <span className="text-[12px] font-medium text-danger/60 mb-1">à désactiver</span>
            </div>
          </div>

          {/* En attente */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-gray-300/20 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-200 text-gray-500">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-gray-600">Sans réponse</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-gray-900">
                {stats.enAttente + stats.nonContacte}
              </span>
              <span className="text-[12px] font-medium text-gray-500 mb-1">en attente</span>
            </div>
          </div>
        </div>

        {/* ─── Candidats Table ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              <h2 className="text-[18px] font-bold text-gray-900">
                Apprenants actifs
              </h2>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[2fr_2fr_1fr_1fr_1.5fr] gap-4 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Apprenant</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Contact</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">TP</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Dernière relance</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Réponse</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-50">
              {candidats.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_1fr_1.5fr] gap-3 sm:gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white text-[12px] font-bold shrink-0"
                      style={{ backgroundColor: '#1130A7' }}
                    >
                      {getInitials(c.fullName)}
                    </span>
                    <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                      {c.fullName}
                    </span>
                  </div>

                  {/* Contact */}
                  <div className="flex flex-col justify-center sm:ml-0 ml-12">
                    <span className="text-[12px] text-gray-600 leading-snug">{c.email}</span>
                    <span className="text-[11px] text-gray-400">{c.phone}</span>
                  </div>

                  {/* TP */}
                  <div className="flex items-center sm:ml-0 ml-12">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${TP_COLORS[c.tp]}`}>
                      {TP_LABELS[c.tp]}
                    </span>
                  </div>

                  {/* Last relance date */}
                  <div className="flex items-center sm:ml-0 ml-12">
                    {c.lastRelanceDate ? (
                      <span className="text-[12px] text-gray-500">
                        {formatDate(c.lastRelanceDate)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-gray-300 italic">—</span>
                    )}
                  </div>

                  {/* Response badge */}
                  <div className="flex items-center sm:ml-0 ml-12">
                    <RelanceBadge response={c.lastRelanceResponse} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Campaign History ─────────────────────────────────────────────── */}
        <div>
          <button
            className="mb-4 flex items-center gap-2 w-full text-left group"
            onClick={() => setShowHistory((v) => !v)}
          >
            <Mail className="h-5 w-5 text-gray-400" />
            <h2 className="text-[18px] font-bold text-gray-900 flex-1">
              Historique des campagnes
            </h2>
            <span className="text-[12px] font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
              {campaigns.length} campagne{campaigns.length > 1 ? 's' : ''}
            </span>
            {showHistory
              ? <ChevronUp className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>

          {showHistory && (
            <div className="flex flex-col gap-3">
              {campaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ─── Confirm Modal ────────────────────────────────────────────────── */}
      {confirmOpen && (
        <ConfirmModal
          count={candidats.length}
          onConfirm={handleConfirmSend}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
