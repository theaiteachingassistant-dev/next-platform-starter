'use client';

import { useState } from 'react';
import { SUBJECTS } from '../utils/constants';

export default function TacticalMatrixTab({ pupils, curriculum, progress, updateProgress, setActiveTab }) {
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);

  // Filter skills for the active subject view
  const subjectSkills = curriculum
    .filter(skill => skill.subject === selectedSubject)
    .sort((a, b) => a.display_order - b.display_order);

  // Status cycling logic (R -> A -> G -> GD -> R)
  const cycleStatus = (currentStatus) => {
    if (!currentStatus || currentStatus === 'Not Yet') return 'Working Towards';
    if (currentStatus === 'Working Towards') return 'Expected';
    if (currentStatus === 'Expected') return 'Greater Depth';
    return 'Not Yet';
  };

  const getStatusColor = (status) => {
    if (status === 'Working Towards') return 'bg-amber-400 text-amber-900 border-amber-500';
    if (status === 'Expected') return 'bg-emerald-400 text-emerald-900 border-emerald-500';
    if (status === 'Greater Depth') return 'bg-blue-400 text-blue-900 border-blue-500';
    return 'bg-red-400 text-red-900 border-red-500'; // 'Not Yet'
  };

  const getStatusLabel = (status) => {
    if (status === 'Working Towards') return 'A'; // Amber
    if (status === 'Expected') return 'G'; // Green
    if (status === 'Greater Depth') return 'GD'; // Greater Depth
    return 'R'; // Red
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Tactical Matrix</h2>
        
        <div className="flex space-x-3">
          <select 
            className="border-slate-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white px-3 py-2 border"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            {SUBJECTS.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
          <button 
            onClick={() => setActiveTab('resource-engine')}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors shadow-sm"
          >
            ✨ Generate Interventions
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 border-r border-slate-200 shadow-sm z-10 w-48">
                Pupil
              </th>
              {subjectSkills.map(skill => (
                <th key={skill.id} className="px-4 py-3 text-center font-semibold text-slate-700 min-w-[120px]">
                  {skill.skill_name}
                </th>
              ))}
              {subjectSkills.length === 0 && (
                <th className="px-4 py-3 text-left font-medium text-slate-500 italic">
                  No skills mapped for {selectedSubject} yet.
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pupils.map(pupil => (
              <tr key={pupil.id} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-900 border-r border-slate-200 shadow-sm z-10">
                  <div className="flex items-center justify-between">
                    <span>{pupil.first_name} {pupil.last_initial}.</span>
                    <div className="flex space-x-1">
                      {pupil.is_send && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">SEND</span>}
                      {pupil.is_pp && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">PP</span>}
                    </div>
                  </div>
                </td>
                {subjectSkills.map(skill => {
                  const record = progress.find(p => p.pupil_id === pupil.id && p.skill_id === skill.id);
                  const currentStatus = record ? record.status : 'Not Yet';
                  
                  return (
                    <td key={skill.id} className="px-2 py-2 text-center">
                      <button
                        onClick={() => updateProgress(pupil.id, skill.id, cycleStatus(currentStatus))}
                        className={`w-full py-1.5 rounded text-xs font-bold border transition-colors ${getStatusColor(currentStatus)}`}
                      >
                        {getStatusLabel(currentStatus)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {pupils.length === 0 && (
              <tr>
                <td colSpan={subjectSkills.length + 1} className="px-4 py-8 text-center text-slate-500 italic">
                  No pupils enrolled. Head to the Resource Engine to onboard your class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
