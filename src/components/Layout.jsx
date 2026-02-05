import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Decisions', icon: '📋', activeIcon: '📋' },
  { to: '/couple', label: 'Couple', icon: '💕', activeIcon: '💑' },
  { to: '/profile', label: 'Profile', icon: '👤', activeIcon: '👤' },
]

export default function Layout() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Outlet />

  return (
    <div className="min-h-screen flex flex-col bg-rose-50">
      {/* Modern Header with glassmorphism */}
      <header className="glass-rose sticky top-0 z-30 text-white px-5 py-4 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">PM</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight">PickMate</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
            {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main content with page transitions */}
      <main className="flex-1 px-4 py-4 pb-24 max-w-lg mx-auto w-full">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Modern Bottom Navigation with glass effect */}
      <nav className="fixed bottom-0 left-0 right-0 glass z-40 safe-bottom">
        <div className="max-w-lg mx-auto flex justify-around py-2 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-rose-600 bg-rose-50'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    {isActive ? item.activeIcon : item.icon}
                  </span>
                  <span className={`text-xs font-medium ${isActive ? 'text-rose-600' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-0 w-1 h-1 bg-rose-600 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
