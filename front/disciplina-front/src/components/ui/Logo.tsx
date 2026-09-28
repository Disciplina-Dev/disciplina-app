type LogoProps = {
  /** Hauteur en classe Tailwind (ex. `h-8`). */
  className?: string
  /** `mark` = pictogramme carré, `full` = logotype complet. */
  variant?: 'mark' | 'full'
  /**
   * Texte alternatif. Vide par défaut : le logo est décoratif quand il est
   * accompagné du nom de l'espace, ce qui évite une double annonce.
   */
  alt?: string
}

/**
 * Logo Disciplina.
 *
 * Le fichier est dessiné en encre foncée : en thème sombre il est posé sur une
 * plaque claire plutôt que recolorisé ou inversé, pour que les couleurs de la
 * charte restent exactes.
 */
export default function Logo({ className = 'h-8', variant = 'full', alt = '' }: LogoProps) {
  const src = variant === 'mark' ? '/icon-logo.png' : '/logo-disciplina.svg'

  return (
    <span className="inline-flex shrink-0 items-center rounded-[var(--radius-sm)] dark:bg-white dark:px-2 dark:py-1">
      {/* `object-contain` + `shrink-0` : dans une barre qui se rétracte, le
          logo garderait sinon la hauteur en perdant sa largeur. */}
      <img src={src} alt={alt} className={`${className} shrink-0 object-contain`} />
    </span>
  )
}
