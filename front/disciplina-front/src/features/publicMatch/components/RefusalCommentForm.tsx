export default function RefusalCommentForm({
  value,
  onChange,
}: {
  value: string
  onChange: (comment: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-bold text-gray-800">Motif du refus (facultatif)</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Précisez la raison du refus si vous le souhaitez..."
        rows={3}
        className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple"
      />
    </div>
  )
}
