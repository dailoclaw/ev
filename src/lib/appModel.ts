import type { Density } from './density'
import type { Style } from './style'
import type { Theme } from './theme'

export interface VehicleAssumptions {
  efficiency: number
  petrolPrice: number
  petrolUse: number
}

export interface AppSettings {
  budgetCap: number
  theme: Theme
  style: Style
  density: Density
  vehicle: VehicleAssumptions
  vehiclePhotoPath: string | null
}

export const DEFAULT_SETTINGS: AppSettings = {
  budgetCap: 50,
  theme: 'light',
  style: 'classic',
  density: 'comfortable',
  vehicle: { efficiency: 14.2, petrolPrice: 1.85, petrolUse: 7 },
  vehiclePhotoPath: null,
}

export type SyncStatus = 'signed-out' | 'loading' | 'syncing' | 'synced' | 'offline' | 'error'
