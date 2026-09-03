export default function StartupSplash() {
  return (
    <main className="startup-splash" role="status" aria-label="Starting EV Command">
      <div className="startup-splash__atmosphere" aria-hidden="true" />
      <div className="startup-splash__trace" aria-hidden="true">
        <svg viewBox="0 0 150 150">
          <circle className="startup-splash__pulse startup-splash__pulse--outer" cx="75" cy="75" r="48" />
          <circle className="startup-splash__pulse startup-splash__pulse--inner" cx="75" cy="75" r="48" />
          <rect className="startup-splash__panel" x="25" y="20" width="100" height="110" rx="27" />
          <path className="startup-splash__row startup-splash__row--one" d="M45 49h43" />
          <circle className="startup-splash__row-dot startup-splash__row-dot--one" cx="103" cy="49" r="4.5" />
          <path className="startup-splash__row startup-splash__row--two" d="M45 74h43" />
          <circle className="startup-splash__row-dot startup-splash__row-dot--two" cx="103" cy="74" r="4.5" />
          <path className="startup-splash__row startup-splash__row--three" d="M45 99h43" />
          <circle className="startup-splash__row-dot startup-splash__row-dot--three" cx="103" cy="99" r="4.5" />
          <path className="startup-splash__bus" d="M103 49v50c0 10-8 18-18 18H74" />
          <circle className="startup-splash__charge-node" cx="74" cy="117" r="5.5" />
          <path className="startup-splash__bolt" d="M75 99 63 119h13l-6 14 20-23H77l8-11" />
        </svg>
      </div>
    </main>
  )
}
