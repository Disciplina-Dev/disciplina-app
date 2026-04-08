import { useState } from 'react'
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, Hash,
  CheckCircle, XCircle, AlertCircle, Plus, Clock,
  FileText, RefreshCw, User, MoreHorizontal, Loader2,
} from 'lucide-react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Button, Badge } from '@/components/ui'
import { useCompany, useLogCall, useCreateRelance } from '@/hooks/useCompanies'
import { CURRENT_USER } from '@/constants/currentUser'
import type { CallResult } from '@/types/api'

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={12} className="text-gray-400" />
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

const CALL_RESULTS: { value: CallResult; label: string; icon: React.ElementType; color: string; border: string }[] = [
  { value: 'ok',      label: "OK — accord pour remplir l'AB", icon: CheckCircle, color: 'text-success', border: 'border-success/30 bg-success-bg/30' },
  { value: 'indecis', label: 'Indécis — à relancer',           icon: AlertCircle, color: 'text-warning', border: 'border-warning/30 bg-warning-bg/30' },
  { value: 'non',     label: 'Non catégorique',                icon: XCircle,     color: 'text-danger',  border: 'border-danger/30 bg-danger-bg/30' },
]

type Tab = 'infos' | 'appel' | 'relances' | 'ab'

// ─── Component ───────────────────────────────────────────────
export default function FicheEntreprise() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const { data, isLoading, isError } = useCompany(id)
  const logCall      = useLogCall()
  const addRelance   = useCreateRelance()

  const [activeTab, setActiveTab] = useState<Tab>('infos')
  const [callResult, setCallResult] = useState<CallResult | null>(null)
  const [callNote, setCallNote]   = useState('')
  const [relanceDate, setRelanceDate] = useState('')
  const [newRelDate, setNewRelDate]   = useState('')
  const [newRelNote, setNewRelNote]   = useState('')

  if (isLoading) return (
    <div className="p-8 flex items-center gap-2 text-gray-400">
      <Loader2 size={18} className="animate-spin" /> Chargement…
    </div>
  )
  if (isError || !data) return (
    <div className="p-8 text-danger text-sm">Entreprise introuvable.</div>
  )

  const e = data.data

  const tabs: { id: Tab; label: string; icon: React.ElementType; disabled?: boolean }[] = [
    { id: 'infos',    label: 'Informations',                       icon: Building2 },
    { id: 'appel',    label: 'Appel & Notes',                      icon: Phone },
    { id: 'relances', label: `Relances (${e.relances.filter(r => r.statut === 'planifiee').length})`, icon: RefreshCw },
    { id: 'ab',       label: 'Analyse de Besoin',                  icon: FileText, disabled: e.statut !== 'ok' },
  ]

  async function handleLogCall() {
    if (!callResult || !id) return
    await logCall.mutateAsync({
      id,
      result: callResult,
      notes: callNote || undefined,
      commercial_id: CURRENT_USER.id,
    })
    // Si indécis et date de relance renseignée, créer la relance
    if (callResult === 'indecis' && relanceDate) {
      await addRelance.mutateAsync({
        id,
        scheduled_date: relanceDate,
        notes: `Relance suite appel`,
        commercial_id: CURRENT_USER.id,
      })
    }
    setCallResult(null)
    setCallNote('')
    setRelanceDate('')
    setActiveTab('infos')
  }

  async function handleAddRelance() {
    if (!id || !newRelDate) return
    await addRelance.mutateAsync({
      id,
      scheduled_date: newRelDate,
      notes: newRelNote || undefined,
      commercial_id: CURRENT_USER.id,
    })
    setNewRelDate('')
    setNewRelNote('')
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* Back */}
      <Link
        to="/commercial/portefeuille"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={13} /> Portefeuille
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-light rounded-xl flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-blue" />
            </div>
            <div>
              <h1 className="text-xl font-black text-black leading-tight">{e.raison_sociale}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-sm text-gray-500">{e.secteur ?? '—'}</span>
                <span className="text-gray-200">·</span>
                <Badge status={e.statut} />
                {e.commercial_nom && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-400">Suivi par {e.commercial_nom}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {e.telephone && (
              <a href={`tel:${e.telephone}`}>
                <Button variant="secondary" size="sm" leftIcon={<Phone size={13} />}>Appeler</Button>
              </a>
            )}
            <Button
              size="sm"
              leftIcon={<FileText size={13} />}
              disabled={e.statut !== 'ok'}
              onClick={() => navigate('/commercial/analyses-besoin/nouvelle')}
            >
              Créer AB
            </Button>
            <button className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
          {e.commune && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
              <MapPin size={10} /> {e.commune} {e.code_postal}
            </span>
          )}
          {e.siret && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
              SIRET {e.siret}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
            Ajouté le {formatDate(e.created_at)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-gray-100">
        {tabs.map(({ id: tid, label, icon: Icon, disabled }) => (
          <button
            key={tid}
            onClick={() => !disabled && setActiveTab(tid)}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === tid
                ? 'text-blue border-blue'
                : disabled
                ? 'text-gray-200 border-transparent cursor-not-allowed'
                : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Informations ── */}
      {activeTab === 'infos' && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm">Identification</h4>
            {e.siret    && <InfoRow icon={Hash}     label="SIRET"    value={e.siret} />}
            {e.secteur  && <InfoRow icon={Building2} label="Secteur"  value={e.secteur} />}
            {e.adresse  && <InfoRow icon={MapPin}   label="Adresse"  value={`${e.adresse}${e.code_postal ? `, ${e.code_postal}` : ''}${e.commune ? ` ${e.commune}` : ''}`} />}
            {e.telephone && <InfoRow icon={Phone}   label="Téléphone" value={e.telephone} />}
            {e.email    && <InfoRow icon={Mail}     label="Email"    value={e.email} />}
          </div>

          <div className="space-y-4">
            {e.contacts.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Contacts</h4>
                {e.contacts.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-blue-light rounded-full flex items-center justify-center shrink-0">
                      <User size={13} className="text-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.nom_prenom}</p>
                      <p className="text-xs text-gray-400">
                        {c.fonction} · {c.type === 'representant_legal' ? 'Représentant légal' : 'Resp. recrutement'}
                      </p>
                      {c.telephone && <p className="text-xs text-blue mt-1">{c.telephone}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {e.calls.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h4 className="font-semibold text-gray-900 text-sm mb-4">Historique des appels</h4>
                <div className="space-y-3">
                  {e.calls.map((c, i) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-7 h-7 bg-blue-light rounded-full flex items-center justify-center shrink-0">
                          <Phone size={11} className="text-blue" />
                        </div>
                        {i < e.calls.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                      </div>
                      <div className="pb-3 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">Appel téléphonique</p>
                          <Badge status={c.result === 'indecis' ? 'indecis' : c.result === 'ok' ? 'ok' : 'non'} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.called_at)}</p>
                        {c.notes && (
                          <p className="text-sm text-gray-600 mt-1.5 bg-gray-50 rounded-lg px-3 py-2">
                            {c.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Appel & Notes ── */}
      {activeTab === 'appel' && (
        <div className="max-w-lg space-y-5">
          <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-5">
            <h3 className="font-semibold text-gray-900">Enregistrer un appel</h3>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Résultat</p>
              {CALL_RESULTS.map(({ value, label, icon: Icon, color, border }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    callResult === value ? border : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <input type="radio" name="result" value={value} onChange={() => setCallResult(value)} className="sr-only" />
                  <Icon size={16} className={color} />
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Notes</p>
              <textarea
                rows={3}
                value={callNote}
                onChange={e => setCallNote(e.target.value)}
                placeholder="Résumé de l'appel, besoins exprimés…"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue resize-none"
              />
            </div>

            {callResult === 'indecis' && (
              <div className="p-4 bg-warning-bg border border-warning/20 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-warning">Planifier une relance</p>
                <input
                  type="date"
                  value={relanceDate}
                  onChange={e => setRelanceDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-warning/30 rounded-lg text-sm text-gray-900 focus:outline-none"
                />
              </div>
            )}

            {callResult === 'ok' && (
              <div className="p-4 bg-success-bg border border-success/20 rounded-xl">
                <p className="text-sm font-semibold text-success">Entreprise OK</p>
                <p className="text-xs text-success/70 mt-0.5">L'onglet "Analyse de Besoin" sera déverrouillé.</p>
              </div>
            )}

            <Button
              className="w-full"
              leftIcon={logCall.isPending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
              disabled={!callResult || logCall.isPending}
              onClick={handleLogCall}
            >
              {logCall.isPending ? 'Enregistrement…' : 'Enregistrer l\'appel'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Relances ── */}
      {activeTab === 'relances' && (
        <div className="space-y-4">
          {/* Form ajout */}
          <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Planifier une relance</h4>
            <div className="flex gap-3">
              <input
                type="date"
                value={newRelDate}
                onChange={e => setNewRelDate(e.target.value)}
                className="flex-1 px-3 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
              <input
                value={newRelNote}
                onChange={e => setNewRelNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="flex-1 px-3 h-10 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
              />
              <Button
                size="sm"
                leftIcon={addRelance.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                disabled={!newRelDate || addRelance.isPending}
                onClick={handleAddRelance}
              >
                Ajouter
              </Button>
            </div>
          </div>

          {/* List */}
          {e.relances.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune relance planifiée</p>
          ) : (
            e.relances.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  r.statut === 'planifiee' ? 'bg-warning-bg text-warning' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Clock size={15} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(r.scheduled_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  r.statut === 'planifiee' ? 'text-warning bg-warning-bg'
                  : r.statut === 'faite' ? 'text-success bg-success-bg'
                  : 'text-gray-500 bg-gray-100'
                }`}>
                  {r.statut === 'planifiee' ? 'Planifiée' : r.statut === 'faite' ? 'Faite' : 'Annulée'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── AB ── */}
      {activeTab === 'ab' && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 bg-success-bg rounded-2xl flex items-center justify-center mb-4">
            <FileText size={26} className="text-success" />
          </div>
          <h3 className="font-bold text-gray-900">Entreprise OK — AB disponible</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm">
            L'entreprise a accepté. Vous pouvez maintenant remplir l'Analyse de Besoin.
          </p>
          <Link to="/commercial/analyses-besoin/nouvelle" className="mt-6">
            <Button leftIcon={<Plus size={14} />}>Créer l'Analyse de Besoin</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
