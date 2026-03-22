# EV Charging Dashboard ⚡

**Track your electric vehicle charging costs and usage patterns**

A comprehensive dashboard for monitoring EV charging sessions with cost analysis, energy tracking, and usage insights.

## Features

📊 **Summary Statistics**
- Total sessions, cost, and energy (kWh)
- Average cost per kWh and per session
- Real-time filtering and search

📈 **Interactive Charts**
- Monthly cost trends (line chart)
- Cost distribution by charger type (pie chart)
- Monthly energy usage (bar chart)
- Sessions per charger type

🔍 **Data Management**
- Search by charger type or notes
- Filter by date range
- Sortable data table with all sessions
- Cost per kWh calculation for each session

⚡ **Charger Types Tracked**
- Matty
- Chargefox
- Jolt
- Supercharger
- And more...

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Fast build tool
- **CoreUI React** - UI components
- **Recharts** - Data visualization
- Dark theme with DM Sans/Mono fonts

## Data Structure

Each charging session includes:
- Date
- Charger type
- Energy added (kWh)
- Cost ($)
- Optional notes

## Quick Start

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

## Updating Data

To update with new charging data:
1. Export your charging spreadsheet (Excel/CSV)
2. Replace `src/data/ev_data.json` with new data
3. Ensure format matches: `{ Date, Type, Amount, Cost, Notes }`
4. Rebuild and redeploy

## Version

**v1.0.0** - Initial release

## License

MIT
