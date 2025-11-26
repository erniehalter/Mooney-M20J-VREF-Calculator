import { AircraftProfile, ChartDataPoint } from './types';

export const DEFAULT_ICAO = 'KMIE';
export const DEFAULT_WEIGHT = 2500;

// Default Profile: Mooney M20J (201)
// Updated to V3: Flaps 0 is now labeled Gear Down
export const MOONEY_M20J: AircraftProfile = {
  id: 'mooney-m20j-default-v3',
  name: 'Mooney M20J (201)',
  shortName: 'M20J',
  dmmsFactor: 1.404,
  configs: [
    { key: 'clean', label: 'Flaps 0°', subLabel: 'Gear Down' },
    { key: 'flaps15', label: 'Flaps 15°', subLabel: 'Gear Down / Takeoff', color: 'blue' },
    { key: 'flaps33', label: 'Flaps 33°', subLabel: 'Gear Down / Full' },
  ],
  performanceData: [
    { lbs: 2200, speeds: { clean: 56.0, flaps15: 53.0, flaps33: 50.0 } },
    { lbs: 2400, speeds: { clean: 59.0, flaps15: 55.0, flaps33: 52.0 } },
    { lbs: 2600, speeds: { clean: 61.5, flaps15: 56.5, flaps33: 53.5 } },
    { lbs: 2740, speeds: { clean: 63.0, flaps15: 58.0, flaps33: 56.0 } },
  ],
  presets: [
    { label: 'Solo + Full Fuel', val: 1850, icon: 'User' },
    { label: 'Training (Dual)', val: 2100, icon: 'Users' },
    { label: 'Max Gross', val: 2740, icon: 'Weight' },
  ]
};