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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} | Server Response: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      setOutput(data.resource);
      
    } catch (error) {
      console.error(error);
      setOutput(`SYSTEM ERROR: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([output], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${topic.replace(/\s+/g, '_')}_Year${yearGroup}_Resource.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
              placeholder="e.g. Fronted Adverbials, The Romans..."
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={isGenerating}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Year Group</label>
            <select 
              value={yearGroup} 
              onChange={(e) => setYearGroup(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={isGenerating}
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

        {/* PROGRESS BAR UI */}
        {isGenerating && (
          <div className="mt-6">
            <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
              <span>Aligning to National Curriculum...</span>
              <span className="animate-pulse">Processing</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div className="bg-indigo-600 h-2.5 rounded-full w-full origin-left animate-[progress_3s_ease-in-out_infinite]"></div>
            </div>
          </div>
        )}
      </div>

      {/* EXPORT ACTION BAR & PRINTABLE AREA */}
      {output && !isGenerating && (
        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <button onClick={() => navigator.clipboard.writeText(output)} className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
              Copy Text
            </button>
            <button onClick={handleDownload} className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100">
              Download .txt
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
              Print Worksheet
            </button>
          </div>

          <div id="printable-worksheet" className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
