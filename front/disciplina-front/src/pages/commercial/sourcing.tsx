import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  X,
  Copy,
  Check,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const API_BASE = 'http://localhost:4000'
const LS_KEY = 'siret_recents_v1'
const EXAMPLES = ['80339671900027', '91234567800019', '39282471400025']
const MAX_RECENTS = 4

interface SireneAdresse {
  numeroVoie: string | null
  typeVoie: string | null
  libelleVoie: string | null
  codePostal: string | null
  commune: string | null
  codeCommune: string | null
}

interface SireneEtablissement {
  siren: string
  nic: string
  siret: string
  siegeSocial: boolean
  etatAdministratif: 'A' | 'F'
  categorieEntreprise: string | null
  categorieJuridique: string | null
  denomination: string | null
  nomPrenom: string | null
  adresse: SireneAdresse
  alreadyExists?: boolean
}

interface RecentEntry {
  name: string
  siret: string
}

interface SireneListHeader {
  total: number
  debut: number
  nombre: number
}

interface SireneListResult {
  header: SireneListHeader
  etablissements: SireneEtablissement[]
}

type View = 'empty' | 'loading' | 'result' | 'notfound'
type ErrKind = 'invalid' | 'missing' | 'server' | 'none'
type CommuneView = 'empty' | 'loading' | 'results' | 'notfound' | 'error'

const normalizeSiret = (raw: string): string => (raw || '').replace(/\D/g, '')

const formatSiret = (digits: string): string => {
  const d = normalizeSiret(digits)
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 14)].filter(Boolean)
  return parts.join(' ')
}

const formatSiren = (digits: string): string => {
  const d = normalizeSiret(digits)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ')
}

const displayName = (e: SireneEtablissement): string =>
  (e.denomination || e.nomPrenom || 'Établissement').trim()

const displayCity = (a: SireneAdresse): string => {
  if (!a.commune && !a.codePostal) return ''
  if (a.commune && a.codePostal) return `${a.commune} (${a.codePostal})`
  return a.commune || a.codePostal || ''
}

const displayAddress = (a: SireneAdresse): string => {
  const street = [a.numeroVoie, a.typeVoie, a.libelleVoie].filter(Boolean).join(' ').trim()
  const city = displayCity(a)
  return [street, city].filter(Boolean).join(', ')
}

const LEGAL_FORMS: Record<string, string> = {
  '5710': 'SAS',
  '5720': 'SASU',
  '5499': 'SARL',
  '5498': 'SARL',
  '5599': 'SA',
  '5505': 'SA',
  '1000': 'Entrepreneur individuel',
  '5410': 'SARL',
  '5710_LABEL': 'Société par actions simplifiée',
}

function legalFormShort(code: string | null): string {
  if (!code) return '—'
  return LEGAL_FORMS[code] || code
}

async function fetchCompaniesByCommune(commune: string, token: string | null): Promise<SireneListResult> {
  const encoded = encodeURIComponent(commune.trim())
  const res = await fetch(`${API_BASE}/api/sourcing/${encoded}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (res.status === 404) throw new Error('notfound')
  if (!res.ok) throw new Error('server')
  return (await res.json()) as SireneListResult
}

function SiretSearchBar({ value, onChange, onSubmit, busy, error }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; error: boolean
}) {
  const digits = normalizeSiret(value)
  return (
    <form
      className={[
        'flex items-center gap-2.5 bg-white border-[1.5px] rounded-[14px] py-[7px] pl-[14px] pr-2 transition-[border-color,box-shadow] duration-[180ms]',
        error
          ? 'border-danger shadow-[0_0_0_4px_var(--color-danger-bg)]'
          : 'border-gray-100 focus-within:border-blue focus-within:shadow-[0_0_0_4px_var(--color-blue-light)]',
      ].join(' ')}
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      <span className={['flex', error ? 'text-danger' : 'text-gray-500'].join(' ')}>
        <Search className="w-5 h-5" />
      </span>
      <input
        className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-gray-900 placeholder:text-gray-300 placeholder:font-normal"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Entrez un numéro SIRET (14 chiffres)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="font-mono text-[12px] text-gray-300 flex-shrink-0">{digits.length}/14</span>
      {value && (
        <button
          type="button"
          className="flex border-0 bg-gray-50 text-gray-500 w-[26px] h-[26px] rounded-full items-center justify-center cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onChange('')}
          aria-label="Effacer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-1.5 flex-shrink-0 border-0 cursor-pointer bg-blue text-white font-semibold text-[14px] py-[9px] px-4 rounded-[10px] min-w-[120px] justify-center hover:bg-blue-dark active:translate-y-[1px] disabled:opacity-85 disabled:cursor-default max-sm:min-w-[46px] max-sm:px-[9px]"
      >
        {busy
          ? <span className="w-4 h-4 border-2 border-white/45 border-t-white rounded-full animate-spin" />
          : <><span className="max-sm:hidden">Rechercher</span><ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  )
}

interface CopyFieldProps {
  label: string
  value: string
  mono?: boolean
  wide?: boolean
}

function CopyField({ label, value, mono, wide }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(value.replace(/\s/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return (
    <div className={['bg-white py-[18px] px-[26px]', wide ? 'col-span-full' : ''].join(' ')}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
        {label}
      </span>
      <button
        className="group inline-flex items-center gap-[9px] mt-2 border-0 bg-transparent cursor-pointer p-0 text-[18px] font-semibold text-gray-900"
        onClick={copy}
        title="Copier"
      >
        <span className={mono ? 'font-mono tracking-[-0.01em]' : ''}>{value}</span>
        <span
          className={[
            'flex transition-colors duration-150',
            copied ? 'text-success' : 'text-gray-300 group-hover:text-blue',
          ].join(' ')}
        >
          {copied ? <Check className="w-[15px] h-[15px]" /> : <Copy className="w-[15px] h-[15px]" />}
        </span>
      </button>
    </div>
  )
}

function ResultCard({ data }: { data: SireneEtablissement }) {
  const closed = data.etatAdministratif === 'F'
  const name = displayName(data)
  const legalShort = legalFormShort(data.categorieJuridique)
  const city = displayCity(data.adresse)
  const address = displayAddress(data.adresse)

  return (
    <article className="bg-white border border-gray-100 rounded-[20px] shadow-[0_1px_2px_rgba(13,13,13,0.04),0_8px_28px_rgba(13,13,13,0.06)] overflow-hidden animate-[rise_0.34s_cubic-bezier(0.2,0.7,0.3,1)_both]">
      <div className="flex items-center gap-4 py-6 px-[26px] bg-gradient-to-b from-blue-light to-white border-b border-gray-100">
        <span className="w-[52px] h-[52px] flex-shrink-0 rounded-[10px] bg-blue text-white flex items-center justify-center">
          <Building2 className="w-[26px] h-[26px]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-[24px] font-extrabold text-black tracking-[-0.02em] leading-[1.1]">
              {name}
            </h2>
            {data.categorieJuridique && (
              <span className="text-[12px] font-bold py-[3px] px-[9px] rounded-full bg-purple-light text-purple tracking-[0.01em]">
                {legalShort}
              </span>
            )}
          </div>
          {(city || data.siegeSocial) && (
            <p className="text-[13.5px] text-gray-500 mt-[5px] font-normal">
              {data.siegeSocial && <>Siège social{city ? ' · ' : ''}</>}
              {city}
            </p>
          )}
        </div>
        <span
          className={[
            'inline-flex items-center gap-1.5 flex-shrink-0 text-[12.5px] font-semibold py-[5px] px-[11px] rounded-full',
            closed ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success',
          ].join(' ')}
        >
          <span
            className={[
              'w-[7px] h-[7px] rounded-full',
              closed ? 'bg-danger' : 'bg-success',
            ].join(' ')}
          />
          {closed ? 'Cessée' : 'En activité'}
        </span>
        {data.alreadyExists && (
          <span className="inline-flex items-center gap-1.5 flex-shrink-0 text-[12.5px] font-semibold py-[5px] px-[11px] rounded-full bg-[#FFF3CD] text-[#856404]">
            Déjà dans le portefeuille
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 max-sm:grid-cols-1">
        <CopyField label="SIREN" value={formatSiren(data.siren)} mono />
        <CopyField label="SIRET (siège)" value={formatSiret(data.siret)} mono />
        {address && (
          <div className="bg-white py-[18px] px-[26px] col-span-full">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Adresse
            </span>
            <p className="mt-2 text-[15px] font-medium text-gray-900">{address}</p>
          </div>
        )}
        {data.categorieEntreprise && (
          <div className="bg-white py-[18px] px-[26px]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Catégorie d'entreprise
            </span>
            <p className="mt-2 text-[15px] font-medium text-gray-900">{data.categorieEntreprise}</p>
          </div>
        )}
        {data.categorieJuridique && (
          <div className="bg-white py-[18px] px-[26px]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-500">
              Forme juridique
            </span>
            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <span className="text-[18px] font-semibold text-blue bg-blue-light py-[2px] px-[9px] rounded-[6px] font-mono">
                {data.categorieJuridique}
              </span>
              <span className="text-[15px] font-medium text-gray-900">{legalShort}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function Skeleton() {
  const sk = 'block rounded-[6px] bg-[linear-gradient(90deg,var(--color-gray-50)_25%,var(--color-gray-100)_37%,var(--color-gray-50)_63%)] bg-[length:400%_100%] animate-[shimmer_1.3s_ease-in-out_infinite]'
  return (
    <article
      className="bg-white border border-gray-100 rounded-[20px] shadow-[0_1px_2px_rgba(13,13,13,0.04),0_8px_28px_rgba(13,13,13,0.06)] overflow-hidden"
      aria-busy="true"
    >
      <div className="flex items-center gap-4 py-6 px-[26px] bg-gradient-to-b from-blue-light to-white border-b border-gray-100">
        <span className={`${sk} w-[52px] h-[52px] rounded-[10px] flex-shrink-0`} />
        <div className="flex-1">
          <span className={sk} style={{ width: '46%', height: 22 }} />
          <span className={sk} style={{ width: '62%', height: 13, marginTop: 12 }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-gray-100 max-sm:grid-cols-1">
        {[0, 1].map((i) => (
          <div className="bg-white py-[18px] px-[26px]" key={i}>
            <span className={sk} style={{ width: 60, height: 11 }} />
            <span className={sk} style={{ width: '80%', height: 18, marginTop: 10 }} />
          </div>
        ))}
        <div className="bg-white py-[18px] px-[26px] col-span-full">
          <span className={sk} style={{ width: 120, height: 11 }} />
          <span className={sk} style={{ width: '70%', height: 18, marginTop: 10 }} />
        </div>
      </div>
    </article>
  )
}

interface NotFoundProps {
  kind: ErrKind
  query: string
}

function NotFound({ kind, query }: NotFoundProps) {
  let title = 'Aucun établissement trouvé'
  let body: React.ReactNode = (
    <>
      Aucune entreprise ne correspond au SIRET <b className="font-mono font-semibold text-gray-900">{query}</b> dans le registre INSEE.
    </>
  )
  if (kind === 'invalid') {
    title = 'Numéro SIRET incomplet'
    body = 'Un SIRET valide comporte exactement 14 chiffres. Vérifiez la saisie et réessayez.'
  } else if (kind === 'server') {
    title = 'Erreur de connexion au registre'
    body = "Impossible d'interroger le registre INSEE pour le moment. Réessayez dans quelques instants."
  }

  return (
    <div className="text-center py-11 px-6 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
      <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
        <AlertTriangle className="w-7 h-7" />
      </span>
      <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">{title}</h3>
      <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">{body}</p>
    </div>
  )
}

interface EmptyStateProps {
  recents: RecentEntry[]
  examples: string[]
  onPick: (siret: string) => void
  onClearRecents: () => void
}

function EmptyState({ recents, examples, onPick, onClearRecents }: EmptyStateProps) {
  return (
    <div className="text-center py-11 px-6 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
      <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-blue-light text-blue">
        <Search className="w-7 h-7" />
      </span>
      <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">
        Recherchez une entreprise
      </h3>
      <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
        Saisissez un numéro SIRET à 14 chiffres pour afficher la dénomination, la forme juridique et l'adresse.
      </p>

      <div className="flex items-center justify-center gap-2 flex-wrap mt-[26px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-300">
          Exemples
        </span>
        {examples.map((s) => (
          <button
            key={s}
            type="button"
            className="border border-gray-100 bg-white text-gray-700 text-[13px] font-semibold py-[7px] px-3 rounded-full cursor-pointer transition-all duration-150 font-mono tracking-[-0.01em] hover:border-blue hover:text-blue hover:bg-blue-light"
            onClick={() => onPick(s)}
          >
            {formatSiret(s)}
          </button>
        ))}
      </div>

      {recents.length > 0 && (
        <div className="mt-[34px] text-left">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="flex items-center gap-[7px] text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-500">
              <Clock className="w-[15px] h-[15px]" /> Recherches récentes
            </span>
            <button
              type="button"
              className="border-0 bg-transparent text-blue font-semibold text-[13px] cursor-pointer hover:text-blue-dark"
              onClick={onClearRecents}
            >
              Effacer
            </button>
          </div>
          <ul className="list-none flex flex-col gap-2 p-0">
            {recents.map((r) => (
              <li key={r.siret}>
                <button
                  type="button"
                  className="w-full flex items-center gap-[13px] text-left cursor-pointer bg-white border border-gray-100 rounded-[10px] py-3 px-3.5 transition-all duration-150 hover:border-blue hover:shadow-[0_4px_14px_rgba(17,48,167,0.08)] hover:-translate-y-px"
                  onClick={() => onPick(r.siret)}
                >
                  <span className="w-[34px] h-[34px] flex-shrink-0 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <span className="flex-1 flex flex-col gap-[2px] min-w-0">
                    <span className="text-[14.5px] font-semibold text-gray-900">{r.name}</span>
                    <span className="text-[12.5px] text-gray-500 font-mono tracking-[-0.01em]">
                      {formatSiret(r.siret)}
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ModeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-5 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 border',
        active
          ? 'bg-blue text-white border-blue shadow-[0_2px_8px_-2px_rgba(17,48,167,0.35)]'
          : 'bg-white text-gray-500 border-gray-100 hover:border-blue/30 hover:text-blue',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function CommuneSearchBar({ value, onChange, onSubmit, busy }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean
}) {
  return (
    <form
      className="flex items-center gap-2.5 bg-white border-[1.5px] border-gray-100 rounded-[14px] py-[7px] pl-[14px] pr-2 transition-[border-color,box-shadow] duration-[180ms] focus-within:border-blue focus-within:shadow-[0_0_0_4px_var(--color-blue-light)]"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      <span className="flex text-gray-500"><Search className="w-5 h-5" /></span>
      <input
        className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-gray-900 placeholder:text-gray-300 placeholder:font-normal"
        placeholder="Nom de la commune (ex : Saint-Denis)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="flex border-0 bg-gray-50 text-gray-500 w-[26px] h-[26px] rounded-full items-center justify-center cursor-pointer flex-shrink-0 hover:bg-gray-100 hover:text-gray-900"
          onClick={() => onChange('')}
          aria-label="Effacer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="flex items-center gap-1.5 flex-shrink-0 border-0 cursor-pointer bg-blue text-white font-semibold text-[14px] py-[9px] px-4 rounded-[10px] min-w-[120px] justify-center hover:bg-blue-dark active:translate-y-[1px] disabled:opacity-85 disabled:cursor-default max-sm:min-w-[46px] max-sm:px-[9px]"
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-white/45 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span className="max-sm:hidden">Rechercher</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}

function CommuneSkeleton() {
  const sk = 'block rounded-[6px] bg-[linear-gradient(90deg,var(--color-gray-50)_25%,var(--color-gray-100)_37%,var(--color-gray-50)_63%)] bg-[length:400%_100%] animate-[shimmer_1.3s_ease-in-out_infinite]'
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-[14px] px-5 py-4 flex items-center gap-4">
          <span className={`${sk} w-9 h-9 rounded-[8px] flex-shrink-0`} />
          <div className="flex-1">
            <span className={sk} style={{ width: '50%', height: 15 }} />
            <span className={sk} style={{ width: '35%', height: 12, marginTop: 8 }} />
          </div>
          <span className={sk} style={{ width: 70, height: 24, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  )
}

function CommuneResultList({ result }: { result: SireneListResult }) {
  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4 text-center">
        <span className="font-semibold text-gray-900">{result.header.nombre}</span>{' '}
        établissement{result.header.nombre !== 1 ? 's' : ''} affiché{result.header.nombre !== 1 ? 's' : ''} sur{' '}
        <span className="font-semibold text-gray-900">{result.header.total.toLocaleString('fr-FR')}</span> trouvés
      </p>
      <div className="flex flex-col gap-2">
        {result.etablissements.map((e) => {
          const closed = e.etatAdministratif === 'F'
          const name = displayName(e)
          const city = displayCity(e.adresse)
          return (
            <div
              key={e.siret}
              className="bg-white border border-gray-100 rounded-[14px] px-5 py-4 flex items-center gap-4 shadow-[0_1px_4px_rgba(13,13,13,0.04)] animate-[rise_0.2s_ease_both]"
            >
              <span className="w-9 h-9 flex-shrink-0 rounded-[8px] bg-blue-light text-blue flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 truncate">{name}</p>
                <p className="text-[12.5px] text-gray-500 font-mono tracking-[-0.01em]">
                  {formatSiret(e.siret)}{city ? ` · ${city}` : ''}
                </p>
              </div>
              <span
                className={[
                  'inline-flex items-center gap-1.5 text-[12px] font-semibold py-1 px-2.5 rounded-full flex-shrink-0',
                  closed ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success',
                ].join(' ')}
              >
                <span className={['w-[6px] h-[6px] rounded-full', closed ? 'bg-danger' : 'bg-success'].join(' ')} />
                {closed ? 'Cessée' : 'En activité'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Sourcing() {
  const token = useAuthStore((s) => s.token)

  // SIRET mode state
  const [mode, setMode] = useState<'siret' | 'commune'>('siret')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('empty')
  const [result, setResult] = useState<SireneEtablissement | null>(null)
  const [errKind, setErrKind] = useState<ErrKind>('none')

  // Commune mode state
  const [communeQuery, setCommuneQuery] = useState('')
  const [communeView, setCommuneView] = useState<CommuneView>('empty')
  const [communeResult, setCommuneResult] = useState<SireneListResult | null>(null)
  const [recents, setRecents] = useState<RecentEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? (JSON.parse(raw) as RecentEntry[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(recents))
    } catch {
      /* ignore */
    }
  }, [recents])

  const pushRecent = useCallback((e: SireneEtablissement) => {
    const entry: RecentEntry = { name: displayName(e), siret: normalizeSiret(e.siret) }
    setRecents((prev) => {
      const next = [entry, ...prev.filter((r) => r.siret !== entry.siret)]
      return next.slice(0, MAX_RECENTS)
    })
  }, [])

  const run = useCallback(
    async (raw: string) => {
      const digits = normalizeSiret(raw)
      if (digits.length !== 14) {
        setErrKind('invalid')
        setView('notfound')
        return
      }
      setErrKind('none')
      setView('loading')
      try {
        const res = await fetch(`${API_BASE}/api/sourcing/${digits}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (res.status === 404) {
          setErrKind('missing')
          setView('notfound')
          return
        }
        if (!res.ok) {
          setErrKind('server')
          setView('notfound')
          return
        }
        const data = (await res.json()) as SireneEtablissement
        setResult(data)
        setView('result')
        pushRecent(data)
      } catch {
        setErrKind('server')
        setView('notfound')
      }
    },
    [token, pushRecent]
  )

  const runCommune = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setCommuneView('loading')
    try {
      const data = await fetchCompaniesByCommune(trimmed, token)
      setCommuneResult(data)
      setCommuneView(data.etablissements.length > 0 ? 'results' : 'notfound')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'server'
      setCommuneView(msg === 'notfound' ? 'notfound' : 'error')
    }
  }, [token])

  const submit = () => run(query)

  const pick = (siret: string) => {
    setQuery(formatSiret(siret))
    run(siret)
  }

  const onChange = (v: string) => {
    setQuery(v)
    if (view !== 'empty') {
      setView('empty')
      setErrKind('none')
    }
  }

  return (
    <div className="min-h-full bg-background">
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      `}</style>
      <main className="max-w-[760px] mx-auto px-6 pt-10 pb-20">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          <ModeTab active={mode === 'siret'} label="Recherche par SIRET" onClick={() => setMode('siret')} />
          <ModeTab active={mode === 'commune'} label="Recherche par commune" onClick={() => setMode('commune')} />
        </div>

        {/* SIRET mode */}
        {mode === 'siret' && (
          <>
            <div className="mb-6">
              <SiretSearchBar
                value={query}
                onChange={onChange}
                onSubmit={submit}
                busy={view === 'loading'}
                error={view === 'notfound' && errKind === 'invalid'}
              />
            </div>
            {view === 'loading' && <Skeleton />}
            {view === 'result' && result && <ResultCard data={result} />}
            {view === 'notfound' && <NotFound kind={errKind} query={formatSiret(query)} />}
            {view === 'empty' && (
              <EmptyState
                recents={recents}
                examples={EXAMPLES}
                onPick={pick}
                onClearRecents={() => setRecents([])}
              />
            )}
          </>
        )}

        {/* Commune mode */}
        {mode === 'commune' && (
          <div>
            <div className="mb-6">
              <CommuneSearchBar
                value={communeQuery}
                onChange={(v) => { setCommuneQuery(v); if (communeView !== 'empty') setCommuneView('empty') }}
                onSubmit={() => runCommune(communeQuery)}
                busy={communeView === 'loading'}
              />
            </div>
            {communeView === 'empty' && (
              <div className="text-center py-11 animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-blue-light text-blue">
                  <Building2 className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">Recherchez par commune</h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Saisissez le nom d'une commune pour lister les établissements enregistrés dans le registre INSEE.
                </p>
              </div>
            )}
            {communeView === 'loading' && <CommuneSkeleton />}
            {communeView === 'results' && communeResult && <CommuneResultList result={communeResult} />}
            {communeView === 'notfound' && (
              <div className="text-center py-11 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
                  <AlertTriangle className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">Commune introuvable</h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Aucun établissement trouvé pour cette commune dans le registre INSEE.
                </p>
              </div>
            )}
            {communeView === 'error' && (
              <div className="text-center py-11 max-w-[520px] mx-auto animate-[rise_0.3s_ease_both]">
                <span className="w-[60px] h-[60px] rounded-[14px] mx-auto mb-5 flex items-center justify-center bg-danger-bg text-danger">
                  <AlertTriangle className="w-7 h-7" />
                </span>
                <h3 className="text-[21px] font-bold text-black tracking-[-0.01em]">Erreur de connexion</h3>
                <p className="text-[14.5px] text-gray-500 mt-[9px] leading-[1.55]">
                  Impossible d'interroger le registre INSEE. Réessayez dans quelques instants.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
