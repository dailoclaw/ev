import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Home from './pages/Home.tsx'
import Savings from './pages/Savings.tsx'
import Statement from './pages/Statement.tsx'
import Analytics from './pages/Analytics.tsx'
import Vehicle from './pages/Vehicle.tsx'
import Settings from './pages/Settings.tsx'
import { AccountsList, AccountDetail } from './pages/Accounts.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Home />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/statement" element={<Statement />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/vehicle" element={<Vehicle />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/accounts" element={<AccountsList />} />
          <Route path="/accounts/:name" element={<AccountDetail />} />
          {/* legacy route from the old two-page app */}
          <Route path="/history" element={<Navigate to="/statement" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
