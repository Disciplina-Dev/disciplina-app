import { Link } from 'react-router-dom'
import Footer from '@/components/layout/Footer'

type Props = {
  title: string
  children: React.ReactNode
}

const LINKS = [
  { to: '/legal/cgu', label: "Conditions d'utilisation" },
  { to: '/legal/confidentialite', label: 'Confidentialité' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal/mentions', label: 'Mentions légales' },
]

export default function LegalLayout({ title, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link to="/">
            <img src="/logo-disciplina.svg" alt="Disciplina" className="h-6" />
          </Link>
          <nav className="flex flex-wrap gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={
                  link.label === title
                    ? 'text-xs font-bold text-purple'
                    : 'text-xs text-gray-500 transition-colors hover:text-gray-900'
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <Footer />
    </div>
  )
}
