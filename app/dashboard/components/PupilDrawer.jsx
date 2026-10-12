'use client';
import { useState, useEffect } from 'react';

export default function PupilDrawer({
  isDrawerOpen, closeDrawer, selectedPupil, handleProfileUpdate,
  drawerStats, drawerStatView, setDrawerStatView, skills,
  isConfirmingDeletePupil, setIsConfirmingDeletePupil, handleDeletePupil, READING_AGES
}) {
  // 1. Accordion Memory State
  const [expandedSections, setExpandedSections] = useState({
    reading: true,
    context: false,
    mastery: true,
  });

  // Load preferences from browser on mount
  useEffect(() => {
    const saved = localStorage.getItem('ks2_drawer_prefs');
    if (saved) {
      try { setExpandedSections(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const toggleSection = (section) => {
    const newState = { ...expandedSections, [section]: !expandedSections[section] };
    setExpandedSections(newState);
    localStorage.setItem('ks2_drawer_prefs', JSON.stringify(newState));
  };

  if (!selectedPupil) return null;

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeDrawer}></div>
      
      {/* Drawer Panel */}
      <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {selectedPupil.name} {selectedPupil.surname_initial ? `${selectedPupil.surname_initial}.` : ''}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pupil Intervention Profile</p>
          </div>
          <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-colors">
            ✕
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* SECTION 1: Reading Engine */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('reading')} className="w-full px-5 py-3.5 bg-indigo-50/50 hover:bg-indigo-50 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-indigo-900">
                <span>📖</span> Reading Engine Calibration
              </div>
              <span className={`transform transition-transform text-indigo-400 text-xs ${expandedSections.reading ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.reading && (
              <div className="p-5 border-t border-indigo-100 space-y-4 bg-white">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Reading Age</label>
                  <select 
                    value={selectedPupil.reading_age || 'Year 3'} 
                    onChange={(e) => handleProfileUpdate('reading_age', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comprehension Tier</label>
                  <select 
                    value={selectedPupil.reading_tier || 'Expected'} 
                    onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Working Towards">Working Towards (WTS)</option>
                    <option value="Expected">Expected (EXP)</option>
                    <option value="Higher">Higher Depth (GDS)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Context Variables */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('context')} className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <span>⚙️</span> Context Variables
              </div>
              <span className={`transform transition-transform text-slate-400 text-xs ${expandedSections.context ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.context && (
              <div className="p-5 border-t border-slate-200 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
                    <select value={selectedPupil.gender} onChange={(e) => handleProfileUpdate('gender', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold">
                      <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Year</label>
                    <select value={selectedPupil.year_group} onChange={(e) => handleProfileUpdate('year_group', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold">
                      {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Personal Interests (For AI Context)</label>
                  <input type="text" value={selectedPupil.interests || ''} onChange={(e) => handleProfileUpdate('interests', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold" placeholder="e.g. Minecraft, Dinosaurs" />
                </div>
                <div className="flex gap-2 justify-between">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_send ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_send} onChange={(e) => handleProfileUpdate('is_send', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">SEND</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_eal ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_eal} onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">EAL</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_pp ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_pp} onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">PP</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Mastery Profile */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('mastery')} className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <span>🎯</span> Mastery Profile
              </div>
              <span className={`transform transition-transform text-slate-400 text-xs ${expandedSections.mastery ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.mastery && drawerStats && (
              <div className="p-5 border-t border-slate-200 bg-white">
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setDrawerStatView('chart')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${drawerStatView === 'chart' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                    Overview
                  </button>
                  <button onClick={() => setDrawerStatView('list')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${drawerStatView === 'list' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                    Topic Breakdown
                  </button>
                </div>
                
                {drawerStatView === 'chart' ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-emerald-600">Mastered (Green)</span><span>{drawerStats.pGreen}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${drawerStats.pGreen}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-amber-500">Developing (Orange)</span><span>{drawerStats.pOrange}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${drawerStats.pOrange}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-red-500">Struggling (Red)</span><span>{drawerStats.pRed}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${drawerStats.pRed}%` }}></div></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {drawerStats.pProg.map((p, i) => {
                      const skill = skills.find(s => s.id === p.skill_id);
                      if (!skill) return null;
                      let dotColor = 'bg-slate-200';
                      if (p.status === 'red') dotColor = 'bg-red-500';
                      if (p.status === 'orange') dotColor = 'bg-amber-400';
                      if (p.status === 'green') dotColor = 'bg-emerald-500';
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs p-1.5 border border-slate-100 rounded bg-slate-50">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                          <span className="font-bold text-slate-700 truncate flex-1">{skill.skill_name}</span>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{skill.subject}</span>
                        </div>
                      );
                    })}
                    {drawerStats.pProg.length === 0 && <p className="text-center text-xs text-slate-400 font-bold py-4">No topics assessed yet.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* This empty space reserves room for the Notes feature coming in Step 3 */}
          <div className="pt-2"></div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
          {!isConfirmingDeletePupil ? (
            <button onClick={() => setIsConfirmingDeletePupil(true)} className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">
              Remove Pupil from Roster
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleDeletePupil} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                Confirm Removal
              </button>
              <button onClick={() => setIsConfirmingDeletePupil(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
