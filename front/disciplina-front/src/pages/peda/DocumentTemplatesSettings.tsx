import { useEffect, useMemo, useState } from 'react'
import { IconCheckCircle, IconClose, IconEdit, IconFile, IconLoader, IconPlus, IconSave, IconSearch, IconSettings, IconTrash } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SegmentedControl from '@/components/ui/SegmentedControl'
import {
  createAlternantDocumentTemplate,
  deleteAlternantDocumentTemplate,
  fetchAlternantDocumentTemplates,
  updateAlternantDocumentTemplate,
} from '@/api/alternantDocumentTemplates'
import type { AlternantDocumentTemplate } from '@/types/alternantDocumentTemplate'

// Teal, pas violet : couleur de marque de tout l'espace Péda (cf. `PedaLayout.tsx` ACCENT,
// `ListeSessions.tsx`) — le violet d'origine venait d'un copier-coller d'une page RH.
const inputClass =
  'w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2.5 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-subtle)] outline-none focus:border-teal-700 transition-colors'

const SYSTEM_LABELS: Record<string, string> = {
  j15: 'J+15 — Prise de contact',
  j10w: 'J+10 semaines — Fin de période d’essai',
}

type Part = 'maitreApprentissage' | 'alternant' | 'formateur'

const PART_LABELS: Record<Part, string> = {
  maitreApprentissage: "Maître d'apprentissage",
  alternant: 'Alternant',
  formateur: 'Formateur',
}

interface FormState {
  label: string
  maitreApprentissage: string
  alternant: string
  formateur: string
}

function emptyForm(label = ''): FormState {
  return { label, maitreApprentissage: '', alternant: '', formateur: '' }
}

function formFromTemplate(t: AlternantDocumentTemplate): FormState {
  return {
    label: t.label,
    maitreApprentissage: t.maitreApprentissage,
    alternant: t.alternant,
    formateur: t.formateur,
  }
}

export default function DocumentTemplatesSettings() {
  const [systemTemplates, setSystemTemplates] = useState<AlternantDocumentTemplate[]>([])
  const [periodicTemplates, setPeriodicTemplates] = useState<AlternantDocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // Un seul formulaire ouvert à la fois (système ou périodique) — mêmes états
  // que `MailTemplates.tsx` pour rester cohérent : la liste reste repliée tant
  // qu'on n'édite rien, ce qui évite d'afficher 3 éditeurs par modèle en permanence.
  const [editing, setEditing] = useState<AlternantDocumentTemplate | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [activePart, setActivePart] = useState<Part>('maitreApprentissage')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Filtrage en mémoire : suffisant pour la volumétrie réelle (une poignée à
  // quelques dizaines de modèles périodiques) sans ajouter de pagination
  // côté serveur — la liste reste scrollable à hauteur fixe en dessous, donc
  // la page elle-même ne grandit jamais même avec beaucoup de modèles.
  const [search, setSearch] = useState('')
  const filteredPeriodic = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? periodicTemplates.filter((t) => t.label.toLowerCase().includes(q)) : periodicTemplates
  }, [periodicTemplates, search])

  useEffect(() => {
    Promise.all([fetchAlternantDocumentTemplates('j15'), fetchAlternantDocumentTemplates('j10w')])
      .then(([j15, j10w]) => setSystemTemplates([...j15, ...j10w]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
    fetchAlternantDocumentTemplates('periodique')
      .then(setPeriodicTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => {
        setLoading(false)
        setLoaded(true)
      })
  }, [])

  function openEdit(t: AlternantDocumentTemplate) {
    setEditing(t)
    setForm(formFromTemplate(t))
    setActivePart('maitreApprentissage')
    setError(null)
  }

  function openNew() {
    setEditing('new')
    setForm(emptyForm())
    setActivePart('maitreApprentissage')
    setError(null)
  }

  function closeForm() {
    setEditing(null)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (editing === 'new') {
        const created = await createAlternantDocumentTemplate(form)
        setPeriodicTemplates((prev) => [...prev, created])
      } else if (editing) {
        const updated = await updateAlternantDocumentTemplate(editing.id, form)
        if (updated.type === 'periodique') {
          setPeriodicTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        } else {
          setSystemTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        }
      }
      setEditing(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce modèle ?')) return
    try {
      await deleteAlternantDocumentTemplate(id)
      setPeriodicTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  // Ligne compacte (pas de carte, pas d'aperçu HTML) : tient à l'échelle même
  // avec beaucoup de modèles, contrairement à la version précédente en grosses
  // cartes avec aperçu 2 lignes. Un petit badge rond garde un peu d'identité
  // visuelle sans reprendre de la hauteur.
  function TemplateRow({ t, deletable }: { t: AlternantDocumentTemplate; deletable: boolean }) {
    const hasContent = Boolean(t.maitreApprentissage || t.alternant || t.formateur)
    return (
      <div className="group flex items-center justify-between gap-3 px-1 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={[
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              deletable ? 'bg-teal-700/10 text-teal-700' : 'bg-amber-100 text-amber-700',
            ].join(' ')}
          >
            <IconFile width={12} height={12} />
          </span>
          <p className="truncate text-sm font-medium text-[var(--ds-text)]">
            {deletable ? t.label : (SYSTEM_LABELS[t.type] ?? t.label)}
          </p>
          {!hasContent && (
            <span className="shrink-0 rounded-full bg-[var(--ds-surface-sunken)] px-2 py-0.5 text-[11px] font-medium text-[var(--ds-text-subtle)]">
              vide
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => openEdit(t)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-surface-sunken)] hover:text-[var(--ds-text-muted)]"
            title="Modifier"
          >
            <IconEdit width={14} height={14} />
          </button>
          {deletable && (
            <button
              onClick={() => handleDelete(t.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] transition-colors hover:bg-[var(--ds-danger-bg)] hover:text-[var(--ds-danger)]"
              title="Supprimer"
            >
              <IconTrash width={14} height={14} />
            </button>
          )}
        </div>
      </div>
    )
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
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-700/10 text-teal-700 ring-2 ring-gray-50">
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

      {/* Formulaire — un seul à la fois, système ou périodique */}
      {editing && (
        <div className="flex flex-col gap-4 rounded-2xl border border-teal-700/20 bg-[var(--ds-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ds-text)]">
              {editing === 'new'
                ? 'Nouveau modèle périodique'
                : `Modifier · ${editing.type === 'periodique' ? editing.label : SYSTEM_LABELS[editing.type]}`}
            </h3>
            <button onClick={closeForm} className="text-[var(--ds-text-subtle)] transition-colors hover:text-[var(--ds-text-muted)]">
              <IconClose width={18} height={18} />
            </button>
          </div>

          {(editing === 'new' || editing.type === 'periodique') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--ds-text-muted)]">Libellé</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex : TP AD"
                className={inputClass}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <SegmentedControl
              label="Partie du modèle"
              size="sm"
              value={activePart}
              onChange={setActivePart}
              options={(['maitreApprentissage', 'alternant', 'formateur'] as Part[]).map((part) => ({
                value: part,
                label: PART_LABELS[part],
              }))}
            />
            <RichTextEditor
              value={form[activePart]}
              onChange={(html) => setForm((f) => ({ ...f, [activePart]: html }))}
              minHeight="180px"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={closeForm} disabled={saving}>
              Annuler
            </Button>
            <Button size="sm" leftIcon={<IconSave width={15} height={15} />} isLoading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {!editing && saved && (
        <span className="flex items-center gap-1 text-sm text-[var(--ds-success)]">
          <IconCheckCircle width={16} height={16} /> Enregistré
        </span>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ds-text)]">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Modèles système
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ds-text-subtle)]">
            Toujours utilisés pour la 1ère SA (J+15) et la 2ème (J+10 semaines) — contenu modifiable,
            ces 2 lignes ne peuvent pas être supprimées.
          </p>
        </div>
        <div className="divide-y divide-[var(--ds-border)] rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4">
          {systemTemplates.map((t) => (
            <TemplateRow key={t.id} t={t} deletable={false} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ds-text)]">
              <span className="h-2 w-2 rounded-full bg-teal-700" />
              Modèles périodiques
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ds-text-subtle)]">
              Un modèle est choisi par Session et s'applique à ses SA périodiques (tous les 4 mois).
            </p>
          </div>
          <Button size="sm" variant="secondary" leftIcon={<IconPlus width={15} height={15} />} onClick={openNew}>
            Nouveau modèle
          </Button>
        </div>

        {periodicTemplates.length === 0 && !editing ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--ds-border)] py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-surface-sunken)]">
              <IconFile width={22} height={22} className="text-[var(--ds-text-subtle)]" />
            </div>
            <p className="text-sm text-[var(--ds-text-subtle)]">
              {loaded ? 'Aucun modèle périodique pour l\'instant' : 'Chargement…'}
            </p>
            <Button size="sm" variant="secondary" leftIcon={<IconPlus width={15} height={15} />} onClick={openNew}>
              Créer un modèle
            </Button>
          </div>
        ) : (
          <>
            {periodicTemplates.length > 5 && (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--ds-text-subtle)]">
                  <IconSearch width={15} height={15} />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un modèle…"
                  aria-label="Rechercher un modèle périodique"
                  className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2 pl-9 pr-3 text-sm text-[var(--ds-text)] outline-none transition-colors placeholder:text-[var(--ds-text-subtle)] focus:border-teal-700"
                />
              </div>
            )}
            <div className="max-h-[420px] divide-y divide-[var(--ds-border)] overflow-y-auto rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4">
              {filteredPeriodic.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--ds-text-subtle)]">Aucun résultat pour « {search} ».</p>
              ) : (
                filteredPeriodic.map((t) => <TemplateRow key={t.id} t={t} deletable />)
              )}
            </div>
            <p className="text-xs text-[var(--ds-text-subtle)]">
              {filteredPeriodic.length} / {periodicTemplates.length} modèle{periodicTemplates.length > 1 ? 's' : ''}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
