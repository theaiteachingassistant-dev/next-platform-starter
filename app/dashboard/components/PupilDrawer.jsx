'use client';

export default function PupilDrawer({
  isDrawerOpen, closeDrawer, selectedPupil, handleProfileUpdate,
  drawerStats, drawerStatView, setDrawerStatView, skills,
  isConfirmingDeletePupil, setIsConfirmingDeletePupil, handleDeletePupil, READING_AGES
}) {
  return (
    <>
      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeDrawer}></div>
      <div className={`fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedPupil && drawerStats && (
          <div className="p-6 flex flex-col h-full bg-slate-50">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
              <div className="flex gap-2 items-center flex-1">
                <input 
                  type="text" 
                  value={selectedPupil.name || ''} 
                  onChange={(e) => handleProfileUpdate('name', e.target.value)}
                  className="text-3xl font-extrabold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 w-full max-w-[200px] transition-colors"
                  placeholder="First Name"
                />
                <input 
                  type="text" 
                  maxLength="1"
                  value={selectedPupil.surname_initial || ''} 
                  onChange={(e) => handleProfileUpdate('surname_initial', e.target.value.toUpperCase())}
                  className="text-3xl font-extrabold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 w-12 text-center transition-colors"
                  placeholder="Initial"
                />
              </div>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 font-black text-2xl shrink-0">&times;</button>
            </div>
            
            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* LEFT COLUMN */}
              <div className="w-1/2 space-y-6 overflow-y-auto pr-2">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider flex items-center gap-2">📖 Reading Engine Calibration</h3>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Reading Age</label>
                    <select value={selectedPupil.reading_age || 'Year 3'} onChange={(e) => handleProfileUpdate('reading_age', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                      {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Mastery Tier</label>
                    <select value={selectedPupil.reading_tier || 'Expected'} onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                      <option value="Working Towards">Working Towards (WTS)</option><option value="Expected">Expected (EXP)</option><option value="Higher">Higher / Greater Depth (GDS)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
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
                    <input type="text" value={selectedPupil.interests || ''} onChange={(e) => handleProfileUpdate('interests', e.target.value)} placeholder="e.g. Minecraft, football..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_pp || false} onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">Pupil Premium</span></label>
                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_eal || false} onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">EAL</span></label>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={selectedPupil.is_send || false} onChange={(e) => handleProfileUpdate('is_send', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">SEND Support</span></label>
                    {selectedPupil.is_send && <input type="text" value={selectedPupil.send_type || ''} onChange={(e) => handleProfileUpdate('send_type', e.target.value)} placeholder="Specify need (e.g. Dyslexia, ADHD...)" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />}
                  </div>
                </div>

                <div className="pt-4 border-t border-red-100 shrink-0">
                  {!isConfirmingDeletePupil ? (
                    <button onClick={() => setIsConfirmingDeletePupil(true)} className="w-full py-3 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">
                      Delete Pupil
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleDeletePupil} className="flex-1 py-3 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">
                        Confirm Delete
                      </button>
                      <button onClick={() => setIsConfirmingDeletePupil(false)} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-900 flex justify-between items-center shrink-0">
                  <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">📊 Mastery Profile</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">Based on {drawerStats.totalP} marked topics</span>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-8 overflow-y-auto">
                  {drawerStatView === 'chart' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Comparative Benchmark</span>
                        <span className="text-2xl font-black text-emerald-500 leading-none">{drawerStats.pGreen}% Green</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                            <span>{selectedPupil.name}</span>
                            <span>{drawerStats.pGreen}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{width: `${drawerStats.pGreen}%`}}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>Class Average</span>
                            <span>{drawerStats.classGreen}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-slate-300 h-full rounded-full transition-all duration-500" style={{width: `${drawerStats.classGreen}%`}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-48 border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                       <div className={`px-4 py-2 flex justify-between items-center text-white ${drawerStatView === 'green' ? 'bg-emerald-500' : drawerStatView === 'orange' ? 'bg-amber-400' : 'bg-red-500'}`}>
                         <h4 className="text-xs font-black uppercase tracking-wider">{drawerStatView} Topics</h4>
                         <button onClick={() => setDrawerStatView('chart')} className="text-xs font-bold hover:underline opacity-90 hover:opacity-100">← Back to Chart</button>
                       </div>
                       <div className="overflow-y-auto p-2 bg-slate-50 flex-1">
                          {drawerStats.pProg.filter(p => p.status === drawerStatView).length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 text-center p-4">No topics in this tier.</p>
                          ) : (
                            drawerStats.pProg.filter(p => p.status === drawerStatView).map(prog => {
                               const sk = skills.find(s => s.id === prog.skill_id);
                               return sk ? (
                                 <div key={sk.id} className="text-sm font-bold text-slate-700 p-2 border-b border-slate-100 last:border-0 flex justify-between items-center">
                                   <span>{sk.skill_name}</span>
                                   <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">{sk.subject}</span>
                                 </div>
                               ) : null;
                            })
                          )}
                       </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-6 flex flex-col items-center flex-1 justify-center relative">
                    <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest absolute top-4">Click slice to view topics</p>
                    {drawerStats.totalP === 0 ? (
                      <p className="text-slate-300 font-bold text-sm">No Assessment Data</p>
                    ) : (
                      <svg viewBox="0 0 36 36" className="w-40 h-40 drop-shadow-sm mt-4">
                         <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4"></circle>
                         {drawerStats.pGreen > 0 && <circle onClick={() => setDrawerStatView('green')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={`${drawerStats.pGreen} ${100 - drawerStats.pGreen}`} strokeDashoffset="25" className="cursor-pointer hover:stroke-emerald-400 transition-colors"></circle>}
                         {drawerStats.pOrange > 0 && <circle onClick={() => setDrawerStatView('orange')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${drawerStats.pOrange} ${100 - drawerStats.pOrange}`} strokeDashoffset={(100 - drawerStats.pGreen) + 25} className="cursor-pointer hover:stroke-amber-300 transition-colors"></circle>}
                         {drawerStats.pRed > 0 && <circle onClick={() => setDrawerStatView('red')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#ef4444" strokeWidth="4" strokeDasharray={`${drawerStats.pRed} ${100 - drawerStats.pRed}`} strokeDashoffset={(100 - drawerStats.pGreen - drawerStats.pOrange) + 25} className="cursor-pointer hover:stroke-red-400 transition-colors"></circle>}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
