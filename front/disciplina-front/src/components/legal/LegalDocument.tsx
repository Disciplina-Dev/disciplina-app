import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'

/**
 * Rendu des documents légaux (`src/content/legal/*.md`).
 *
 * Tailwind v4 est utilisé sans le plugin `typography` : chaque balise reçoit ses
 * classes explicitement, alignées sur les tokens de `index.css`.
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-2 mb-6 text-2xl font-bold text-[var(--ds-text)]">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 border-b border-[var(--ds-border)] pb-2 text-lg font-bold text-purple">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-[15px] font-bold text-[var(--ds-text)]">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[14px] leading-relaxed text-[var(--ds-text-muted)]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[var(--ds-text-muted)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-[var(--ds-text-muted)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-[var(--ds-text)]">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r border-l-4 border-purple-light bg-[var(--ds-surface-sunken)] px-4 py-2 text-[13px] text-[var(--ds-text-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-[var(--ds-border)]" />,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--ds-surface-sunken)]">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-[var(--ds-border)] px-3 py-2 font-bold text-[var(--ds-text)]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--ds-border)] px-3 py-2 align-top text-[var(--ds-text-muted)]">{children}</td>
  ),
  code: ({ children }) => (
    <code className="rounded bg-[var(--ds-surface-sunken)] px-1.5 py-0.5 font-mono text-[12px] text-purple-dark">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const target = href ?? '#'
    // Les renvois internes entre documents légaux restent en navigation SPA.
    if (target.startsWith('/')) {
      return (
        <Link to={target} className="text-purple underline hover:text-purple-dark">
          {children}
        </Link>
      )
    }
    return (
      <a
        href={target}
        target="_blank"
        rel="noopener noreferrer"
        className="text-purple underline hover:text-purple-dark"
      >
        {children}
      </a>
    )
  },
}

export default function LegalDocument({ source }: { source: string }) {
  return (
    <article>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </Markdown>
    </article>
  )
}
