import { useLocation, useNavigate } from 'react-router-dom'
import { GlassSurface, Icon } from './ui'

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

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((tab, i) =>
        'fab' in tab ? (
          <div className="fabwrap" key={i}>
            <GlassSurface
              className="liquid-fab"
              width={54}
              height={54}
              radius={20}
              strength={0.11}
              chromaticAberration={0.24}
              depth={9}
              glow={0.18}
              edgeHighlight={0.36}
              shadow="0 0 0 1px rgba(255,255,255,0.3), 0 14px 30px rgba(5, 150, 105, 0.36)"
            >
              <button className="fabb" type="button" aria-label="Add charge" onClick={onAdd}>
                <Icon name="plus" />
              </button>
            </GlassSurface>
          </div>
        ) : (
          <button
            key={tab.path}
            className={`ti ${pathname === tab.path ? 'on' : ''}`}
            type="button"
            aria-current={pathname === tab.path ? 'page' : undefined}
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
