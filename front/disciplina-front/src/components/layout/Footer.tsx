export default function Footer() {
  return (
    <footer className="bg-transparent py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-disciplina.svg" alt="Disciplina" className="h-6 opacity-60" />
        <p className="text-xs text-gray-300">
          © 2025 Disciplina. Tous droits réservés.
        </p>
        <div className="flex gap-4">
          <a href="#" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Confidentialité
          </a>
          <a href="#" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Conditions
          </a>
          <a href="#" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}
