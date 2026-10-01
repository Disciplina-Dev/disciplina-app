import { useEffect } from 'react'
import { IconAnnounce, IconBug, IconClose, IconShieldCheck, IconSparkles, IconTools, IconWarning, type IconComponent } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import type { ChangeLogRelease, ChangeLogCategory } from '@/lib/changelog'

interface ChangeLogModalProps {
  /** Versions à afficher (envoyées par l'appelant au moment de l'ouverture). */
  releases: ChangeLogRelease[]
  /** Accent de l'espace courant (ex. "#60207E"), utilisé pour le badge de version. */
  accent?: string
  onClose: () => void
}

const CATEGORY_META: Record<ChangeLogCategory, { icon: IconComponent; label: string; chip: string }> = {
  Added: { icon: IconSparkles, label: 'Ajouts', chip: 'bg-[var(--ds-success-bg)] text-[var(--ds-success)]' },
  Changed: { icon: IconTools, label: 'Modifications', chip: 'bg-[var(--ds-accent-soft)] text-[var(--ds-accent)]' },
  Deprecated: { icon: IconWarning, label: 'Déprécié', chip: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]' },
  Fixed: { icon: IconBug, label: 'Corrections', chip: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]' },
  Security: { icon: IconShieldCheck, label: 'Sécurité', chip: 'bg-purple-50 text-purple-700' },
}

const CATEGORY_ORDER: ChangeLogCategory[] = ['Added', 'Changed', 'Deprecated', 'Fixed', 'Security']

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR')
}

export default function ChangeLogModal({ releases, accent = '#60207E', onClose }: ChangeLogModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-[var(--ds-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
              <IconAnnounce width={16} height={16} />
            </span>
            <h2 className="text-base font-semibold text-[var(--ds-text)]">Nouveautés</h2>
          </div>
          <button onClick={onClose} className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-text-muted)] transition-colors" aria-label="Fermer">
            <IconClose width={20} height={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {releases.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--ds-text-subtle)]">Aucune nouveauté récente.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {releases.map((release) => (
                <section key={release.version} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      v{release.version}
                    </span>
                    {release.date && <span className="text-xs font-medium text-[var(--ds-text-subtle)]">{formatDate(release.date)}</span>}
                  </div>

                  {CATEGORY_ORDER.map((category) => {
                    const items = release.changes[category]
                    if (!items || items.length === 0) return null
                    const meta = CATEGORY_META[category]
                    const Icon = meta.icon
                    return (
                      <div key={category} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.chip}`}>
                            <Icon width={12} height={12} />
                            {meta.label}
                          </span>
                        </div>
                        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-[var(--ds-text-muted)]">
                          {items.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}