import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, AlertCircle, Check, CalendarClock, MapPin } from 'lucide-react'
import { getInterviewSlots, bookInterviewSlot, SlotUnavailableError, type InterviewSlotsResult } from '@/api/interview'
import { useGuestInterviewTokenStore } from '@/store/guestInterviewTokenStore'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">{children}</div>
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function InterviewSlotPicker() {
  const { signature = '' } = useParams()
  const navigate = useNavigate()
  const token = useGuestInterviewTokenStore((s) => s.token)
  const clearToken = useGuestInterviewTokenStore((s) => s.clearToken)

  const [data, setData] = useState<InterviewSlotsResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [bookedSlot, setBookedSlot] = useState<string | null>(null)

  const load = () => {
    if (!token) return
    getInterviewSlots(signature, token)
      .then(setData)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Erreur'))
  }

  useEffect(() => {
    if (!token) {
      navigate(`/public/interview?sig=${signature}`)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, token, navigate])

  const pickSlot = async (slot: string) => {
    if (!token) return
    setBusySlot(slot)
    setLoadError(null)
    try {
      await bookInterviewSlot(signature, token, slot)
      clearToken()
      setBookedSlot(slot)
      setDone(true)
    } catch (e) {
      if (e instanceof SlotUnavailableError) {
        setLoadError(e.message)
        load()
      } else {
        setLoadError(e instanceof Error ? e.message : 'Erreur')
      }
    } finally {
      setBusySlot(null)
    }
  }

  if (done) {
    return (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
            <Check size={30} />
          </div>
          <p className="text-[17px] font-extrabold text-gray-900">Créneau confirmé</p>
          {bookedSlot && <p className="text-[13px] text-gray-500">{formatSlot(bookedSlot)}</p>}
          <p className="text-[13px] text-gray-500">Votre conseiller a été notifié.</p>
        </div>
      </Centered>
    )
  }

  if (!data) {
    if (loadError) {
      return (
        <Centered>
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle size={32} className="text-danger" />
            <p className="text-[13px] text-gray-500">{loadError}</p>
          </div>
        </Centered>
      )
    }
    return (
      <Centered>
        <Loader2 size={28} className="animate-spin text-purple" />
      </Centered>
    )
  }

  if (data.bookedSlot) {
    return (
      <Centered>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
            <Check size={30} />
          </div>
          <p className="text-[17px] font-extrabold text-gray-900">Vous avez déjà choisi un créneau</p>
          <p className="text-[13px] text-gray-500">{formatSlot(data.bookedSlot)}</p>
        </div>
      </Centered>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <p className="text-[12px] font-bold uppercase tracking-wider text-purple">Disciplina</p>
        <h1 className="mt-1 text-[20px] font-extrabold text-gray-900">Choisissez votre créneau d'entretien</h1>

        {data.location && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-gray-600">
            <MapPin size={14} /> {data.location}
          </p>
        )}

        {loadError && <p className="mt-3 text-[12px] text-danger">{loadError}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {data.slots.map(({ slot, taken }) => (
            <button
              key={slot}
              onClick={() => pickSlot(slot)}
              disabled={taken || busySlot !== null}
              className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                taken
                  ? 'border-gray-100 bg-gray-50 text-gray-400'
                  : 'border-gray-200 text-gray-800 hover:border-purple hover:bg-purple/5'
              } disabled:opacity-60`}
            >
              <span className="flex items-center gap-2">
                <CalendarClock size={15} /> {formatSlot(slot)}
              </span>
              {taken ? (
                <span className="text-[11px] font-semibold text-gray-400">Pris</span>
              ) : busySlot === slot ? (
                <Loader2 size={15} className="animate-spin text-purple" />
              ) : null}
            </button>
          ))}
          {data.slots.length === 0 && (
            <p className="text-[13px] text-gray-500">Aucun créneau n'est disponible pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  )
}
