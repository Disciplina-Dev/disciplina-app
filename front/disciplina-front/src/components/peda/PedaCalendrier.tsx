import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconExternalLink,
  IconLoader,
  IconMapPin,
  IconRefresh,
} from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import {
  fetchPedaCalendarEvents,
  PedaCalendarNotConnectedError,
  type PedaCalendarEvent,
} from '@/api/peda'
import { rescheduleSequence } from '@/api/alternants'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Lundi = 0 … Dimanche = 6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
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

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Clé `YYYY-MM-DD` d'une date, dans le fuseau local. */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Clé du jour d'un événement : date `YYYY-MM-DD` pour une journée entière. */
function eventDayKey(e: PedaCalendarEvent): string {
  if (e.allDay) return e.start.slice(0, 10)
  return ymd(new Date(e.start))
}

/** Heure locale `HH:mm` d'un événement horaire. */
function eventTime(e: PedaCalendarEvent): string {
  if (e.allDay) return ''
  const d = new Date(e.start)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Grille du mois : 6 semaines de 7 jours, du lundi au dimanche. */
function buildMonthGrid(year: number, month: number): Date[] {
  const gridStart = startOfWeek(new Date(year, month, 1))
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export default function PedaCalendrier() {
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [events, setEvents] = useState<PedaCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<PedaCalendarEvent | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  useEffect(() => {
    let alive = true
    // Fenêtre chargée : la grille complète du mois (débordement des semaines inclus).
    const gridStart = startOfWeek(new Date(viewYear, viewMonth, 1))
    const gridEnd = addDays(gridStart, 42)
    fetchPedaCalendarEvents(gridStart, gridEnd).then(
      (data) => {
        if (!alive) return
        setEvents(data.events)
        setNotConnected(false)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setNotConnected(e instanceof PedaCalendarNotConnectedError)
        setError(e instanceof Error ? e.message : 'Chargement impossible')
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [viewYear, viewMonth, refreshKey])

  function goToMonth(delta: number) {
    setLoading(true)
    setError(null)
    setViewDate((d) => addMonths(d, delta))
  }

  function goToToday() {
    const now = new Date()
    setLoading(true)
    setError(null)
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  function reload() {
    setLoading(true)
    setError(null)
    setRefreshKey((k) => k + 1)
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setSyncMessage(null)
    const gridStart = startOfWeek(new Date(viewYear, viewMonth, 1))
    const gridEnd = addDays(gridStart, 42)
    try {
      // GET = pull des modifications Google puis push de l'état des SA, en une passe.
      const data = await fetchPedaCalendarEvents(gridStart, gridEnd)
      setEvents(data.events)
      setNotConnected(false)
      const { created, updated, deleted, rescheduled } = data.report
      setSyncMessage(
        `${created} créée(s), ${updated} mise(s) à jour, ${deleted} supprimée(s), ${rescheduled} replanifiée(s).`,
      )
      setLoading(false)
    } catch (e) {
      setNotConnected(e instanceof PedaCalendarNotConnectedError)
      setError(e instanceof Error ? e.message : 'Synchronisation impossible')
    } finally {
      setSyncing(false)
    }
  }

  const eventsByDay = new Map<string, PedaCalendarEvent[]>()
  for (const event of events) {
    const key = eventDayKey(event)
    const list = eventsByDay.get(key)
    if (list) list.push(event)
    else eventsByDay.set(key, [event])
  }

  const todayKey = ymd(new Date())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Mois précédent"
            className="rounded-full border border-[var(--ds-border)] p-2 text-[var(--ds-text-muted)] transition-colors hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconChevronLeft width={16} height={16} />
          </button>
          <h2 className="min-w-[180px] text-center text-lg font-bold capitalize text-[var(--ds-text)]">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Mois suivant"
            className="rounded-full border border-[var(--ds-border)] p-2 text-[var(--ds-text-muted)] transition-colors hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconChevronRight width={16} height={16} />
          </button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {syncMessage && <span className="text-[12px] text-[var(--ds-text-subtle)]">{syncMessage}</span>}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconRefresh width={16} height={16} />}
            isLoading={syncing}
            onClick={handleSync}
            title="Récupère les modifications faites dans Google Calendar, puis y renvoie l'état des SA"
          >
            Synchroniser
          </Button>
        </div>
      </div>

      {notConnected && (
        <div className="rounded-xl border border-[var(--ds-warning)]/40 bg-[var(--ds-warning)]/10 px-4 py-3 text-sm text-[var(--ds-text-muted)]">
          Connectez votre compte Google (bandeau ci-dessus) pour afficher vos SA dans votre agenda.
        </div>
      )}
      {error && !notConnected && (
        <div className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-bg)] px-4 py-3 text-sm text-[var(--ds-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--ds-text-subtle)]">
          <IconLoader width={28} height={28} className="animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-sm">
          <div className="grid grid-cols-7 border-b border-[var(--ds-border)]">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2.5 text-center text-[12px] font-bold uppercase tracking-wide text-[var(--ds-text-subtle)]">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()).map((day) => {
              const key = ymd(day)
              const inMonth = day.getMonth() === viewDate.getMonth()
              const dayEvents = eventsByDay.get(key) ?? []
              return (
                <div
                  key={key}
                  className={[
                    'min-h-[96px] border-b border-r border-[var(--ds-border)] p-1.5',
                    inMonth ? '' : 'bg-[var(--ds-surface-sunken)]/60',
                  ].join(' ')}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
                        key === todayKey
                          ? 'bg-teal-700 text-white'
                          : inMonth
                            ? 'text-[var(--ds-text-muted)]'
                            : 'text-[var(--ds-text-subtle)]',
                      ].join(' ')}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelected(event)}
                        title={event.summary}
                        className={[
                          'flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors',
                          event.saSequenceId
                            ? 'bg-teal-700/10 text-teal-800 hover:bg-teal-700/20'
                            : 'bg-[var(--ds-surface-sunken)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-border)]',
                        ].join(' ')}
                      >
                        {event.saSequenceId ? <IconCalendar width={11} height={11} className="shrink-0" /> : null}
                        {eventTime(event) && <span className="shrink-0 font-bold">{eventTime(event)}</span>}
                        <span className="truncate">{event.summary}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1.5 text-[10px] text-[var(--ds-text-subtle)]">
                        +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <EventDetail
          key={selected.id}
          event={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

/** Panneau de détail : les SA sont replanifiables, les autres événements sont en lecture seule. */
function EventDetail({
  event,
  onClose,
  onSaved,
}: {
  event: PedaCalendarEvent
  onClose: () => void
  onSaved: () => void
}) {
  const isSa = Boolean(event.saSequenceId)
  const [date, setDate] = useState(eventDayKey(event))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!event.saSequenceId || !date) return
    setSaving(true)
    setError(null)
    try {
      // Midi UTC : évite tout décalage de jour selon le fuseau du tenant.
      await rescheduleSequence(event.saSequenceId, `${date}T12:00:00.000Z`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replanification impossible')
    } finally {
      setSaving(false)
    }
  }

  const dayLabel = new Date(`${eventDayKey(event)}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--ds-text)]">{event.summary}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] capitalize text-[var(--ds-text-subtle)]">
              <IconCalendar width={13} height={13} /> {dayLabel}
              {eventTime(event) && ` · ${eventTime(event)}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose width={18} height={18} />
          </button>
        </div>

        {event.location && (
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--ds-text-muted)]">
            <IconMapPin width={14} height={14} className="shrink-0 text-[var(--ds-text-subtle)]" />
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="mb-2 whitespace-pre-line text-[13px] text-[var(--ds-text-muted)]">{event.description}</p>
        )}

        {error && <p className="mt-2 text-[12px] text-[var(--ds-danger)]">{error}</p>}

        {isSa ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--ds-border)] pt-4">
            <InputField
              id={`sa-cal-date-${event.id}`}
              label="Date prévue de la SA"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-[11px] text-[var(--ds-text-subtle)]">
              Le déplacement d'une SA décale aussi les SA suivantes. La date est reportée dans la liste des SA.
            </p>
            <div className="flex items-center justify-between gap-2">
              {event.saAlternantId ? (
                <Link
                  to={`/peda/alternants/${event.saAlternantId}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline"
                >
                  <IconExternalLink width={14} height={14} /> Ouvrir la fiche
                </Link>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" isLoading={saving} disabled={!date} onClick={handleSave}>
                  Replanifier
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--ds-border)] pt-4">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline"
              >
                <IconExternalLink width={14} height={14} /> Ouvrir dans Google
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
