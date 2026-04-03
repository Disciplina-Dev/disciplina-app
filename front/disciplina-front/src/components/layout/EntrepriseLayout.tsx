import { Outlet } from 'react-router-dom'

export default function EntrepriseLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <p>Entreprise</p>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
