import { useState } from 'react'
import type { OutboxOperation } from '../lib/cache'
import type { AppSettings } from '../lib/appModel'
import { updateAppSettings, updateProvider, useEvState } from '../lib/data'
import { INPUT_LIMITS, VEHICLE_LIMITS } from '../lib/validation'

export default function SyncCorrectionForm({ operation, onClose }: { operation: OutboxOperation; onClose: () => void }) {
  const ev = useEvState()
  const providerId = operation.action === 'provider-upsert' ? operation.payload.id : undefined
  const provider = ev.providers.find(item => item.id === providerId)
  const isProvider = operation.action === 'provider-upsert'
  const [name, setName] = useState(provider?.name ?? '')
  const [color, setColor] = useState(provider?.color ?? '#123456')
  const [allowance, setAllowance] = useState(String(provider?.freeKwhPerDay ?? 0))
  const [order, setOrder] = useState(String(provider?.sortOrder ?? 0))
  const [archived, setArchived] = useState(provider?.archived ?? false)
  const [budget, setBudget] = useState(String(ev.settings.budgetCap))
  const [vehicle, setVehicle] = useState({ efficiency: String(ev.settings.vehicle.efficiency), petrolPrice: String(ev.settings.vehicle.petrolPrice), petrolUse: String(ev.settings.vehicle.petrolUse) })
  const [theme, setTheme] = useState(ev.settings.theme)
  const [style, setStyle] = useState(ev.settings.style)
  const [density, setDensity] = useState(ev.settings.density)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      if (isProvider) {
        if (!provider) throw new Error('This charger is missing from the local ledger. Retry or restore the cloud version instead.')
        if (!allowance.trim() || !order.trim()) throw new Error('Allowance and order are required.')
        await updateProvider(provider.id, { name, color, freeKwhPerDay: Number(allowance), sortOrder: Number(order), archived })
      } else {
        if (!budget.trim() || Object.values(vehicle).some(value => !value.trim())) throw new Error('Budget and vehicle assumptions are required.')
        await updateAppSettings({ budgetCap: Number(budget), vehicle: { efficiency: Number(vehicle.efficiency), petrolPrice: Number(vehicle.petrolPrice), petrolUse: Number(vehicle.petrolUse) }, theme, style, density,
          vehiclePhotoPath: typeof ev.settings.vehiclePhotoPath === 'string' ? ev.settings.vehiclePhotoPath : null })
      }
      onClose()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Correction could not be saved.') }
    finally { setSaving(false) }
  }
  return <form className="sync-correction" aria-label={isProvider ? 'Correct rejected charger' : 'Correct rejected settings'} onSubmit={event => { event.preventDefault(); void save() }}>
    <fieldset disabled={saving}>
      <legend>{isProvider ? 'Correct charger details' : 'Correct settings'}</legend>
      {isProvider ? <>
        <label>Name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Colour<input required value={color} onChange={event => setColor(event.target.value)} /></label>
        <label>Daily allowance (kWh)<input required type="number" min={0} max={INPUT_LIMITS.allowance} step={0.01} value={allowance} onChange={event => setAllowance(event.target.value)} /></label>
        <label>Picker order<input required type="number" min={0} max={INPUT_LIMITS.providerOrder} step={1} value={order} onChange={event => setOrder(event.target.value)} /></label>
        <label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Archived</label>
      </> : <>
        <label>Monthly budget (AUD)<input required type="number" min={0} max={INPUT_LIMITS.budget} step={0.01} value={budget} onChange={event => setBudget(event.target.value)} /></label>
        {(['efficiency', 'petrolPrice', 'petrolUse'] as const).map(key => <label key={key}>
          {{ efficiency: 'Efficiency (kWh / 100 km)', petrolPrice: 'Petrol price (AUD / litre)', petrolUse: 'Petrol use (L / 100 km)' }[key]}
          <input required type="number" min={VEHICLE_LIMITS[key].min} max={VEHICLE_LIMITS[key].max} step={key === 'petrolPrice' ? 0.001 : 0.01} value={vehicle[key]} onChange={event => setVehicle({ ...vehicle, [key]: event.target.value })} />
        </label>)}
        <label>Theme<select value={theme} onChange={event => setTheme(event.target.value as AppSettings['theme'])}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label>Style<select value={style} onChange={event => setStyle(event.target.value as AppSettings['style'])}><option value="classic">Classic</option><option value="minimal">Minimal</option></select></label>
        <label>Density<select value={density} onChange={event => setDensity(event.target.value as AppSettings['density'])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="presentation">Presentation</option></select></label>
      </>}
      <button type="submit" className="text-btn">{saving ? 'Saving correction…' : 'Save correction'}</button>
      <button type="button" className="text-btn" onClick={onClose}>Cancel correction</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>
}
