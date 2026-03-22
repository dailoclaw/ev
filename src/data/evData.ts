import rawData from './ev_data.json';

export interface ChargingSession {
  Date: string;
  Type: string;
  Amount: number;
  Cost: number;
  Notes: string | null;
}

export const chargingData: ChargingSession[] = rawData.map(item => ({
  ...item,
  Date: item.Date,
  Type: item.Type || 'Unknown',
  Amount: Number(item.Amount) || 0,
  Cost: Number(item.Cost) || 0,
  Notes: item.Notes || null,
}));
