import Tooltip from './Tooltip'

type TruncatedTextProps = {
  text: string
  /** Au-delà, le texte est coupé et la version complète passe en infobulle. */
  maxChars?: number
  className?: string
}

/**
 * Texte d'une seule ligne, coupé s'il est trop long.
 *
 * Même principe que `TruncatedBadge`, mais sans le fond de pastille : pour les
 * lignes d'information où un libellé métier peut être une phrase entière.
 */
export default function TruncatedText({ text, maxChars = 70, className = '' }: TruncatedTextProps) {
  const label = text.trim()
  if (label.length <= maxChars) return <span className={className}>{label}</span>

  return (
    <Tooltip content={label} className={`cursor-help truncate ${className}`}>
      <span>{`${label.slice(0, maxChars).trimEnd()}…`}</span>
    </Tooltip>
  )
}
