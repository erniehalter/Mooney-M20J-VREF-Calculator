export interface SpeedConfig {
  key: string;
  label: string;
  subLabel: string;
  color?: string; // 'blue' | undefined
}

export interface ChartDataPoint {
  lbs: number;
  speeds: Record<string, number>; // Dynamic map: { "clean": 60, "flaps20": 55 }
}

export interface WeightPreset {
  label: string;
  val: number;
  icon: 'User' | 'Users' | 'Weight';
}

export interface AircraftProfile {
  id: string;
  name: string;
  shortName: string;
  performanceData: ChartDataPoint[];
  configs: SpeedConfig[];
  presets: WeightPreset[];
  dmmsFactor: number;
}

export interface TafEntry {
  raw: string;
  gust: number | null;
  type: 'BASE' | 'FM' | 'TEMPO' | 'BECMG' | 'HEADER';
  day: number | null;
  hour: number | null;
}

export interface WeatherResult {
  source: string;
  status: 'success' | 'warning' | 'error';
  msg: string;
}

export type Speeds = Record<string, number>;