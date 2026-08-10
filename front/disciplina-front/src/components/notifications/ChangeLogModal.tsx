import { useEffect } from 'react'
import {
  X,
  Megaphone,
  Sparkles,
  Wrench,
  TriangleAlert,
  Bug,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import type { ChangeLogRelease, ChangeLogCategory } from '@/lib/changelog'

interface ChangeLogModalProps {
  /** Versions à afficher (envoyées par l'appelant au moment de l'ouverture). */
  releases: ChangeLogRelease[]
  /** Accent de l'espace courant (ex. "#60207E"), utilisé pour le badge de version. */
  accent?: string
  onClose: () => void
}

const CATEGORY_META: Record<ChangeLogCategory, { icon: LucideIcon; label: string; chip: string }> = {
  Added: { icon: Sparkles, label: 'Ajouts', chip: 'bg-green-50 text-green-700' },
  Changed: { icon: Wrench, label: 'Modifications', chip: 'bg-blue-50 text-blue-700' },
  Deprecated: { icon: TriangleAlert, label: 'Déprécié', chip: 'bg-amber-50 text-amber-700' },
  Fixed: { icon: Bug, label: 'Corrections', chip: 'bg-red-50 text-red-700' },
  Security: { icon: ShieldCheck, label: 'Sécurité', chip: 'bg-purple-50 text-purple-700' },
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
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
              <Megaphone size={16} />
            </span>
            <h2 className="text-base font-semibold text-gray-900">Nouveautés</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {releases.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Aucune nouveauté récente.</p>
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
                    {release.date && <span className="text-xs font-medium text-gray-400">{formatDate(release.date)}</span>}
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
                            <Icon size={12} />
                            {meta.label}
                          </span>
                        </div>
                        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-gray-700">
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

        <div className="flex shrink-0 justify-end border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}