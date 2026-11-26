import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSidebarStore } from '@/store/sidebarStore'

/** Largeurs des deux états, partagées avec les enfants via CSS. */
export const SIDEBAR_COLLAPSED_WIDTH = 76
export const SIDEBAR_EXPANDED_WIDTH = 256

type CollapsibleSidebarProps = {
  children: ReactNode
  /** Intitulé de la zone, annoncé aux lecteurs d'écran. */
  label: string
}

/**
 * Barre latérale rétractée qui s'ouvre au survol.
 *
 * Trois façons de l'ouvrir, pour qu'elle reste atteignable sans souris :
 *  - le survol,
 *  - le focus clavier sur n'importe quel élément qu'elle contient,
 *  - l'épinglage, qui la fige ouverte et se retient entre les sessions.
 *
 * Elle est posée en `absolute` au-dessus du contenu : la page ne se remet pas
 * en page à chaque survol, donc aucun tableau ne saute pendant la lecture.
 * Un bloc de la largeur repliée réserve la gouttière à gauche.
 */
export default function CollapsibleSidebar({ children, label }: CollapsibleSidebarProps) {
  const pinned = useSidebarStore((s) => s.pinned)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const isOpen = pinned || hovered || focusWithin

  // Petit délai à la sortie : un passage de souris en diagonale vers le contenu
  // ne referme pas la barre sous le curseur.
  const handleEnter = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setHovered(true)
  }
  const handleLeave = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setHovered(false), 120)
  }

  /**
   * Seul un focus clavier maintient la barre ouverte.
   *
   * Après un clic à la souris, le lien cliqué garde le focus : sans cette
   * distinction, la barre resterait ouverte une fois le curseur parti, jusqu'à
   * ce qu'on aille cliquer ailleurs. `:focus-visible` est justement ce que le
   * navigateur considère comme un focus méritant d'être signalé — au clavier
   * oui, au clic non.
   */
  const isKeyboardFocus = (node: Element) => {
    try {
      return node.matches(':focus-visible')
    } catch {
      // Navigateur sans :focus-visible : on garde l'ancien comportement, plus
      // collant mais jamais bloquant pour la navigation au clavier.
      return true
    }
  }

  // Le clic relâche le focus : la barre se referme dès que la souris sort,
  // sans attendre que l'utilisateur aille cliquer autre part.
  const handlePointerUp = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' || event.pointerType === 'touch') {
      setFocusWithin(false)
    }
  }

  return (
    <>
      {/* Gouttière réservée : la barre flotte au-dessus, sans pousser la page. */}
      <div style={{ width: SIDEBAR_COLLAPSED_WIDTH }} className="h-full shrink-0" aria-hidden="true" />

      <aside
        aria-label={label}
        data-open={isOpen ? 'true' : 'false'}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onPointerUp={handlePointerUp}
        onFocusCapture={(event) => {
          if (isKeyboardFocus(event.target as Element)) setFocusWithin(true)
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusWithin(false)
          }
        }}
        style={{ width: isOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
        className={[
          'ds-glass-flush group/sidebar absolute inset-y-0 left-0 z-40',
          'flex h-full flex-col border-r border-[var(--ds-glass-border)]',
          'motion-safe:transition-[width,box-shadow] motion-safe:duration-300',
          'motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen && !pinned ? 'shadow-[var(--shadow-xl)]' : '',
        ].join(' ')}
      >
        {children}
      </aside>
    </>
  )
}

type SidebarRevealProps = {
  children: ReactNode
  className?: string
}

/**
 * Bloc qui n'existe que barre ouverte, et qui s'ouvre sans à-coup.
 *
 * `display: none` ferait apparaître le contenu d'un seul coup au milieu de
 * l'animation de largeur. On anime plutôt une grille de `0fr` à `1fr` : la
 * hauteur se déplie en même temps que la barre, et le contenu reste masqué à
 * l'assistance technique tant qu'il est replié.
 */
export function SidebarReveal({ children, className = '' }: SidebarRevealProps) {
  return (
    <div
      className={[
        // `invisible` retire le contenu replié du parcours clavier : sans lui,
        // les liens restent focusables derrière une zone rognée.
        'grid grid-rows-[0fr] opacity-0 invisible',
        'group-data-[open=true]/sidebar:grid-rows-[1fr] group-data-[open=true]/sidebar:opacity-100',
        'group-data-[open=true]/sidebar:visible',
        'motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300',
        'motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        className,
      ].join(' ')}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

type SidebarSectionTitleProps = {
  children: ReactNode
}

/**
 * Séparateur de groupe : un filet et, sur la même ligne, l'intitulé.
 *
 * Sa hauteur ne change jamais entre l'état replié et l'état ouvert — seul le
 * texte apparaît en fondu. Un titre qui se déplierait pousserait les liens
 * vers le bas pendant l'ouverture, et le clic tomberait à côté de la cible.
 */
export function SidebarSectionTitle({ children }: SidebarSectionTitleProps) {
  return (
    <div className="flex h-10 items-center gap-2 px-4" aria-hidden="true">
      <span className="h-px w-3 shrink-0 bg-[var(--ds-border)]" />
      <span
        className={[
          'whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ds-text-subtle)]',
          'opacity-0 group-data-[open=true]/sidebar:opacity-100',
          'motion-safe:transition-opacity motion-safe:duration-200',
        ].join(' ')}
      >
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--ds-border)]" />
    </div>
  )
}

type SidebarLabelProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Texte qui n'apparaît que lorsque la barre est ouverte.
 *
 * `aria-hidden` n'est pas utilisé : le libellé reste dans l'arbre
 * d'accessibilité même replié, pour que chaque lien garde son nom.
 */
export function SidebarLabel({ children, className = '', style }: SidebarLabelProps) {
  return (
    <span
      style={style}
      className={[
        'min-w-0 truncate',
        'motion-safe:transition-[opacity,transform] motion-safe:duration-200',
        'opacity-0 -translate-x-1 group-data-[open=true]/sidebar:opacity-100',
        'group-data-[open=true]/sidebar:translate-x-0',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
