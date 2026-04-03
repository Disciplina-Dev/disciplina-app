import { Outlet } from 'react-router-dom'
import { Button } from '../ui'

export default function RHLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-purple text-white p-4">
        <Button>Toto</Button>
        <p>RH</p>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
