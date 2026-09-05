export default function StartupSplash() {
  return (
    <main className="startup-splash" role="status" aria-label="Starting EV Command">
      <div className="startup-splash__atmosphere" aria-hidden="true" />
      <div className="startup-splash__battery" aria-hidden="true">
        <svg viewBox="0 0 360 280">
          <circle className="startup-splash__halo startup-splash__halo--echo" cx="180" cy="52" r="58" />
          <circle className="startup-splash__halo startup-splash__halo--first" cx="180" cy="52" r="58" />
          <g transform="translate(0 -18) translate(180 65) scale(1 1.18) translate(-180 -65)">
            <path
              className="startup-splash__bolt"
              pathLength="1"
              d="M194 2 124 76h52l-16 52 78-88h-51Z"
            />
          </g>
          <rect className="startup-splash__battery-shell" x="27" y="155" width="296" height="102" rx="28" />
          <rect className="startup-splash__battery-tip" x="323" y="185" width="14" height="42" rx="6" />
          <rect className="startup-splash__battery-cell" x="45" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-fill startup-splash__battery-fill--1" x="45" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-cell" x="99" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-fill startup-splash__battery-fill--2" x="99" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-cell" x="153" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-fill startup-splash__battery-fill--3" x="153" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-cell" x="207" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-fill startup-splash__battery-fill--4" x="207" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-cell" x="261" y="173" width="44" height="66" rx="12" />
          <rect className="startup-splash__battery-fill startup-splash__battery-fill--5" x="261" y="173" width="44" height="66" rx="12" />
        </svg>
      </div>
    </main>
  )
}
