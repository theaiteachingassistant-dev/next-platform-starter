'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

// Unified Reading Age Options
const READING_AGES = [
  'Phonics Phase 1 (Sound Awareness)',
  'Phonics Phase 2 (Letter Sounds)',
  'Phonics Phase 3 (Digraphs & Trigraphs)',
  'Phonics Phase 4 (Blending Clusters)',
  'Phonics Phase 5 (Alternative Spellings)',
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'
];

export default function CommandCenterTab() {
  const { userId } = useAuth();
  const { session } = useSession();
  
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return null;

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: async (url, options = {}) => {
          try {
            const clerkToken = await session?.getToken({ template: 'supabase' });
            const headers = new Headers(options?.headers);
            if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`);
            return fetch(url, { ...options, headers });
          } catch (err) {
            console.error('Clerk Token Error:', err);
            throw err;
          }
        },
      },
    });
  }, [session]);

  // UI State
  const [activeTab, setActiveTab] = useState('master');
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Strict Error Surfacing States
  const [saveError, setSaveError] = useState(null);
  const [columnError, setColumnError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  
  // Data State
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Skill Input State
  const [newSkillName, setNewSkillName] = useState('');

  // New Pupil Form State
  const initialPupilState = {
    name: '', surname_initial: '', gender: 'Neutral', year_group: '3',
    reading_age: 'Year 3', reading_tier: 'Expected', interests: '',
    is_send: false, send_type: '', is_pp: false, is_eal: false
  };
  const [newPupil, setNewPupil] = useState(initialPupilState);

  // Initial Data Fetch
  useEffect(() => {
    if (userId && supabase) fetchDashboardData();
  }, [userId, supabase]);

  // UI Transition State-Reset: Wipes inputs when changing subject tabs
  useEffect(() => {
    setNewSkillName('');
    setColumnError(null);
  }, [activeTab]);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    setIsLoading(true);
    
    const [pupilsRes, skillsRes, progressRes] = await Promise.all([
      supabase.from('pupils').select('*').eq('user_id', userId).order('name', { ascending: true }),
      supabase.from('curriculum_skills').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
      supabase.from('pupil_progress').select('*').eq('user_id', userId)
    ]);
    
    if (pupilsRes.data) setPupils(pupilsRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (progressRes.data) setProgress(progressRes.data);
    
    setIsLoading(false);
  };

  // --- PUPIL INTAKE LOGIC ---
  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setSaveError(null);
    setNewPupil(initialPupilState); 
  };

  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!newPupil.name.trim() || !userId || !supabase) return;
    setIsSaving(true);
    setSaveError(null);

    const pupilData = { ...newPupil, user_id: userId };
    
    try {
      const { data, error } = await supabase.from('pupils').insert([pupilData]).select();
      if (error) throw error;
      if (data) {
        setPupils([...pupils, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        closeAddModal();
      }
    } catch (error) {
      setSaveError(error.message || "Failed to connect to Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileUpdate = async (field, value) => {
    if (!supabase) return;
    const updatedPupil = { ...selectedPupil, [field]: value };
    setSelectedPupil(updatedPupil);
    setPupils(pupils.map(p => p.id === updatedPupil.id ? updatedPupil : p));
    await supabase.from('pupils').update({ [field]: value }).eq('id', updatedPupil.id);
  };

  // --- MATRIX ENGINE LOGIC ---
  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim() || !userId || !supabase) return;
    setIsAddingSkill(true);
    setColumnError(null);

    const subjectSkills = skills.filter(s => s.subject === activeTab);
    const nextIndex = subjectSkills.length;

    try {
      const { data, error } = await supabase
        .from('curriculum_skills')
        .insert([{ user_id: userId, subject: activeTab, skill_name: newSkillName.trim(), order_index: nextIndex }])
        .select();

      if (error) throw error;
      
      if (data) {
        setSkills([...skills, data[0]]);
        setNewSkillName('');
      }
    } catch (err) {
      console.error("Add Skill Error:", err);
      setColumnError(err.message || "Failed to add column.");
    } finally {
      setIsAddingSkill(false);
    }
  };

  const handleCellCycle = async (pupilId, skillId) => {
    if (!supabase) return;
    
    const existing = progress.find(p => p.pupil_id === pupilId && p.skill_id === skillId);
    const currentStatus = existing ? existing.status : 'blank';
    
    const cycle = { 'blank': 'red', 'red': 'orange', 'orange': 'green', 'green': 'blank' };
    const nextStatus = cycle[currentStatus];
    
    let newProgress = [...progress];
    if (existing) {
      const index = newProgress.findIndex(p => p.id === existing.id);
      newProgress[index] = { ...existing, status: nextStatus };
    } else {
      newProgress.push({ pupil_id: pupilId, skill_id: skillId, status: nextStatus, user_id: userId, id: 'temp-'+Date.now() });
    }
    setProgress(newProgress);

    if (existing) {
      await supabase.from('pupil_progress').update({ status: nextStatus }).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('pupil_progress').insert([{
        user_id: userId, pupil_id: pupilId, skill_id: skillId, status: nextStatus
      }]).select();
      
      if (data) {
         setProgress(prev => prev.map(p => (p.pupil_id === pupilId && p.skill_id === skillId) ? data[0] : p));
      }
    }
  };

  const openPupilDrawer = (pupil) => { setSelectedPupil(pupil); setIsDrawerOpen(true); };
  const closeDrawer = () => { setIsDrawerOpen(false); setTimeout(() => setSelectedPupil(null), 300); };

  const activeSkills = skills.filter(s => s.subject === activeTab).sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="flex flex-col h-screen bg-slate-50 pb-20 relative">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Tactical Command Center</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {activeTab === 'master' ? 'Master Staging Area: Ready for Sweep' : `${activeTab.replace('-', ' ').toUpperCase()} Intervention Matrix`}
          </p>
        </div>
        {activeTab === 'master' && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2">
            🚀 Execute Batch Sweep
          </button>
        )}
      </header>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-400 font-medium">Loading Database...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-full">
            
            {/* MASTER TAB */}
            {activeTab === 'master' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Class Roster (Master View)</p>
                  <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    + Add Pupil
                  </button>
                </div>
                
                {pupils.length === 0 ? (
                  <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-500 font-medium">No pupils in roster.</p>
                    <p className="text-sm text-slate-400 mt-1">Click '+ Add Pupil' to build your class.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pupils.map(pupil => (
                      <button key={pupil.id} onClick={() => openPupilDrawer(pupil)} className="w-full text-left px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors font-semibold text-slate-700 flex justify-between items-center">
                        <span>{pupil.name} {pupil.surname_initial ? `${pupil.surname_initial}.` : ''}</span>
                        <span className="text-xs px-2 py-1 bg-white rounded border border-slate-200 text-slate-500">
                          {pupil.reading_age || 'Age Pending'} • {pupil.reading_tier || 'Tier Pending'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBJECT MATRIX TAB */}
            {activeTab !== 'master' && (
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-lg font-bold text-slate-800 capitalize mt-2">{activeTab.replace('-', ' ')}</h2>
                  <div className="flex flex-col items-end">
                    <form onSubmit={handleAddSkill} className="flex gap-2">
                      <input 
                        type="text" required
                        value={newSkillName} 
                        onChange={(e) => setNewSkillName(e.target.value)} 
                        placeholder="New Column (e.g. Fractions)" 
                        className="border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                      />
                      <button type="submit" disabled={isAddingSkill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:bg-indigo-400">
                        {isAddingSkill ? '...' : '+ Add Column'}
                      </button>
                    </form>
                    {columnError && (
                      <div className="text-red-600 text-xs font-bold mt-2 bg-red-50 px-3 py-1.5 rounded border border-red-100">
                        🚨 {columnError}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                  {pupils.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Add pupils in the Master Tab to populate this grid.</div>
                  ) : activeSkills.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Use the "+ Add Column" button above to build your {activeTab} curriculum.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                        <tr>
                          <th className="p-3 border-b border-slate-200 border-r min-w-[150px] font-extrabold text-slate-700 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] sticky left-0 z-20">
                            Class Roster
                          </th>
                          {activeSkills.map(skill => (
                            <th key={skill.id} className="p-3 border-b border-slate-200 border-r min-w-[120px] max-w-[160px] text-center font-bold text-slate-700 bg-slate-50 leading-tight">
                              {skill.skill_name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pupils.map(pupil => (
                          <tr key={pupil.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-3 border-b border-slate-200 border-r font-semibold text-slate-700 bg-white group-hover:bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[150px]">
                              {pupil.name} {pupil.surname_initial ? `${pupil.surname_initial}.` : ''}
                            </td>
                            {activeSkills.map(skill => {
                              const cellData = progress.find(p => p.pupil_id === pupil.id && p.skill_id === skill.id);
                              const status = cellData ? cellData.status : 'blank';
                              
                              let bgClass = 'bg-slate-50 hover:bg-slate-100 border-slate-200';
                              if (status === 'red') bgClass = 'bg-red-500 hover:bg-red-600 border-red-600 shadow-inner';
                              if (status === 'orange') bgClass = 'bg-amber-400 hover:bg-amber-500 border-amber-500 shadow-inner';
                              if (status === 'green') bgClass = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 shadow-inner';

                              return (
                                <td key={`${pupil.id}-${skill.id}`} className="p-1.5 border-b border-slate-200 border-r text-center">
                                  <button 
                                    onClick={() => handleCellCycle(pupil.id, skill.id)}
                                    className={`w-full h-10 rounded transition-all border ${bgClass}`}
                                  ></button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-6xl mx-auto flex justify-between px-2">
          {[
            { id: 'master', label: 'Master', icon: '🎯' },
            { id: 'maths', label: 'Maths', icon: '➗' },
            { id: 'writing', label: 'Writing', icon: '✍️' },
            { id: 'reading', label: 'Reading', icon: '📖' },
            { id: 'spelling', label: 'Spelling', icon: '🔤' },
            { id: 'times-tables', label: 'Times Tables', icon: '✖️' }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-4 flex flex-col items-center gap-1 border-t-2 transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ADD PUPIL MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-lg text-slate-800">Add New Pupil</h3>
              <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            
            <form id="add-pupil-form" onSubmit={handleAddPupil} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5">
                {saveError && <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm font-medium">🚨 {saveError}</div>}

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                    <input type="text" required value={newPupil.name} onChange={(e) => setNewPupil({...newPupil, name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Leo" />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Initial</label>
                    <input type="text" maxLength="1" value={newPupil.surname_initial} onChange={(e) => setNewPupil({...newPupil, surname_initial: e.target.value.toUpperCase()})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-center" placeholder="M" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select value={newPupil.gender} onChange={(e) => setNewPupil({...newPupil, gender: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral/Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Year Group</label>
                    <select value={newPupil.year_group} onChange={(e) => setNewPupil({...newPupil, year_group: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Reading Age</label>
                    <select value={newPupil.reading_age} onChange={(e) => setNewPupil({...newPupil, reading_age: e.target.value})} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Reading Tier</label>
                    <select value={newPupil.reading_tier} onChange={(e) => setNewPupil({...newPupil, reading_tier: e.target.value})} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="Working Towards">Working Towards (WTS)</option><option value="Expected">Expected (EXP)</option><option value="Higher">Higher / Greater Depth (GDS)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">3 Key Interests (For AI Context)</label>
                  <input type="text" value={newPupil.interests} onChange={(e) => setNewPupil({...newPupil, interests: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Minecraft, football, baking" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_send} onChange={(e) => setNewPupil({...newPupil, is_send: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">SEND</span></label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_eal} onChange={(e) => setNewPupil({...newPupil, is_eal: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">EAL</span></label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_pp} onChange={(e) => setNewPupil({...newPupil, is_pp: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">PP</span></label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                <button type="button" onClick={closeAddModal} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="submit" disabled={isSaving} className={`px-5 py-2.5 text-white rounded-lg text-sm font-bold transition-colors ${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{isSaving ? 'Saving...' : 'Save Pupil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PUPIL PROFILE DRAWER */}
      <div className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeDrawer}></div>
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedPupil && (
          <div className="p-6 pb-24">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
              <h2 className="text-2xl font-extrabold text-slate-800">{selectedPupil.name} {selectedPupil.surname_initial ? `${selectedPupil.surname_initial}.` : ''}</h2>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider flex items-center gap-2">📖 Reading Engine Calibration</h3>
                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">Chronological / Reading Age</label>
                  <select value={selectedPupil.reading_age || 'Year 3'} onChange={(e) => handleProfileUpdate('reading_age', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500">
                    {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">Mastery Tier</label>
                  <select value={selectedPupil.reading_tier || 'Expected'} onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500">
                    <option value="Working Towards">Working Towards (WTS)</option><option value="Expected">Expected (EXP)</option><option value="Higher">Higher / Greater Depth (GDS)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Context Variables</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Gender</label>
                    <select value={selectedPupil.gender || 'Neutral'} onChange={(e) => handleProfileUpdate('gender', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral/Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Year Group</label>
                    <select value={selectedPupil.year_group || '3'} onChange={(e) => handleProfileUpdate('year_group', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">3 Key Interests</label>
                  <input type="text" value={selectedPupil.interests || ''} onChange={(e) => handleProfileUpdate('interests', e.target.value)} placeholder="e.g. Minecraft, football, baking..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_pp || false} onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">Pupil Premium</span></label>
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_eal || false} onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">EAL</span></label>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={selectedPupil.is_send || false} onChange={(e) => handleProfileUpdate('is_send', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">SEND Support</span></label>
                  {selectedPupil.is_send && <input type="text" value={selectedPupil.send_type || ''} onChange={(e) => handleProfileUpdate('send_type', e.target.value)} placeholder="Specify need (e.g. Dyslexia, ADHD, ASD...)" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
