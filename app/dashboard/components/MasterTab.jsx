'use client';

export default function MasterTab({
  sortedPupils, selectedForSweep, toggleSelectAll, setIsAddModalOpen,
  blueRoster, printRoster, executeReassessmentSweep, isProcessing,
  toggleSelectPupil, openPupilDrawer, renderPupilName, SUBJECTS,
  sweepOverrides, calculateTarget, skills, handleTargetOverride
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={sortedPupils.length > 0 && selectedForSweep.size === sortedPupils.length} 
              onChange={toggleSelectAll} 
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
            />
            Select All
          </label>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          + Add Pupil
        </button>
      </div>
      
      {/* Permanent Blue Roster */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
          <div>
            <h3 className="font-extrabold text-blue-900 flex items-center gap-2">🔄 Reassessment Roster</h3>
            <p className="text-xs text-blue-700 font-medium">These topics have reached 0% battery and require a quick verbal check.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={printRoster} className="text-sm font-bold bg-white text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors shadow-sm w-full sm:w-auto">
              Print Audit
            </button>
            <button onClick={executeReassessmentSweep} disabled={isProcessing || blueRoster.length === 0} className={`text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-sm w-full sm:w-auto ${(isProcessing || blueRoster.length === 0) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
              Generate Reassessment Pack
            </button>
          </div>
        </div>
        {blueRoster.length === 0 ? (
           <p className="text-center font-bold text-blue-400 py-4 italic">All topics healthy. No immediate reassessments required.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blueRoster.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                <span className="font-black text-slate-800 text-sm block mb-2">{item.pupil}</span>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  {item.topics.map((t, i) => <li key={i} className="font-bold">{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roster Grid */}
      {sortedPupils.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500 font-medium">No pupils in roster.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedPupils.map(pupil => (
            <div key={pupil.id} className={`bg-white border rounded-xl shadow-sm p-4 flex flex-col transition-colors ${selectedForSweep.has(pupil.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={selectedForSweep.has(pupil.id)} 
                    onChange={() => toggleSelectPupil(pupil.id)} 
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                  />
                  <button onClick={() => openPupilDrawer(pupil)} className="font-extrabold text-slate-800 hover:text-indigo-600 transition-colors text-left">
                    {renderPupilName(pupil)}
                  </button>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold border border-slate-200">
                  {pupil.reading_age}
                </span>
              </div>
              <div className="space-y-2.5 flex-1">
                {SUBJECTS.map(sub => {
                  const currentTargetId = sweepOverrides[pupil.id]?.[sub] || calculateTarget(pupil.id, sub);
                  const subSkills = skills.filter(s => s.subject === sub).sort((a,b) => a.order_index - b.order_index);
                  return (
                    <div key={sub} className="flex justify-between items-center gap-3">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider w-16 shrink-0">
                        {sub.replace('-', ' ')}
                      </span>
                      <select 
                        className="flex-1 text-xs p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500 overflow-hidden text-ellipsis"
                        value={currentTargetId}
                        onChange={(e) => handleTargetOverride(pupil.id, sub, e.target.value)}
                      >
                        <option value="all-clear">✅ No Intervention</option>
                        {subSkills.map(s => (
                          <option key={s.id} value={s.id}>{s.skill_name}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
