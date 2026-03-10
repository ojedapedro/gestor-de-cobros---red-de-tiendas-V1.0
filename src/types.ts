export interface Payment {
  id?: number;
  date: string;
  store: string;
  method: 'Bolivares' | 'Dolares' | 'Zelle' | 'Transferencia';
  amountOriginal: number;
  currency: 'VES' | 'USD';
  rate: number;
  amountUsd: number;
  reference: string;
  description: string;
}

export interface DashboardStats {
  totalUsd: number;
  byMethod: { name: string; value: number }[];
  byStore: { name: string; value: number }[];
  dailyTrend: { date: string; amount: number }[];
}

export const STORES = [
  "Tienda Principal",
  "Sucursal Norte",
  "Sucursal Sur",
  "Sucursal Este",
  "Sucursal Oeste"
];

export const METHODS = [
  "Bolivares",
  "Dolares",
  "Zelle",
  "Transferencia"
];
