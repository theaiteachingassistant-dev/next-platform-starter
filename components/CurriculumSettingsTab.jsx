'use client';

import { useState, useEffect } from 'react';
import { SUBJECTS } from '../utils/constants';

export default function CurriculumSettingsTab({ curriculum, addSkill, apiKey, setApiKey }) {
  const [newSkillName, setNewSkillName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);

  // Persist API key in browser storage for the BYOK model
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey && !apiKey) {
      setApiKey(storedKey);
    }
  }, [apiKey, setApiKey]);

  const handleSaveKey = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    
    // Calculate display order to append to the end of the subject list
    const subjectSkills = curriculum.filter(s => s.subject === selectedSubject);
    const nextOrder = subjectSkills.length > 0 
      ? Math.max(...subjectSkills.map(s => s.display_order)) + 1 
      : 1;

    await addSkill({
      subject: selectedSubject,
      skill_name: newSkillName.trim(),
      display_order: nextOrder
    });
    
    setNewSkillName('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* API Key Settings Panel */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-2">System Settings</h3>
        <p className="text-sm text-slate-500 mb-4">Phase 1 BYOK Configuration</p>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={handleSaveKey} 
            placeholder="AIzaSy..."
            className="w-full max-w-md border border-slate-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" 
          />
          <p className="text-xs text-slate-400 mt-2">Stored locally in your browser. Never share this key.</p>
        </div>
      </div>

      {/* Curriculum Mapping Panel */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Curriculum Mapping</h3>
        <p className="text-sm text-slate-500 mb-6">Map specific skills to subjects to track in the Tactical Matrix.</p>
        
        <form onSubmit={handleAddSkill} className="flex space-x-4 mb-8">
          <select 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)}
            className="border border-slate-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            {SUBJECTS.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
          
          <input 
            type="text" 
            value={newSkillName} 
            onChange={e => setNewSkillName(e.target.value)} 
            placeholder="e.g. Fronted Adverbials"
            className="flex-1 border border-slate-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" 
            required 
          />
          
          <button 
            type="submit" 
            className="px-4 py-2 bg-slate-800 text-white rounded-md font-medium text-sm hover:bg-slate-700 transition-colors"
          >
            Add Skill
          </button>
        </form>

        {/* Existing Skills List */}
        <div className="space-y-6">
          {SUBJECTS.map(subject => {
            const skills = curriculum.filter(s => s.subject === subject).sort((a, b) => a.display_order - b.display_order);
            if (skills.length === 0) return null;
            
            return (
              <div key={subject}>
                <h4 className="font-semibold text-slate-700 border-b pb-2 mb-3">{subject}</h4>
                <ul className="space-y-2">
                  {skills.map(skill => (
                    <li key={skill.id} className="flex items-center text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded border border-slate-100">
                      <span className="w-6 h-6 flex items-center justify-center bg-slate-200 rounded text-xs font-bold mr-3">{skill.display_order}</span>
                      {skill.skill_name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
