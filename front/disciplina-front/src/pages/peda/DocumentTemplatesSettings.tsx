import { useEffect, useState } from 'react'
import { IconCheckCircle, IconLoader, IconPlus, IconSave, IconSettings, IconTrash } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import {
  createAlternantDocumentTemplate,
  deleteAlternantDocumentTemplate,
  fetchAlternantDocumentTemplates,
  updateAlternantDocumentTemplate,
} from '@/api/alternantDocumentTemplates'
import type { AlternantDocumentTemplate } from '@/types/alternantDocumentTemplate'

const inputClass =
  'w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none focus:border-purple transition-colors'

const SYSTEM_LABELS: Record<string, string> = {
  j15: 'J+15 — Prise de contact',
  j10w: 'J+10 semaines — Fin de période d’essai',
}

interface TemplateCardProps {
  template: AlternantDocumentTemplate
  onSaved: (updated: AlternantDocumentTemplate) => void
  onDeleted?: (id: string) => void
  deletable: boolean
  title: string
}

function TemplateCard({ template, onSaved, onDeleted, deletable, title }: TemplateCardProps) {
  const [label, setLabel] = useState(template.label)
  const [maitreApprentissage, setMaitreApprentissage] = useState(template.maitreApprentissage)
  const [alternant, setAlternant] = useState(template.alternant)
  const [formateur, setFormateur] = useState(template.formateur)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateAlternantDocumentTemplate(template.id, {
        label,
        maitreApprentissage,
        alternant,
        formateur,
      })
      onSaved(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDeleted) return
    if (!window.confirm(`Supprimer le modèle "${template.label}" ?`)) return
    setDeleting(true)
    setError(null)
    try {
      await deleteAlternantDocumentTemplate(template.id)
      onDeleted(template.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6">
      <div className="flex items-center justify-between gap-3">
        {deletable ? (
          <input
            className={`${inputClass} max-w-sm font-medium`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé du modèle (ex. TP AD)"
          />
        ) : (
          <h3 className="text-sm font-semibold text-[var(--ds-text)]">{title}</h3>
        )}
        {deletable && (
          <button
            type="button"
            className="text-[var(--ds-text-subtle)] hover:text-[var(--ds-danger)] disabled:opacity-40"
            onClick={handleDelete}
            disabled={deleting}
            title="Supprimer ce modèle"
          >
            <IconTrash width={16} height={16} />
          </button>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--ds-text-muted)]">Maître d'apprentissage</label>
        <RichTextEditor value={maitreApprentissage} onChange={setMaitreApprentissage} minHeight="100px" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--ds-text-muted)]">Alternant</label>
        <RichTextEditor value={alternant} onChange={setAlternant} minHeight="100px" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--ds-text-muted)]">Formateur</label>
        <RichTextEditor value={formateur} onChange={setFormateur} minHeight="100px" />
      </div>

      {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}

      <div className="flex items-center gap-3">
        <Button size="sm" leftIcon={<IconSave width={15} height={15} />} isLoading={saving} onClick={handleSave}>
          Enregistrer
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-[var(--ds-success)]">
            <IconCheckCircle width={16} height={16} /> Enregistré
          </span>
        )}
      </div>
    </div>
  )
}

export default function DocumentTemplatesSettings() {
  const [systemTemplates, setSystemTemplates] = useState<AlternantDocumentTemplate[]>([])
  const [periodicTemplates, setPeriodicTemplates] = useState<AlternantDocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchAlternantDocumentTemplates('j15'), fetchAlternantDocumentTemplates('j10w')])
      .then(([j15, j10w]) => setSystemTemplates([...j15, ...j10w]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
    fetchAlternantDocumentTemplates('periodique')
      .then(setPeriodicTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const created = await createAlternantDocumentTemplate({
        label: 'Nouveau modèle',
        maitreApprentissage: '',
        alternant: '',
        formateur: '',
      })
      setPeriodicTemplates((prev) => [...prev, created])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--ds-text-subtle)]">
        <IconLoader className="animate-spin" width={22} height={22} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 text-purple">
          <IconSettings width={20} height={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--ds-text)]">Réglages — Documents de séquence</h1>
          <p className="text-sm text-[var(--ds-text-subtle)]">
            Textes pré-remplis proposés à l'ouverture d'une SA (Séquence d'Accompagnement). Chaque
            partie (Maître d'apprentissage / Alternant / Formateur) sert de point de départ ;
            l'édition d'une SA précise n'affecte jamais ces modèles.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
          Modèles système
        </h2>
        <p className="text-sm text-[var(--ds-text-subtle)]">
          Toujours utilisés pour la 1ère SA (J+15) et la 2ème (J+10 semaines), quel que soit le
          titre professionnel. Contenu modifiable, mais ces 2 lignes ne peuvent pas être
          supprimées.
        </p>
        {systemTemplates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            title={SYSTEM_LABELS[t.type] ?? t.label}
            deletable={false}
            onSaved={(updated) =>
              setSystemTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            }
          />
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ds-text-subtle)]">
              Modèles périodiques
            </h2>
            <p className="text-sm text-[var(--ds-text-subtle)]">
              Un modèle est choisi par Session (à sa création) et s'applique à toutes ses SA
              suivantes (tous les 4 mois).
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<IconPlus width={15} height={15} />}
            isLoading={creating}
            onClick={handleCreate}
          >
            Nouveau modèle
          </Button>
        </div>
        {periodicTemplates.length === 0 && (
          <p className="text-sm text-[var(--ds-text-subtle)]">Aucun modèle périodique pour l'instant.</p>
        )}
        {periodicTemplates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            title={t.label}
            deletable
            onSaved={(updated) =>
              setPeriodicTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            }
            onDeleted={(id) => setPeriodicTemplates((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </section>
    </div>
  )
}
