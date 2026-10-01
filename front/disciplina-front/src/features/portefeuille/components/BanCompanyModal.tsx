import { useState } from 'react'
import { IconClose, IconWarning } from '@/components/ui/icons'
import type { Entreprise } from '@/types/entreprise'
import { normalizeSiret } from '@/types/sourcing'
import Button from '@/components/ui/Button'
import { useBlacklistCompany } from '@/graphql/hooks'

interface Props {
  entreprise: Entreprise
  onClose: () => void
  onSuccess: () => void
}

export default function BanCompanyModal({ entreprise, onClose, onSuccess }: Props) {
  const { blacklistCompany, result } = useBlacklistCompany()
  const [reason, setReason] = useState('')
  const [siretConfirm, setSiretConfirm] = useState('')
  const [allBlacklist, setAllBlacklist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expectedSiret = normalizeSiret(entreprise.siret ?? '')
  const siretMatches = expectedSiret.length === 14 && normalizeSiret(siretConfirm) === expectedSiret
  const canConfirm = reason.trim().length > 0 && siretMatches

  const handleConfirm = async () => {
    if (!canConfirm) return
    setError(null)
    const response = await blacklistCompany(Number(entreprise.id), reason.trim(), allBlacklist)
    if (response.error) {
      setError(response.error.message)
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--ds-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--ds-border)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ds-danger-bg)]">
              <IconWarning className="h-5 w-5 text-[var(--ds-danger)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--ds-text)]">Bannir l'entreprise</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ds-text-subtle)] hover:bg-[var(--ds-surface-sunken)]">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-[var(--ds-text-muted)]">
            Cette action est irréversible. L'entreprise <strong>{entreprise.nom_commercial}</strong> sera retirée
            du portefeuille et ajoutée à la liste noire.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--ds-text-muted)]" htmlFor="ban-reason">
              Raison du bannissement *
            </label>
            <textarea
              id="ban-reason"
              rows={3}
              maxLength={255}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez pourquoi cette entreprise est blacklistée…"
              className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-4 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-blue resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--ds-text-muted)]">
            <input
              type="checkbox"
              checked={allBlacklist}
              onChange={(e) => setAllBlacklist(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--ds-border-strong)] accent-blue cursor-pointer"
            />
            Blacklister toute l'unité légale (même SIREN)
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--ds-text-muted)]" htmlFor="ban-siret-confirm">
              Tapez le SIRET <span className="font-mono">{entreprise.siret}</span> pour confirmer
            </label>
            <input
              id="ban-siret-confirm"
              inputMode="numeric"
              autoComplete="off"
              value={siretConfirm}
              onChange={(e) => setSiretConfirm(e.target.value)}
              placeholder={entreprise.siret ?? ''}
              className="w-full rounded-[10px] border border-[var(--ds-border)] bg-[var(--ds-surface)] py-2.5 px-4 text-sm text-[var(--ds-text)] outline-none transition-colors focus:border-blue font-mono tracking-wider"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-danger/20 bg-[var(--ds-danger-bg)] px-4 py-2.5 text-sm text-[var(--ds-danger)]">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-[var(--ds-border)]">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="danger" disabled={!canConfirm} isLoading={result.fetching} onClick={handleConfirm}>
            Bannir définitivement
          </Button>
        </div>
      </div>
    </div>
  )
}
