import { useState } from 'react'
import { Bell, Mail, Building2, CalendarClock, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import type { Entreprise } from '@/types/entreprise'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio } from '@/graphql/useInitializePortfolio'
import { useUpdateCompany } from '@/graphql/hooks'
import { useCommercialMailTemplatesStore } from '@/store/mailTemplatesStore'
import { getRelanceType, computeRelanceDate } from '@/types/relance'
import { toCompany } from '@/types/companyMapper'
import { toSlug } from '@/utils/slug'
import Button from '@/components/ui/Button'
import MailModal from '@/components/ui/MailModal'

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: fr })
  } catch {
    return iso
  }
}

export default function RelanceCommercial() {
  const navigate = useNavigate()
  const companies = usePortefeuilleStore((s) => s.companies)
  const { loading } = useInitializePortfolio(200)
  const { update } = useUpdateCompany()
  const templates = useCommercialMailTemplatesStore((s) => s.templates)

  const [mailFor, setMailFor] = useState<Entreprise | null>(null)
  const [rescheduling, setRescheduling] = useState<string | null>(null)

  // Local date (not UTC) so a relance set for "today" is due all day in the user's timezone
  const today = format(new Date(), 'yyyy-MM-dd')
  const withRelance = companies.filter((c) => c.date_relance)
  const due = withRelance
    .filter((c) => c.date_relance! <= today)
    .sort((a, b) => a.date_relance!.localeCompare(b.date_relance!))
  const upcoming = withRelance
    .filter((c) => c.date_relance! > today)
    .sort((a, b) => a.date_relance!.localeCompare(b.date_relance!))

  async function reschedule(ent: Entreprise) {
    if (!ent.type_relance) return
    setRescheduling(ent.id)
    const next = { ...ent, date_relance: computeRelanceDate(ent.type_relance) }
    await update(Number(ent.id), toCompany(next))
    setRescheduling(null)
  }

  function Row({ ent, isDue }: { ent: Entreprise; isDue: boolean }) {
    const type = getRelanceType(ent.type_relance)
    const template = templates.find((t) => t.id === ent.relance_template_id)
    return (
      <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4 hover:border-blue/20 transition-colors">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light">
          <Building2 className="h-5 w-5 text-blue" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/commercial/portefeuille/${toSlug(ent.nom_commercial ?? ent.id)}`, { state: { entreprise: ent } })}
            className="font-semibold text-gray-900 truncate hover:text-blue transition-colors text-left"
          >
            {ent.nom_commercial ?? 'Entreprise sans nom'}
          </button>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${isDue ? 'text-red-600' : 'text-gray-500'}`}>
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDate(ent.date_relance)}
            </span>
            {type && (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${type.badge.bg} ${type.badge.text}`}>
                {type.label}
              </span>
            )}
            {template && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Mail className="h-3 w-3" />
                {template.name}
              </span>
            )}
            {!ent.email && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Mail className="h-3 w-3" />
                E-mail manquant
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ent.type_relance && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              isLoading={rescheduling === ent.id}
              onClick={() => reschedule(ent)}
              title="Replanifier à la prochaine échéance du type"
            >
              Replanifier
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Mail className="h-3.5 w-3.5" />}
            disabled={!ent.email}
            onClick={() => setMailFor(ent)}
            title={ent.email ? 'Préparer le brouillon de relance' : 'Pas d’email renseigné'}
          >
            Préparer le mail
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Relances entreprises</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Prépare les brouillons de relance — le mail part dans tes brouillons Gmail, à toi de l'envoyer
        </p>
      </div>

      {loading && companies.length === 0 ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : (
        <>
          {/* À relancer */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-widest flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-500" />
              À relancer ({due.length})
            </h2>
            {due.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                Aucune relance en retard 🎉
              </div>
            ) : (
              due.map((ent) => <Row key={ent.id} ent={ent} isDue />)
            )}
          </section>

          {/* À venir */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-widest flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue" />
              À venir ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
                Aucune relance planifiée
              </div>
            ) : (
              upcoming.map((ent) => <Row key={ent.id} ent={ent} isDue={false} />)
            )}
          </section>
        </>
      )}

      {mailFor && (
        <MailModal
          defaultTo={mailFor.email ?? ''}
          candidateName={mailFor.nom_commercial ?? undefined}
          scope="commercial"
          mode="draft"
          defaultTemplateId={mailFor.relance_template_id ?? undefined}
          onClose={() => setMailFor(null)}
        />
      )}
    </div>
  )
}
