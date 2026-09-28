import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { IconAlert, IconCalendar, IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconLoader, IconMapPin } from '@/components/ui/icons'
import {
  fetchPublicBooking, fetchPublicSlots, createBooking,
  type PublicBookingInfo, type Slot,
} from '@/api/booking'

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

export default function PublicBooking() {
  const { slug = '' } = useParams()
  const [info, setInfo] = useState<PublicBookingInfo | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [day, setDay] = useState(() => new Date())
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmed, setConfirmed] = useState<Slot | null>(null)

  useEffect(() => {
    fetchPublicBooking(slug)
      .then(setInfo)
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Erreur'))
  }, [slug])

  const dayStr = useMemo(() => toDateInput(day), [day])

  useEffect(() => {
    if (!info) return
    setLoadingSlots(true); setSelected(null)
    fetchPublicSlots(slug, dayStr, dayStr)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [slug, dayStr, info])

  if (loadErr) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <IconAlert width={32} height={32} className="text-[var(--ds-danger)]" />
          <p className="text-[15px] font-bold text-[var(--ds-text)]">Page indisponible</p>
          <p className="text-[13px] text-[var(--ds-text-subtle)]">{loadErr}</p>
        </div>
      </Centered>
    )
  }

  if (!info) return <Centered><IconLoader width={28} height={28} className="animate-spin text-purple" /></Centered>

  if (confirmed) {
    return (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ds-success-bg)] text-[var(--ds-success)]"><IconCheck width={30} height={30} /></div>
          <p className="text-[17px] font-extrabold text-[var(--ds-text)]">Rendez-vous confirmé</p>
          <p className="text-[13px] text-[var(--ds-text-subtle)]">
            {new Date(confirmed.start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[12px] text-[var(--ds-text-subtle)]">Un email de confirmation vous a été envoyé par {info.hostName}.</p>
        </div>
      </Centered>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--ds-surface-sunken)] px-4 py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-sm">
        {/* En-tête */}
        <div className="border-b border-[var(--ds-border)] p-6">
          <p className="text-[12px] font-bold uppercase tracking-wider text-purple">{info.hostName}</p>
          <h1 className="mt-1 text-[22px] font-extrabold text-[var(--ds-text)]">{info.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-[var(--ds-text-subtle)]">
            <span className="inline-flex items-center gap-1.5"><IconClock width={15} height={15} /> {info.durationMin} min</span>
            {info.location && <span className="inline-flex items-center gap-1.5"><IconMapPin width={15} height={15} /> {info.location}</span>}
            <span className="inline-flex items-center gap-1.5"><IconCalendar width={15} height={15} /> {info.timezone}</span>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr]">
          {/* Sélecteur de jour + créneaux */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setDay((d) => addDays(d, -1))} disabled={dayStr <= toDateInput(new Date())}
                className="rounded-lg border border-[var(--ds-border)] p-1.5 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)] disabled:opacity-40">
                <IconChevronLeft width={16} height={16} />
              </button>
              <p className="text-[14px] font-bold capitalize text-[var(--ds-text)]">
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button onClick={() => setDay((d) => addDays(d, 1))}
                className="rounded-lg border border-[var(--ds-border)] p-1.5 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-sunken)]">
                <IconChevronRight width={16} height={16} />
              </button>
            </div>

            {loadingSlots ? (
              <div className="flex justify-center py-10"><IconLoader width={22} height={22} className="animate-spin text-purple" /></div>
            ) : slots.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[var(--ds-text-subtle)]">Aucun créneau libre ce jour-là.</p>
            ) : (
              <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {slots.map((s) => {
                  const active = selected?.start === s.start
                  return (
                    <button key={s.start} onClick={() => setSelected(s)}
                      className={`rounded-lg border px-3 py-2.5 text-[13px] font-bold transition-colors ${active ? 'border-purple bg-purple text-white' : 'border-[var(--ds-border)] text-[var(--ds-text-muted)] hover:border-purple'}`}>
                      {new Date(s.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Formulaire de réservation */}
          <div className="border-t border-[var(--ds-border)] pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {selected ? (
              <BookingForm slug={slug} slot={selected} onDone={setConfirmed} />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[13px] text-[var(--ds-text-subtle)]">
                Sélectionnez un créneau pour réserver.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BookingForm({ slug, slot, onDone }: { slug: string; slot: Slot; onDone: (s: Slot) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (!name.trim()) { setErr('Nom requis'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Email invalide'); return }
    setBusy(true)
    try {
      const booked = await createBooking(slug, { start: slot.start, name: name.trim(), email: email.trim(), note: note.trim() || undefined })
      onDone(booked)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur'); setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-bold text-[var(--ds-text)]">
        {new Date(slot.start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom"
        className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-[13px] outline-none focus:border-purple" />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Votre email"
        className="w-full rounded-lg border border-[var(--ds-border)] px-3 py-2 text-[13px] outline-none focus:border-purple" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message (optionnel)" rows={3}
        className="w-full resize-none rounded-lg border border-[var(--ds-border)] px-3 py-2 text-[13px] outline-none focus:border-purple" />
      {err && <p className="text-[12px] text-[var(--ds-danger)]">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="flex items-center justify-center gap-2 rounded-lg bg-purple px-4 py-2.5 text-[14px] font-bold text-white hover:bg-purple-dark disabled:opacity-60">
        {busy && <IconLoader width={16} height={16} className="animate-spin" />} Confirmer le rendez-vous
      </button>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--ds-surface-sunken)] p-6">{children}</div>
}
