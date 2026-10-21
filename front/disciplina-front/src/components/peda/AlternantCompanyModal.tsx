import { useState } from 'react'
import { IconClose, IconCompany } from '@/components/ui/icons'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import type { AlternantCompany } from '@/types/alternant'

interface AlternantCompanyModalProps {
  initial?: AlternantCompany | null
  onClose: () => void
  onSubmit: (company: { name?: string | null; address?: string | null; mentorName?: string | null; startDate: string; endDate?: string | null }) => Promise<void>
}

export default function AlternantCompanyModal({ initial, onClose, onSubmit }: AlternantCompanyModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [mentorName, setMentorName] = useState(initial?.mentorName ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ? initial.startDate.slice(0, 10) : '')
  const [endDate, setEndDate] = useState(initial?.endDate ? (initial.endDate as string).slice(0, 10) : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!startDate) {
      setError('La date d’entrée en entreprise est obligatoire.')
      return
    }
    if (endDate && endDate < startDate) {
      setError('La date de fin doit être postérieure à la date d’entrée.')
      return
    }
    setLoading(true)
    try {
      await onSubmit({
        name: name.trim() || null,
        address: address.trim() || null,
        mentorName: mentorName.trim() || null,
        startDate,
        endDate: endDate || null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--ds-text)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--ds-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ds-text)]">
            <IconCompany width={20} height={20} className="text-teal-700" />
            Changement d’entreprise
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-[13px] text-[var(--ds-text-subtle)]">
            Les SA automatiques à venir seront régénérées à partir des nouvelles dates.
          </p>
          <InputField id="cmp-name" label="Nom de l’entreprise" value={name} onChange={(e) => setName(e.target.value)} />
          <InputField id="cmp-address" label="Adresse de l’entreprise" value={address} onChange={(e) => setAddress(e.target.value)} />
          <InputField id="cmp-mentor" label="Maître d’apprentissage" value={mentorName} onChange={(e) => setMentorName(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField id="cmp-start" label="Date d’entrée en entreprise" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <InputField id="cmp-end" label="Date de fin en entreprise" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {error && <p className="text-sm text-[var(--ds-danger)]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--ds-border)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}
