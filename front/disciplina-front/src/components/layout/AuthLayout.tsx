import { Outlet } from 'react-router-dom'
import Footer from './Footer'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Outlet />
      <Footer />
    </div>
  )
}
