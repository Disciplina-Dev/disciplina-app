import {
  Plus,
  PhoneCall,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  BarChart3,
  Users,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { isSameWeek, parseISO } from 'date-fns'

import type { Entreprise } from '@/types/entreprise'
import { useAuthStore, useCurrentUser, USERS } from '@/store/authStore'
import { usePortefeuilleStore } from '@/store/portefeuilleStore'
import { useInitializePortfolio } from '@/graphql/useInitializePortfolio'

import EntrepriseCard from '@/features/portefeuille/components/EntrepriseCard'
import DetailModal from '@/features/portefeuille/components/DetailModal'
import CreateEditModal from '@/features/portefeuille/components/CreateEditModal'
import Button from '@/components/ui/Button'

// ─── User switcher (copied from Portefeuille for testing/nav) ───────────────
function UserSwitcher() {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const setCurrentUser = useAuthStore((s) => s.set)
  const user = USERS[currentUserId]

  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden sm:block text-[11px] font-medium text-gray-400 uppercase tracking-wider">
        Session
      </span>
      <div className="flex items-center rounded-xl border border-gray-100 bg-white overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        {Object.values(USERS).map((u) => (
          <button
            key={u.id}
            onClick={() => setCurrentUser(u.id)}
            title={`${u.name} — ${u.role}`}
            className={[
              'relative flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-medium transition-all duration-150',
              'border-r border-gray-100 last:border-r-0',
              u.id === user.id ? 'text-white' : 'text-gray-500 hover:bg-gray-50',
            ].join(' ')}
            style={u.id === user.id ? { backgroundColor: u.color } : undefined}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0"
              style={{
                backgroundColor:
                  u.id === user.id ? 'rgba(255,255,255,0.25)' : u.color,
              }}
            >
              {u.initials}
            </span>
            <span className="hidden md:block">{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardCommercial() {
  const currentUser = useCurrentUser()
  const companies = usePortefeuilleStore((s) => s.companies)
  const updateCompany = usePortefeuilleStore((s) => s.updateCompany)
  const addCompany = usePortefeuilleStore((s) => s.addCompany)

  const { loading } = useInitializePortfolio()

  const [detailEntry, setDetailEntry] = useState<Entreprise | null>(null)
  const [editEntry, setEditEntry] = useState<Entreprise | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // 1. Filter companies by user permissions
  const myCompanies = useMemo(() => {
    // Amanda (2) and Lorenzo (5) can see all.
    // Brandon (3) and Emile (4) only see their own.
    const isRestricted = currentUser.role === 'commercial' && currentUser.id !== 1
    if (isRestricted) {
      return companies.filter((c) => c.proprietaire_id === currentUser.id)
    }
    return companies
  }, [companies, currentUser])

  // 2. Filter companies called "this week" (we assume 'date_insertion' or a recent 'status' means they were called)
  const thisWeekCompanies = useMemo(() => {
    const now = new Date()
    const weekCompanies = myCompanies.filter((c) => {
      if (!c.date_insertion) return false
      try {
        const date = parseISO(c.date_insertion)
        // If it's this week, and we assume any entry here represents a call/action
        return isSameWeek(date, now, { weekStartsOn: 1 })
      } catch {
        return false
      }
    })

    // If there is strictly no data for this week, we fallback to showing the last 15 updated companies that have a conclusion
    if (weekCompanies.length === 0) {
      return [...myCompanies]
        .filter((c) => Boolean(c.conclusion) || c.status)
        .sort((a, b) => new Date(b.date_insertion).getTime() - new Date(a.date_insertion).getTime())
        .slice(0, 15)
    }

    return weekCompanies.sort((a, b) => new Date(b.date_insertion).getTime() - new Date(a.date_insertion).getTime())
  }, [myCompanies])

  // 3. Compute stats
  const stats = useMemo(() => {
    let total = thisWeekCompanies.length
    let oui = 0
    let non = 0
    let aReflechir = 0

    thisWeekCompanies.forEach((c) => {
      if (c.status === 'Oui') oui++
      else if (c.status === 'Non') non++
      else if (c.status === 'À Réfléchir') aReflechir++
    })

    return { total, oui, non, aReflechir }
  }, [thisWeekCompanies])

  // 4. Compute performance per commercial (only visible for Admin/Responsable)
  const statsPerCommercial = useMemo(() => {
    if (currentUser.role === 'commercial' && currentUser.id !== 1) return []

    const map: Record<number, { id: number, name: string, total: number, oui: number, non: number, aReflechir: number, color: string }> = {}

    Object.values(USERS).forEach((u) => {
      if (u.role === 'commercial' && u.id !== 1) {
        map[u.id] = { id: u.id, name: u.name, total: 0, oui: 0, non: 0, aReflechir: 0, color: u.color }
      }
    })

    thisWeekCompanies.forEach((c) => {
      const pId = c.proprietaire_id
      if (pId && map[pId]) {
        map[pId].total++
        if (c.status === 'Oui') map[pId].oui++
        else if (c.status === 'Non') map[pId].non++
        else if (c.status === 'À Réfléchir') map[pId].aReflechir++
      } else if (pId) {
        const fallbackColor = USERS[pId]?.color || '#9ca3af'
        const fallbackName = USERS[pId]?.name || c.commercial || 'Inconnu'
        map[pId] = { id: pId, name: fallbackName, total: 1, oui: c.status === 'Oui' ? 1 : 0, non: c.status === 'Non' ? 1 : 0, aReflechir: c.status === 'À Réfléchir' ? 1 : 0, color: fallbackColor }
      }
    })

    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [thisWeekCompanies, currentUser])

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleSaveEdit = (data: Partial<Entreprise>) => {
    if (!editEntry) return
    updateCompany(editEntry.id, data)
    setEditEntry(null)
    if (detailEntry?.id === editEntry.id) {
      setDetailEntry({ ...detailEntry, ...data } as Entreprise)
    }
  }

  const handleCreate = (data: Partial<Entreprise>) => {
    addCompany({
      ...data,
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date_insertion: new Date().toISOString(),
    } as Entreprise)
    setCreateOpen(false)
  }

  const handleClaim = (id: string) => {
    updateCompany(id, {
      proprietaire_id: currentUser.id,
      commercial: currentUser.name,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Chargement du dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1">
              Vue d'ensemble
            </p>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
              Dashboard Commercial
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-400">
              Bienvenue, analysez vos performances et celles de votre équipe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <UserSwitcher />
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
              className="rounded-xl shadow-[0_2px_8px_-2px_rgba(17,48,167,0.30)]"
            >
              Nouvelle fiche
            </Button>
          </div>
        </div>

        {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card: Total */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue/5 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue/10 text-blue">
                <PhoneCall className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-gray-500">Appels cette semaine</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-gray-900">{stats.total}</span>
              <span className="text-[12px] font-medium text-gray-400 mb-1">entreprises</span>
            </div>
          </div>

          {/* Card: Oui */}
          <div className="rounded-2xl border border-success/10 bg-success-bg/30 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-success/10 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-success/20 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-success/80">Réponses positives</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-success">{stats.oui}</span>
              <span className="text-[12px] font-medium text-success/60 mb-1">accords</span>
            </div>
          </div>

          {/* Card: Non */}
          <div className="rounded-2xl border border-warning/10 bg-warning-bg/30 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-warning/10 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-warning/20 text-warning">
                <XCircle className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-warning/80">Réponses négatives</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-warning">{stats.non}</span>
              <span className="text-[12px] font-medium text-warning/60 mb-1">refus</span>
            </div>
          </div>

          {/* Card: À Réfléchir */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-gray-300/20 blur-2xl" />
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-200 text-gray-500">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-gray-600">En réflexion</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-bold leading-none text-gray-900">{stats.aReflechir}</span>
              <span className="text-[12px] font-medium text-gray-500 mb-1">en attente</span>
            </div>
          </div>
        </div>

        {/* ─── Performances de l'équipe (Admin/Responsable) ──────────────── */}
        {statsPerCommercial.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <h2 className="text-[18px] font-bold text-gray-900">
                  Performances de l'équipe
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {statsPerCommercial.map((s) => (
                <div key={s.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white text-[13px] font-bold shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name.substring(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <span className="block text-[14px] font-bold text-gray-900 leading-none mb-1">{s.name}</span>
                      <span className="block text-[12px] font-medium text-gray-400 leading-none">{s.total} appel{s.total !== 1 ? 's' : ''} cette semaine</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/50 p-2.5">
                    <div className="flex items-center gap-1.5 text-success" title="Accords">
                      <CheckCircle2 className="h-4 w-4 opacity-75" />
                      <span className="text-[14px] font-bold">{s.oui}</span>
                    </div>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-warning" title="Refus">
                      <XCircle className="h-4 w-4 opacity-75" />
                      <span className="text-[14px] font-bold">{s.non}</span>
                    </div>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-gray-500" title="En réflexion">
                      <Clock className="h-4 w-4 opacity-75" />
                      <span className="text-[14px] font-bold">{s.aReflechir}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── List of Companies ───────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h2 className="text-[18px] font-bold text-gray-900">
              Détails des appels de la semaine
            </h2>
          </div>
        </div>

        {thisWeekCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 rounded-3xl border border-gray-100 bg-white">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-light border border-blue/10">
              <Building2 className="h-7 w-7 text-blue" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">
                Aucun appel téléphonique
              </p>
              <p className="text-[13px] text-gray-400 mt-1 max-w-sm mx-auto">
                {currentUser.role === 'commercial'
                  ? "Vous n'avez appelé aucune entreprise cette semaine pour le moment. Commencez votre prospection !"
                  : "Aucune entreprise n'a été appelée récemment par les commerciaux."}
              </p>
            </div>
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Créer une fiche entreprise
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {thisWeekCompanies.map((e) => (
              <EntrepriseCard
                key={e.id}
                entreprise={e}
                currentUser={currentUser}
                onClick={() => setDetailEntry(e)}
                onClaim={() => handleClaim(e.id)}
              />
            ))}
          </div>
        )}

      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      {detailEntry && !editEntry && (
        <DetailModal
          entreprise={detailEntry}
          currentUser={currentUser}
          onClose={() => setDetailEntry(null)}
          onEdit={() => setEditEntry(detailEntry)}
        />
      )}
      {editEntry && (
        <CreateEditModal
          mode="edit"
          initial={editEntry}
          currentUser={currentUser}
          onSave={handleSaveEdit}
          onClose={() => setEditEntry(null)}
        />
      )}
      {createOpen && (
        <CreateEditModal
          mode="create"
          currentUser={currentUser}
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
