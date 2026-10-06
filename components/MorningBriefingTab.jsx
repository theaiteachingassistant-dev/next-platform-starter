'use client';

import { useState } from 'react';

export default function MorningBriefingTab({ pupils, curriculum, progress, setActiveTab }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // 1. Core Analytics Calculations
  const totalPupils = pupils.length || 0;
  const sendCount = pupils.filter(p => p.is_send).length || 0;
  const ppCount = pupils.filter(p => p.is_pp).length || 0;

  // 2. Voice Routing Controller (Native Browser Speech API)
  const handleVoiceCommand = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setTranscript(speechToText);
      // Future integration: Send to Gemini for fuzzy-matching database updates
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // 3. Intervention Handshake 
  const routeToInterventions = (demographic) => {
    // Routes user to Tab 3 for immediate batch generation
    setActiveTab('resource-engine');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Morning Briefing</h2>
        <button 
          onClick={handleVoiceCommand}
          className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {isListening ? 'Listening...' : '🎤 Dictate Update'}
        </button>
      </div>

      {transcript && (
        <div className="p-4 bg-slate-100 rounded-md text-sm text-slate-700 border border-slate-200">
          <strong>Heard:</strong> "{transcript}"
        </div>
      )}

      {/* Analytics Demographic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => routeToInterventions('SEND')}
          className="p-6 border rounded-lg bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow border-l-4 border-l-amber-500"
        >
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">SEND Pupils</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{sendCount}</p>
          <p className="text-xs text-slate-400 mt-1">Click to generate interventions</p>
        </div>

        <div 
          onClick={() => routeToInterventions('PP')}
          className="p-6 border rounded-lg bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow border-l-4 border-l-blue-500"
        >
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pupil Premium</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{ppCount}</p>
          <p className="text-xs text-slate-400 mt-1">Click to generate interventions</p>
        </div>

        <div className="p-6 border rounded-lg bg-white shadow-sm border-l-4 border-l-emerald-500">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Cohort</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{totalPupils}</p>
          <p className="text-xs text-slate-400 mt-1">Active on platform</p>
        </div>
      </div>
    </div>
  );
}
