import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, CalendarDays,
  MapPin, Video, Plus, Trash2, X, Pencil, LinkIcon, Share2, Copy, Check,
  Mail, UserCheck, UserX, User as UserIcon,
} from 'lucide-react'
import {
  fetchMyBookingSettings, updateMyBookingSettings, bookingPublicUrl,
  type BookingSettings, type WorkingHours,
} from '@/api/booking'
import { useAuthStore } from '@/store/authStore'
import { useRhMailTemplatesStore } from '@/store/mailTemplatesStore'
import { fetchSectorSettings, type SectorSetting } from '@/api/sectorSettings'
import { SECTEUR_VALUES } from '@/types/entreprise'
import { useGoogleOAuthPopup } from '@/hooks/useGoogleOAuthPopup'
import { useNavigate } from 'react-router-dom'
import CandidateFormModal from '@/components/rh/CandidateFormModal'
import {
  fetchCalendarEvents, fetchCalendarUsers, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  setEventAttendance,
  CalendarNotConnectedError, EVENT_COLORS, DEFAULT_EVENT_HEX, eventHex, ownerColor,
  type CalendarEvent, type CalendarEventInput, type CalendarUser, type Attendance,
} from '@/api/calendar'

type View = 'month' | 'week'
/** Event enrichi de son propriétaire (pour vue multi-agendas). */
type OwnedEvent = CalendarEvent & { ownerId: number }

/** Couleur des cases selon la présence : vert = arrivé, rouge = pas venu (sinon couleur normale). */
const ATTENDANCE_HEX: Record<'arrived' | 'noshow', string> = { arrived: '#1A7A4A', noshow: '#C0152A' }

/** Couleur d'affichage : présence (vert/rouge) prioritaire, sinon colorId (self) ou couleur du propriétaire. */
function displayHex(e: OwnedEvent, selfId: number): string {
  if (e.attendance === 'arrived' || e.attendance === 'noshow') return ATTENDANCE_HEX[e.attendance]
  return e.ownerId === selfId ? eventHex(e.colorId) : ownerColor(e.ownerId)
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const HOUR_PX = 48
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Nom candidat déduit du titre de l'entretien (retire un préfixe « Entretien »). */
function candidateNameFromSummary(summary: string): string {
  return (summary ?? '').replace(/^\s*entretien\s*[-:–—]?\s*/i, '').trim()
}

/** Lundi = 0 … Dimanche = 6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - mondayIndex(x))
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildMonthGrid(year: number, month: number): Date[] {
  const gridStart = startOfWeek(new Date(year, month, 1))
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

function buildWeek(anchor: Date): Date[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function eventDate(e: CalendarEvent): Date {
  return startOfDay(new Date(e.start))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

/** Construit une string locale "YYYY-MM-DDTHH:mm" → ISO (respecte le fuseau du navigateur). */
function localToISO(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Liens description Google → nouvel onglet sans fuite de referrer.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

function cleanHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

/** Layout des events d'un jour en colonnes pour gérer les chevauchements. */
interface PositionedEvent { event: OwnedEvent; col: number; cols: number }
function layoutDay(events: OwnedEvent[]): PositionedEvent[] {
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const result: PositionedEvent[] = []
  let cluster: OwnedEvent[] = []
  let clusterEnd = 0

  const flush = () => {
    const colsEnd: number[] = []
    const placed = cluster.map((ev) => {
      const s = minutesSinceMidnight(ev.start)
      let col = colsEnd.findIndex((end) => end <= s)
      if (col === -1) { col = colsEnd.length; colsEnd.push(0) }
      colsEnd[col] = minutesSinceMidnight(ev.end)
      return { event: ev, col }
    })
    const cols = colsEnd.length
    placed.forEach((p) => result.push({ ...p, cols }))
    cluster = []
    clusterEnd = 0
  }

  for (const ev of sorted) {
    const s = minutesSinceMidnight(ev.start)
    if (cluster.length && s >= clusterEnd) flush()
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, minutesSinceMidnight(ev.end))
  }
  flush()
  return result
}

export default function Calendrier() {
  const token = useAuthStore((s) => s.token)
  const selfId = Number(useAuthStore((s) => s.user?.id))
  const { connectGoogle, isLoading: isConnecting } = useGoogleOAuthPopup()

  const today = useMemo(() => startOfDay(new Date()), [])
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(today)
  const [events, setEvents] = useState<OwnedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Agendas de collègues inaccessibles (compte Google non lié / accès expiré) : avertissement non bloquant.
  const [unavailableIds, setUnavailableIds] = useState<number[]>([])
  // Bannière fermée manuellement pour cette liste d'agendas (clé = ids triés) ; réapparaît si nouveaux échecs.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const unavailableKey = unavailableIds.slice().sort().join(',')
  const [detail, setDetail] = useState<OwnedEvent | null>(null)
  const [editing, setEditing] = useState<{ event?: CalendarEvent; ownerId?: number; start?: Date; end?: Date } | null>(null)
  const [showBooking, setShowBooking] = useState(false)
  // Candidat à créer depuis un entretien marqué « arrivé » (pré-rempli puis redirige vers sa fiche).
  const [createFromEvent, setCreateFromEvent] = useState<CalendarEvent | null>(null)
  const navigate = useNavigate()

  // Multi-agendas : liste des RH/responsables + ceux affichés.
  const [users, setUsers] = useState<CalendarUser[]>([])
  const [visible, setVisible] = useState<Set<number>>(new Set())

  const loadUsers = useCallback(async () => {
    if (!token) return
    try {
      const list = await fetchCalendarUsers(token)
      setUsers(list)
      // Par défaut : son propre agenda + ceux des collègues partageant ≥ 1 secteur (connectés).
      const self = list.find((u) => u.isSelf)
      const selfSectors = new Set(self?.sectors ?? [])
      const sameSector = (u: CalendarUser) => (u.sectors ?? []).some((s) => selfSectors.has(s))
      setVisible(new Set(list.filter((u) => u.connected && (u.isSelf || sameSector(u))).map((u) => u.id)))
    } catch {
      /* géré via état notConnected au chargement des events */
    }
  }, [token])

  useEffect(() => { void loadUsers() }, [loadUsers])

  // Self non connecté à Google → on invite à connecter plutôt qu'afficher une grille vide.
  const selfDisconnected = users.some((u) => u.isSelf && !u.connected)

  const toggleUser = (id: number) =>
    setVisible((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const range = useMemo(() => {
    if (view === 'month') {
      const grid = buildMonthGrid(cursor.getFullYear(), cursor.getMonth())
      const max = new Date(grid[grid.length - 1]); max.setHours(23, 59, 59, 999)
      return { cells: grid, min: grid[0], max }
    }
    const week = buildWeek(cursor)
    const max = new Date(week[6]); max.setHours(23, 59, 59, 999)
    return { cells: week, min: week[0], max }
  }, [view, cursor])

  const visibleKey = useMemo(() => [...visible].sort().join(','), [visible])

  const load = useCallback(async () => {
    if (!token) return
    const ids = visibleKey ? visibleKey.split(',').map(Number) : []
    setLoading(true); setError(null); setNotConnected(false)
    try {
      const failed: number[] = []
      const perUser = await Promise.all(
        ids.map(async (id) => {
          // Un agenda en échec (409 non connecté ou erreur Google) ne doit jamais bloquer les autres.
          try {
            const evs = await fetchCalendarEvents(token, range.min, range.max, id === selfId ? undefined : id)
            return evs.map((e) => ({ ...e, ownerId: id }))
          } catch (err) {
            if (err instanceof CalendarNotConnectedError && id === selfId) setNotConnected(true)
            else failed.push(id)
            return []
          }
        }),
      )
      // Cumule les échecs (un rechargement sans erreur ne masque pas la bannière : fermeture via la croix).
      setUnavailableIds((prev) => (failed.length ? Array.from(new Set([...prev, ...failed])) : prev))
      setEvents(perUser.flat())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [token, range.min, range.max, visibleKey, selfId])

  useEffect(() => { void load() }, [load])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, OwnedEvent[]>()
    for (const e of events) {
      const key = eventDate(e).toDateString()
      const list = map.get(key)
      if (list) list.push(e); else map.set(key, [e])
    }
    return map
  }, [events])

  const shift = (delta: number) =>
    setCursor((c) => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() + delta, 1) : addDays(c, delta * 7)))
  const goToday = () => setCursor(today)

  const headerLabel = view === 'month'
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const w = buildWeek(cursor)
        return `${w[0].getDate()} ${MONTHS[w[0].getMonth()].slice(0, 4)}. – ${w[6].getDate()} ${MONTHS[w[6].getMonth()].slice(0, 4)}. ${w[6].getFullYear()}`
      })()

  const openCreate = (start: Date) => {
    const end = new Date(start); end.setHours(start.getHours() + 1)
    setEditing({ start, end })
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-gray-900">Calendrier</h1>
          <p className="text-[13px] font-medium capitalize text-gray-400">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-[10px] border border-gray-200 bg-white p-0.5">
            {(['month', 'week'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-[8px] px-3 py-1.5 text-[13px] font-bold transition-colors ${view === v ? 'bg-purple text-white' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {v === 'month' ? 'Mois' : 'Semaine'}
              </button>
            ))}
          </div>
          <button onClick={goToday} className="rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50">
            Aujourd'hui
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-[10px] border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50" aria-label="Précédent">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => shift(1)} className="rounded-[10px] border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50" aria-label="Suivant">
              <ChevronRight size={18} />
            </button>
          </div>
          <button onClick={() => setShowBooking(true)} className="flex items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50">
            <Share2 size={16} /> Partager mon agenda
          </button>
          <button onClick={() => openCreate(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 9, 0))} className="flex items-center gap-1.5 rounded-[10px] bg-purple px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-purple-dark">
            <Plus size={16} /> Créneau
          </button>
        </div>
      </div>

      {(notConnected || selfDisconnected) ? (
        <ConnectPrompt onConnect={connectGoogle} isConnecting={isConnecting} onDone={loadUsers} />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl bg-danger-bg p-3 text-[13px] text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {unavailableIds.length > 0 && dismissedKey !== unavailableKey && (
            <div className="flex items-center gap-2 rounded-xl bg-warning-bg p-3 text-[13px] font-semibold text-warning">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="flex-1">
                {(() => {
                  const names = unavailableIds
                    .map((id) => users.find((u) => u.id === id))
                    .filter(Boolean)
                    .map((u) => `${u!.firstName} ${u!.lastName}`.trim())
                  return names.length
                    ? `Agenda${names.length > 1 ? 's' : ''} indisponible${names.length > 1 ? 's' : ''} : ${names.join(', ')} — compte Google non connecté ou accès expiré.`
                    : 'Certains agendas sont indisponibles (compte Google non connecté ou accès expiré).'
                })()}
              </span>
              <button
                onClick={() => setDismissedKey(unavailableKey)}
                className="flex-shrink-0 rounded-lg p-1 text-warning transition-colors hover:bg-warning/10"
                aria-label="Fermer l'avertissement"
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 gap-4">
          <AgendasPanel users={users} visible={visible} selfId={selfId} onToggle={toggleUser} />
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <Loader2 size={26} className="animate-spin text-purple" />
              </div>
            )}
            {view === 'month'
              ? <MonthView cells={range.cells} cursorMonth={cursor.getMonth()} today={today} eventsByDay={eventsByDay} onEvent={setDetail} selfId={selfId} />
              : <WeekView days={range.cells} today={today} eventsByDay={eventsByDay} onEvent={setDetail} onSlot={openCreate} selfId={selfId} />}
          </div>
          </div>
        </div>
      )}

      {detail && token && (
        <EventModal
          event={detail}
          token={token}
          isOwn={detail.ownerId === selfId}
          ownerName={(() => { const u = users.find((u) => u.id === detail.ownerId); return u ? `${u.firstName} ${u.lastName}`.trim() : undefined })()}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing({ event: detail, ownerId: detail.ownerId }); setDetail(null) }}
          onAttendance={(e) => { setDetail((d) => (d ? { ...d, ...e } : d)); void load() }}
          onArrived={(e) => { setDetail(null); setCreateFromEvent(e) }}
        />
      )}
      {createFromEvent && (
        <CandidateFormModal
          prefill={{
            fullName: candidateNameFromSummary(createFromEvent.summary),
            email: createFromEvent.attendeeEmail ?? '',
          }}
          onClose={() => setCreateFromEvent(null)}
          onSaved={() => { void load() }}
          onCreated={(id) => { setCreateFromEvent(null); navigate(`/rh/candidats/${id}`) }}
        />
      )}
      {editing && token && (
        <EventForm
          token={token}
          event={editing.event}
          ownerId={editing.ownerId}
          users={users}
          selfId={selfId}
          defaultStart={editing.start}
          defaultEnd={editing.end}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
        />
      )}
      {showBooking && token && <BookingSettingsModal token={token} onClose={() => setShowBooking(false)} />}
    </div>
  )
}

const ISO_DAYS: { key: string; label: string }[] = [
  { key: '1', label: 'Lundi' }, { key: '2', label: 'Mardi' }, { key: '3', label: 'Mercredi' },
  { key: '4', label: 'Jeudi' }, { key: '5', label: 'Vendredi' }, { key: '6', label: 'Samedi' }, { key: '7', label: 'Dimanche' },
]

function BookingSettingsModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const mailTemplates = useRhMailTemplatesStore((s) => s.templates)
  const loadMailTemplates = useRhMailTemplatesStore((s) => s.load)

  useEffect(() => { loadMailTemplates() }, [loadMailTemplates])

  useEffect(() => {
    fetchMyBookingSettings(token)
      .then(setSettings)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [token])

  const patch = (p: Partial<BookingSettings>) => setSettings((s) => (s ? { ...s, ...p } : s))

  const setWindow = (day: string, idx: number, pos: 0 | 1, value: string) => {
    if (!settings) return
    const wh: WorkingHours = { ...settings.workingHours }
    const list = [...(wh[day] ?? [])]
    const win = [...list[idx]] as [string, string]
    win[pos] = value
    list[idx] = win
    wh[day] = list
    patch({ workingHours: wh })
  }
  const addWindow = (day: string) => {
    if (!settings) return
    const wh: WorkingHours = { ...settings.workingHours }
    wh[day] = [...(wh[day] ?? []), ['09:00', '12:00']]
    patch({ workingHours: wh })
  }
  const removeWindow = (day: string, idx: number) => {
    if (!settings) return
    const wh: WorkingHours = { ...settings.workingHours }
    wh[day] = (wh[day] ?? []).filter((_, i) => i !== idx)
    if (wh[day].length === 0) delete wh[day]
    patch({ workingHours: wh })
  }

  const save = async () => {
    if (!settings) return
    setBusy(true); setErr(null)
    try {
      const updated = await updateMyBookingSettings(token, {
        enabled: settings.enabled, title: settings.title, location: settings.location,
        durationMin: settings.durationMin, bufferMin: settings.bufferMin,
        minNoticeHours: settings.minNoticeHours, maxDaysAhead: settings.maxDaysAhead,
        timezone: settings.timezone, workingHours: settings.workingHours,
        confirmationSubject: settings.confirmationSubject, confirmationBody: settings.confirmationBody,
        propositionSubject: settings.propositionSubject, propositionBody: settings.propositionBody,
      })
      setSettings(updated)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur'); setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!settings) return
    await navigator.clipboard.writeText(bookingPublicUrl(settings.slug))
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-gray-900">Partager mon agenda</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-purple" /></div>
        ) : !settings ? (
          <p className="text-[13px] text-danger">{err ?? 'Erreur de chargement'}</p>
        ) : (
          <div className="space-y-4">
            {/* Lien public */}
            <div className="rounded-xl bg-purple-light/40 p-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-purple">Lien public</p>
              <div className="flex items-center gap-2">
                <input readOnly value={bookingPublicUrl(settings.slug)}
                  className="flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-600 outline-none" />
                <button onClick={copyLink} className="flex items-center gap-1.5 rounded-lg bg-purple px-3 py-2 text-[12px] font-bold text-white hover:bg-purple-dark">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-gray-600">
                <input type="checkbox" checked={settings.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                Réservation activée
              </label>
            </div>

            {/* Détails du RDV */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Titre du rendez-vous" className="col-span-2">
                <input value={settings.title} onChange={(e) => patch({ title: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Lieu (optionnel)" className="col-span-2">
                <LocationPicker token={token} value={settings.location ?? ''} onChange={(v) => patch({ location: v || null })} autoDefault />
              </Field>
              <Field label="Durée (min)">
                <input type="number" min={5} max={480} value={settings.durationMin} onChange={(e) => patch({ durationMin: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Pause entre RDV (min)">
                <input type="number" min={0} max={240} value={settings.bufferMin} onChange={(e) => patch({ bufferMin: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Préavis min (h)">
                <input type="number" min={0} max={720} value={settings.minNoticeHours} onChange={(e) => patch({ minNoticeHours: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Horizon max (jours)">
                <input type="number" min={1} max={365} value={settings.maxDaysAhead} onChange={(e) => patch({ maxDaysAhead: Number(e.target.value) })} className={inputCls} />
              </Field>
            </div>

            {/* Mail de confirmation */}
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Mail size={13} /> Mail de confirmation
              </p>
              <select
                value={
                  settings.confirmationBody
                    ? (mailTemplates.find((t) => t.body === settings.confirmationBody)?.id ?? '__custom')
                    : ''
                }
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) { patch({ confirmationSubject: null, confirmationBody: null }); return }
                  const tpl = mailTemplates.find((t) => t.id === id)
                  if (tpl) patch({ confirmationSubject: tpl.subject, confirmationBody: tpl.body })
                }}
                className={inputCls}
              >
                <option value="">Mail par défaut</option>
                {settings.confirmationBody && !mailTemplates.some((t) => t.body === settings.confirmationBody) && (
                  <option value="__custom">Modèle enregistré (introuvable)</option>
                )}
                {mailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                Modèles gérés dans « Modèles de mail ». Variables disponibles :{' '}
                <code>{'{{nom}}'}</code> <code>{'{{date}}'}</code> <code>{'{{jour}}'}</code>{' '}
                <code>{'{{date_longue}}'}</code> <code>{'{{date_courte}}'}</code> <code>{'{{heure}}'}</code>{' '}
                <code>{'{{lieu}}'}</code> <code>{'{{titre}}'}</code> <code>{'{{duree}}'}</code> <code>{'{{hote}}'}</code>.
              </p>
            </div>

            {/* Mail de proposition d'entretien */}
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Mail size={13} /> Mail de proposition d'entretien
              </p>
              <select
                value={
                  settings.propositionBody
                    ? (mailTemplates.find((t) => t.body === settings.propositionBody)?.id ?? '__custom')
                    : ''
                }
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) { patch({ propositionSubject: null, propositionBody: null }); return }
                  const tpl = mailTemplates.find((t) => t.id === id)
                  if (tpl) patch({ propositionSubject: tpl.subject, propositionBody: tpl.body })
                }}
                className={inputCls}
              >
                <option value="">Mail par défaut</option>
                {settings.propositionBody && !mailTemplates.some((t) => t.body === settings.propositionBody) && (
                  <option value="__custom">Modèle enregistré (introuvable)</option>
                )}
                {mailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                Envoyé au candidat via « Proposer un entretien ». Variable :{' '}
                <code>{'{{lien}}'}</code> (lien de réservation). Sans cette variable, le lien est ajouté en bas.
              </p>
            </div>

            {/* Plages horaires */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Disponibilités hebdomadaires</p>
              <div className="space-y-1.5">
                {ISO_DAYS.map(({ key, label }) => {
                  const windows = settings.workingHours[key] ?? []
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <span className="w-20 flex-shrink-0 pt-1.5 text-[12px] font-bold text-gray-600">{label}</span>
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {windows.length === 0 && <span className="py-1 text-[12px] text-gray-300">Indisponible</span>}
                        {windows.map((w, i) => (
                          <div key={i} className="flex items-center gap-1 rounded-lg border border-gray-200 px-1.5 py-1">
                            <input type="time" value={w[0]} onChange={(e) => setWindow(key, i, 0, e.target.value)} className="text-[12px] outline-none" />
                            <span className="text-gray-300">–</span>
                            <input type="time" value={w[1]} onChange={(e) => setWindow(key, i, 1, e.target.value)} className="text-[12px] outline-none" />
                            <button onClick={() => removeWindow(key, i)} className="text-gray-300 hover:text-danger"><X size={13} /></button>
                          </div>
                        ))}
                        <button onClick={() => addWindow(key)} className="rounded-lg p-1 text-purple hover:bg-purple-light"><Plus size={15} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {err && <p className="text-[12px] text-danger">{err}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={onClose} className="ml-auto rounded-lg px-3 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-700">Annuler</button>
              <button onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white hover:bg-purple-dark disabled:opacity-60">
                {busy && <Loader2 size={15} className="animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple'

const CUSTOM_LOCATION = '__custom'

/**
 * Sélecteur de lieu : dropdown des lieux par secteur (sector_settings) + saisie libre (« Autre… »).
 * `autoDefault` pré-sélectionne le lieu du secteur de l'utilisateur (fallback Nord-Est) si la valeur est vide.
 */
function LocationPicker({ token, value, onChange, autoDefault }: {
  token: string; value: string; onChange: (v: string) => void; autoDefault?: boolean
}) {
  const [options, setOptions] = useState<SectorSetting[]>([])
  const [loaded, setLoaded] = useState(false)
  const [custom, setCustom] = useState(false)
  const selfSectors = useAuthStore((s) => s.user?.sectors)

  useEffect(() => {
    let cancelled = false
    fetchSectorSettings(token)
      .then((all) => {
        if (cancelled) return
        const withLocation = all.filter((s) => s.location.trim())
        setOptions(withLocation)
        setLoaded(true)
        // Défaut : lieu du secteur de l'utilisateur, sinon Nord-Est ; rien si non configuré.
        if (autoDefault && !value.trim()) {
          const sector = selfSectors?.find((s) => (SECTEUR_VALUES as readonly string[]).includes(s)) ?? 'Nord-Est'
          const match = withLocation.find((s) => s.sector === sector)
          if (match) onChange(match.location)
        }
      })
      .catch(() => setLoaded(true)) // best-effort : saisie libre reste possible
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Valeur existante hors liste (ancien lieu libre) → mode « Autre » automatiquement.
  const isKnown = options.some((s) => s.location === value)
  const showCustom = custom || (loaded && value.trim() !== '' && !isKnown)
  const selectValue = showCustom ? CUSTOM_LOCATION : (isKnown ? value : '')

  const pick = (v: string) => {
    if (v === CUSTOM_LOCATION) { setCustom(true); onChange(''); return }
    setCustom(false)
    onChange(v)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-purple">
        <MapPin size={15} className="flex-shrink-0 text-gray-400" />
        <select value={selectValue} onChange={(e) => pick(e.target.value)} className="w-full bg-transparent py-2 text-[13px] outline-none">
          <option value="">Aucun lieu</option>
          {options.map((s) => (
            <option key={s.sector} value={s.location}>{s.sector} — {s.location}</option>
          ))}
          <option value={CUSTOM_LOCATION}>Autre…</option>
        </select>
      </div>
      {showCustom && (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Lieu personnalisé (visio, adresse…)"
          className={inputCls}
        />
      )}
    </div>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      {children}
    </label>
  )
}

function MonthView({ cells, cursorMonth, today, eventsByDay, onEvent, selfId }: {
  cells: Date[]; cursorMonth: number; today: Date; selfId: number
  eventsByDay: Map<string, OwnedEvent[]>; onEvent: (e: OwnedEvent) => void
}) {
  return (
    <>
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid h-[calc(100%-41px)] grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursorMonth
          const isToday = sameDay(day, today)
          const dayEvents = eventsByDay.get(day.toDateString()) ?? []
          return (
            <div key={day.toISOString()} className={`flex flex-col gap-1 overflow-hidden border-b border-r border-gray-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-gray-50/50'}`}>
              <span className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${isToday ? 'bg-purple text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => {
                  const hex = displayHex(e, selfId)
                  return (
                    <button key={e.id} onClick={() => onEvent(e)} title={e.summary}
                      className="flex items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: `${hex}22`, color: hex }}>
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: hex }} />
                      {!e.allDay && <span className="font-bold opacity-70">{formatTime(e.start)}</span>}
                      <span className="truncate">{e.summary}</span>
                    </button>
                  )
                })}
                {dayEvents.length > 3 && <span className="px-1.5 text-[10px] font-bold text-gray-400">+{dayEvents.length - 3} autres</span>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function WeekView({ days, today, eventsByDay, onEvent, onSlot, selfId }: {
  days: Date[]; today: Date; eventsByDay: Map<string, OwnedEvent[]>; selfId: number
  onEvent: (e: OwnedEvent) => void; onSlot: (start: Date) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7.5 * HOUR_PX }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Day headers */}
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
        <div />
        {days.map((d) => {
          const isToday = sameDay(d, today)
          return (
            <div key={d.toISOString()} className="border-l border-gray-100 py-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{WEEKDAYS[mondayIndex(d)]}</div>
              <div className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${isToday ? 'bg-purple text-white' : 'text-gray-700'}`}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
          {/* Hour labels */}
          <div className="relative" style={{ height: HOURS.length * HOUR_PX }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute -translate-y-1/2 pr-2 text-right text-[10px] font-semibold text-gray-400" style={{ top: h * HOUR_PX, right: 0 }}>
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayEvents = (eventsByDay.get(day.toDateString()) ?? []).filter((e) => !e.allDay)
            const positioned = layoutDay(dayEvents)
            return (
              <div key={day.toISOString()} className="relative border-l border-gray-100" style={{ height: HOURS.length * HOUR_PX }}>
                {/* Hour lines + click-to-create */}
                {HOURS.map((h) => (
                  <div key={h} onClick={() => onSlot(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0))}
                    className="cursor-pointer border-b border-gray-50 hover:bg-purple-light/40" style={{ height: HOUR_PX }} />
                ))}
                {/* Events */}
                {positioned.map(({ event, col, cols }) => {
                  const top = (minutesSinceMidnight(event.start) / 60) * HOUR_PX
                  const height = Math.max(18, ((minutesSinceMidnight(event.end) - minutesSinceMidnight(event.start)) / 60) * HOUR_PX - 2)
                  const hex = displayHex(event, selfId)
                  const width = `calc(${100 / cols}% - 4px)`
                  const left = `calc(${(100 / cols) * col}% + 2px)`
                  return (
                    <button key={event.id} onClick={(e) => { e.stopPropagation(); onEvent(event) }}
                      className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left transition-opacity hover:opacity-90"
                      style={{ top, height, width, left, backgroundColor: `${hex}26`, borderLeft: `3px solid ${hex}` }}>
                      <div className="truncate text-[11px] font-bold" style={{ color: hex }}>{event.summary}</div>
                      {height > 30 && <div className="truncate text-[10px] font-medium text-gray-500">{formatTime(event.start)} – {formatTime(event.end)}</div>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AgendasPanel({ users, visible, selfId, onToggle }: {
  users: CalendarUser[]; visible: Set<number>; selfId: number; onToggle: (id: number) => void
}) {
  const ordered = [...users].sort((a, b) => (a.isSelf === b.isSelf ? a.firstName.localeCompare(b.firstName) : a.isSelf ? -1 : 1))
  return (
    <aside className="w-52 flex-shrink-0 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-3">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Agendas</p>
      <div className="flex flex-col gap-0.5">
        {ordered.map((u) => {
          const hex = u.id === selfId ? DEFAULT_EVENT_HEX : ownerColor(u.id)
          const checked = visible.has(u.id)
          return (
            <button
              key={u.id}
              onClick={() => u.connected && onToggle(u.id)}
              disabled={!u.connected}
              title={u.connected ? '' : 'Google Calendar non connecté'}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${u.connected ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'}`}
            >
              <span
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2"
                style={{ borderColor: hex, backgroundColor: checked ? hex : 'transparent' }}
              >
                {checked && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
              </span>
              <span className="truncate text-[13px] font-semibold text-gray-700">
                {`${u.firstName} ${u.lastName}`.trim()}{u.isSelf && <span className="ml-1 text-[11px] font-medium text-gray-400">(moi)</span>}
              </span>
            </button>
          )
        })}
        {users.length === 0 && <p className="px-1 text-[12px] text-gray-400">Aucun agenda</p>}
      </div>
    </aside>
  )
}

function ConnectPrompt({ onConnect, isConnecting, onDone }: { onConnect: () => Promise<void>; isConnecting: boolean; onDone: () => void }) {
  const [err, setErr] = useState<string | null>(null)
  const handle = async () => {
    setErr(null)
    try { await onConnect(); onDone() } catch (e: any) { setErr(e?.message || 'Erreur de connexion') }
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-gray-100 bg-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-light text-purple"><CalendarDays size={28} /></div>
      <div className="text-center">
        <p className="text-[15px] font-bold text-gray-900">Google Calendar non connecté</p>
        <p className="text-[13px] text-gray-400">Connectez votre compte Google pour afficher votre agenda.</p>
      </div>
      <button onClick={handle} disabled={isConnecting} className="flex items-center gap-2 rounded-xl bg-purple px-4 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-purple-dark disabled:opacity-70">
        {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
        {isConnecting ? 'Connexion...' : 'Connecter Google'}
      </button>
      {err && <p className="text-[12px] text-danger">{err}</p>}
    </div>
  )
}

function EventModal({ event, token, isOwn, ownerName, onClose, onEdit, onAttendance, onArrived }: {
  event: OwnedEvent; token: string; isOwn: boolean; ownerName?: string
  onClose: () => void; onEdit: () => void; onAttendance: (e: CalendarEvent) => void
  onArrived: (e: CalendarEvent) => void
}) {
  const start = new Date(event.start)
  const dateLabel = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeLabel = event.allDay ? 'Toute la journée' : `${formatTime(event.start)} – ${formatTime(event.end)}`
  const hex = isOwn ? eventHex(event.colorId) : ownerColor(event.ownerId)

  const [savingAtt, setSavingAtt] = useState<Attendance | null>(null)
  const [attErr, setAttErr] = useState<string | null>(null)
  const isPast = new Date(event.end).getTime() < Date.now()

  const mark = async (status: Attendance) => {
    setSavingAtt(status); setAttErr(null)
    try {
      const updated = await setEventAttendance(token, event.id, status, event.ownerId)
      onAttendance(updated)
      // « Arrivé » → création du candidat pré-rempli puis redirection vers sa fiche.
      if (status === 'arrived') onArrived(updated)
    } catch (e) {
      setAttErr(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSavingAtt(null)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: hex }} />
          <h2 className="flex-1 text-[17px] font-extrabold leading-snug text-gray-900">{event.summary}</h2>
          <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple" title="Modifier"><Pencil size={16} /></button>
        </div>
        <div className="space-y-2 text-[13px] text-gray-600">
          {!isOwn && ownerName && (
            <p className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ backgroundColor: `${hex}22`, color: hex }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex }} /> {ownerName}
            </p>
          )}
          <p className="font-semibold capitalize text-gray-800">{dateLabel}</p>
          <p>{timeLabel}</p>
          {event.location && <p className="flex items-center gap-2"><MapPin size={14} className="text-gray-400" /> {event.location}</p>}
          {event.attendeeEmail && (
            <p className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {event.attendeeEmail}</p>
          )}
          {event.description && (
            <div className="pt-1 text-gray-500 [&_a]:font-semibold [&_a]:text-purple [&_a]:underline [&_a:hover]:text-purple-dark"
              dangerouslySetInnerHTML={{ __html: cleanHtml(event.description) }} />
          )}
        </div>

        {/* Présence de l'invité (tout event avec un email, y compris agenda d'un collègue). */}
        {event.attendeeEmail && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Présence</p>
            <div className="flex items-center gap-2">
              <button onClick={() => mark('arrived')} disabled={savingAtt !== null}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-60 ${event.attendance === 'arrived' ? 'border-success bg-success-bg text-success' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                {savingAtt === 'arrived' ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />} Venu
              </button>
              <button onClick={() => mark('noshow')} disabled={savingAtt !== null}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-60 ${event.attendance === 'noshow' ? 'border-danger bg-danger-bg text-danger' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                {savingAtt === 'noshow' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Pas venu
              </button>
            </div>
            {event.attendance === 'noshow' && (
              <p className="mt-2 text-[12px] text-gray-500">Un mail de proposition de rendez-vous a été envoyé.</p>
            )}
            {!isPast && event.attendance == null && (
              <p className="mt-2 text-[12px] text-gray-400">Le rendez-vous n'a pas encore eu lieu.</p>
            )}
            {attErr && <p className="mt-2 text-[12px] text-danger">{attErr}</p>}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {(event.meetingLink || event.hangoutLink) && (
            <a href={event.meetingLink || event.hangoutLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-purple px-3 py-2 text-[13px] font-bold text-white hover:bg-purple-dark"><Video size={15} /> Rejoindre</a>
          )}
          {event.htmlLink && (
            <a href={event.htmlLink} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-50">Ouvrir dans Google</a>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg px-3 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-700">Fermer</button>
        </div>
      </div>
    </div>
  )
}

function EventForm({ token, event, ownerId, users, selfId, defaultStart, defaultEnd, onClose, onSaved }: {
  token: string; event?: CalendarEvent; ownerId?: number
  users: CalendarUser[]; selfId: number
  defaultStart?: Date; defaultEnd?: Date
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = Boolean(event)
  // Propriétaire du calendrier cible : figé en édition (le créneau existe déjà chez lui),
  // choisissable à la création parmi les RH/responsables connectés. Défaut : soi-même.
  const [targetId, setTargetId] = useState<number>(ownerId ?? selfId)
  // La liste ne contient que des RH/responsables (+ soi) : tous connectés sont assignables.
  const assignableUsers = useMemo(() => users.filter((u) => u.connected), [users])
  const ownerName = useMemo(() => {
    const u = users.find((x) => x.id === (ownerId ?? targetId))
    return u ? `${u.firstName} ${u.lastName}`.trim() : undefined
  }, [users, ownerId, targetId])
  // Signature RH (image Drive) à apposer au mail de proposition, comme la confirmation.
  const signatureImage = useRhMailTemplatesStore((s) => s.signatureImage)
  const loadMailTemplates = useRhMailTemplatesStore((s) => s.load)
  useEffect(() => { loadMailTemplates() }, [loadMailTemplates])
  const initStart = event ? new Date(event.start) : (defaultStart ?? new Date())
  const initEnd = event ? new Date(event.end) : (defaultEnd ?? new Date(initStart.getTime() + 3600000))

  const [summary, setSummary] = useState(event?.summary ?? '')
  const [date, setDate] = useState(toDateInput(initStart))
  const [startTime, setStartTime] = useState(toTimeInput(initStart))
  const [endTime, setEndTime] = useState(toTimeInput(initEnd))
  const [location, setLocation] = useState(event?.location ?? '')
  const [attendeeEmail, setAttendeeEmail] = useState(event?.attendeeEmail ?? '')
  const [meetingLink, setMeetingLink] = useState(event?.meetingLink ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [colorId, setColorId] = useState<string | undefined>(event?.colorId)
  // Type de créneau : pilote le flag "entretien" (compté KPI RH).
  const [slotType, setSlotType] = useState<'entretien' | 'autre'>(event?.isInterview ? 'entretien' : 'autre')
  const isInterview = slotType === 'entretien'
  // Proposer un entretien : au lieu de poser un créneau, on envoie au candidat
  // le lien de réservation (emploi du temps + créneaux libres) par mail.
  const [propose, setPropose] = useState(false)
  const [proposeNote, setProposeNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const pickType = (t: 'entretien' | 'autre') => {
    setSlotType(t)
    if (t === 'entretien' && !summary.trim()) setSummary('Entretien')
  }

  const sendProposition = async () => {
    setErr(null)
    const email = attendeeEmail.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Renseignez l\'email du candidat ci-dessus'); return }
    setBusy(true)
    try {
      const settings = await fetchMyBookingSettings(token)
      if (!settings.enabled) {
        setErr('Activez d\'abord votre page de réservation (bouton Partager).'); setBusy(false); return
      }
      const url = bookingPublicUrl(settings.slug)
      const linkHtml = `<a href="${url}">${url}</a>`
      const note = proposeNote.trim()
        ? `<p>${DOMPurify.sanitize(proposeNote.trim()).replace(/\n/g, '<br/>')}</p>`
        : ''

      // Modèle configuré dans les paramètres ({{lien}}), sinon mail par défaut.
      let subject: string
      let html: string
      if (settings.propositionBody && settings.propositionBody.trim()) {
        subject = settings.propositionSubject || 'Proposition de rendez-vous — Disciplina'
        const tpl = settings.propositionBody
        html = tpl.includes('{{lien}}')
          ? tpl.replace(/\{\{lien\}\}/g, linkHtml)
          : `${tpl}<p>${linkHtml}</p>`
        if (note) html += note
      } else {
        subject = settings.propositionSubject || 'Proposition de rendez-vous — Disciplina'
        html =
          `<p>Bonjour,</p>` +
          `<p>Nous vous proposons de choisir un créneau d'entretien à votre convenance :</p>` +
          `<p>${linkHtml}</p>` +
          note +
          `<p>À très vite,<br/>L'équipe Disciplina</p>`
      }

      if (signatureImage) {
        html += `<br/><img src="${signatureImage}" alt="signature" style="width:100%;max-width:480px;height:auto"/>`
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: email, subject, body: html }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Échec de l\'envoi')
      setSent(true)
      setTimeout(onSaved, 800)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur'); setBusy(false)
    }
  }

  const submit = async () => {
    if (propose) { await sendProposition(); return }
    setErr(null)
    if (!summary.trim()) { setErr('Titre requis'); return }
    const link = meetingLink.trim()
    if (link && !/^https?:\/\//i.test(link)) { setErr('Lien invalide (http/https requis)'); return }
    const email = attendeeEmail.trim()
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Email invité invalide'); return }
    const input: CalendarEventInput = {
      summary: summary.trim(),
      start: localToISO(date, startTime),
      end: localToISO(date, endTime),
      location: location.trim() || undefined,
      attendeeEmail: email || undefined,
      meetingLink: link || undefined,
      description: description.trim() || undefined,
      colorId,
      isInterview,
    }
    if (new Date(input.end) <= new Date(input.start)) { setErr('Fin doit suivre le début'); return }
    setBusy(true)
    try {
      // ownerId omis (undefined) quand c'est son propre agenda → route par défaut sur soi.
      const owner = (isEdit ? ownerId : targetId)
      const ownerArg = owner != null && owner !== selfId ? owner : undefined
      if (isEdit && event) await updateCalendarEvent(token, event.id, input, ownerArg)
      else await createCalendarEvent(token, input, ownerArg)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur'); setBusy(false)
    }
  }

  const remove = async () => {
    if (!event || !confirm('Supprimer ce créneau ?')) return
    setBusy(true); setErr(null)
    try { await deleteCalendarEvent(token, event.id, ownerId != null && ownerId !== selfId ? ownerId : undefined); onSaved() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-gray-900">{isEdit ? 'Modifier le créneau' : 'Nouveau créneau'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <input autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Titre"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] font-semibold outline-none focus:border-purple" />

          {/* Agenda cible : choix du RH à la création, figé en édition. */}
          {!isEdit ? (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-purple">
              <UserIcon size={15} className="flex-shrink-0 text-gray-400" />
              <select
                value={targetId}
                onChange={(e) => setTargetId(Number(e.target.value))}
                className="w-full bg-transparent py-2 text-[13px] outline-none"
              >
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {`${u.firstName} ${u.lastName}`.trim()}{u.isSelf ? ' (moi)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : ownerId != null && ownerId !== selfId && ownerName ? (
            <div className="flex items-center gap-2 rounded-lg bg-purple-light px-3 py-2 text-[12px] font-semibold text-purple">
              <UserIcon size={14} /> Agenda de {ownerName}
            </div>
          ) : null}

          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-[13px] outline-none focus:border-purple" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-2 text-[13px] outline-none focus:border-purple" />
          </div>

          <LocationPicker token={token} value={location} onChange={setLocation} autoDefault={!isEdit} />

          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-purple">
            <Mail size={15} className="flex-shrink-0 text-gray-400" />
            <input type="email" value={attendeeEmail} onChange={(e) => setAttendeeEmail(e.target.value)} placeholder="Email de l'invité (envoie une confirmation)"
              className="w-full bg-transparent py-2 text-[13px] outline-none" />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-purple">
            <LinkIcon size={15} className="flex-shrink-0 text-gray-400" />
            <input type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Lien du rendez-vous (visio, optionnel)"
              className="w-full bg-transparent py-2 text-[13px] outline-none" />
          </div>

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple" />

          {/* Color picker */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={() => setColorId(undefined)} title="Défaut"
              className={`h-6 w-6 rounded-full ring-offset-2 transition-all ${colorId === undefined ? 'ring-2 ring-gray-400' : ''}`} style={{ backgroundColor: DEFAULT_EVENT_HEX }} />
            {Object.entries(EVENT_COLORS).map(([id, c]) => (
              <button key={id} type="button" onClick={() => setColorId(id)} title={c.name}
                className={`h-6 w-6 rounded-full ring-offset-2 transition-all ${colorId === id ? 'ring-2 ring-gray-400' : ''}`} style={{ backgroundColor: c.hex }} />
            ))}
          </div>

          <div className="pt-1">
            <p className="mb-1.5 text-[12px] font-semibold text-gray-500">Type de créneau</p>
            <div className="flex gap-2">
              {([['entretien', 'Entretien'], ['autre', 'Autre']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickType(key)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors ${
                    slotType === key
                      ? 'border-purple bg-purple/10 text-purple'
                      : 'border-gray-200 text-gray-500 hover:border-purple'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isInterview && (
              <p className="mt-1 text-[11px] text-gray-400">Compté dans les KPI RH.</p>
            )}
          </div>

          {/* Proposer un entretien : envoie le lien de réservation par mail au candidat. */}
          {!isEdit && (
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
              <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} className="accent-purple" />
              Proposer un entretien (envoyer le lien de réservation)
            </label>
            {propose && (
              <div className="mt-3 space-y-2">
                <p className="text-[12px] text-gray-500">
                  Le lien de votre emploi du temps sera envoyé à l'email de l'invité saisi ci-dessus.
                </p>
                <textarea value={proposeNote} onChange={(e) => setProposeNote(e.target.value)} placeholder="Message personnalisé (optionnel)" rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple" />
              </div>
            )}
          </div>
          )}

          {err && <p className="text-[12px] text-danger">{err}</p>}
          {sent && <p className="text-[12px] font-semibold text-success">Proposition envoyée ✓</p>}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {isEdit && (
            <button onClick={remove} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[13px] font-bold text-danger hover:bg-danger/10 disabled:opacity-60">
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg px-3 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-700">Annuler</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-[13px] font-bold text-white hover:bg-purple-dark disabled:opacity-60">
            {busy && <Loader2 size={15} className="animate-spin" />} {propose ? 'Envoyer la proposition' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
