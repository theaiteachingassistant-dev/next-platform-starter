'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CommandCenterTab() {
  const { userId } = useAuth();
  
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState('master');
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Data State
  const [pupils, setPupils] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchPupils();
  }, [userId]);

  const fetchPupils = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pupils')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });
    
    if (!error && data) setPupils(data);
    setIsLoading(false);
  };

  const openPupilDrawer = (pupil) => {
    setSelectedPupil(pupil);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedPupil(null), 300); // Wait for transition
  };

  const handleProfileUpdate = async (field, value) => {
    const updatedPupil = { ...selectedPupil, [field]: value };
    setSelectedPupil(updatedPupil);
    
    // Optimistic UI update
    setPupils(pupils.map(p => p.id === updatedPupil.id ? updatedPupil : p));

    await supabase
      .from('pupils')
      .update({ [field]: value })
      .eq('id', updatedPupil.id);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tactical Command Center</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {activeTab === 'master' && 'Master Staging Area: Ready for Sweep'}
            {activeTab === 'maths' && 'Mathematics Intervention Matrix'}
            {activeTab === 'writing' && 'Writing & Grammar Matrix'}
            {activeTab === 'reading' && 'Reading Comprehension Matrix'}
            {activeTab === 'spelling' && 'Spelling & Phonics Matrix'}
          </p>
        </div>
        {activeTab === 'master' && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2">
            🚀 Execute Batch Sweep
          </button>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-400 font-medium">Loading Roster...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-full">
            {/* Placeholder for the matrices. We will inject the draggable grids here in Phase 3 */}
            {activeTab === 'master' && (
              <div className="text-center text-slate-500 py-20">
                <h3 className="text-lg font-bold text-slate-700 mb-2">Staging Area Empty</h3>
                <p>Switch to a subject tab to mark deficits and stage interventions.</p>
              </div>
            )}
            
            {/* Subject Tabs Placeholder - Renders list of clickable pupils for now to test the drawer */}
            {activeTab !== 'master' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Class Roster</p>
                {pupils.map(pupil => (
                  <button 
                    key={pupil.id}
                    onClick={() => openPupilDrawer(pupil)}
                    className="w-full text-left px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors font-semibold text-slate-700 flex justify-between items-center"
                  >
                    <span>{pupil.name}</span>
                    <span className="text-xs px-2 py-1 bg-white rounded border border-slate-200 text-slate-500">
                      {pupil.reading_age || 'Age Pending'} • {pupil.reading_tier || 'Tier Pending'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION TABS */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto flex justify-between px-2">
          {[
            { id: 'master', label: 'Master Tab', icon: '🎯' },
            { id: 'maths', label: 'Maths', icon: '➗' },
            { id: 'writing', label: 'Writing', icon: '✍️' },
            { id: 'reading', label: 'Reading', icon: '📖' },
            { id: 'spelling', label: 'Spelling', icon: '🔤' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 flex flex-col items-center gap-1 border-t-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-bold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* PUPIL PROFILE DRAWER (SLIDES FROM RIGHT) */}
      <div className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeDrawer}></div>
      
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedPupil && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-extrabold text-slate-800">{selectedPupil.name}</h2>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>

            <div className="space-y-6">
              {/* READING ENGINE SETTINGS */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  📖 Reading Engine Calibration
                </h3>
                
                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">Chronological / Reading Age</label>
                  <select 
                    value={selectedPupil.reading_age || 'Year 3'} 
                    onChange={(e) => handleProfileUpdate('reading_age', e.target.value)}
                    className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Phonics Phase 1', 'Phonics Phase 2', 'Phonics Phase 3', 'Phonics Phase 4', 'Phonics Phase 5', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'].map(age => (
                      <option key={age} value={age}>{age}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">Mastery Tier</label>
                  <select 
                    value={selectedPupil.reading_tier || 'Expected'} 
                    onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)}
                    className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Working Towards">Working Towards (WTS)</option>
                    <option value="Expected">Expected (EXP)</option>
                    <option value="Higher">Higher / Greater Depth (GDS)</option>
                  </select>
                </div>
              </div>

              {/* CONTEXT VARIABLES */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Context Variables</h3>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Pupil Interests (For AI Reasoning Questions)</label>
                  <input 
                    type="text" 
                    value={selectedPupil.interests || ''}
                    onChange={(e) => handleProfileUpdate('interests', e.target.value)}
                    placeholder="e.g. Minecraft, football, baking..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedPupil.is_pp || false}
                      onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-700">Pupil Premium</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedPupil.is_eal || false}
                      onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-700">EAL</span>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedPupil.is_send || false}
                      onChange={(e) => handleProfileUpdate('is_send', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-bold text-slate-700">SEND Support</span>
                  </label>
                  
                  {selectedPupil.is_send && (
                    <input 
                      type="text" 
                      value={selectedPupil.send_type || ''}
                      onChange={(e) => handleProfileUpdate('send_type', e.target.value)}
                      placeholder="Specify need (e.g. Dyslexia, ADHD, ASD...)"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100">
              <button onClick={closeDrawer} className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors">
                Save & Close Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
