import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

type Indicator = { left: number; width: number }

/**
 * Mesure la position de l'élément actif dans une barre de choix, pour qu'une
 * pilule puisse glisser jusqu'à lui.
 *
 * La position vient du DOM réel plutôt que d'un calcul sur les index : elle
 * reste juste quelles que soient la longueur des libellés, la police chargée
 * ou la largeur disponible.
 */
export function useSlidingIndicator<T extends string | number>(value: T, optionCount: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<T, HTMLElement>())
  const [indicator, setIndicator] = useState<Indicator | null>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    const active = itemRefs.current.get(value)
    if (!container || !active) return
    const containerBox = container.getBoundingClientRect()
    const activeBox = active.getBoundingClientRect()
    setIndicator({ left: activeBox.left - containerBox.left, width: activeBox.width })
  }, [value])

  // Avant peinture : la pilule n'apparaît jamais au mauvais endroit.
  useLayoutEffect(measure, [measure, optionCount])

  // Le texte peut être remis en page après coup (police chargée, fenêtre
  // redimensionnée) : on suit la taille réelle.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    for (const node of itemRefs.current.values()) observer.observe(node)
    return () => observer.disconnect()
  }, [measure, optionCount])

  const registerItem = useCallback(
    (key: T) => (node: HTMLElement | null) => {
      if (node) itemRefs.current.set(key, node)
      else itemRefs.current.delete(key)
    },
    [],
  )

  const focusItem = useCallback((key: T) => {
    itemRefs.current.get(key)?.focus()
  }, [])

  return { containerRef, registerItem, focusItem, indicator }
}
