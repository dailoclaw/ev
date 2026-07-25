// What's New — a plain, hand-kept record of what shipped and when.
// Reverse-chronological. Add one entry per release; keep each note to a line.
export interface ChangelogEntry {
  version: string
  date: string
  notes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
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
