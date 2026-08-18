import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'

const Home = lazy(() => import('./pages/Home'))
const Savings = lazy(() => import('./pages/Savings'))
const Statement = lazy(() => import('./pages/Statement'))
const Analytics = lazy(() => import('./pages/Analytics'))
const AnalyticsChart = lazy(() => import('./pages/AnalyticsChart'))
const CostAnatomy = lazy(() => import('./pages/CostAnatomy'))
const Vehicle = lazy(() => import('./pages/Vehicle'))
const Settings = lazy(() => import('./pages/Settings'))
const AccountsList = lazy(() => import('./pages/Accounts').then(module => ({ default: module.AccountsList })))
const AccountDetail = lazy(() => import('./pages/Accounts').then(module => ({ default: module.AccountDetail })))

export default function AppRoutes() {
  return (
    <Suspense fallback={<main className="route-loading" aria-label="Loading page" />}>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Home />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/statement" element={<Statement />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/analytics/chart" element={<AnalyticsChart />} />
            <Route path="/cost-anatomy" element={<CostAnatomy />} />
            <Route path="/vehicle" element={<Vehicle />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/accounts" element={<AccountsList />} />
            <Route path="/accounts/:name" element={<AccountDetail />} />
            <Route path="/history" element={<Navigate to="/statement" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Suspense>
  )
}
