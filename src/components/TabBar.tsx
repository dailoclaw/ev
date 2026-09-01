import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './ui'

const TABS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/analytics', icon: 'chart', label: 'Stats' },
  { fab: true },
  { path: '/vehicle', icon: 'car', label: 'Vehicle' },
  { path: '/settings', icon: 'gear', label: 'Settings' },
] as const

export default function TabBar({ onAdd }: { onAdd: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isActive = (path: string) => (path === '/analytics' ? pathname.startsWith('/analytics') : pathname === path)

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((tab, i) =>
        'fab' in tab ? (
          <div className="fabwrap" key={i}>
            <button className="fabb" type="button" aria-label="Add charge" onClick={onAdd}>
              <Icon name="plus" />
            </button>
          </div>
        ) : (
          <button
            key={tab.path}
            className={`ti ${isActive(tab.path) ? 'on' : ''}`}
            type="button"
            aria-current={isActive(tab.path) ? 'page' : undefined}
            onClick={() => navigate(tab.path)}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ),
      )}
    </nav>
  )
}
