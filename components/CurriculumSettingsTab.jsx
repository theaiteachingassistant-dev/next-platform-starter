'use client';

import { useState } from 'react';
import { SUBJECTS } from '../utils/constants';

export default function CurriculumSettingsTab({ curriculum, addSkill, apiKey, setApiKey }) {
  const [newSkillName, setNewSkillName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [settingsSubjectFilter, setSettingsSubjectFilter] = useState(SUBJECTS[0]);

  const handleSaveKey = (e) => {
    e.preventDefault();
    const key = document.getElementById("apiKeyInput").value;
    if (key) { setApiKey(key); localStorage.setItem('gemini_api_key', key); document.getElementById("apiKeyInput").value = ""; }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    const subjectSkills = curriculum.filter(s => s.subject === selectedSubject);
    const nextOrder = subjectSkills.length > 0 ? Math.max(...subjectSkills.map(s => s.display_order)) + 1 : 1;
    await addSkill({ subject: selectedSubject, skill_name: newSkillName.trim(), display_order: nextOrder });
    setNewSkillName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Mapped Skills Tracker</h2>
            <select value={settingsSubjectFilter} onChange={e => setSettingsSubjectFilter(e.target.value)} className="p-2 border border-slate-300 rounded bg-white text-sm outline-none">
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto border border-slate-100 rounded-lg bg-slate-50 p-4 space-y-2">
            {curriculum.filter(s => s.subject === settingsSubjectFilter).sort((a,b) => a.display_order - b.display_order).map(skill => (
              <div key={skill.id} className="p-3 bg-white border border-slate-200 rounded flex justify-between items-center text-sm">
                <div><span className="font-bold text-slate-400 mr-3">#{skill.display_order}</span><span className="font-bold text-indigo-600 mr-3">{skill.subject}</span><span className="text-slate-700">{skill.skill_name}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-fuchsia-50 border border-fuchsia-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold text-fuchsia-800 mb-4">📚 Map New Skill</h2>
          <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-4">
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-3 border border-fuchsia-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-fuchsia-500">
              {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            <input type="text" value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="e.g. Fronted Adverbials" className="flex-1 p-3 border border-fuchsia-300 rounded-lg outline-none focus:ring-2 focus:ring-fuchsia-500" required />
            <button type="submit" className="px-6 py-3 bg-fuchsia-600 text-white rounded-lg font-bold hover:bg-fuchsia-700 transition-colors">Map Skill</button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-1 bg-white border border-slate-200 p-6 rounded-lg shadow-sm h-fit">
        <h2 className="text-xl font-bold text-slate-800 mb-4">⚙ AI System Config</h2>
        <p className="text-sm text-slate-500 mb-4">Phase 1 BYOK Configuration to run the analysis engine without server charges.</p>
        <form onSubmit={handleSaveKey} className="flex flex-col gap-3">
          <input id="apiKeyInput" type="password" placeholder={apiKey ? "Key securely loaded..." : "Paste Gemini API key..."} className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
          <button type="submit" className="w-full p-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors">Save Locally</button>
        </form>
      </div>

    </div>
  );
}
