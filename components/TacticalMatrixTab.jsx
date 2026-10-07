'use client';

import { useState } from 'react';
import { SUBJECTS } from '../utils/constants';

export default function TacticalMatrixTab({ pupils, curriculum, progress, updateProgress, setActiveTab }) {
  const [matrixFilters, setMatrixFilters] = useState({ cohort: "All", subject: "All" });

  let matrixPupils = pupils;
  if (matrixFilters.cohort === "SEND") matrixPupils = pupils.filter(p => p.is_send);
  if (matrixFilters.cohort === "PP") matrixPupils = pupils.filter(p => p.is_pp);
  if (matrixFilters.cohort === "EAL") matrixPupils = pupils.filter(p => p.is_eal);

  let matrixSkills = curriculum;
  if (matrixFilters.subject !== "All") matrixSkills = curriculum.filter(s => s.subject === matrixFilters.subject);

  const toggleStatus = (pupilId, skillId, currentStatus) => {
    const cycle = { 'Not Yet': 'Practising', 'Practising': 'Achieved', 'Achieved': 'Not Yet' };
    const nextStatus = cycle[currentStatus || 'Not Yet'] || 'Achieved';
    updateProgress(pupilId, skillId, nextStatus);
  };

  return (
    <div className="animate-in fade-in duration-500">
      {(matrixFilters.cohort !== "All" || matrixFilters.subject !== "All") && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-5 flex justify-between items-center">
          <span className="text-blue-900 font-bold">🔍 Viewing Filtered Data: {matrixFilters.cohort} Cohort | {matrixFilters.subject} Skills</span>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab("resource-engine")} className="px-4 py-2 bg-emerald-500 text-white rounded-md font-bold hover:bg-emerald-600 transition-colors">✨ Generate Interventions</button>
            <button onClick={() => { setActiveTab("morning-briefing"); setMatrixFilters({cohort: "All", subject: "All"}); }} className="px-4 py-2 bg-blue-500 text-white rounded-md font-bold hover:bg-blue-600 transition-colors">⬅ Back</button>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-5">
        <select value={matrixFilters.cohort} onChange={(e) => setMatrixFilters(prev => ({...prev, cohort: e.target.value}))} className="p-2.5 border border-slate-300 rounded-lg w-52 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="All">All Pupils</option><option value="SEND">SEND Only</option><option value="PP">Pupil Premium Only</option><option value="EAL">EAL Only</option>
        </select>
        <select value={matrixFilters.subject} onChange={(e) => setMatrixFilters(prev => ({...prev, subject: e.target.value}))} className="p-2.5 border border-slate-300 rounded-lg w-52 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="All">All Subjects</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="w-full overflow-auto max-h-[700px] border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full border-collapse text-[13px] min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 bg-slate-50 z-20 border-r-2 border-b-2 border-slate-300 p-3 min-w-[140px] text-left text-slate-800">Pupil</th>
              {matrixSkills.map(skill => (
                <th key={skill.id} className="sticky top-0 bg-slate-50 z-10 border-b-2 border-slate-300 p-3 border-r border-slate-200 whitespace-nowrap text-center">
                  <div className="text-[11px] text-slate-500 font-normal">{skill.subject}</div>
                  <div className="text-slate-800">{skill.skill_name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixPupils.map(pupil => (
              <tr key={pupil.id} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 bg-white z-5 font-bold border-r-2 border-slate-300 p-3 border-b border-slate-200 text-slate-800">
                  {pupil.first_name} {pupil.last_initial}. ✏
                </td>
                {matrixSkills.map(skill => {
                  const status = progress.find(pr => pr.pupil_id === pupil.id && pr.skill_id === skill.id)?.status || 'Not Yet';
                  let cellClass = "bg-red-100 text-red-800";
                  let letter = "R";
                  if (status === 'Practising') { cellClass = "bg-amber-100 text-amber-800"; letter = "A"; }
                  if (status === 'Achieved') { cellClass = "bg-green-100 text-green-800"; letter = "G"; }

                  return (
                    <td key={`${pupil.id}-${skill.id}`} className="p-0 border-b border-r border-slate-200 text-center cursor-pointer min-w-[80px]">
                      <div className={`w-full h-full p-3 font-bold transition-all hover:brightness-95 ${cellClass}`} onClick={() => toggleStatus(pupil.id, skill.id, status)}>
                        {letter}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
