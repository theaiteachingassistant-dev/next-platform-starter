'use client';

import { useState, useRef } from 'react';
import { READING_LEVELS } from '../utils/constants';

const ANSWER_KEY_DELIMITER = "|||START_OF_ANSWERS|||";

export default function ResourceEngineTab({ pupils, addPupil, apiKey, curriculum, progress }) {
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [gender, setGender] = useState("Male");
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  const [interestOne, setInterestOne] = useState("");
  const [interestTwo, setInterestTwo] = useState("");
  const [interestThree, setInterestThree] = useState("");
  const [readingLevel, setReadingLevel] = useState("Year 3 Expected");
  const [isPupilSubmitting, setIsPupilSubmitting] = useState(false);

  const [wsSelectedPupils, setWsSelectedPupils] = useState([]);
  const [wsSubject, setWsSubject] = useState("Weekly Pack");
  const [isGeneratingWs, setIsGeneratingWs] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [generatedSheets, setGeneratedSheets] = useState([]);
  const [wsTotalTasks, setWsTotalTasks] = useState(0);
  const [wsCompletedTasks, setWsCompletedTasks] = useState(0);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const abortControllerRef = useRef(null);

  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) return;
    setIsPupilSubmitting(true);
    const combinedInterests = [interestOne, interestTwo, interestThree].filter(Boolean).join(", ");
    await addPupil({
      first_name: firstName, last_initial: lastInitial.toUpperCase(), gender, is_send: isSend, is_eal: isEal, is_pp: isPp, interests: combinedInterests, reading_level: readingLevel
    });
    setFirstName(""); setLastInitial(""); setGender("Male"); setIsSend(false); setIsEal(false); setIsPp(false);
    setInterestOne(""); setInterestTwo(""); setInterestThree(""); setReadingLevel("Year 3 Expected");
    setIsPupilSubmitting(false);
  };

  const handleSelectAllPupils = () => wsSelectedPupils.length === pupils.length ? setWsSelectedPupils([]) : setWsSelectedPupils(pupils.map(p => p.id));
  const handleSelectPupil = (id) => wsSelectedPupils.includes(id) ? setWsSelectedPupils(wsSelectedPupils.filter(pid => pid !== id)) : setWsSelectedPupils([...wsSelectedPupils, id]);

  const cleanWorksheetMarkup = (rawHtml) => {
    if (!rawHtml) return "";
    let clean = rawHtml.replace(/```html/gi, "").replace(/```/g, "");
    clean = clean.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
    clean = clean.replace(/\[FULL_LINE\]/gi, '<p class="write-line"></p>').replace(/\[ANSWER_LINE\]/gi, '<span class="short-line"></span>');
    return clean;
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const combinedSignal = options.signal ? (options.signal.aborted ? options.signal : controller.signal) : controller.signal;
    try { const response = await fetch(url, { ...options, signal: combinedSignal }); clearTimeout(id); return response; } 
    catch (error) { clearTimeout(id); if (error.name === 'AbortError') throw new Error(`Server Timeout (${timeoutMs/1000}s)`); throw error; }
  };

  const getTargetForSubject = (pupilId, subj) => {
    if (!curriculum) return { skill_name: "General Practice" };
    const subjSkills = curriculum.filter(s => s.subject === subj).sort((a,b) => a.display_order - b.display_order);
    if (subjSkills.length === 0) return { skill_name: "General Practice" };
    let foundSkill = subjSkills.find(s => progress?.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status === 'Practising');
    if (!foundSkill) foundSkill = subjSkills.find(s => { const stat = progress?.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status; return stat === 'Not Yet' || !stat; });
    return foundSkill || subjSkills[0];
  };

  const handleGenerateWorksheet = async () => {
    if (wsSelectedPupils.length === 0) { setWsMessage("Select at least one pupil."); return; }
    if (!apiKey) { setWsMessage("Missing API Key in BYOK settings."); return; }
    setIsGeneratingWs(true); setGeneratedSheets([]); setIsDocumentReady(false);
    abortControllerRef.current = new AbortController();
    setWsTotalTasks(wsSelectedPupils.length); setWsCompletedTasks(0);
    let completedCount = 0;

    try {
      for (const pid of wsSelectedPupils) {
        if (abortControllerRef.current.signal.aborted) throw new Error("Halted by user.");
        const targetPupil = pupils.find(p => p.id === pid);
        const pro = targetPupil.gender === "Male" ? "he/him" : (targetPupil.gender === "Female" ? "she/her" : "they/them");
        setWsMessage(`Synthesizing ${targetPupil.first_name}...`);

        let systemPrompt = `You are an expert UK primary school teacher. CRITICAL ANTI-CHEAT RULE: Never bold, underline, italicize, or indicate the correct answers anywhere in the worksheet body. The pupil must identify them independently. CRITICAL FORMATTING: Output pure HTML. Do not wrap output in JSON. Do not use markdown codeblocks. The child is ${targetPupil.gender} (use ${pro} pronouns). Reading ability: "${targetPupil.reading_level}". Adapt all vocabulary to match this reading level. To provide writing space under questions, add: <p class="write-line"></p>. After the worksheet content is completely finished, print the exact text delimiter: ${ANSWER_KEY_DELIMITER} Immediately after the delimiter, write the Answer Key in HTML.`;
        
        if (wsSubject === "Weekly Pack") {
          systemPrompt += ` Create a Weekly Pack: \n<div class="worksheet-section"><h2>1. Reading</h2><p>Focus: ${targetPupil.interests}. Target: ${getTargetForSubject(pid, "Reading").skill_name}. 150-word story and 5 NFER questions.</p></div> <div class="worksheet-section"><h2>2. Maths</h2><p>Target: ${getTargetForSubject(pid, "Maths").skill_name}. 5 arithmetic, 3 word problems about ${targetPupil.interests}.</p></div> <div class="worksheet-section"><h2>3. Writing</h2><p>Target: ${getTargetForSubject(pid, "Writing").skill_name}. Identify, gap-fill, and paragraph writing.</p></div> <div class="worksheet-section"><h2>4. Spelling</h2><p>Target: ${getTargetForSubject(pid, "Spelling").skill_name}. 8 words phonetically broken down.</p></div>`;
        } else {
          systemPrompt += ` Create a ${wsSubject} worksheet for target skill: "${getTargetForSubject(pid, wsSubject).skill_name}". Theme: ${targetPupil.interests}.`;
        }

        try {
          const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7 } }), signal: abortControllerRef.current.signal
          }, 60000); 
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          
          let worksheetBody = rawText, answerKeyBody = "Answer key not generated.";
          if (rawText.includes(ANSWER_KEY_DELIMITER)) {
            const splitParts = rawText.split(ANSWER_KEY_DELIMITER);
            worksheetBody = splitParts[0]; answerKeyBody = splitParts[1];
          }
          setGeneratedSheets(prev => [...prev, { pupilName: targetPupil.first_name, subject: wsSubject, worksheet: cleanWorksheetMarkup(worksheetBody), answers: cleanWorksheetMarkup(answerKeyBody) }]);
        } catch (fetchErr) {
          if (fetchErr.message.includes('AbortError')) throw fetchErr;
          setGeneratedSheets(prev => [...prev, { pupilName: targetPupil.first_name, subject: wsSubject, worksheet: `<div class="worksheet-section"><h3>Server Error</h3><p>${fetchErr.message}</p></div>`, answers: "<p>Unavailable</p>" }]);
        }
        completedCount++; setWsCompletedTasks(completedCount);
        if (completedCount < wsSelectedPupils.length) { setWsMessage(`Pacing requests...`); await delay(3000); }
      }
      setIsDocumentReady(true); setWsMessage("Generation Complete.");
    } catch (error) { setWsMessage(error.message === 'Halted by user.' ? "Generation halted." : `Error: ${error.message}`); } 
    finally { setIsGeneratingWs(false); abortControllerRef.current = null; }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      <div className="lg:col-span-1 bg-slate-50 border border-slate-200 p-6 rounded-lg shadow-sm">
        <h2 className="text-slate-800 font-bold text-xl mb-5">Pupil Onboarding</h2>
        <form onSubmit={handleAddPupil} className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={isPupilSubmitting} className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm" placeholder="First Name" required />
            <input type="text" value={lastInitial} onChange={e => setLastInitial(e.target.value.substring(0, 1))} disabled={isPupilSubmitting} className="w-16 p-2.5 border border-slate-300 rounded-lg text-sm text-center" placeholder="Init" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"><option>Male</option><option>Female</option></select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Reading Level</label>
            <div className="grid grid-cols-3 gap-1.5">
              {READING_LEVELS.map(level => (
                <button type="button" key={level} onClick={() => setReadingLevel(level)} className={`p-1.5 text-[10px] rounded border transition-colors ${readingLevel === level ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-slate-300 bg-white text-slate-600"}`}>{level}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Interests</label>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={interestOne} onChange={e => setInterestOne(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-xs" placeholder="Topic 1" />
              <input type="text" value={interestTwo} onChange={e => setInterestTwo(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-xs" placeholder="Topic 2" />
              <input type="text" value={interestThree} onChange={e => setInterestThree(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-xs" placeholder="Topic 3" />
            </div>
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isSend} onChange={e => setIsSend(e.target.checked)} className="rounded" /> SEND</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isEal} onChange={e => setIsEal(e.target.checked)} className="rounded" /> EAL</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isPp} onChange={e => setIsPp(e.target.checked)} className="rounded" /> PP</label>
          </div>
          <button type="submit" disabled={isPupilSubmitting} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors mt-4">Add Pupil</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-fuchsia-50 border-2 border-fuchsia-200 p-6 rounded-lg shadow-sm h-fit">
        <h2 className="text-fuchsia-800 font-bold text-xl mb-4 flex items-center gap-2">📄 Batch Worksheet Engine</h2>
        
        {(isGeneratingWs || wsCompletedTasks > 0) && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-fuchsia-800 font-bold mb-2"><span>{wsMessage}</span><span>{wsCompletedTasks} / {wsTotalTasks}</span></div>
            <progress value={wsCompletedTasks} max={wsTotalTasks || 1} className="w-full h-2.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-fuchsia-200 [&::-webkit-progress-value]:bg-fuchsia-600" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-5 h-[300px]">
          <div className="flex-1 border border-fuchsia-300 rounded-lg bg-white flex flex-col overflow-hidden">
            <div className="p-3 bg-fuchsia-50 border-b border-fuchsia-100 flex justify-between items-center">
              <span className="text-sm font-bold text-fuchsia-800">Select Pupils ({wsSelectedPupils.length})</span>
              <button onClick={handleSelectAllPupils} disabled={isGeneratingWs} className="text-xs font-bold text-fuchsia-600 hover:text-fuchsia-800">All</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {pupils.map(p => (
                <label key={p.id} className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={wsSelectedPupils.includes(p.id)} onChange={() => handleSelectPupil(p.id)} disabled={isGeneratingWs} className="rounded text-fuchsia-600 focus:ring-fuchsia-500" />
                  {p.first_name} {p.last_initial}.
                </label>
              ))}
            </div>
          </div>
          <select value={wsSubject} onChange={e => setWsSubject(e.target.value)} disabled={isGeneratingWs} className="sm:w-64 p-3 border border-fuchsia-300 rounded-lg bg-white h-fit outline-none focus:ring-2 focus:ring-fuchsia-500 text-slate-700">
            <option value="Weekly Pack">Weekly Pack (4 Subjects)</option><option value="Maths">Maths Only</option><option value="Writing">Writing Only</option><option value="Reading">Reading Only</option><option value="Spelling">Spelling Only</option><option value="Timestables">Timestables Only</option>
          </select>
        </div>

        {isGeneratingWs ? (
          <button onClick={() => abortControllerRef.current?.abort()} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors">Halt Generation</button>
        ) : (
          <button onClick={handleGenerateWorksheet} disabled={wsSelectedPupils.length === 0} className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Generate Resources</button>
        )}

        {isDocumentReady && !isGeneratingWs && generatedSheets.length > 0 && (
          <button onClick={() => window.scrollTo(0, document.body.scrollHeight)} className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2"><span>✔</span> View Document Ready to Print</button>
        )}
      </div>

      {generatedSheets.length > 0 && isDocumentReady && (
        <div className="lg:col-span-3">
          <div id="printable-document" className="max-w-[800px] mx-auto p-10 bg-white shadow-xl rounded-lg border border-slate-200 my-10">
            <div className="no-print text-right mb-6">
              <button onClick={() => window.print()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">🖨️ Print Document</button>
            </div>
            {generatedSheets.map((sheet, idx) => (
              <div key={`ws-${idx}`} className={idx > 0 ? "pack-boundary" : ""}>
                <div className="worksheet-pack mb-10">
                  <div className="text-xl font-bold border-b-2 border-slate-800 pb-2 mb-6">{sheet.pupilName} | {sheet.subject}</div>
                  <div dangerouslySetInnerHTML={{ __html: sheet.worksheet }} className="leading-relaxed text-[15px] text-slate-800" />
                </div>
              </div>
            ))}
            {generatedSheets.map((sheet, idx) => (
              <div key={`ans-${idx}`} className="answer-page">
                {idx === 0 && <h1 className="text-center text-2xl font-black border-b-4 border-slate-800 pb-3 mb-8 uppercase tracking-widest">Answer Keys</h1>}
                <div className="text-lg font-bold border-b border-slate-400 pb-2 mb-4">{sheet.pupilName} | Answer Key ({sheet.subject})</div>
                <div dangerouslySetInnerHTML={{ __html: sheet.answers }} className="text-sm text-slate-700 bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 leading-relaxed" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
