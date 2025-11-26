import React, { useState, useEffect } from 'react';
import { CloudSun, Loader2, CheckCircle2, AlertTriangle, Clock, Search, Wind, CalendarDays, MousePointerClick } from 'lucide-react';
import { TafEntry, WeatherResult } from '../types';
import { fetchProxyWeather, extractGust, parseTaf } from '../services/weatherService';

interface WeatherSectionProps {
  onGustUpdate: (gust: number) => void;
}

export const WeatherSection: React.FC<WeatherSectionProps> = ({ onGustUpdate }) => {
  const [icao, setIcao] = useState('KMIE');
  const [loading, setLoading] = useState(false);
  const [metarText, setMetarText] = useState('');
  const [tafData, setTafData] = useState<TafEntry[]>([]);
  const [resultStatus, setResultStatus] = useState<WeatherResult | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getZTime = () => {
    const hours = currentTime.getUTCHours();
    const minutes = currentTime.getUTCMinutes();
    const day = currentTime.getUTCDate();
    return { str: `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}Z (Day ${day})`, day, hours };
  };

  const zTime = getZTime();

  // Helper to convert TAF DDHH to local friendly string
  const convertToLocalTime = (day: number | null, hour: number | null) => {
    if (day === null || hour === null) return null;
    
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-indexed
    
    // Construct base UTC date
    let tafDate = new Date(Date.UTC(currentYear, currentMonth, day, hour, 0, 0));
    
    // Handle Month Rollover logic (e.g. today is 30th, TAF is 01st)
    const currentDay = now.getUTCDate();
    if (day < currentDay && (currentDay - day) > 15) {
       tafDate.setUTCMonth(tafDate.getUTCMonth() + 1);
    } else if (day > currentDay && (day - currentDay) > 15) {
       tafDate.setUTCMonth(tafDate.getUTCMonth() - 1);
    }

    return tafDate.toLocaleTimeString([], { 
      weekday: 'short', 
      hour: 'numeric', 
      minute: '2-digit'
    });
  };

  const getActiveTafIndex = () => {
    if (tafData.length === 0) return -1;
    
    // We want the last FM/BECMG group that has started relative to NOW
    let activeIndex = -1;
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    // Helper to get Date object for a TAF entry
    const getEntryDate = (entry: TafEntry) => {
        if (entry.day === null || entry.hour === null) return new Date(0); // far past
        let d = new Date(Date.UTC(currentYear, currentMonth, entry.day, entry.hour, 0));
        
        // Month rollover logic same as display
        const currentDay = now.getUTCDate();
        if (entry.day < currentDay && (currentDay - entry.day) > 15) {
            d.setUTCMonth(d.getUTCMonth() + 1);
        } else if (entry.day > currentDay && (entry.day - currentDay) > 15) {
            d.setUTCMonth(d.getUTCMonth() - 1);
        }
        return d;
    };

    tafData.forEach((line, idx) => {
        // Skip HEADER for calculation unless it's the only thing
        if (line.type === 'HEADER' && idx !== 0) return;

        // For FM groups, it's a specific start time
        if (line.type === 'FM' || line.type === 'BASE' || line.type === 'HEADER') {
            const entryDate = getEntryDate(line);
            // If entry date is in the past (or now), it's a candidate for active
            if (entryDate <= now) {
                activeIndex = idx;
            }
        }
        // Note: BECMG/TEMPO are ranges, simplified here to start time for "Active" flag
    });
    
    // Fallback: if nothing matched (e.g. forecast starts in future), maybe index 0
    return activeIndex;
  };

  const activeTafIndex = getActiveTafIndex();

  const handleFetch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!icao || icao.length < 3) return;

    setLoading(true);
    setResultStatus(null);
    setMetarText('');
    setTafData([]);
    
    const code = icao.toUpperCase();
    const url = `https://en.allmetsat.com/metar-taf/tennessee-kentucky.php?icao=${code}`;

    try {
      const content = await fetchProxyWeather(url);
      
      if (!content || !content.includes(code)) {
        throw new Error('Station data not found');
      }

      // METAR
      const metarRegex = new RegExp(`(${code}\\s+\\d{6}Z\\s+[^<]+)`, 'i');
      const metarMatch = content.match(metarRegex);
      
      let foundGust: number | null = null;

      if (metarMatch) {
        const rawMetar = metarMatch[1].trim();
        setMetarText(rawMetar);
        foundGust = extractGust(rawMetar);
        
        if (foundGust !== null) {
          setResultStatus({ source: 'METAR', status: 'success', msg: `Peak Gust: ${foundGust} kts` });
        } else {
          setResultStatus({ source: 'METAR', status: 'success', msg: 'METAR active (No Gusts)' });
        }
      } else {
        setResultStatus({ source: 'System', status: 'warning', msg: 'No recent METAR found' });
      }

      // TAF
      const parsedTaf = parseTaf(content, code);
      if (parsedTaf.length > 0) {
        setTafData(parsedTaf);
      }

      onGustUpdate(foundGust !== null ? foundGust : 0);

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setResultStatus({ source: 'Network', status: 'error', msg: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const renderMetarParts = (text: string) => {
    return text.split(' ').map((part, i) => {
      const isWind = /([0-9]{3}|VRB)([0-9]{2,3})(G[0-9]{2,3})?KT/.test(part);
      const isCode = part === icao.toUpperCase();
      return (
        <span key={i} className={isWind ? "text-yellow-400 font-bold" : isCode ? "text-white font-bold" : "text-slate-300"}>
          {part}{' '}
        </span>
      );
    });
  };

  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 shadow-xl space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center text-slate-200 font-medium gap-2.5">
          <CloudSun className="w-5 h-5 text-slate-400" />
          <span>Live Weather (AllMetSat)</span>
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-700/50">
           <Clock className="w-3 h-3" />
           <span>{zTime.str}</span>
        </div>
      </div>

      {/* Input Row */}
      <form onSubmit={handleFetch} className="flex gap-3">
        <div className="relative w-28 flex-shrink-0">
          <input
            type="text"
            value={icao}
            onChange={(e) => setIcao(e.target.value.toUpperCase())}
            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-3 text-center text-slate-100 font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500 font-mono uppercase"
            placeholder="ICAO"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex-grow bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
        >
          {loading ? (
             <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Fetching...</span>
             </div>
          ) : (
             "Fetch METAR & TAF"
          )}
        </button>
      </form>

      {/* Results Container */}
      {(resultStatus || metarText || tafData.length > 0) && (
        <div className="space-y-6 pt-2">
            
            {/* METAR SECTION */}
            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current METAR</span>
                    {resultStatus && (
                        <span className={`text-[10px] font-medium ${
                            resultStatus.status === 'success' ? 'text-emerald-400' : 
                            resultStatus.status === 'warning' ? 'text-amber-400' : 'text-red-400'
                        }`}>
                            {resultStatus.msg}
                        </span>
                    )}
                </div>
                {metarText ? (
                    <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-700/60 text-xs font-mono leading-relaxed break-words shadow-sm">
                        {renderMetarParts(metarText)}
                    </div>
                ) : (
                    <div className="bg-[#0f172a]/50 p-3 rounded-lg border border-slate-800 border-dashed text-xs text-slate-600 text-center">
                        No METAR available
                    </div>
                )}
            </div>

            {/* TAF SECTION */}
            <div className="space-y-3">
               <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Forecast (TAF)</span>
                    </div>
                    {tafData.length > 0 && (
                        <span className="text-[10px] italic text-slate-600">Click to apply gust</span>
                    )}
               </div>

               {tafData.length > 0 ? (
                   <div className="space-y-2">
                       {tafData.map((t, idx) => {
                           const isActive = idx === activeTafIndex;
                           const localTime = convertToLocalTime(t.day, t.hour);
                           const isHeader = t.type === 'HEADER';

                           return (
                               <div 
                                   key={idx} 
                                   className={`relative group rounded-lg border transition-all duration-200 ${
                                       isHeader 
                                         ? 'bg-[#0f172a]/60 border-slate-800 p-3' 
                                         : isActive
                                            ? 'bg-blue-500/10 border-blue-500/50 p-3'
                                            : 'bg-[#1e293b] border-slate-700/50 p-3 hover:border-slate-600'
                                   }`}
                               >
                                   {/* Header / Time Badge */}
                                   <div className="flex items-center justify-between mb-2">
                                       <div className="flex items-center gap-2">
                                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                               isHeader ? 'bg-slate-700 text-slate-300' : 'bg-indigo-500/20 text-indigo-300'
                                           }`}>
                                               {t.type}
                                           </span>
                                           {localTime && (
                                               <span className="text-xs font-bold text-slate-200">{localTime}</span>
                                           )}
                                           {isActive && !isHeader && (
                                               <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">
                                                   <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                   Active
                                               </span>
                                           )}
                                       </div>
                                       
                                       {/* Gust Button */}
                                       {t.gust ? (
                                           <button 
                                                onClick={() => onGustUpdate(t.gust!)}
                                                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                                           >
                                               <Wind className="w-3 h-3" />
                                               {t.gust}
                                           </button>
                                       ) : (
                                            <span className="text-[10px] text-slate-700 font-mono">No Gust</span>
                                       )}
                                   </div>

                                   {/* Raw Text */}
                                   <div className={`font-mono text-xs leading-relaxed ${isHeader ? 'text-slate-400' : 'text-slate-300'}`}>
                                       {t.raw}
                                   </div>
                               </div>
                           );
                       })}
                   </div>
                ) : (
                    <div className="bg-[#0f172a]/50 p-3 rounded-lg border border-slate-800 border-dashed text-xs text-slate-600 text-center">
                        No TAF available
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};