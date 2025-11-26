import React, { useMemo } from 'react';
import { Scale, Wind, Plane, User, Users, Weight } from 'lucide-react';
import { Speeds, AircraftProfile, ChartDataPoint } from '../types';

// --- Shared Logic ---

const interpolate = (currentWeight: number, configKey: string, data: ChartDataPoint[]): number => {
  let lower = data[0];
  let upper = data[data.length - 1];

  const safeWeight = Math.max(lower.lbs, Math.min(upper.lbs, currentWeight));

  for (let i = 0; i < data.length - 1; i++) {
    if (safeWeight >= data[i].lbs && safeWeight <= data[i + 1].lbs) {
      lower = data[i];
      upper = data[i + 1];
      break;
    }
  }

  if (lower.lbs === upper.lbs) {
      return lower.speeds[configKey] || 0; 
  }
  
  const lowerVal = lower.speeds[configKey] || 0;
  const upperVal = upper.speeds[configKey] || 0;
  
  const ratio = (safeWeight - lower.lbs) / (upper.lbs - lower.lbs);
  return lowerVal + ratio * (upperVal - lowerVal);
};

export const useAircraftPerformance = (weight: number, gustFactor: number, profile: AircraftProfile) => {
  // Dynamic Stall Speed Calculation based on profile configs
  const stallSpeed: Speeds = useMemo(() => {
    const result: Speeds = {};
    profile.configs.forEach(cfg => {
      result[cfg.key] = interpolate(weight, cfg.key, profile.performanceData);
    });
    return result;
  }, [weight, profile]);

  const approachSpeed: Speeds = useMemo(() => {
    const gustAdder = gustFactor * 0.5;
    const result: Speeds = {};
    profile.configs.forEach(cfg => {
       const sVal = stallSpeed[cfg.key] || 0;
       result[cfg.key] = (sVal * 1.3) + gustAdder;
    });
    return result;
  }, [stallSpeed, gustFactor, profile]);

  // DMMS usually based on Clean stall speed
  // We assume the first config is 'clean' or we look for one with 'clean' in key, fallback to index 0
  const cleanKey = profile.configs.find(c => c.key.includes('clean'))?.key || profile.configs[0].key;
  const cleanStall = stallSpeed[cleanKey] || 0;

  const dmms = Math.round(cleanStall * profile.dmmsFactor);
  const buffer = Math.round(dmms - cleanStall);

  return { stallSpeed, approachSpeed, dmms, buffer };
};

// --- Components ---

interface ControlsProps {
  weight: number;
  setWeight: (w: number) => void;
  gustFactor: number;
  setGustFactor: (g: number) => void;
  profile: AircraftProfile;
}

export const WeightGustControls: React.FC<ControlsProps> = ({ weight, setWeight, gustFactor, setGustFactor, profile }) => {
  const getIcon = (iconName: string) => {
    switch(iconName) {
        case 'User': return <User className="w-5 h-5 mb-1" />;
        case 'Users': return <Users className="w-5 h-5 mb-1" />;
        case 'Weight': return <Weight className="w-5 h-5 mb-1" />;
        default: return <Plane className="w-5 h-5 mb-1" />;
    }
  };

  const minWeight = profile.performanceData[0].lbs;
  const maxWeight = profile.performanceData[profile.performanceData.length - 1].lbs;

  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 shadow-xl space-y-8">
      
      {/* Weight Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Scale className="w-5 h-5" />
            <span>Gross Weight</span>
          </div>
          <div className="font-mono text-xl font-bold text-blue-400">
            {weight} <span className="text-sm font-sans text-slate-500 font-normal">lbs</span>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-3">
          {profile.presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setWeight(preset.val)}
              className={`flex flex-col items-center justify-center py-3 px-1 rounded-lg border transition-all duration-200 ${
                  weight === preset.val 
                  ? 'bg-slate-700/50 border-blue-500 text-blue-100 shadow-inner' 
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className={weight === preset.val ? 'text-blue-400' : 'text-slate-500'}>
                {getIcon(preset.icon)}
              </div>
              <span className="font-semibold text-xs text-center leading-tight mb-1">{preset.label}</span>
              <span className="font-mono text-[10px] opacity-60">{preset.val}</span>
            </button>
          ))}
        </div>

        {/* Weight Slider */}
        <input
          type="range"
          min={minWeight}
          max={maxWeight}
          step="10"
          value={weight}
          onChange={(e) => setWeight(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
        />
      </div>

      <div className="h-px bg-slate-700/50" />

      {/* Gust Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Wind className="w-5 h-5" />
            <span>Gust Factor (Peak)</span>
          </div>
          <div className="font-mono text-xl font-bold text-emerald-400">
            {gustFactor} <span className="text-sm font-sans text-slate-500 font-normal">kts</span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="30"
          step="1"
          value={gustFactor}
          onChange={(e) => setGustFactor(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
        />
        
        <p className="text-xs text-slate-500 text-right">
           Adds {Math.ceil(gustFactor * 0.5)} kts to Vref
        </p>
      </div>
    </div>
  );
};

interface ResultsProps {
  weight: number;
  gustFactor: number;
  profile: AircraftProfile;
}

export const SpeedResults: React.FC<ResultsProps> = ({ weight, gustFactor, profile }) => {
  const { stallSpeed, approachSpeed } = useAircraftPerformance(weight, gustFactor, profile);

  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
      <div className="grid grid-cols-12 bg-slate-800/50 border-b border-slate-700/50 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
        <div className="col-span-6 p-4">Configuration</div>
        <div className="col-span-3 p-4 text-right">VS <span className="opacity-50">(Stall)</span></div>
        <div className="col-span-3 p-4 text-right">VREF <span className="opacity-50">(Appr)</span></div>
      </div>
      
      <div className="divide-y divide-slate-700/30">
        {profile.configs.map((config) => {
           const sSpeed = stallSpeed[config.key] || 0;
           const aSpeed = approachSpeed[config.key] || 0;
           
           const isHighlighted = config.color === 'blue';

           const containerClass = isHighlighted 
            ? "grid grid-cols-12 items-center bg-blue-900/20 border-l-2 border-l-blue-500"
            : "grid grid-cols-12 items-center hover:bg-slate-800/30 transition-colors";

           const labelClass = isHighlighted ? "text-base font-bold text-blue-400" : "text-base font-bold text-slate-200";
           const subLabelClass = isHighlighted ? "text-xs text-blue-300/70" : "text-xs text-slate-500";
           const stallClass = isHighlighted ? "col-span-3 p-4 text-right font-mono text-slate-300 text-lg" : "col-span-3 p-4 text-right font-mono text-slate-400 text-lg";
           const apprClass = isHighlighted ? "font-mono text-2xl font-bold text-blue-400" : "font-mono text-xl font-bold text-slate-200";
           
           return (
             <div key={config.key} className={containerClass}>
               <div className={isHighlighted ? "col-span-6 p-4 pl-[14px]" : "col-span-6 p-4"}>
                 <div className={labelClass}>{config.label}</div>
                 <div className={subLabelClass}>{config.subLabel}</div>
               </div>
               <div className={stallClass}>
                 {Math.round(sSpeed)}
               </div>
               <div className="col-span-3 p-4 text-right">
                 <div className={apprClass}>{Math.round(aSpeed)}</div>
                 <div className={`text-[10px] font-mono ${isHighlighted ? 'text-blue-300/60' : 'text-slate-500'}`}>
                   +{Math.round(aSpeed - sSpeed)} kts
                 </div>
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
};

export const DmmsCard: React.FC<{ weight: number, profile: AircraftProfile }> = ({ weight, profile }) => {
  const { dmms, buffer } = useAircraftPerformance(weight, 0, profile);
  
  return (
    <div className="bg-[#1e293b]/50 rounded-lg border border-slate-700/50 px-4 py-2 flex items-center justify-between">
       <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">DMMS</span>
          <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wide">Min Maneuvering</span>
       </div>
       <div className="flex items-center gap-4 text-right">
          <span className="text-[10px] text-slate-600 font-mono hidden sm:inline-block">Vs +{buffer}</span>
          <div>
            <div className="text-xl font-mono font-bold text-indigo-400 leading-none">{dmms}</div>
            <div className="text-[9px] font-bold text-indigo-400/40 uppercase">KIAS</div>
          </div>
       </div>
    </div>
  );
};