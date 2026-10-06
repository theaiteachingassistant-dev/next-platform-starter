"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

const READING_LEVELS = [
  "Phonics Phase 1", "Phonics Phase 2", "Phonics Phase 3",
  "Phonics Phase 4", "Phonics Phase 5", "Phonics Phase 6",
  "Year 1 Working Towards", "Year 1 Expected", "Year 1 Greater Depth",
  "Year 2 Working Towards", "Year 2 Expected", "Year 2 Greater Depth",
  "Year 3 Working Towards", "Year 3 Expected", "Year 3 Greater Depth",
  "Year 4 Working Towards", "Year 4 Expected", "Year 4 Greater Depth",
  "Year 5 Working Towards", "Year 5 Expected", "Year 5 Greater Depth",
  "Year 6 Working Towards", "Year 6 Expected", "Year 6 Greater Depth"
];

const SUBJECTS = ["Maths", "Writing", "Reading", "Spelling", "Timestables"];
const ANSWER_KEY_DELIMITER = "|||START_OF_ANSWERS|||";

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth(); 
  
  // Navigation & View State
  const [activeTab, setActiveTab] = useState("analytics"); 
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");
  
  // Database Data
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]); 

  // Tab 1: Analytics State
  const [currentYear, setCurrentYear] = useState(3);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Tab 2: Matrix State
  const [matrixFilters, setMatrixFilters] = useState({ cohort: "All", subject: "All" });

  // Tab 3: Resource Engine & Onboarding State
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
  const [pupilMessage, setPupilMessage] = useState("");
  const [editingPupil, setEditingPupil] = useState(null);
  const [isUpdatingPupil, setIsUpdatingPupil] = useState(false);

  const [wsSelectedPupils, setWsSelectedPupils] = useState([]); 
  const [wsSubject, setWsSubject] = useState("Weekly Pack");
  const [isGeneratingWs, setIsGeneratingWs] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [generatedSheets, setGeneratedSheets] = useState([]); 
  const [wsTotalTasks, setWsTotalTasks] = useState(0);
  const [wsCompletedTasks, setWsCompletedTasks] = useState(0);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const abortControllerRef = useRef(null);

  // Tab 4: Curriculum & Config State
  const [settingsSubjectFilter, setSettingsSubjectFilter] = useState("Maths");
  const [newSubject, setNewSubject] = useState("Maths");
  const [newSkillName, setNewSkillName] = useState("");
  const [newDisplayOrder, setNewDisplayOrder] = useState(1);
  const [isSkillSubmitting, setIsSkillSubmitting] = useState(false);
  const [skillMessage, setSkillMessage] = useState("");
  const [editingSkill, setEditingSkill] = useState(null);
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Voice Note State
  const [noteText, setNoteText] = useState("");
  const [isProcessingNote, setIsProcessingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceRoute, setPendingVoiceRoute] = useState(null); 

  const fetchDashboardData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { data: pupilsData } = await supabase.from("pupils").select("*").order("first_name", { ascending: true });
      setPupils(pupilsData || []);

      const { data: skillsData } = await supabase.from("curriculum_skills").select("*").order("display_order", { ascending: true });
      setSkills(skillsData || []);

      const { data: progressData } = await supabase.from("pupil_progress").select("*");
      setProgress(progressData || []);
      
      setDbStatus(`Secure Connection Active. ${pupilsData?.length || 0} Pupils | ${skillsData?.length || 0} Skills`);
    } catch { 
      setDbStatus("Database Connection Failed."); 
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchDashboardData();
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setIsKeySaved(true);
  }, [fetchDashboardData]);

  // --- CORE FUNCTIONS (Routing & Generation) ---
  const executeDatabaseRoute = async (payload) => {
    setNoteMessage("Routing to database...");
    const token = await getToken({ template: "supabase" });
    const supabase = createClerkSupabaseClient(token);
    await supabase.from("pupil_progress").upsert({ user_id: userId, pupil_id: payload.pupil_id, skill_id: payload.skill_id, status: payload.status }, { onConflict: 'pupil_id,skill_id' });
    setNoteText(""); fetchDashboardData(); setPendingVoiceRoute(null);
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
      const mappedSkills = skills.map(s => ({ id: s.id, subject: s.subject, skill: s.skill_name }));
      const prompt = `Read the teacher's note. Map it to ONE pupil and ONE skill.
      Status Rules: 'Green'/'Mastered' = 'Achieved', 'Orange'/'Amber' = 'Practising', 'Red'/'Not yet' = 'Not Yet'. Default = 'Practising'.
      Fuzzy Match: Find the closest match. If uncertain, set "confidence" to "low".
      Respond ONLY with raw JSON: { "pupil_id": "uuid", "skill_id": "uuid", "status": "Achieved/Practising/Not Yet", "confidence": "high/low", "matched_pupil": "Name", "matched_skill": "Skill" }
      Note: "${noteText}" Pupils: ${JSON.stringify(mappedPupils)} Skills: ${JSON.stringify(mappedSkills)}`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      const aiResult = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim());
      
      if (aiResult.confidence === "low") { setPendingVoiceRoute(aiResult); setNoteMessage(""); } 
      else { await executeDatabaseRoute(aiResult); }
    } catch { setNoteMessage("Routing failed."); } finally { setIsProcessingNote(false); }
  };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNoteMessage("Voice dictation is not supported in this browser."); return; }
    if (isRecording) { setIsRecording(false); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); };
    recognition.onresult = (event) => { setNoteText((prev) => prev + (prev ? " " : "") + event.results[0][0].transcript); setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
    recognition.start();
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const combinedSignal = options.signal ? (options.signal.aborted ? options.signal : controller.signal) : controller.signal;
    try {
      const response = await fetch(url, { ...options, signal: combinedSignal });
      clearTimeout(id); return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === 'AbortError') throw new Error(`Server Timeout (${timeoutMs/1000}s)`);
      throw error;
    }
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  const cleanWorksheetMarkup = (rawHtml) => {
    if (!rawHtml) return "";
    let clean = rawHtml;
    clean = clean.replace(/```html/gi, "").replace(/```/g, "");
    clean = clean.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
    clean = clean.replace(/\[FULL_LINE\]/gi, '<p class="write-line"></p>').replace(/\[ANSWER_LINE\]/gi, '<span class="short-line"></span>');
    return clean;
  };
  const getTargetForSubject = (pupilId, subj) => {
    const subjSkills = skills.filter(s => s.subject === subj).sort((a,b) => a.display_order - b.display_order);
    if (subjSkills.length === 0) return { skill_name: "General Age-Appropriate Practice" };
    let foundSkill = subjSkills.find(s => progress.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status === 'Practising');
    if (!foundSkill) foundSkill = subjSkills.find(s => { const stat = progress.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status; return stat === 'Not Yet' || !stat; });
    return foundSkill || subjSkills[0] || { skill_name: "General Age-Appropriate Practice" };
  };

  const handleGenerateWorksheet = async () => {
    if (wsSelectedPupils.length === 0) { setWsMessage("Select at least one pupil."); return; }
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { setWsMessage("Missing API Key in settings."); return; }

    const ledger = JSON.parse(localStorage.getItem("worksheet_ledger") || "{}");
    const todayStr = new Date().toISOString().split('T')[0];
    const pupilsToProcess = [];

    for (const pid of wsSelectedPupils) {
      const pName = pupils.find(p => p.id === pid)?.first_name;
      if (ledger[`${pid}_${wsSubject}_${todayStr}`]) {
        if (window.confirm(`You already generated a ${wsSubject} sheet for ${pName} today. Force Regenerate?`)) pupilsToProcess.push(pid);
      } else { pupilsToProcess.push(pid); }
    }
    if (pupilsToProcess.length === 0) return;

    setIsGeneratingWs(true); setGeneratedSheets([]); setIsDocumentReady(false);
    abortControllerRef.current = new AbortController();
    const totalCalls = pupilsToProcess.length;
    setWsTotalTasks(totalCalls); setWsCompletedTasks(0);
    let completedCount = 0;

    try {
      for (const pid of pupilsToProcess) {
        if (abortControllerRef.current.signal.aborted) throw new Error("Halted by user.");
        const targetPupil = pupils.find(p => p.id === pid);
        const interests = targetPupil.interests || "general fun topics";
        const readLevel = targetPupil.reading_level || "Year 3 Expected";
        const pGender = targetPupil.gender || "Unspecified";
        const pro = pGender === "Male" ? "he/him" : (pGender === "Female" ? "she/her" : "they/them");

        setWsMessage(`Synthesizing ${targetPupil.first_name}...`);

        let systemPrompt = `You are an expert UK primary school teacher.
CRITICAL ANTI-CHEAT RULE: Never bold, underline, italicize, or indicate the correct answers anywhere in the worksheet body. The pupil must identify them independently.
CRITICAL FORMATTING: Output pure HTML. Do not wrap output in JSON. Do not use markdown codeblocks. 
The child is ${pGender} (use ${pro} pronouns). Reading ability: "${readLevel}". Adapt all vocabulary to match this reading level.
To provide writing space under questions, add: <p class="write-line"></p>. Keep line counts strictly proportional.

After the worksheet content is completely finished, print the exact text delimiter:
${ANSWER_KEY_DELIMITER}
Immediately after the delimiter, write the comprehensive Answer Key in clear HTML format using <h3>, <p>, and ordered lists.`;

        if (wsSubject === "Weekly Pack") {
          const r = getTargetForSubject(pid, "Reading");
          const m = getTargetForSubject(pid, "Maths");
          const w = getTargetForSubject(pid, "Writing");
          const s = getTargetForSubject(pid, "Spelling");
          systemPrompt += `

Create a complete Weekly Pack in EXACTLY this section order:
<div class="worksheet-section"><h2>1. Reading Comprehension</h2><p>Text Focus: ${interests}. Target skill: ${r.skill_name}. Provide an engaging 150-word story. Follow with 5 NFER-style comprehension questions.</p></div>
<div class="worksheet-section"><h2>2. Mathematics</h2><p>Target skill: ${m.skill_name}. Provide 5 arithmetic calculations followed by 3 word problems contextualized around ${interests}.</p></div>
<div class="worksheet-section"><h2>3. English Writing</h2><p>Target skill: ${w.skill_name}. Structure in 3 parts: Part 1 Identify (find the skill in sample sentences), Part 2 Apply (gap-fill tasks), Part 3 Independent Application (paragraph writing brief themed around ${interests}).</p></div>
<div class="worksheet-section"><h2>4. Spelling</h2><p>Target skill: ${s.skill_name}. Provide 8 words broken down phonetically for pronunciation practice, each with a line for reproduction.</p></div>`;
        } else {
          const tg = getTargetForSubject(pid, wsSubject);
          if (wsSubject === "Reading") systemPrompt += `\nCreate a Reading Comprehension sheet. 150-word text themed around ${interests}. 5 NFER-style comprehension questions focusing on: "${tg.skill_name}".`;
          else if (wsSubject === "Maths") systemPrompt += `\nCreate a Maths worksheet for: "${tg.skill_name}". 5 arithmetic fluency questions, 3 word problems themed around ${interests}.`;
          else if (wsSubject === "Writing") systemPrompt += `\nCreate an English Writing worksheet for: "${tg.skill_name}". 1) Identify in sentences, 2) Apply in gap-fills, 3) Write a paragraph themed around ${interests}.`;
          else if (wsSubject === "Spelling") systemPrompt += `\nCreate a Spelling worksheet for: "${tg.skill_name}". 8 words broken down phonetically with dedicated write lines.`;
          else if (wsSubject === "Timestables") systemPrompt += `\nCreate a Timestables worksheet focusing on: "${tg.skill_name}". 20 randomized fluency questions.`;
        }

        try {
          const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7 } }),
            signal: abortControllerRef.current.signal
          }, 60000); 
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          
          let worksheetBody = rawText; let answerKeyBody = "Answer key not generated.";
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
        ledger[`${pid}_${wsSubject}_${todayStr}`] = true;
        if (completedCount < totalCalls) { setWsMessage(`Pacing requests (3s)...`); await delay(3000); }
      }
      
      localStorage.setItem("worksheet_ledger", JSON.stringify(ledger));
      setIsDocumentReady(true); setWsMessage("Generation Complete.");
    } catch (error) { 
      if (error.name === 'AbortError' || error.message === 'Halted by user.') setWsMessage("Generation halted.");
      else setWsMessage(`Error: ${error.message}`); 
    } finally { setIsGeneratingWs(false); abortControllerRef.current = null; }
  };

  // --- CRUD FUNCTIONS ---
  const toggleSkillStatusMatrix = async (pupilId, skillId, currentStatus) => {
    const cycle = { 'Not Yet': 'Practising', 'Practising': 'Achieved', 'Achieved': 'Not Yet' };
    const nextStatus = cycle[currentStatus || 'Not Yet'] || 'Achieved';
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupil_progress").upsert({ user_id: userId, pupil_id: pupilId, skill_id: skillId, status: nextStatus }, { onConflict: 'pupil_id,skill_id' });
      fetchDashboardData(); 
    } catch (error) { console.error(error); }
  };

  // --- ANALYTICS CALCULATIONS ---
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

    const relevantSkills = skills.filter(s => s.subject === subjectFilter);
    let total = 0; let achieved = 0; let practising = 0; let notYet = 0;

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
    return { 
      achieved: Math.round((achieved / total) * 100), 
      practising: Math.round((practising / total) * 100), 
      notYet: Math.round((notYet / total) * 100) 
    };
  };

  const handleStatClick = (cohort, subject) => {
    setMatrixFilters({ cohort, subject });
    setActiveTab("matrix");
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

  if (!isLoaded) return null;

  // Filter Data for Matrix Tab
  let matrixPupils = pupils;
  if (matrixFilters.cohort === "SEND") matrixPupils = pupils.filter(p => p.is_send);
  if (matrixFilters.cohort === "PP") matrixPupils = pupils.filter(p => p.is_pp);
  if (matrixFilters.cohort === "EAL") matrixPupils = pupils.filter(p => p.is_eal);
  
  let matrixSkills = skills;
  if (matrixFilters.subject !== "All") matrixSkills = skills.filter(s => s.subject === matrixFilters.subject);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #printable-document, #printable-document * { visibility: visible; }
          #printable-document { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; }
          .no-print { display: none !important; }
          .pack-boundary { page-break-before: always; }
          .answer-page { page-break-before: always; }
          .worksheet-section, p, ol, ul { page-break-inside: avoid; }
          .worksheet-header { font-size: 22px; font-weight: bold; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 16px; }
          body { background: white; }
          .write-line { border-bottom: 1px solid #4b5563; margin-top: 12px; margin-bottom: 12px; width: 100%; height: 18px; }
          .short-line { display: inline-block; border-bottom: 1px solid #4b5563; width: 120px; height: 16px; margin: 0 4px; }
        }
        .write-line { border-bottom: 1px solid #9ca3af; margin-top: 12px; margin-bottom: 12px; width: 100%; height: 18px; }
        .short-line { display: inline-block; border-bottom: 1px solid #9ca3af; width: 120px; height: 16px; margin: 0 4px; }
        .worksheet-section { margin-bottom: 24px; }
        .matrix-table-wrapper { width: 100%; overflow: auto; max-height: 700px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .matrix-table { border-collapse: separate; border-spacing: 0; min-width: 100%; font-size: 13px; }
        .matrix-th { position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 2px solid #cbd5e1; padding: 10px; border-right: 1px solid #e2e8f0; white-space: nowrap; }
        .matrix-th-left { position: sticky; left: 0; top: 0; background: #f8fafc; z-index: 20; border-right: 2px solid #cbd5e1; padding: 10px; min-width: 140px; }
        .matrix-td-left { position: sticky; left: 0; background: white; z-index: 5; font-weight: bold; border-right: 2px solid #cbd5e1; padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .matrix-cell { padding: 0; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-align: center; cursor: pointer; min-width: 80px; }
        .matrix-cell div { padding: 12px 8px; transition: filter 0.2s; width: 100%; height: 100%; }
        .matrix-cell div:hover { filter: brightness(0.95); }
        .status-not-yet { background: #fee2e2; color: #991b1b; }
        .status-practising { background: #fef3c7; color: #92400e; }
        .status-achieved { background: #dcfce3; color: #166534; }
      `}} />

      <div className="no-print" style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1400px", margin: "0 auto", paddingBottom: "100px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "20px" }}>
          <div><h1 style={{ margin: 0, color: "#111827" }}>Command Center</h1><p style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>{dbStatus}</p></div>
          <UserButton />
        </div>

        {/* --- 4 TAB NAVIGATION --- */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "2px solid #e5e7eb" }}>
          <button onClick={() => setActiveTab("analytics")} style={{ padding: "10px 20px", cursor: "pointer", background: activeTab === "analytics" ? "#f3f4f6" : "transparent", border: "none", borderBottom: activeTab === "analytics" ? "3px solid #3b82f6" : "3px solid transparent", fontWeight: "bold", color: activeTab === "analytics" ? "#111827" : "#6b7280" }}>📊 Morning Briefing</button>
          <button onClick={() => { setActiveTab("matrix"); setMatrixFilters({cohort: "All", subject: "All"}); }} style={{ padding: "10px 20px", cursor: "pointer", background: activeTab === "matrix" ? "#f3f4f6" : "transparent", border: "none", borderBottom: activeTab === "matrix" ? "3px solid #3b82f6" : "3px solid transparent", fontWeight: "bold", color: activeTab === "matrix" ? "#111827" : "#6b7280" }}>📝 Tactical Matrix</button>
          <button onClick={() => setActiveTab("resources")} style={{ padding: "10px 20px", cursor: "pointer", background: activeTab === "resources" ? "#f3f4f6" : "transparent", border: "none", borderBottom: activeTab === "resources" ? "3px solid #3b82f6" : "3px solid transparent", fontWeight: "bold", color: activeTab === "resources" ? "#111827" : "#6b7280" }}>📄 Resource Engine</button>
          <button onClick={() => setActiveTab("settings")} style={{ padding: "10px 20px", cursor: "pointer", background: activeTab === "settings" ? "#f3f4f6" : "transparent", border: "none", borderBottom: activeTab === "settings" ? "3px solid #3b82f6" : "3px solid transparent", fontWeight: "bold", color: activeTab === "settings" ? "#111827" : "#6b7280" }}>⚙️ Curriculum</button>
        </div>

        {/* =========================================
            TAB 1: MORNING BRIEFING (ANALYTICS)
            ========================================= */}
        {activeTab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px" }}>
            
            {/* Left Column: Voice Note & Reading Benchmarks */}
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <div style={{ background: "#f0f9ff", border: "2px solid #bae6fd", padding: "25px", borderRadius: "8px" }}>
                <h2 style={{ marginTop: 0, color: "#0369a1", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}><span>🎙️</span> Voice Route</h2>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={isProcessingNote} placeholder="e.g. 'Leo mastered 3-digit Addition.'" style={{ width: "100%", height: "80px", padding: "10px", border: "1px solid #7dd3fc", borderRadius: "8px", resize: "none" }} />
                {pendingVoiceRoute && (
                  <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", padding: "12px", borderRadius: "6px", marginTop: "10px", fontSize: "14px" }}>
                    <p style={{ margin: "0 0 10px 0", color: "#92400e", fontWeight: "bold" }}>Match Confirmation:</p>
                    <div style={{ marginBottom: "10px", color: "#92400e" }}><strong>Pupil:</strong> {pendingVoiceRoute.matched_pupil} <br/><strong>Skill:</strong> {pendingVoiceRoute.matched_skill} <br/><strong>Status:</strong> {pendingVoiceRoute.status}</div>
                    <div style={{ display: "flex", gap: "10px" }}><button onClick={() => executeDatabaseRoute(pendingVoiceRoute)} style={{ flex: 1, padding: "8px", background: "#f59e0b", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Confirm Route</button><button onClick={() => setPendingVoiceRoute(null)} style={{ flex: 1, padding: "8px", background: "white", color: "#92400e", border: "1px solid #fbbf24", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Cancel</button></div>
                  </div>
                )}
                {!pendingVoiceRoute && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button onClick={toggleRecording} disabled={isProcessingNote} style={{ padding: "10px", background: isRecording ? "#ef4444" : "#e0f2fe", color: isRecording ? "white" : "#0284c7", border: "1px solid #7dd3fc", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isRecording ? "Stop" : "Dictate"}</button>
                    <button onClick={handleProcessNote} disabled={isProcessingNote || !noteText.trim()} style={{ flex: 1, padding: "10px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isProcessingNote ? "Processing..." : "Route Note"}</button>
                  </div>
                )}
                {noteMessage && !pendingVoiceRoute && <p style={{ marginTop: "10px", fontSize: "14px", fontWeight: "600", color: noteMessage.includes("Error") ? "#ef4444" : "#0369a1" }}>{noteMessage}</p>}
              </div>

              <div style={{ background: "white", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ marginTop: 0, color: "#374151" }}>📖 Reading Benchmark</h2>
                  <select value={currentYear} onChange={(e) => setCurrentYear(Number(e.target.value))} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db" }}>
                    {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#dcfce3", border: "1px solid #4ade80", borderRadius: "6px", color: "#166534", fontWeight: "bold" }}><span>Above Expected:</span><span>{readingStats.above} Pupils</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: "6px", color: "#92400e", fontWeight: "bold" }}><span>At Expected:</span><span>{readingStats.at} Pupils</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#fee2e2", border: "1px solid #f87171", borderRadius: "6px", color: "#991b1b", fontWeight: "bold" }}><span>Working Below:</span><span>{readingStats.below} Pupils</span></div>
                </div>
              </div>

              <div style={{ background: "white", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
                <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>🤖 AI Curriculum Analyst</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "15px" }}>Cross-reference class progression against UK Year {currentYear} objectives to identify broad teaching gaps.</p>
                <button onClick={handleAnalyzeClass} disabled={isAnalyzing} style={{ width: "100%", padding: "10px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginBottom: "15px" }}>{isAnalyzing ? "Analyzing..." : "Analyze Class Matrix"}</button>
                {aiAnalysis && <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", background: "#f9fafb", padding: "15px", borderRadius: "6px", border: "1px solid #e5e7eb", whiteSpace: "pre-wrap" }}>{aiAnalysis}</div>}
              </div>
            </div>

            {/* Right Column: RAG Demographics Board */}
            <div style={{ background: "white", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
              <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "25px" }}>🎯 Demographic Tracking (Achieved %)</h2>
              
              <div style={{ display: "grid", gap: "25px" }}>
                {SUBJECTS.map(subject => {
                  const all = calculateRAG(subject, "All");
                  const send = calculateRAG(subject, "SEND");
                  const pp = calculateRAG(subject, "PP");
                  const eal = calculateRAG(subject, "EAL");

                  return (
                    <div key={subject} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "20px" }}>
                      <h3 style={{ margin: "0 0 10px 0", color: "#4f46e5" }}>{subject}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                        <button onClick={() => handleStatClick("All", subject)} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>Class Avg</div>
                          <div style={{ fontSize: "20px", color: "#166534", fontWeight: "bold", marginTop: "5px" }}>{all.achieved}%</div>
                        </button>
                        <button onClick={() => handleStatClick("SEND", subject)} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>SEND</div>
                          <div style={{ fontSize: "20px", color: send.achieved < all.achieved - 10 ? "#dc2626" : "#166534", fontWeight: "bold", marginTop: "5px" }}>{send.achieved}%</div>
                        </button>
                        <button onClick={() => handleStatClick("PP", subject)} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>Pupil Premium</div>
                          <div style={{ fontSize: "20px", color: pp.achieved < all.achieved - 10 ? "#dc2626" : "#166534", fontWeight: "bold", marginTop: "5px" }}>{pp.achieved}%</div>
                        </button>
                        <button onClick={() => handleStatClick("EAL", subject)} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", textAlign: "center" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>EAL</div>
                          <div style={{ fontSize: "20px", color: eal.achieved < all.achieved - 10 ? "#dc2626" : "#166534", fontWeight: "bold", marginTop: "5px" }}>{eal.achieved}%</div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 2: TACTICAL MATRIX
            ========================================= */}
        {activeTab === "matrix" && (
          <div>
            {(matrixFilters.cohort !== "All" || matrixFilters.subject !== "All") && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "15px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#1e3a8a", fontWeight: "bold" }}>🔍 Viewing Filtered Data: {matrixFilters.cohort} Cohort | {matrixFilters.subject} Skills</span>
                <button onClick={() => { setActiveTab("analytics"); setMatrixFilters({cohort: "All", subject: "All"}); }} style={{ padding: "8px 16px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>⬅ Back to Analytics</button>
              </div>
            )}
            
            <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
              <select value={matrixFilters.cohort} onChange={(e) => setMatrixFilters(prev => ({...prev, cohort: e.target.value}))} style={{ padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", width: "200px" }}>
                <option value="All">All Pupils</option><option value="SEND">SEND Only</option><option value="PP">Pupil Premium Only</option><option value="EAL">EAL Only</option>
              </select>
              <select value={matrixFilters.subject} onChange={(e) => setMatrixFilters(prev => ({...prev, subject: e.target.value}))} style={{ padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", width: "200px" }}>
                <option value="All">All Subjects</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="matrix-table-wrapper">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-th-left">Pupil</th>
                    {matrixSkills.map(skill => (
                      <th key={skill.id} className="matrix-th">
                        <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>{skill.subject}</div>
                        <div>{skill.skill_name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixPupils.map(pupil => (
                    <tr key={pupil.id}>
                      <td className="matrix-td-left" style={{ cursor: "pointer" }} onClick={() => setEditingPupil(pupil)}>
                        {pupil.first_name} {pupil.last_initial}. ✏️
                      </td>
                      {matrixSkills.map(skill => {
                        const status = progress.find(pr => pr.pupil_id === pupil.id && pr.skill_id === skill.id)?.status || 'Not Yet';
                        let cssClass = "status-not-yet";
                        if (status === 'Practising') cssClass = "status-practising";
                        if (status === 'Achieved') cssClass = "status-achieved";
                        return (
                          <td key={`${pupil.id}-${skill.id}`} className="matrix-cell">
                            <div className={cssClass} onClick={() => toggleSkillStatusMatrix(pupil.id, skill.id, status)}>
                              {status === 'Achieved' ? "G" : status === 'Practising' ? "A" : "R"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 3: RESOURCE ENGINE & ONBOARDING
            ========================================= */}
        {activeTab === "resources" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px" }}>
            <div style={{ background: "#f9fafb", padding: "25px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "20px" }}>Pupil Onboarding</h2>
              <form onSubmit={handleAddPupil}>
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPupilSubmitting} style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="First Name" />
                  <input type="text" value={lastInitial} onChange={(e) => setLastInitial(e.target.value.substring(0, 1))} disabled={isPupilSubmitting} style={{ width: "60px", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="Init" />
                </div>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563", display: "block", marginBottom: "8px" }}>Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}>
                    <option value="Male">Male</option><option value="Female">Female</option>
                  </select>
                </div>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563", display: "block", marginBottom: "8px" }}>Reading Level</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {READING_LEVELS.map(level => (
                      <button type="button" key={level} onClick={() => setReadingLevel(level)} style={{ padding: "6px 4px", fontSize: "11px", borderRadius: "4px", cursor: "pointer", border: readingLevel === level ? "2px solid #3b82f6" : "1px solid #d1d5db", background: readingLevel === level ? "#eff6ff" : "white", color: readingLevel === level ? "#1d4ed8" : "#4b5563", fontWeight: readingLevel === level ? "bold" : "normal" }}>{level}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563" }}>Child's Interests</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <input type="text" value={interestOne} onChange={(e) => setInterestOne(e.target.value)} style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 1" />
                    <input type="text" value={interestTwo} onChange={(e) => setInterestTwo(e.target.value)} style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 2" />
                    <input type="text" value={interestThree} onChange={(e) => setInterestThree(e.target.value)} style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 3" />
                  </div>
                </div>
                <div style={{ marginBottom: "25px", display: "flex", gap: "20px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}><input type="checkbox" checked={isSend} onChange={(e) => setIsSend(e.target.checked)} /> SEND</label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}><input type="checkbox" checked={isEal} onChange={(e) => setIsEal(e.target.checked)} /> EAL</label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}><input type="checkbox" checked={isPp} onChange={(e) => setIsPp(e.target.checked)} /> PP</label>
                </div>
                <button type="submit" disabled={isPupilSubmitting} style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Add Pupil</button>
              </form>
            </div>

            <div style={{ background: "#fdf4ff", border: "2px solid #f5d0fe", padding: "25px", borderRadius: "8px", height: "fit-content" }}>
              <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>📄</span> Batch Worksheet Engine</h2>
              
              {(isGeneratingWs || wsCompletedTasks > 0) && (
                <div style={{ marginBottom: "15px", marginTop: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#86198f", fontWeight: "bold", marginBottom: "4px" }}>
                    <span>{wsMessage}</span>
                    <span>{wsCompletedTasks} / {wsTotalTasks}</span>
                  </div>
                  <progress value={wsCompletedTasks} max={wsTotalTasks} style={{ width: "100%", height: "10px" }} />
                </div>
              )}

              <div style={{ display: "flex", gap: "15px", marginBottom: "15px", marginTop: "15px", height: "300px" }}>
                <div style={{ flex: 1, border: "1px solid #f0abfc", borderRadius: "6px", background: "white", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "8px", borderBottom: "1px solid #fdf4ff", background: "#fdf4ff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "#86198f" }}>Select Pupils ({wsSelectedPupils.length})</span>
                    <button onClick={handleSelectAllPupils} disabled={isGeneratingWs} style={{ background: "none", border: "none", fontSize: "12px", color: "#d946ef", cursor: "pointer", fontWeight: "bold" }}>All</button>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {pupils.map(p => (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", marginBottom: "6px", cursor: "pointer" }}>
                        <input type="checkbox" checked={wsSelectedPupils.includes(p.id)} onChange={() => handleSelectPupil(p.id)} disabled={isGeneratingWs} />
                        {p.first_name} {p.last_initial}.
                      </label>
                    ))}
                  </div>
                </div>
                <select value={wsSubject} onChange={(e) => setWsSubject(e.target.value)} disabled={isGeneratingWs} style={{ flex: 1, padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px", height: "fit-content" }}>
                  <option value="Weekly Pack">Weekly Pack (4 Subjects)</option><option value="Maths">Maths Only</option><option value="Writing">Writing Only</option><option value="Reading">Reading Only</option><option value="Spelling">Spelling Only</option><option value="Timestables">Timestables Only</option>
                </select>
              </div>

              {isGeneratingWs ? (
                <button onClick={() => abortControllerRef.current?.abort()} style={{ width: "100%", padding: "12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Halt Generation</button>
              ) : (
                <button onClick={handleGenerateWorksheet} disabled={wsSelectedPupils.length === 0} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: wsSelectedPupils.length === 0 ? "not-allowed" : "pointer", opacity: wsSelectedPupils.length === 0 ? 0.5 : 1 }}>Generate Resources</button>
              )}

              {isDocumentReady && !isGeneratingWs && generatedSheets.length > 0 && (
                 <button onClick={handleRevealDocument} style={{ width: "100%", padding: "12px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}><span>✔</span> View Document Ready to Print</button>
              )}
            </div>
          </div>
        )}

        {/* =========================================
            TAB 4: CURRICULUM CONFIG
            ========================================= */}
        {activeTab === "settings" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              
              <div style={{ background: "white", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <h2 style={{ marginTop: 0, color: "#374151", margin: 0 }}>Mapped Skills (Edit/Delete)</h2>
                  <select value={settingsSubjectFilter} onChange={(e) => setSettingsSubjectFilter(e.target.value)} style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: "400px", border: "1px solid #f3f4f6", borderRadius: "6px", background: "#f9fafb", padding: "10px" }}>
                  {skills.filter(s => s.subject === settingsSubjectFilter).map((skill) => (
                    <div key={skill.id} style={{ padding: "10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><span style={{ fontWeight: "bold", color: "#6b7280", marginRight: "10px" }}>#{skill.display_order}</span><span style={{ fontWeight: "600", color: "#4f46e5", marginRight: "10px" }}>{skill.subject}</span><span>{skill.skill_name}</span></div>
                      <div style={{ display: "flex", gap: "10px" }}><button onClick={() => setEditingSkill(skill)} style={{ background: "none", border: "none", cursor: "pointer" }}>✏️</button><button onClick={() => handleDeleteSkill(skill.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑️</button></div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "#fdf4ff", padding: "25px", borderRadius: "8px", border: "1px solid #f5d0fe" }}>
                <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px" }}>📚 Map New Skill</h2>
                <form onSubmit={handleAddSkill}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px", marginBottom: "20px", marginTop: "15px" }}>
                    <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} disabled={isSkillSubmitting} style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }}>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} disabled={isSkillSubmitting} placeholder="e.g. 3-digit Addition" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} />
                    <input type="number" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value)} disabled={isSkillSubmitting} placeholder="Order" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} min="1" />
                  </div>
                  <button type="submit" disabled={isSkillSubmitting} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Map New Skill</button>
                </form>
              </div>

            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", height: "fit-content" }}>
              <h2 style={{ marginTop: 0, color: "#374151" }}>⚙ AI System Config</h2>
              <form onSubmit={handleSaveKey} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
                <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Paste Gemini API key..." style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
                <button type="submit" style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Save Locally</button>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* --- RENDERED SHEETS (Hidden until print or scrolled to) --- */}
      {generatedSheets.length > 0 && isDocumentReady && (
        <div id="printable-document" style={{ maxWidth: "800px", margin: "40px auto", padding: "40px", background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: "8px" }}>
          <div className="no-print" style={{ textAlign: "right", marginBottom: "20px" }}>
            <button onClick={() => window.print()} style={{ padding: "10px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>🖨️ Print Document</button>
          </div>
          
          {generatedSheets.map((sheet, idx) => (
            <div key={`ws-${idx}`} className={idx > 0 ? "pack-boundary" : ""}>
              <div className="worksheet-pack">
                <div className="worksheet-header">{sheet.pupilName} | {sheet.subject}</div>
                <div dangerouslySetInnerHTML={{ __html: sheet.worksheet }} style={{ lineHeight: "1.7", fontSize: "15px" }} />
              </div>
            </div>
          ))}

          {generatedSheets.map((sheet, idx) => (
            <div key={`ans-${idx}`} className="answer-page">
              {idx === 0 && <h1 style={{ textAlign: "center", borderBottom: "3px solid black", paddingBottom: "10px", marginBottom: "20px" }}>Answer Keys</h1>}
              <div className="worksheet-header">{sheet.pupilName} | Answer Key ({sheet.subject})</div>
              <div dangerouslySetInnerHTML={{ __html: sheet.answers }} style={{ fontSize: "14px", color: "#374151", background: "#f9fafb", padding: "20px", borderRadius: "6px", border: "1px dashed #d1d5db", lineHeight: "1.6" }} />
            </div>
          ))}
        </div>
      )}

      {/* --- EDIT MODALS --- */}
      {editingPupil && (
        <div className="no-print" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 }}>
          <div style={{ background: "white", padding: "30px", borderRadius: "8px", width: "700px", maxWidth: "90%" }}>
            <h2 style={{ marginTop: 0 }}>Edit Pupil</h2>
            <form onSubmit={handleUpdatePupil}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <input type="text" value={editingPupil.first_name} onChange={(e) => setEditingPupil({...editingPupil, first_name: e.target.value})} style={{ flex: 1, padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                <input type="text" value={editingPupil.last_initial} onChange={(e) => setEditingPupil({...editingPupil, last_initial: e.target.value.substring(0,1)})} style={{ width: "60px", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                <select value={editingPupil.gender || "Male"} onChange={(e) => setEditingPupil({...editingPupil, gender: e.target.value})} style={{ width: "100px", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}>
                  <option value="Male">Male</option><option value="Female">Female</option>
                </select>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "8px" }}>Reading Level</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {READING_LEVELS.map(level => (
                    <button type="button" key={level} onClick={() => setEditingPupil({...editingPupil, reading_level: level})} style={{ padding: "6px 4px", fontSize: "11px", borderRadius: "4px", cursor: "pointer", border: editingPupil.reading_level === level ? "2px solid #3b82f6" : "1px solid #d1d5db", background: editingPupil.reading_level === level ? "#eff6ff" : "white", color: editingPupil.reading_level === level ? "#1d4ed8" : "#4b5563", fontWeight: editingPupil.reading_level === level ? "bold" : "normal" }}>{level}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "5px" }}>Interests (Comma separated)</label>
                <input type="text" value={editingPupil.interests || ""} onChange={(e) => setEditingPupil({...editingPupil, interests: e.target.value})} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setEditingPupil(null)} style={{ flex: 1, padding: "10px", background: "#e5e7eb", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isUpdatingPupil} style={{ flex: 1, padding: "10px", background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSkill && (
        <div className="no-print" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 50 }}>
          <div style={{ background: "white", padding: "30px", borderRadius: "8px", width: "400px", maxWidth: "90%" }}>
            <h2 style={{ marginTop: 0 }}>Edit Skill</h2>
            <form onSubmit={handleUpdateSkill}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "13px", marginBottom: "5px" }}>Subject</label>
                <select value={editingSkill.subject} onChange={(e) => setEditingSkill({...editingSkill, subject: e.target.value})} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "13px", marginBottom: "5px" }}>Skill Name</label>
                <input type="text" value={editingSkill.skill_name} onChange={(e) => setEditingSkill({...editingSkill, skill_name: e.target.value})} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
              </div>
              <div style={{ marginBottom: "25px" }}>
                <label style={{ display: "block", fontSize: "13px", marginBottom: "5px" }}>Display Order</label>
                <input type="number" value={editingSkill.display_order} onChange={(e) => setEditingSkill({...editingSkill, display_order: e.target.value})} style={{ width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setEditingSkill(null)} style={{ flex: 1, padding: "10px", background: "#e5e7eb", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isUpdatingSkill} style={{ flex: 1, padding: "10px", background: "#d946ef", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
