import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type TooltipProps = {
  /** Texte complet affiché au survol. */
  content: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Infobulle au survol et au focus clavier.
 *
 * Rendue dans un portail sur `document.body`, et non à sa place dans l'arbre :
 * un ancêtre porteur d'une transformation CSS — une carte qui se soulève au
 * survol, par exemple — devient le référentiel des positions `fixed`, et
 * l'infobulle se retrouverait décalée de la hauteur de la carte.
 *
 * Sa position est mesurée à l'ouverture, et elle bascule sous l'élément quand
 * le haut de la fenêtre manque de place.
 *
 * L'élément déclencheur reçoit `tabIndex={0}` et `aria-describedby` : le texte
 * complet reste donc atteignable sans souris, ce qu'un simple `title` ne
 * garantit ni au clavier ni sur écran tactile.
 */
export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; below: boolean } | null>(null)

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    // 44px : hauteur approchée de l'infobulle plus sa flèche d'espacement.
    const below = rect.top < 56
    setPosition({
      top: below ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      below,
    })
  }

  const hide = () => setPosition(null)

  // Échap referme, et un défilement invalide la position mesurée.
  useEffect(() => {
    if (!position) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', hide, true)
    }
  }, [position])

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)] ${className}`}
      >
        {children}
      </span>

      {position && createPortal(
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: `translate(-50%, ${position.below ? '0' : '-100%'})`,
          }}
          className={[
            'ds-glass-strong pointer-events-none z-[300] max-w-xs rounded-[var(--radius-md)] px-3 py-2',
            'text-[12px] leading-snug text-[var(--ds-text)]',
            'motion-safe:animate-[ds-fade-in_120ms_ease-out]',
          ].join(' ')}
        >
          {content}
        </span>,
        document.body,
      )}
    </>
  )
}
