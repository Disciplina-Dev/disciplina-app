import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, AlertCircle, CalendarClock, MapPin, CircleCheck } from 'lucide-react'
import {
  getInterviewSlots,
  bookInterviewSlot,
  ExternalAuthError,
  SlotUnavailableError,
  SessionCompletedError,
  type InterviewSlotsResult,
} from '@/api/externalInterview'

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
    timeZone: 'Indian/Reunion',
  })
}

function AlreadyDone() {
  return (
    <Centered>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <CircleCheck size={32} className="text-green-500" />
        <p className="text-[17px] font-extrabold text-gray-900">Démarche déjà finalisée</p>
        <p className="text-[13px] text-gray-500">Vous avez déjà réservé votre créneau d'entretien.</p>
      </div>
    </Centered>
  )
}

export default function ExternalInterview() {
  const { signature = '' } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState<InterviewSlotsResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [bookedSlot, setBookedSlot] = useState<string | null>(null)

  const load = () => {
    getInterviewSlots(signature)
      .then(setData)
      .catch((e) => {
        if (e instanceof ExternalAuthError) {
          navigate(`/external/authenticate?sig=${signature}`, { replace: true })
          return
        }
        setLoadError(e instanceof Error ? e.message : 'Erreur')
      })
  }

  useEffect(() => {
    if (!signature) {
      navigate('/external/authenticate', { replace: true })
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, navigate])

  const pickSlot = async (slot: string) => {
    setBusySlot(slot)
    setLoadError(null)
    try {
      await bookInterviewSlot(signature, slot)
      setBookedSlot(slot)
    } catch (e) {
      if (e instanceof ExternalAuthError) {
        navigate(`/external/authenticate?sig=${signature}`, { replace: true })
        return
      }
      setLoadError(e instanceof Error ? e.message : 'Erreur')
      if (e instanceof SlotUnavailableError || e instanceof SessionCompletedError) load()
    } finally {
      setBusySlot(null)
    }
  }

  if (bookedSlot) return <AlreadyDone />

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

  if (data.bookedSlot) return <AlreadyDone />

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