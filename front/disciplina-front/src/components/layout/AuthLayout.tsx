import { Outlet } from 'react-router-dom'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Footer from './Footer'

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Outlet />
      <Footer />
    </div>
  )
}
