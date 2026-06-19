import { Plus, Trash2 } from 'lucide-react'

export default function InterviewProposalForm({
  slots,
  onChange,
}: {
  slots: string[]
  onChange: (slots: string[]) => void
}) {
  const updateSlot = (index: number, localValue: string) => {
    const next = [...slots]
    next[index] = localValue ? new Date(localValue).toISOString() : ''
    onChange(next)
  }

  const toLocalInput = (iso: string): string => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-bold text-gray-800">Créneaux d'entretien proposés</p>
      {slots.map((slot, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={toLocalInput(slot)}
            onChange={(e) => updateSlot(index, e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple"
          />
          <button
            onClick={() => onChange(slots.filter((_, i) => i !== index))}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-danger hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...slots, ''])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[13px] font-bold text-gray-600 hover:border-purple hover:text-purple"
      >
        <Plus size={15} /> Ajouter un créneau
      </button>
    </div>
  )
}
