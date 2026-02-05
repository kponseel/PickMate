import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCouple } from '../contexts/CoupleContext'

const navItems = [
  { to: '/', label: 'Decisions', icon: '📋' },
  { to: '/couple', label: 'Couple', icon: '💑' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export default function Layout() {
  const { user } = useAuth()

  if (!user) return <Outlet />

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-bold tracking-tight">PickMate</h1>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 px-4 safe-area-pb">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-xs transition-colors ${
                isActive ? 'text-rose-600 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
