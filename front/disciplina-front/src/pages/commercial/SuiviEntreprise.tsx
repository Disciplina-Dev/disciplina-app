import CompanyDirectory from '@/features/entreprises/CompanyDirectory'

/**
 * Suivi entreprise — annuaire des entreprises issues des analyses de besoin,
 * organisé par offre : pastille de suivi, immersions, date d'activation,
 * références France Travail / KOANN et historique.
 */
export default function SuiviEntreprise() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-subtle)]">
            CRM Commercial
          </p>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ds-text)]">
            Suivi entreprise
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--ds-text-subtle)]">
            Annuaire des entreprises issues des analyses de besoin : suivi, immersions et historique.
          </p>
        </div>

        <CompanyDirectory variant="page" mode="commercial" />
      </div>
    </div>
  )
}
