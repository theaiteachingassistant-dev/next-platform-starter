'use client';

import { useState } from 'react';
import { SUBJECTS } from '../utils/constants';

export default function MorningBriefingTab({ pupils, curriculum, progress, updateProgress, setActiveTab }) {
  const [currentYear, setCurrentYear] = useState(3);
  const [noteText, setNoteText] = useState("");
  const [isProcessingNote, setIsProcessingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceRoute, setPendingVoiceRoute] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getReadingStatus = (level, targetYear) => {
    if (!level) return "Below";
    const match = level.match(/Year (\d)/);
    if (match) {
      const lvlYear = parseInt(match[1]);
      if (lvlYear > targetYear) return "Above";
      if (lvlYear < targetYear) return "Below";
      if (level.includes("Working Towards")) return "Below";
      if (level.includes("Greater Depth")) return "Above";
      return "At";
    }
    if (level.includes("Phonics") || level.includes("Phase")) return targetYear <= 1 ? "At" : "Below";
    return "Below";
  };

  const readingStats = { above: 0, at: 0, below: 0 };
  pupils.forEach(p => {
    const stat = getReadingStatus(p.reading_level, currentYear);
    if (stat === "Above") readingStats.above++;
    else if (stat === "At") readingStats.at++;
    else readingStats.below++;
  });

  const calculateRAG = (subjectFilter, cohortFilter) => {
    let filteredPupils = pupils;
    if (cohortFilter === "SEND") filteredPupils = pupils.filter(p => p.is_send);
    if (cohortFilter === "PP") filteredPupils = pupils.filter(p => p.is_pp);
    if (cohortFilter === "EAL") filteredPupils = pupils.filter(p => p.is_eal);
    const relevantSkills = curriculum.filter(s => s.subject === subjectFilter);
    let total = 0, achieved = 0, practising = 0, notYet = 0;
    
    filteredPupils.forEach(p => {
      relevantSkills.forEach(s => {
        const pStatus = progress.find(pr => pr.pupil_id === p.id && pr.skill_id === s.id)?.status || 'Not Yet';
        total++;
        if (pStatus === 'Achieved') achieved++;
        else if (pStatus === 'Practising') practising++;
        else notYet++;
      });
    });
    if (total === 0) return { achieved: 0, practising: 0, notYet: 0 };
    return { achieved: Math.round((achieved/total)*100), practising: Math.round((practising/total)*100), notYet: Math.round((notYet/total)*100) };
  };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNoteMessage("Voice dictation is not supported in this browser."); return; }
    if (isRecording) { setIsRecording(false); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => { setNoteText(prev => prev + (prev ? " " : "") + event.results[0][0].transcript); setIsRecording(false); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const executeDatabaseRoute = async (payload) => {
    setNoteMessage("Routing to database...");
    await updateProgress(payload.pupil_id, payload.skill_id, payload.status);
    setNoteText(""); setPendingVoiceRoute(null);
    setNoteMessage(`Updated: ${payload.matched_pupil} - ${payload.matched_skill} (${payload.status})`);
    setTimeout(() => setNoteMessage(""), 4000);
  };

  const handleProcessNote = async () => {
    if (!noteText.trim()) return;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) return;
    setIsProcessingNote(true); setPendingVoiceRoute(null);
    try {
      const mappedPupils = pupils.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_initial}` }));
      const mappedSkills = curriculum.map(s => ({ id: s.id, subject: s.subject, skill: s.skill_name }));
      const prompt = `Read the teacher's note. Map it to ONE pupil and ONE skill. Status Rules: 'Green'/'Mastered' = 'Achieved', 'Orange'/'Amber' = 'Practising', 'Red'/'Not yet' = 'Not Yet'. Default = 'Practising'. Fuzzy Match: Find the closest match. If uncertain, set "confidence" to "low". Respond ONLY with raw JSON: { "pupil_id": "uuid", "skill_id": "uuid", "status": "Achieved/Practising/Not Yet", "confidence": "high/low", "matched_pupil": "Name", "matched_skill": "Skill" } Note: "${noteText}" Pupils: ${JSON.stringify(mappedPupils)} Skills: ${JSON.stringify(mappedSkills)}`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      const aiResult = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim());
      
      if (aiResult.confidence === "low") { setPendingVoiceRoute(aiResult); setNoteMessage(""); } 
      else { await executeDatabaseRoute(aiResult); }
    } catch { setNoteMessage("Routing failed."); } finally { setIsProcessingNote(false); }
  };

  const handleAnalyzeClass = async () => {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { setAiAnalysis("API Key required in Settings to analyze class."); return; }
    setIsAnalyzing(true);
    try {
      const summaryData = SUBJECTS.map(subj => {
        const rag = calculateRAG(subj, "All");
        return `${subj}: ${rag.achieved}% Achieved, ${rag.practising}% Practising, ${rag.notYet}% Not Yet.`;
      }).join("\n");
      const prompt = `Analyze this primary class data against UK National Curriculum Year ${currentYear} expectations. \nData:\n${summaryData}\nProvide a 2-paragraph summary identifying the most pressing subject gap and one recommended teaching strategy. Do not use bold formatting.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      setAiAnalysis(data.candidates[0].content.parts[0].text.trim());
    } catch { setAiAnalysis("Analysis failed."); } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-1 space-y-8">
        
        <div className="bg-sky-50 border-2 border-sky-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-sky-700 font-bold flex items-center gap-2 mb-4 text-xl">🎙️ Voice Route</h2>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={isProcessingNote} placeholder="e.g. 'Leo mastered 3-digit Addition.'" className="w-full h-20 p-3 border border-sky-300 rounded-lg resize-none focus:ring-2 focus:ring-sky-400 outline-none mb-3" />
          {pendingVoiceRoute ? (
            <div className="bg-amber-50 border border-amber-400 p-4 rounded-lg text-sm">
              <p className="text-amber-800 font-bold mb-2">Match Confirmation:</p>
              <div className="text-amber-800 mb-3"><strong>Pupil:</strong> {pendingVoiceRoute.matched_pupil} <br/><strong>Skill:</strong> {pendingVoiceRoute.matched_skill} <br/><strong>Status:</strong> {pendingVoiceRoute.status}</div>
              <div className="flex gap-2">
                <button onClick={() => executeDatabaseRoute(pendingVoiceRoute)} className="flex-1 p-2 bg-amber-500 text-white rounded font-bold">Confirm</button>
                <button onClick={() => setPendingVoiceRoute(null)} className="flex-1 p-2 bg-white text-amber-800 border border-amber-400 rounded font-bold">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={toggleRecording} disabled={isProcessingNote} className={`px-4 py-2 font-bold border rounded-lg transition-colors ${isRecording ? "bg-red-500 text-white border-red-600" : "bg-sky-100 text-sky-700 border-sky-300"}`}>{isRecording ? "Stop" : "Dictate"}</button>
              <button onClick={handleProcessNote} disabled={isProcessingNote || !noteText.trim()} className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50">{isProcessingNote ? "Processing..." : "Route Note"}</button>
            </div>
          )}
          {noteMessage && !pendingVoiceRoute && <p className={`mt-3 text-sm font-bold ${noteMessage.includes("Error") ? "text-red-500" : "text-sky-700"}`}>{noteMessage}</p>}
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-slate-700 font-bold text-xl">📖 Reading Benchmark</h2>
            <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))} className="p-1.5 border border-slate-300 rounded outline-none">
              {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-green-100 border border-green-400 rounded-lg text-green-800 font-bold"><span>Above Expected:</span><span>{readingStats.above} Pupils</span></div>
            <div className="flex justify-between p-3 bg-amber-100 border border-amber-400 rounded-lg text-amber-800 font-bold"><span>At Expected:</span><span>{readingStats.at} Pupils</span></div>
            <div className="flex justify-between p-3 bg-red-100 border border-red-400 rounded-lg text-red-800 font-bold"><span>Working Below:</span><span>{readingStats.below} Pupils</span></div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-slate-700 font-bold text-xl mb-3">🤖 AI Curriculum Analyst</h2>
          <p className="text-sm text-slate-500 mb-4">Cross-reference class progression against UK Year {currentYear} objectives to identify broad teaching gaps.</p>
          <button onClick={handleAnalyzeClass} disabled={isAnalyzing} className="w-full p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-colors mb-4">{isAnalyzing ? "Analyzing..." : "Analyze Class Matrix"}</button>
          {aiAnalysis && <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap">{aiAnalysis}</div>}
        </div>

      </div>

      <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-lg shadow-sm h-fit">
        <h2 className="text-slate-700 font-bold text-xl mb-6">🎯 Demographic Tracking (Achieved %)</h2>
        <div className="space-y-6">
          {SUBJECTS.map(subject => {
            const all = calculateRAG(subject, "All");
            const send = calculateRAG(subject, "SEND");
            const pp = calculateRAG(subject, "PP");
            const eal = calculateRAG(subject, "EAL");
            return (
              <div key={subject} className="border-b border-slate-100 pb-5">
                <h3 className="text-indigo-600 font-bold mb-3">{subject}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setActiveTab("tactical-matrix"); }}>
                    <div className="text-xs text-slate-500 font-bold">Class Avg</div>
                    <div className="text-xl text-green-800 font-bold mt-1">{all.achieved}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setActiveTab("tactical-matrix"); }}>
                    <div className="text-xs text-slate-500 font-bold">SEND</div>
                    <div className={`text-xl font-bold mt-1 ${send.achieved < all.achieved - 10 ? "text-red-600" : "text-green-800"}`}>{send.achieved}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setActiveTab("tactical-matrix"); }}>
                    <div className="text-xs text-slate-500 font-bold">Pupil Premium</div>
                    <div className={`text-xl font-bold mt-1 ${pp.achieved < all.achieved - 10 ? "text-red-600" : "text-green-800"}`}>{pp.achieved}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setActiveTab("tactical-matrix"); }}>
                    <div className="text-xs text-slate-500 font-bold">EAL</div>
                    <div className={`text-xl font-bold mt-1 ${eal.achieved < all.achieved - 10 ? "text-red-600" : "text-green-800"}`}>{eal.achieved}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
