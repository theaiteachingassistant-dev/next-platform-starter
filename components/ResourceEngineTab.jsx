'use client';

import { useState, useRef } from 'react';
import { READING_LEVELS, SUBJECTS, ANSWER_KEY_DELIMITER } from '../utils/constants';

export default function ResourceEngineTab({ pupils, addPupil, apiKey }) {
  // Pupil Onboarding State
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [readingLevel, setReadingLevel] = useState(READING_LEVELS[13]); // Default: Year 3 Expected
  const [gender, setGender] = useState('Male');
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  const [interests, setInterests] = useState('');

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorStatus, setErrorStatus] = useState(null);
  const [generatedPacks, setGeneratedPacks] = useState([]);
  
  // Abort Controller for manual halt
  const abortControllerRef = useRef(null);

  const handleOnboard = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) return;
    
    await addPupil({
      first_name: firstName,
      last_initial: lastInitial,
      reading_level: readingLevel,
      gender,
      is_send: isSend,
      is_eal: isEal,
      is_pp: isPp,
      interests
    });

    setFirstName('');
    setLastInitial('');
    setInterests('');
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setErrorStatus('API Key missing. Please paste it into the Curriculum mapping tab.');
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    setErrorStatus(null);
    setGeneratedPacks([]);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const results = [];

    try {
      for (let i = 0; i < pupils.length; i++) {
        if (signal.aborted) throw new Error('Generation halted by user.');
        
        const pupil = pupils[i];
        const promptText = `Act as an expert UK Key Stage 2 teacher. Generate a Weekly Intervention Pack for ${pupil.first_name} ${pupil.last_initial}. 
        Reading Level: ${pupil.reading_level}. 
        Interests: ${pupil.interests || 'General topic'}. 
        Needs: ${pupil.is_send ? 'SEND requirements' : 'Standard'} / ${pupil.is_eal ? 'EAL requirements' : 'Standard'}.
        Provide 1 Reading Task, 1 Maths Task, and 1 Writing Task formatted in HTML.
        Then output EXACTLY the phrase "${ANSWER_KEY_DELIMITER}" followed by the answers.`;

        // Extended 120-second timeout merged with the Abort Signal
        const fetchPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          }),
          signal
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('120-Second Timeout: Google API is throttling requests.')), 120000)
        );

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // HTTP Error Interceptor
        if (!response.ok) {
          throw new Error(`API Error ${response.status}: Rate Limit Exceeded or Server Rejected.`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Split using the strict delimiter constant
        const [worksheetContent, answerKeyContent] = text.split(ANSWER_KEY_DELIMITER);
        
        results.push({ 
          pupil: pupil.first_name, 
          worksheet: worksheetContent || text, 
          answers: answerKeyContent || 'No answers provided.' 
        });
        
        setProgress(Math.round(((i + 1) / pupils.length) * 100));

        // 5-Second Pacing Delay to protect the 10 RPM limit
        if (i < pupils.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      setGeneratedPacks(results);
    } catch (err) {
      setErrorStatus(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHalt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Onboarding Panel */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Onboard Pupil</h3>
          <form onSubmit={handleOnboard} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md p-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Last Initial</label>
                <input type="text" value={lastInitial} onChange={e => setLastInitial(e.target.value)} maxLength={1} className="mt-1 block w-full border border-slate-300 rounded-md p-2 text-sm" required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md p-2 text-sm">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Reading Level</label>
                <select value={readingLevel} onChange={e => setReadingLevel(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-md p-2 text-sm">
                  {READING_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Interests (For contextual generation)</label>
              <input type="text" value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g. Football, Dinosaurs, Space" className="mt-1 block w-full border border-slate-300 rounded-md p-2 text-sm" />
            </div>

            <div className="flex space-x-4 pt-2">
              <label className="flex items-center text-sm"><input type="checkbox" checked={isSend} onChange={e => setIsSend(e.target.checked)} className="mr-2" /> SEND</label>
              <label className="flex items-center text-sm"><input type="checkbox" checked={isPp} onChange={e => setIsPp(e.target.checked)} className="mr-2" /> PP</label>
              <label className="flex items-center text-sm"><input type="checkbox" checked={isEal} onChange={e => setIsEal(e.target.checked)} className="mr-2" /> EAL</label>
            </div>

            <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-md font-medium text-sm hover:bg-slate-700">
              Add Pupil
            </button>
          </form>
        </div>

        {/* Generator Panel */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Batch Generator</h3>
          <p className="text-sm text-slate-600 mb-6">Generates targeted weekly packs for all {pupils.length} pupils.</p>
          
          <div className="space-y-4">
            <button 
              onClick={isGenerating ? handleHalt : handleGenerate}
              disabled={pupils.length === 0}
              className={`w-full py-3 rounded-md font-bold text-white transition-colors ${
                isGenerating ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300'
              }`}
            >
              {isGenerating ? '🛑 Halt Generation' : '🚀 Generate Class Pack'}
            </button>

            {isGenerating && (
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {errorStatus && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium">
                {errorStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Output */}
      {generatedPacks.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Print Ready Packs</h3>
          <div className="space-y-8">
             {generatedPacks.map((pack, idx) => (
                <div key={idx} className="border-t pt-4">
                  <h4 className="font-bold text-indigo-700 mb-2">{pack.pupil}'s Pack</h4>
                  <div dangerouslySetInnerHTML={{ __html: pack.worksheet }} className="prose text-sm max-w-none"></div>
                  <div className="mt-4 p-4 bg-slate-50 border rounded-md">
                    <h5 className="font-bold text-slate-700 mb-2">Answer Key</h5>
                    <div dangerouslySetInnerHTML={{ __html: pack.answers }} className="prose text-sm max-w-none text-slate-600"></div>
                  </div>
                </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
