import React, { useState } from 'react';
import { Plane, ChevronDown, Plus, X, Check, Trash2, ArrowRight, ArrowLeft, Settings, AlertCircle, HelpCircle, LayoutGrid, XCircle } from 'lucide-react';
import { AircraftProfile, ChartDataPoint, SpeedConfig } from '../types';

interface ProfileManagerProps {
  profiles: AircraftProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: (profile: AircraftProfile) => void;
  onDeleteProfile: (id: string) => void;
}

// Internal Wizard State Types

// A Column now represents a Configuration (e.g. Flaps 10)
interface WizardConfigCol {
    id: string;
    isRef: boolean;
    label: string;
    subLabel: string;
}

// A Row now represents a Weight (e.g. 2500 lbs) and holds speeds for each column
interface WizardWeightRow {
    id: string;
    weight: string;
    speeds: string[]; // Indices match the cols array
}

interface WizardState {
    step: 'init' | 'table';
    name: string;
    rowCounts: number; // Number of Weight Rows
    colCounts: number; // Number of Config Columns (Excluding Clean)
    cols: WizardConfigCol[];
    rows: WizardWeightRow[];
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onDeleteProfile
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Wizard State
  const [wiz, setWiz] = useState<WizardState>({
      step: 'init',
      name: '',
      rowCounts: 3, // Defaults to 3 standard weights
      colCounts: 2, // Defaults to 2 flap settings + 1 clean = 3 cols
      cols: [],
      rows: []
  });

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const resetForm = () => {
      setWiz({
          step: 'init',
          name: '',
          rowCounts: 3,
          colCounts: 2,
          cols: [],
          rows: []
      });
  };

  // --- Actions ---

  const handleInitNext = () => {
      // 1. Generate Columns (Configs)
      // Total Cols = User Input + 1 (Clean)
      const totalCols = wiz.colCounts + 1;
      const newCols: WizardConfigCol[] = Array.from({ length: totalCols }).map((_, i) => {
          const isClean = i === 0;
          return {
              id: `col-${i}`,
              isRef: isClean,
              label: isClean ? 'Flaps 0°' : '', 
              subLabel: isClean ? 'Gear Up' : 'Gear Down'
          };
      });

      // 2. Generate Rows (Weights)
      // Pre-fill weights low to high if count is 3
      const newRows: WizardWeightRow[] = Array.from({ length: wiz.rowCounts }).map((_, i) => {
          let defaultWeight = '';
          if (wiz.rowCounts === 3) {
             if (i === 0) defaultWeight = '2200';
             if (i === 1) defaultWeight = '2500';
             if (i === 2) defaultWeight = '2740';
          }
          return {
              id: `row-${i}`,
              weight: defaultWeight,
              speeds: Array(totalCols).fill('')
          };
      });

      setWiz({
          ...wiz,
          step: 'table',
          cols: newCols,
          rows: newRows
      });
  };

  // -- Update Logic --

  const updateCol = (colId: string, field: keyof WizardConfigCol, val: any) => {
      setWiz(prev => ({
          ...prev,
          cols: prev.cols.map(c => c.id === colId ? { ...c, [field]: val } : c)
      }));
  };

  const setRefCol = (colId: string) => {
      setWiz(prev => ({
          ...prev,
          cols: prev.cols.map(c => ({ ...c, isRef: c.id === colId }))
      }));
  };

  const updateRowWeight = (rowId: string, val: string) => {
      setWiz(prev => ({
          ...prev,
          rows: prev.rows.map(r => r.id === rowId ? { ...r, weight: val } : r)
      }));
  };

  const updateSpeed = (rowId: string, colIdx: number, val: string) => {
      setWiz(prev => ({
          ...prev,
          rows: prev.rows.map(r => {
              if (r.id !== rowId) return r;
              const newSpeeds = [...r.speeds];
              newSpeeds[colIdx] = val;
              return { ...r, speeds: newSpeeds };
          })
      }));
  };

  // -- Add/Remove Actions --

  const addConfigCol = () => {
      setWiz(prev => ({
          ...prev,
          cols: [...prev.cols, { id: `col-${Date.now()}`, isRef: false, label: '', subLabel: 'Gear Down' }],
          rows: prev.rows.map(r => ({ ...r, speeds: [...r.speeds, ''] }))
      }));
  };

  const removeConfigCol = (idx: number) => {
      if (wiz.cols.length <= 1) return;
      setWiz(prev => {
          const newCols = prev.cols.filter((_, i) => i !== idx);
          // Safety: ensure a ref exists
          if (!newCols.some(c => c.isRef)) newCols[0].isRef = true;
          
          return {
              ...prev,
              cols: newCols,
              rows: prev.rows.map(r => ({ ...r, speeds: r.speeds.filter((_, i) => i !== idx) }))
          };
      });
  };

  const addWeightRow = () => {
      setWiz(prev => ({
          ...prev,
          rows: [...prev.rows, { id: `row-${Date.now()}`, weight: '', speeds: Array(prev.cols.length).fill('') }]
      }));
  };

  const removeWeightRow = (id: string) => {
      if (wiz.rows.length <= 1) return;
      setWiz(prev => ({
          ...prev,
          rows: prev.rows.filter(r => r.id !== id)
      }));
  };

  // -- Finish --

  const handleFinish = () => {
      // 1. Sort Rows by Weight (Ascending) for interpolation
      const sortedRows = [...wiz.rows].sort((a, b) => (parseFloat(a.weight) || 0) - (parseFloat(b.weight) || 0));
      
      const minW = parseFloat(sortedRows[0].weight) || 0;
      const maxW = parseFloat(sortedRows[sortedRows.length - 1].weight) || 0;

      // 2. Build Performance Data
      const performanceData: ChartDataPoint[] = sortedRows.map(row => {
          const speedsMap: Record<string, number> = {};
          
          wiz.cols.forEach((col, idx) => {
              speedsMap[col.id] = parseFloat(row.speeds[idx]) || 0;
          });

          return {
              lbs: parseFloat(row.weight) || 0,
              speeds: speedsMap
          };
      });

      // 3. Build Configs
      const configs: SpeedConfig[] = wiz.cols.map(col => ({
          key: col.id,
          label: col.label,
          subLabel: col.subLabel,
          color: (col.label.toLowerCase().includes('15') || col.label.toLowerCase().includes('appr') || col.subLabel.toLowerCase().includes('takeoff')) ? 'blue' : undefined
      }));

      // 4. Presets
      const presets = [
        { label: 'Light', val: minW, icon: 'User' as const },
        { label: 'Mid', val: Math.round((minW+maxW)/2), icon: 'Users' as const },
        { label: 'Max Gross', val: maxW, icon: 'Weight' as const },
      ];

      const newProfile: AircraftProfile = {
          id: `custom-${Date.now()}`,
          name: wiz.name,
          shortName: wiz.name.substring(0, 4).toUpperCase(),
          dmmsFactor: 1.404,
          configs,
          performanceData,
          presets
      };

      onAddProfile(newProfile);
      setIsCreating(false);
      setIsOpen(false);
      resetForm();
  };


  // --- Render Steps ---

  const renderInitStep = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-lg flex gap-3">
             <div className="bg-blue-500/20 p-2 rounded-full h-fit">
                <LayoutGrid className="w-5 h-5 text-blue-400" />
             </div>
             <div>
                <h4 className="text-sm font-bold text-blue-100 mb-1">New Profile Setup</h4>
                <p className="text-xs text-blue-200/60 leading-relaxed">
                   Reference your POH Stall Speed table (Section 5). Define the table structure first.
                </p>
             </div>
          </div>

          <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Aircraft Name</label>
                <input 
                    type="text" 
                    value={wiz.name}
                    onChange={e => setWiz({...wiz, name: e.target.value})}
                    placeholder="e.g. Cessna 172S"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                    autoFocus
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Weight Rows</label>
                    <input 
                        type="number" 
                        min={1} max={6}
                        value={wiz.rowCounts}
                        onChange={e => setWiz({...wiz, rowCounts: parseInt(e.target.value) || 1})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">Number of weight values (rows) in table.</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Config Columns</label>
                    <input 
                        type="number" 
                        min={1} max={8}
                        value={wiz.colCounts}
                        onChange={e => setWiz({...wiz, colCounts: parseInt(e.target.value) || 1})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-600 mt-1">Columns for flaps/gear (excl. clean).</p>
                </div>
            </div>
          </div>
      </div>
  );

  const renderTableStep = () => {
      // Validation Check
      const allWeightsFilled = wiz.rows.every(r => r.weight.trim() !== '' && !isNaN(parseFloat(r.weight)));
      const allLabelsFilled = wiz.cols.every(c => c.label.trim() !== '');
      const allSpeedsFilled = wiz.rows.every(r => r.speeds.every(s => s.trim() !== '' && !isNaN(parseFloat(s))));
      const refSelected = wiz.cols.some(c => c.isRef);

      const isValid = allWeightsFilled && allLabelsFilled && allSpeedsFilled && refSelected;

      return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="mb-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Enter <strong className="text-slate-300">KIAS</strong>. Weight sorted automatically.</span>
                </div>
                {!refSelected && (
                    <span className="text-[10px] text-amber-500 flex items-center gap-1 bg-amber-950/30 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3" /> Select clean Vso col
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto border border-slate-700 rounded-lg bg-[#0f172a] shadow-inner relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3 text-[10px] font-bold text-slate-400 uppercase w-24">
                                Weight (lbs)
                            </th>
                            {wiz.cols.map((col, idx) => (
                                <th key={col.id} className={`p-2 min-w-[140px] border-l border-slate-700 group relative ${col.isRef ? 'bg-indigo-900/20' : ''}`}>
                                    <div className="flex flex-col gap-2">
                                        {/* Ref & Label */}
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="radio" 
                                                name="refCol"
                                                checked={col.isRef}
                                                onChange={() => setRefCol(col.id)}
                                                className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                                                title="Select Clean/Gear Up"
                                            />
                                            <input 
                                                value={col.label}
                                                onChange={e => updateCol(col.id, 'label', e.target.value)}
                                                placeholder="Flaps..."
                                                className="w-full bg-slate-700/50 text-xs font-bold text-slate-200 placeholder-slate-500 px-2 py-1 rounded focus:bg-slate-700 focus:outline-none border border-transparent focus:border-slate-500"
                                            />
                                        </div>
                                        {/* SubLabel */}
                                        <input 
                                            value={col.subLabel}
                                            onChange={e => updateCol(col.id, 'subLabel', e.target.value)}
                                            placeholder="Gear..."
                                            className="w-full bg-slate-700/30 text-[10px] text-slate-400 placeholder-slate-600 px-2 py-1 rounded focus:bg-slate-700 focus:outline-none ml-5"
                                        />
                                    </div>
                                    
                                    {wiz.cols.length > 1 && (
                                        <button 
                                            onClick={() => removeConfigCol(idx)}
                                            className="absolute top-2 right-1 hidden group-hover:flex text-slate-500 hover:text-red-400 p-0.5"
                                            title="Remove Column"
                                        >
                                            <XCircle className="w-3 h-3" />
                                        </button>
                                    )}
                                </th>
                            ))}
                            <th className="p-1 w-10 align-middle border-l border-slate-700">
                                <button 
                                    onClick={addConfigCol}
                                    className="w-full h-8 flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded transition-colors"
                                    title="Add Config Column"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {wiz.rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-800/30">
                                {/* Weight Input */}
                                <td className="p-2 align-middle">
                                     <div className="flex items-center gap-1 bg-slate-700/50 rounded px-1 border border-slate-600/50 focus-within:border-blue-500">
                                        <input 
                                            type="number"
                                            value={row.weight}
                                            onChange={e => updateRowWeight(row.id, e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-transparent text-xs font-bold text-white text-right p-1.5 focus:outline-none placeholder-slate-600"
                                        />
                                    </div>
                                </td>

                                {/* Speed Inputs */}
                                {wiz.cols.map((col, cIdx) => (
                                    <td key={`${row.id}-${col.id}`} className="p-2 align-middle border-l border-slate-800">
                                        <input 
                                            type="number"
                                            value={row.speeds[cIdx]}
                                            onChange={e => updateSpeed(row.id, cIdx, e.target.value)}
                                            placeholder="-"
                                            className={`w-full bg-transparent text-center text-sm font-mono p-1.5 rounded focus:bg-slate-800 focus:outline-none ${!row.speeds[cIdx] ? 'bg-red-500/5' : 'text-emerald-300 font-bold'}`}
                                        />
                                    </td>
                                ))}

                                {/* Row Actions */}
                                <td className="p-1 text-center align-middle border-l border-slate-800">
                                     {wiz.rows.length > 1 && (
                                         <button 
                                            onClick={() => removeWeightRow(row.id)}
                                            className="text-slate-700 hover:text-red-400 p-1.5 rounded hover:bg-red-400/10 transition-colors"
                                            title="Remove Row"
                                         >
                                             <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                     )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-2">
                 <button 
                    onClick={addWeightRow}
                    className="w-full py-2 border border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 rounded text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Weight Row
                </button>
            </div>
            
            {!isValid && (
                <div className="mt-2 text-center">
                    <span className="text-[10px] text-red-400/80 animate-pulse">
                        Please fill in all weights, labels, and speeds to continue.
                    </span>
                </div>
            )}
        </div>
      );
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-[#1e293b] hover:bg-slate-800 border border-slate-700/50 rounded-full px-3 py-1.5 transition-all text-slate-300 hover:text-white"
      >
        <Plane className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-bold tracking-wide">{activeProfile.shortName}</span>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-[#0f172a] rounded-xl border border-slate-700 shadow-2xl w-full flex flex-col relative overflow-hidden transition-all duration-300 ${isCreating && wiz.step === 'table' ? 'max-w-4xl h-[700px]' : 'max-w-md h-[600px]'} max-h-[90vh]`} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#1e293b] shrink-0">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                {isCreating ? (
                    <>
                        <Settings className="w-4 h-4 text-blue-400" />
                        <span>{wiz.step === 'init' ? 'Profile Setup' : 'Enter POH Data'}</span>
                    </>
                ) : (
                    <>
                        <Plane className="w-4 h-4 text-blue-400" />
                        <span>Select Aircraft</span>
                    </>
                )}
              </h3>
              <button onClick={() => { setIsOpen(false); setIsCreating(false); resetForm(); }} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto flex-1 relative bg-gradient-to-b from-[#0f172a] to-[#0f172a]">
              {!isCreating ? (
                // --- SELECTOR MODE ---
                <div className="space-y-2">
                  {profiles.map(profile => (
                    <div 
                      key={profile.id}
                      onClick={() => {
                        onSelectProfile(profile.id);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        activeProfileId === profile.id 
                        ? 'bg-blue-600/10 border-blue-500/50' 
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${activeProfileId === profile.id ? 'bg-blue-400' : 'bg-slate-600'}`} />
                         <div>
                            <div className={`text-sm font-bold ${activeProfileId === profile.id ? 'text-blue-200' : 'text-slate-200'}`}>
                                {profile.name}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                                {profile.performanceData.length > 0 ? `${profile.performanceData[profile.performanceData.length-1].lbs} lbs Max` : ''}
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {activeProfileId === profile.id && <Check className="w-4 h-4 text-blue-400" />}
                        {profile.id.startsWith('custom') && activeProfileId !== profile.id && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteProfile(profile.id); }}
                                className="p-2 text-slate-600 hover:text-red-400"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <button 
                    onClick={() => { setIsCreating(true); resetForm(); }}
                    className="w-full mt-4 py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/50 flex items-center justify-center gap-2 text-xs font-bold transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Profile
                  </button>
                </div>
              ) : (
                // --- WIZARD MODE ---
                <>
                   {wiz.step === 'init' && renderInitStep()}
                   {wiz.step === 'table' && renderTableStep()}
                </>
              )}
            </div>

            {/* Footer Actions */}
            {isCreating && (
                <div className="p-4 border-t border-slate-800 bg-[#1e293b] flex gap-2 shrink-0">
                    <button 
                        onClick={() => {
                            if (wiz.step === 'init') { setIsCreating(false); }
                            else if (wiz.step === 'table') setWiz({...wiz, step: 'init'});
                        }}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs font-bold flex items-center gap-1"
                    >
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                    
                    <div className="flex-1"></div>

                    {wiz.step === 'init' ? (
                        <button 
                            onClick={handleInitNext}
                            disabled={!wiz.name}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                            Next: Fill Table <ArrowRight className="w-3 h-3" />
                        </button>
                    ) : (
                        <button 
                            onClick={handleFinish}
                            // Re-check validation to disable button
                            disabled={!(wiz.rows.every(r => r.weight.trim() !== '' && !isNaN(parseFloat(r.weight))) && wiz.cols.every(c => c.label.trim() !== '') && wiz.rows.every(r => r.speeds.every(s => s.trim() !== '')) && wiz.cols.some(c => c.isRef))}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg shadow-emerald-900/20"
                        >
                            <Check className="w-3 h-3" /> Finish & Save
                        </button>
                    )}
                </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};