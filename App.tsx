import React, { useState, useEffect } from 'react';
import { Plane } from 'lucide-react';
import { WeightGustControls, SpeedResults, DmmsCard } from './components/CalculatorSection';
import { WeatherSection } from './components/WeatherSection';
import { ProfileManager } from './components/ProfileManager';
import { MOONEY_M20J } from './constants';
import { AircraftProfile } from './types';

const App = () => {
  // Load Profiles from LS - Use V3 key to separate from old data structure
  const [profiles, setProfiles] = useState<AircraftProfile[]>(() => {
    try {
      const saved = localStorage.getItem('aircraft_profiles_v3');
      return saved ? JSON.parse(saved) : [MOONEY_M20J];
    } catch (e) {
      return [MOONEY_M20J];
    }
  });

  // Load Active ID from LS 
  const [activeProfileId, setActiveProfileId] = useState(() => {
    return localStorage.getItem('active_aircraft_id_v3') || MOONEY_M20J.id;
  });

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const [weight, setWeight] = useState(2500); // Will update on profile change
  const [gustFactor, setGustFactor] = useState(0);

  // Persistence
  useEffect(() => {
    localStorage.setItem('aircraft_profiles_v3', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('active_aircraft_id_v3', activeProfileId);
  }, [activeProfileId]);

  // When profile changes, reset weight to "Max Gross" of that profile to avoid out-of-bounds errors
  useEffect(() => {
    const maxGross = activeProfile.presets.find(p => p.icon === 'Weight')?.val || 2500;
    setWeight(maxGross);
  }, [activeProfile.id]);


  const handleAddProfile = (newProfile: AircraftProfile) => {
    setProfiles([...profiles, newProfile]);
    setActiveProfileId(newProfile.id);
  };

  const handleDeleteProfile = (id: string) => {
    const newProfiles = profiles.filter(p => p.id !== id);
    setProfiles(newProfiles);
    if (activeProfileId === id) {
      setActiveProfileId(newProfiles[0].id);
    }
  };

  const handleGustUpdate = (newGust: number) => {
    setGustFactor(newGust);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      {/* Top Bar */}
      <div className="max-w-md mx-auto pt-6 px-4 pb-2 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Approach Speed Calc</h1>
            <span className="text-[10px] text-slate-600 font-mono border border-slate-800/50 rounded px-1.5 py-0.5">v1.05</span>
         </div>
         <ProfileManager 
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={setActiveProfileId}
            onAddProfile={handleAddProfile}
            onDeleteProfile={handleDeleteProfile}
         />
      </div>

      <div className="w-full max-w-md mx-auto space-y-5 px-4 pt-2">
        
        {/* Controls Card (Weight & Gust) */}
        <WeightGustControls 
          weight={weight}
          setWeight={setWeight}
          gustFactor={gustFactor}
          setGustFactor={setGustFactor}
          profile={activeProfile}
        />

        {/* Weather Card */}
        <WeatherSection onGustUpdate={handleGustUpdate} />

        {/* Results Card (Configuration Table) */}
        <SpeedResults 
          weight={weight}
          gustFactor={gustFactor}
          profile={activeProfile}
        />

        {/* DMMS Card */}
        <DmmsCard weight={weight} profile={activeProfile} />

      </div>
    </div>
  );
};

export default App;