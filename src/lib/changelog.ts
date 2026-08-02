// What's New — a plain, hand-kept record of what shipped and when.
// Reverse-chronological. Add one entry per release; keep each note to a line.
export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.9.31',
    date: '2 Aug 2026',
    notes: [
      'Stats fix — moved Monthly breakdown sparklines inward so they no longer sit against the card edge.',
    ],
  },
  {
    version: '3.9.30',
    date: '2 Aug 2026',
    notes: [
      'Stats fix — moved the Monthly breakdown Cost heading and values left with an explicit text inset.',
    ],
  },
  {
    version: '3.9.29',
    date: '2 Aug 2026',
    notes: [
      'Stats fix — moved the Monthly breakdown cost column inward with extra right-side ledger padding.',
    ],
  },
  {
    version: '3.9.28',
    date: '2 Aug 2026',
    notes: [
      'Stats fix — narrowed the Monthly breakdown kWh column and gave the cost area more room away from the screen edge.',
    ],
  },
  {
    version: '3.9.27',
    date: '1 Aug 2026',
    notes: [
      'Stats fix — locked Monthly breakdown header and row columns to the same grid and raised sparklines for better number baseline alignment.',
    ],
  },
  {
    version: '3.9.26',
    date: '1 Aug 2026',
    notes: [
      'Stats fix — aligned Monthly breakdown kWh values with their heading and raised row sparklines to sit with the number baseline.',
    ],
  },
  {
    version: '3.9.25',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — segmented LiquidGlass lenses now glide between options with the same spring-style motion as the live demo.',
    ],
  },
  {
    version: '3.9.24',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — restored dark active labels for light mode segmented controls while preserving the LiquidGlass lens.',
    ],
  },
  {
    version: '3.9.23',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — segmented controls now follow the live LiquidGlass demo pattern with a low-strength lens over a rounded rail.',
    ],
  },
  {
    version: '3.9.22',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — segmented controls now use a single CSS glass pill indicator, removing the iOS LiquidGlass outline artifacts permanently.',
    ],
  },
  {
    version: '3.9.21',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — removed the external segmented pill shadow so no bottom tabs appear under the active button.',
    ],
  },
  {
    version: '3.9.20',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — removed the LiquidGlass built-in shadow from segmented controls and replaced it with a pill-only CSS rim.',
    ],
  },
  {
    version: '3.9.19',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — restored the full LiquidGlass refraction surface and clipped it to the active pill, including the iOS Safari mask.',
    ],
  },
  {
    version: '3.9.18',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — the LiquidGlass segmented lens is now only the selected pill, removing full-row rectangular outlines.',
    ],
  },
  {
    version: '3.9.17',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — segmented controls now keep the rail outline outside the LiquidGlass layer so no rectangular box appears around the pill.',
    ],
  },
  {
    version: '3.9.16',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — segmented labels now render above the LiquidGlass lens so text no longer warps or repeats inside the button.',
    ],
  },
  {
    version: '3.9.15',
    date: '1 Aug 2026',
    notes: [
      'Glass controls — segmented controls now use the real LiquidGlass lens component instead of CSS-only active button styling.',
    ],
  },
  {
    version: '3.9.14',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — light segmented controls now match the green tab action style, while dark mode uses black glass selection.',
    ],
  },
  {
    version: '3.9.13',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — dark mode segmented controls are restored, while light mode now uses a softer pale green glass selection.',
    ],
  },
  {
    version: '3.9.12',
    date: '1 Aug 2026',
    notes: [
      'Glass controls fix — active segmented controls now use green glass in light mode instead of falling back to charcoal.',
    ],
  },
  {
    version: '3.9.11',
    date: '1 Aug 2026',
    notes: [
      'Glass controls polish — selected segmented controls now have a clearer rim, green tint and glass highlight so the effect is visible.',
    ],
  },
  {
    version: '3.9.10',
    date: '1 Aug 2026',
    notes: [
      'Glass controls — top icon buttons and active segmented controls now use a restrained native CSS glass treatment.',
    ],
  },
  {
    version: '3.9.9',
    date: '1 Aug 2026',
    notes: [
      'Charge popup fix — save buttons now keep their native primary styling when enabled, avoiding the broken glass wrapper render.',
    ],
  },
  {
    version: '3.9.8',
    date: '1 Aug 2026',
    notes: [
      'Liquid Glass fix — the tab bar add button now uses a stable native glass style so it stays centered and fully tappable.',
    ],
  },
  {
    version: '3.9.7',
    date: '1 Aug 2026',
    notes: [
      'Liquid Glass — the mobile add button and primary sheet actions now use a refractive glass treatment with native button behavior preserved.',
    ],
  },
  {
    version: '3.9.6',
    date: '29 Jul 2026',
    notes: [
      'Minimal polish — Stats trend charts now use a perfectly round filled marker that animates with the line.',
    ],
  },
  {
    version: '3.9.5',
    date: '28 Jul 2026',
    notes: [
      'Minimal polish — summary cards now use larger value typography so Energy and Vehicle detail cards match the bolder Minimal look.',
    ],
  },
  {
    version: '3.9.4',
    date: '28 Jul 2026',
    notes: [
      'Minimal polish — key numbers now count up across Home, Stats and Vehicle, and Distance lifetime energy opens the Statement view.',
    ],
  },
  {
    version: '3.9.3',
    date: '28 Jul 2026',
    notes: [
      'Minimal Vehicle polish — Efficiency now uses a premium dial, and Distance uses the saved vehicle photo with metric badges instead of an abstract placeholder.',
    ],
  },
  {
    version: '3.9.2',
    date: '28 Jul 2026',
    notes: [
      'Minimal polish — Stats chart line and marker now animate together, Energy bars show values, and Vehicle metric badges are better centered.',
    ],
  },
  {
    version: '3.9.1',
    date: '28 Jul 2026',
    notes: [
      'Minimal Stats fix — the trend line animation now uses normalized SVG path length so it draws all the way across.',
    ],
  },
  {
    version: '3.9.0',
    date: '27 Jul 2026',
    notes: [
      'Minimal Vehicle — the Vehicle tab now has a Minimal-only car cockpit with running cost, efficiency, distance, petrol comparison and assumptions drill-ins.',
    ],
  },
  {
    version: '3.8.0',
    date: '27 Jul 2026',
    notes: [
      'Minimal Stats — the Stats tab now has a simplified Minimal-only layout with an all-in-rate hero, trend chart, and focused drill-ins for energy, free charging and networks.',
    ],
  },
  {
    version: '3.7.9',
    date: '27 Jul 2026',
    notes: [
      'Minimal Home polish — the spend amount is reduced to 76px for a better balance with the larger month label.',
    ],
  },
  {
    version: '3.7.8',
    date: '27 Jul 2026',
    notes: [
      'Minimal Home polish — the spend amount is dialled back to a calmer 82px while keeping the larger month label.',
    ],
  },
  {
    version: '3.7.7',
    date: '27 Jul 2026',
    notes: [
      'Minimal Home fix — the spend amount now keeps its intended large size instead of being overridden by the generic Minimal app bar heading rule.',
    ],
  },
  {
    version: '3.7.6',
    date: '27 Jul 2026',
    notes: [
      'Minimal Home polish — the month and spend typography are larger again for a bolder canvas-style hero.',
    ],
  },
  {
    version: '3.7.5',
    date: '27 Jul 2026',
    notes: [
      'Minimal Home polish — the month label and spend amount are larger for a stronger first-glance hierarchy.',
    ],
  },
  {
    version: '3.7.4',
    date: '27 Jul 2026',
    notes: [
      'Classic Home restored — the Canvas donut Home now appears only when the Minimal style is selected.',
    ],
  },
  {
    version: '3.7.3',
    date: '27 Jul 2026',
    notes: [
      'Canvas Home polish — the monthly spend amount is slightly larger for stronger hierarchy under the month label.',
    ],
  },
  {
    version: '3.7.2',
    date: '27 Jul 2026',
    notes: [
      'Canvas Home polish — the free-energy donut now scales up to better use the phone screen, with larger center text for easier scanning.',
    ],
  },
  {
    version: '3.7.1',
    date: '27 Jul 2026',
    notes: [
      'Canvas Home — the home screen now uses a calmer spend-first layout with an animated free-energy donut and two focused drill-in rows.',
    ],
  },
  {
    version: '3.7.0',
    date: '27 Jul 2026',
    notes: [
      'Minimal style — a second look for the whole app, switchable in Settings › Appearance. Same numbers, same navigation: softer corners, no card borders, sentence-case labels and more air. Works alongside Light/Dark.',
    ],
  },
  {
    version: '3.6.19',
    date: '26 Jul 2026',
    notes: ['New Charge provider order — Jolt now appears first and is selected by default, with Chargefox moved to the end of the picker.'],
  },
  {
    version: '3.6.18',
    date: '25 Jul 2026',
    notes: ['Split, Compare and Statement motion — donut, bar, sparkline and statement number animations now run in the live app without changing typography.'],
  },
  {
    version: '3.6.17',
    date: '25 Jul 2026',
    notes: ['Release housekeeping — version references updated after the Density Profiles release.'],
  },
  {
    version: '3.6.16',
    date: '25 Jul 2026',
    notes: ['Density Profiles — Settings now offers Comfortable, Compact and Present display modes for ledger-heavy screens.'],
  },
  {
    version: '3.6.15',
    date: '25 Jul 2026',
    notes: ['Stats Typography Fix — animated KPI numbers now keep the original card sizing, weight and spacing.'],
  },
  {
    version: '3.6.14',
    date: '25 Jul 2026',
    notes: ['Unit Switch — flipping $ ⇄ kWh now re-scales the bars on a cascade and rolls the value labels.'],
  },
  {
    version: '3.6.13',
    date: '25 Jul 2026',
    notes: ['Stats Cascade — Analytics now animates its KPI numbers and saved-per-month bars.'],
  },
  {
    version: '3.6.12',
    date: '25 Jul 2026',
    notes: ['Analytics Motion — Trends now draws the line in, fades the area fill, and reveals the selected point.'],
  },
  {
    version: '3.6.11',
    date: '25 Jul 2026',
    notes: ['Motion Pass — savings, accounts and vehicle comparison screens now animate their key numbers and progress bars.'],
  },
  {
    version: '3.6.10',
    date: '24 Jul 2026',
    notes: ['Dashboard Motion — monthly spend now counts up and the budget thermometer animates into place.'],
  },
  {
    version: '3.6.9',
    date: '24 Jul 2026',
    notes: ['Vehicle Photo — add a picture of your actual car to the Vehicle page.'],
  },
  {
    version: '3.6.8',
    date: '24 Jul 2026',
    notes: ['Provider Order — reorder your chargers so the one you use daily comes first in every picker.'],
  },
  {
    version: '3.6.7',
    date: '23 Jul 2026',
    notes: ["What's New — this list, reachable by tapping the version number in Settings."],
  },
  {
    version: '3.6.6',
    date: '23 Jul 2026',
    notes: ['Archived Providers — retire a charger without losing its history.', 'Swipe left on a Statement row to edit or delete a charge.'],
  },
  {
    version: '3.6.5',
    date: '23 Jul 2026',
    notes: ['Backup & Restore — download a full copy of your ledger, or restore one.', 'Restoring while synced merges straight into Supabase.'],
  },
  {
    version: '3.6.4',
    date: '23 Jul 2026',
    notes: ['Streak Freeze — one earned pass so a single overflow doesn’t erase months of discipline.'],
  },
  {
    version: '3.6.3',
    date: '23 Jul 2026',
    notes: ['Vehicle efficiency assumption now steps by 0.1 instead of 1.'],
  },
  {
    version: '3.6.2',
    date: '19 Jul 2026',
    notes: ['Unified the Records icon chips on the money green.'],
  },
  {
    version: '3.6.1',
    date: '19 Jul 2026',
    notes: ['Redesigned Records with stroke icons and open, in-progress targets.'],
  },
  {
    version: '3.6.0',
    date: '19 Jul 2026',
    notes: ['Added the Records trophy cabinet to the Stats page.'],
  },
  {
    version: '3.5.0',
    date: '19 Jul 2026',
    notes: ['The month now describes itself in a paragraph on the Statement.'],
  },
  {
    version: '3.4.0',
    date: '18 Jul 2026',
    notes: ['Key figures can show their working.'],
  },
  {
    version: '3.3.0',
    date: '18 Jul 2026',
    notes: ['Free energy is valued at the independent rate, not a guess.'],
  },
  {
    version: '3.2.0',
    date: '18 Jul 2026',
    notes: ['Added a same-month year-on-year card to Cluster.'],
  },
  {
    version: '3.1.0',
    date: '18 Jul 2026',
    notes: ['Added the Cost Anatomy page.'],
  },
]

export const APP_VERSION = CHANGELOG[0]?.version ?? '0.0.0'
