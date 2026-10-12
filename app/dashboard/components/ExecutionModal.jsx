'use client';
import { useState } from 'react';

export default function ExecutionModal({ isOpen, onClose, onExecute, selectedCount, SUBJECTS }) {
  const [scope, setScope] = useState('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2">🚀 Execution Scope</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 font-medium leading-tight">
            You have selected <strong>{selectedCount} pupils</strong>. Choose which subjects to generate interventions for.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Generation Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
              <option value="all">All 5 Subjects (Weekly Pack)</option>
              {SUBJECTS.map(sub => (
                <option key={sub} value={sub}>Only {sub.replace('-', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={() => onExecute(scope)} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors">
            Generate Now
          </button>
        </div>
      </div>
    </div>
  );
}
