'use client';

import { useState } from 'react';

export default function ResourceEngineTab() {
  const [topic, setTopic] = useState('');
  const [yearGroup, setYearGroup] = useState('3');
  const [differentiation, setDifferentiation] = useState('Core');
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setOutput('');

    try {
      const response = await fetch('/api/generate-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, yearGroup, differentiation }),
      });

      if (!response.ok) throw new Error('Generation failed');
      
      const data = await response.json();
      setOutput(data.resource);
    } catch (error) {
      console.error(error);
      setOutput('Error: Could not generate resource. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">⚙️ AI Resource Engine</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Topic or Learning Objective</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Fronted Adverbials, The Romans, Fractions..."
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Year Group</label>
            <select 
              value={yearGroup} 
              onChange={(e) => setYearGroup(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
              <option value="5">Year 5</option>
              <option value="6">Year 6</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !topic}
          className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${isGenerating || !topic ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {isGenerating ? 'Synthesizing KS2 Resource...' : 'Generate Resource'}
        </button>
      </div>

      {output && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">
          {output}
        </div>
      )}
    </div>
  );
}
