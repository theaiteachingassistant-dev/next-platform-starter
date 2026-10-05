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

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth(); 
  
  // Database State
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]); 
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");
  
  // UI State
  const [expandedPupil, setExpandedPupil] = useState(null);

  // Pupil Form State
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

  // Edit Pupil & Skill Modal State
  const [editingPupil, setEditingPupil] = useState(null);
  const [isUpdatingPupil, setIsUpdatingPupil] = useState(false);
  const [newSubject, setNewSubject] = useState("Maths");
  const [newSkillName, setNewSkillName] = useState("");
  const [newDisplayOrder, setNewDisplayOrder] = useState(1);
  const [isSkillSubmitting, setIsSkillSubmitting] = useState(false);
  const [skillMessage, setSkillMessage] = useState("");
  const [editingSkill, setEditingSkill] = useState(null);
  const [isUpdatingSkill, setIsUpdatingSkill] = useState(false);

  // BYOK State
  const [geminiKey, setGeminiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Voice Routing Note-Taker State
  const [noteText, setNoteText] = useState("");
  const [isProcessingNote, setIsProcessingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceRoute, setPendingVoiceRoute] = useState(null); 

  // Worksheet Engine State
  const [wsSelectedPupils, setWsSelectedPupils] = useState([]); 
  const [wsSubject, setWsSubject] = useState("Weekly Pack");
  const [isGeneratingWs, setIsGeneratingWs] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [generatedSheets, setGeneratedSheets] = useState([]); 
  const [wsTotalTasks, setWsTotalTasks] = useState(0);
  const [wsCompletedTasks, setWsCompletedTasks] = useState(0);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const abortControllerRef = useRef(null);

  const fetchDashboardData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { data: pupilsData } = await supabase.from("pupils").select("*").order("created_at", { ascending: false });
      setPupils(pupilsData || []);

      const { data: skillsData } = await supabase.from("curriculum_skills").select("*").order("subject", { ascending: true }).order("display_order", { ascending: true });
      setSkills(skillsData || []);

      const { data: progressData } = await supabase.from("pupil_progress").select("*");
      setProgress(progressData || []);
      
      setDbStatus(`✅ Secure Connection. ${pupilsData?.length || 0} Pupils | ${skillsData?.length || 0} Skills`);
    } catch (error) { setDbStatus("❌ Database Connection Failed."); }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchDashboardData();
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setIsKeySaved(true);
  }, [fetchDashboardData]);

  const handleSelectAllPupils = () => {
    if (wsSelectedPupils.length === pupils.length) setWsSelectedPupils([]);
    else setWsSelectedPupils(pupils.map(p => p.id));
  };
  const handleSelectPupil = (id) => {
    if (wsSelectedPupils.includes(id)) setWsSelectedPupils(wsSelectedPupils.filter(pid => pid !== id));
    else setWsSelectedPupils([...wsSelectedPupils, id]);
  };

  const toggleSkillStatus = async (pupilId, skillId, currentStatus) => {
    const cycle = { 'Not Yet': 'Practising', 'Practising': 'Achieved', 'Achieved': 'Not Yet' };
    const nextStatus = cycle[currentStatus || 'Not Yet'] || 'Achieved';
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupil_progress").upsert({ user_id: userId, pupil_id: pupilId, skill_id: skillId, status: nextStatus }, { onConflict: 'pupil_id,skill_id' });
      fetchDashboardData(); 
    } catch (error) { console.error(error); }
  };

  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) return;
    setIsPupilSubmitting(true);
    try {
      const combinedInterests = [interestOne, interestTwo, interestThree].filter(Boolean).join(", ");
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupils").insert({ 
        user_id: userId, first_name: firstName, last_initial: lastInitial.toUpperCase(), 
        gender: gender, is_send: isSend, is_eal: isEal, is_pp: isPp, 
        interests: combinedInterests, reading_level: readingLevel
      });
      setPupilMessage("✅ Pupil added.");
      setFirstName(""); setLastInitial(""); setGender("Male"); setIsSend(false); setIsEal(false); setIsPp(false); 
      setInterestOne(""); setInterestTwo(""); setInterestThree(""); setReadingLevel("Year 3 Expected");
      fetchDashboardData();
      setTimeout(() => setPupilMessage(""), 3000);
    } catch (error) { setPupilMessage(`❌ Error: ${error.message}`); } finally { setIsPupilSubmitting(false); }
  };

  const handleUpdatePupil = async (e) => {
    e.preventDefault();
    setIsUpdatingPupil(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupils").update({
        first_name: editingPupil.first_name, last_initial: editingPupil.last_initial.toUpperCase(),
        gender: editingPupil.gender, is_send: editingPupil.is_send, is_eal: editingPupil.is_eal, is_pp: editingPupil.is_pp,
        interests: editingPupil.interests, reading_level: editingPupil.reading_level
      }).eq('id', editingPupil.id);
      fetchDashboardData();
      setEditingPupil(null);
    } catch (error) { console.error(error); } finally { setIsUpdatingPupil(false); }
  };

  const handleDeletePupil = async (id) => {
    if (!window.confirm("Delete this pupil permanently?")) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupils").delete().eq('id', id);
      fetchDashboardData();
    } catch (error) {}
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName) return;
    setIsSkillSubmitting(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("curriculum_skills").insert({ user_id: userId, subject: newSubject, skill_name: newSkillName, display_order: parseInt(newDisplayOrder) });
      setSkillMessage("✅ Skill mapped.");
      setNewSkillName(""); setNewDisplayOrder((prev) => parseInt(prev) + 1); 
      fetchDashboardData();
      setTimeout(() => setSkillMessage(""), 3000);
    } catch (error) { setSkillMessage(`❌ Error: ${error.message}`); } finally { setIsSkillSubmitting(false); }
  };

  const handleUpdateSkill = async (e) => {
    e.preventDefault();
    setIsUpdatingSkill(true);
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("curriculum_skills").update({ subject: editingSkill.subject, skill_name: editingSkill.skill_name, display_order: parseInt(editingSkill.display_order) }).eq('id', editingSkill.id);
      fetchDashboardData(); setEditingSkill(null);
    } catch (error) {} finally { setIsUpdatingSkill(false); }
  };

  const handleDeleteSkill = async (id) => {
    if (!window.confirm("Delete this skill?")) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("curriculum_skills").delete().eq('id', id);
      fetchDashboardData();
    } catch (error) {}
  };

  const handleSaveKey = (e) => { e.preventDefault(); if (!geminiKey.trim()) return; localStorage.setItem("gemini_api_key", geminiKey.trim()); setIsKeySaved(true); setGeminiKey(""); };
  const handleClearKey = () => { localStorage.removeItem("gemini_api_key"); setIsKeySaved(false); };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNoteMessage("❌ Voice not supported."); return; }
    if (isRecording) { setIsRecording(false); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); };
    recognition.onresult = (event) => { setNoteText((prev) => prev + (prev ? " " : "") + event.results[0][0].transcript); setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
    recognition.start();
  };

  const executeDatabaseRoute = async (payload) => {
    setNoteMessage("🔐 Routing to database...");
    const token = await getToken({ template: "supabase" });
    const supabase = createClerkSupabaseClient(token);
    await supabase.from("pupil_progress").upsert({ user_id: userId, pupil_id: payload.pupil_id, skill_id: payload.skill_id, status: payload.status }, { onConflict: 'pupil_id,skill_id' });
    setNoteText(""); fetchDashboardData(); setPendingVoiceRoute(null);
    setNoteMessage(`✅ Updated: ${payload.matched_pupil} - ${payload.matched_skill} (${payload.status})`);
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
      
      if (aiResult.confidence === "low") {
        setPendingVoiceRoute(aiResult); setNoteMessage("");
      } else {
        await executeDatabaseRoute(aiResult);
      }
    } catch (error) { setNoteMessage("❌ Routing Failed."); } finally { setIsProcessingNote(false); }
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  // Custom fetch with absolute 60s timeout for massive single payloads
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const combinedSignal = options.signal ? 
      (options.signal.aborted ? options.signal : controller.signal) : controller.signal;
    
    try {
      const response = await fetch(url, { ...options, signal: combinedSignal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === 'AbortError') throw new Error(`Server Timeout (${timeoutMs/1000}s)`);
      throw error;
    }
  };

  const getTargetForSubject = (pupilId, subj) => {
    const subjSkills = skills.filter(s => s.subject === subj).sort((a,b) => a.display_order - b.display_order);
    if (subjSkills.length === 0) return { skill_name: "General Age-Appropriate Practice" };
    let foundSkill = subjSkills.find(s => progress.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status === 'Practising');
    if (!foundSkill) foundSkill = subjSkills.find(s => { const stat = progress.find(p => p.skill_id === s.id && p.pupil_id === pupilId)?.status; return stat === 'Not Yet' || !stat; });
    return foundSkill || subjSkills[0] || { skill_name: "General Age-Appropriate Practice" };
  };

  // ==========================================
  // WORKSHEET ENGINE (SINGLE MEGA-PROMPT PER PUPIL)
  // ==========================================
  const handleGenerateWorksheet = async () => {
    if (wsSelectedPupils.length === 0) { setWsMessage("❌ Select at least one pupil."); return; }
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { setWsMessage("❌ Missing API Key in BYOK settings."); return; }

    const ledger = JSON.parse(localStorage.getItem("worksheet_ledger") || "{}");
    const todayStr = new Date().toISOString().split('T')[0];
    const pupilsToProcess = [];

    for (const pid of wsSelectedPupils) {
      const pName = pupils.find(p => p.id === pid)?.first_name;
      if (ledger[`${pid}_${wsSubject}_${todayStr}`]) {
        if (window.confirm(`⚠️ You already generated a ${wsSubject} sheet for ${pName} today. Force Regenerate?`)) {
          pupilsToProcess.push(pid);
        }
      } else {
        pupilsToProcess.push(pid);
      }
    }

    if (pupilsToProcess.length === 0) return;

    setIsGeneratingWs(true); 
    setGeneratedSheets([]); 
    setIsDocumentReady(false);
    abortControllerRef.current = new AbortController();

    const totalCalls = pupilsToProcess.length;
    setWsTotalTasks(totalCalls);
    setWsCompletedTasks(0);
    let completedCount = 0;

    try {
      for (const pid of pupilsToProcess) {
        if (abortControllerRef.current.signal.aborted) throw new Error("Halted by user.");
        
        const targetPupil = pupils.find(p => p.id === pid);
        const interests = targetPupil.interests || "general fun topics";
        const readLevel = targetPupil.reading_level || "Year 3 Expected";
        const pGender = targetPupil.gender || "Unspecified";
        const pro = pGender === "Male" ? "he/him" : (pGender === "Female" ? "she/her" : "they/them");

        setWsMessage(`⚙️ Synthesizing ${targetPupil.first_name}...`);

        let systemPrompt = `You are an expert UK primary school teacher. 
        CRITICAL: The child is a ${pGender} (use ${pro} pronouns). Reading ability: "${readLevel}". Adapt all text to this level.
        Output ONLY raw JSON: { "worksheet": "<html> string", "answers": "<html> string" }. Format HTML nicely using <h2>, <p>, <strong>, and lists. Instead of adding blank <br> tags or underscores for writing lines, use the class <p class="write-line">...</p> to designate lines for the student to write their answer. `;

        if (wsSubject === "Weekly Pack") {
          const r = getTargetForSubject(pid, "Reading");
          const m = getTargetForSubject(pid, "Maths");
          const w = getTargetForSubject(pid, "Writing");
          const s = getTargetForSubject(pid, "Spelling");

          systemPrompt += `Create a complete Weekly Pack separated by <h2> headers in EXACTLY this order:
          1. Reading: 150-word story about ${interests}. 5 NFER-style comprehension questions on "${r.skill_name}".
          2. Maths: Target "${m.skill_name}". 5 arithmetic, 3 word problems about ${interests}, 1 challenge.
          3. Writing: Target "${w.skill_name}". 1) Identify in sentence, 2) Gap-fill, 3) Write paragraph about ${interests}.
          4. Spelling: Target "${s.skill_name}". 8 words broken down phonetically, 3 blank lines next to each.`;
        } else {
          const tg = getTargetForSubject(pid, wsSubject);
          if (wsSubject === "Reading") systemPrompt += `Reading worksheet. 150-word text about ${interests}. 5 NFER comprehension questions on: "${tg.skill_name}".`;
          else if (wsSubject === "Maths") systemPrompt += `Maths worksheet for: "${tg.skill_name}". 5 arithmetic, 3 word problems about ${interests}, 1 challenge.`;
          else if (wsSubject === "Writing") systemPrompt += `Writing worksheet for: "${tg.skill_name}". 1) Identify, 2) Apply gap-fill, 3) Paragraph about ${interests}.`;
          else if (wsSubject === "Spelling") systemPrompt += `Spelling worksheet for: "${tg.skill_name}". 8 words broken down phonetically, 3 blank lines next to each.`;
          else if (wsSubject === "Timestables") systemPrompt += `Timestables sheet focusing on: "${tg.skill_name}". 20 randomized questions.`;
        }

        try {
          const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.7 } }),
            signal: abortControllerRef.current.signal
          }, 60000); 
          
          const data = await response.json();
          const rawText = data.candidates[0].content.parts[0].text.trim();
          const cleanJson = rawText.replace(/```json/g, "").replace(/```html/g, "").replace(/```/g, "");
          const parsed = JSON.parse(cleanJson);
          
          setGeneratedSheets(prev => [...prev, { 
            pupilName: targetPupil.first_name, 
            subject: wsSubject, 
            worksheet: parsed.worksheet, 
            answers: parsed.answers 
          }]);

        } catch (fetchErr) {
          if (fetchErr.message.includes('AbortError')) throw fetchErr;
          setGeneratedSheets(prev => [...prev, { 
            pupilName: targetPupil.first_name, 
            subject: wsSubject, 
            worksheet: `<h3>⚠ Server Timeout or Error</h3><p>${fetchErr.message}</p>`, 
            answers: "N/A" 
          }]);
        }

        completedCount++;
        setWsCompletedTasks(completedCount);
        ledger[`${pid}_${wsSubject}_${todayStr}`] = true;

        if (completedCount < totalCalls) {
          setWsMessage(`⏳ Pacing API (3s) to prevent crash...`);
          await delay(3000); // REVERTED TO 3 SECONDS
        }
      }
      
      localStorage.setItem("worksheet_ledger", JSON.stringify(ledger));
      setIsDocumentReady(true);
      setWsMessage("✅ Generation Complete.");

    } catch (error) { 
      if (error.name === 'AbortError' || error.message === 'Halted by user.') setWsMessage("⏹️ Generation halted.");
      else setWsMessage(`❌ ${error.message}`); 
    } finally { 
      setIsGeneratingWs(false); abortControllerRef.current = null;
    }
  };

  const handleRevealDocument = () => document.getElementById("printable-document")?.scrollIntoView({ behavior: 'smooth' });

  if (!isLoaded) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #printable-document, #printable-document * { visibility: visible; }
          #printable-document { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; margin-top: 40px; }
          .worksheet-header { font-size: 24px; font-weight: bold; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px; }
          body { background: white; }
          .write-line { border-bottom: 1px solid black; margin-top: 15px; margin-bottom: 15px; padding-bottom: 15px; width: 100%; }
        }
        .write-line { border-bottom: 1px solid black; margin-top: 15px; margin-bottom: 15px; padding-bottom: 15px; width: 100%; }
      `}} />

      <div className="no-print" style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", paddingBottom: "100px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "30px" }}>
          <div><h1 style={{ margin: 0, color: "#111827" }}>Command Center</h1><p style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>{dbStatus}</p></div>
          <UserButton />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "30px" }}>
          
          <div style={{ background: "#f0f9ff", border: "2px solid #bae6fd", padding: "25px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, color: "#0369a1", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>🎙️</span> Voice Note-Taker</h2>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={isProcessingNote} placeholder="e.g. 'Leo struggled with Addition. Red.'" style={{ width: "100%", height: "80px", padding: "10px", border: "1px solid #7dd3fc", borderRadius: "8px", resize: "none" }} />
            
            {pendingVoiceRoute && (
              <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", padding: "12px", borderRadius: "6px", marginTop: "10px", fontSize: "14px" }}>
                <p style={{ margin: "0 0 10px 0", color: "#92400e", fontWeight: "bold" }}>🤔 Did you mean:</p>
                <div style={{ marginBottom: "10px", color: "#92400e" }}>
                  <strong>Pupil:</strong> {pendingVoiceRoute.matched_pupil} <br/>
                  <strong>Skill:</strong> {pendingVoiceRoute.matched_skill} <br/>
                  <strong>Status:</strong> {pendingVoiceRoute.status}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => executeDatabaseRoute(pendingVoiceRoute)} style={{ flex: 1, padding: "8px", background: "#f59e0b", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Yes, Route It</button>
                  <button onClick={() => setPendingVoiceRoute(null)} style={{ flex: 1, padding: "8px", background: "white", color: "#92400e", border: "1px solid #fbbf24", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {!pendingVoiceRoute && (
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button onClick={toggleRecording} disabled={isProcessingNote} style={{ padding: "10px", background: isRecording ? "#ef4444" : "#e0f2fe", color: isRecording ? "white" : "#0284c7", border: "1px solid #7dd3fc", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isRecording ? "🔴 Stop" : "🎤 Dictate"}</button>
                <button onClick={handleProcessNote} disabled={isProcessingNote || !noteText.trim()} style={{ flex: 1, padding: "10px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isProcessingNote ? "Processing..." : "✨ Route Note"}</button>
              </div>
            )}
            {noteMessage && !pendingVoiceRoute && <p style={{ marginTop: "10px", fontSize: "14px", fontWeight: "600", color: noteMessage.includes("❌") ? "#ef4444" : "#0369a1" }}>{noteMessage}</p>}
          </div>

          <div style={{ background: "#fdf4ff", border: "2px solid #f5d0fe", padding: "25px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>📄</span> Batch Worksheet Engine</h2>
            
            {(isGeneratingWs || wsCompletedTasks > 0) && (
              <div style={{ marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#86198f", fontWeight: "bold", marginBottom: "4px" }}>
                  <span>{wsMessage}</span>
                  <span>{wsCompletedTasks} / {wsTotalTasks}</span>
                </div>
                <progress value={wsCompletedTasks} max={wsTotalTasks} style={{ width: "100%", height: "10px" }} />
              </div>
            )}

            <div style={{ display: "flex", gap: "15px", marginBottom: "15px", height: "130px" }}>
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
              <button onClick={() => abortControllerRef.current?.abort()} style={{ width: "100%", padding: "12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>⏹️ Halt Generation</button>
            ) : (
              <button onClick={handleGenerateWorksheet} disabled={wsSelectedPupils.length === 0} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: wsSelectedPupils.length === 0 ? "not-allowed" : "pointer", opacity: wsSelectedPupils.length === 0 ? 0.5 : 1 }}>✨ Generate Resources</button>
            )}

            {isDocumentReady && !isGeneratingWs && generatedSheets.length > 0 && (
               <button onClick={handleRevealDocument} style={{ width: "100%", padding: "12px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}><span>✅</span> View Document Ready to Print</button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px", marginBottom: "30px" }}>
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

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
            <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>Interactive Cohort Matrix</h2>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "800px", paddingRight: "10px" }}>
              {pupils.map((pupil) => {
                const isExpanded = expandedPupil === pupil.id;
                return (
                  <div key={pupil.id} style={{ border: "1px solid #e5e7eb", marginBottom: "8px", borderRadius: "6px", overflow: "hidden", background: "white" }}>
                    <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                      <div onClick={() => setExpandedPupil(isExpanded ? null : pupil.id)} style={{ fontWeight: "600", fontSize: "15px", cursor: "pointer", flex: 1 }}>{pupil.first_name} {pupil.last_initial}.</div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => setEditingPupil(pupil)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>✏️</button>
                        <button onClick={() => handleDeletePupil(pupil.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>🗑️</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "15px", borderTop: "1px solid #e5e7eb" }}>
                        <div style={{ marginBottom: "15px", fontSize: "13px", display: "grid", gap: "5px" }}>
                          <div><strong>Gender:</strong> {pupil.gender || "Unspecified"}</div>
                          <div><strong>Reading Level:</strong> <span style={{ color: "#4f46e5", fontWeight: "bold" }}>{pupil.reading_level || "Year 3 Expected"}</span></div>
                          {pupil.interests && <div><strong>Interests:</strong> {pupil.interests}</div>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {skills.map((skill) => {
                            const currentStatus = progress.find(pr => pr.pupil_id === pupil.id && pr.skill_id === skill.id)?.status || 'Not Yet';
                            let bg = "#fee2e2"; let col = "#991b1b"; let border = "#f87171"; 
                            if (currentStatus === 'Practising') { bg = "#fef3c7"; col = "#92400e"; border = "#fbbf24"; } 
                            if (currentStatus === 'Achieved') { bg = "#dcfce3"; col = "#166534"; border = "#4ade80"; } 
                            return ( <button key={skill.id} onClick={() => toggleSkillStatus(pupil.id, skill.id, currentStatus)} style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "4px", border: `1px solid ${border}`, background: bg, color: col, cursor: "pointer", fontWeight: "600" }}>{skill.subject.substring(0,1)}: {skill.skill_name}</button> );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px", marginBottom: "30px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ background: "#fdf4ff", padding: "25px", borderRadius: "8px", border: "1px solid #f5d0fe" }}>
              <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px" }}>📚 Curriculum Skills Manager</h2>
              <form onSubmit={handleAddSkill}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px", marginBottom: "20px", marginTop: "15px" }}>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} disabled={isSkillSubmitting} style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }}>
                    <option value="Maths">Maths</option><option value="Writing">Writing</option><option value="Reading">Reading</option><option value="Spelling">Spelling</option><option value="Timestables">Timestables</option>
                  </select>
                  <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} disabled={isSkillSubmitting} placeholder="e.g. 3-digit Addition" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} />
                  <input type="number" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value)} disabled={isSkillSubmitting} placeholder="Order" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} min="1" />
                </div>
                <button type="submit" disabled={isSkillSubmitting} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Map New Skill</button>
              </form>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
              <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>Mapped Skills (Edit/Delete)</h2>
              <div style={{ flex: 1, overflowY: "auto", maxHeight: "250px", border: "1px solid #f3f4f6", borderRadius: "6px", background: "#f9fafb", padding: "10px" }}>
                {skills.map((skill) => (
                  <div key={skill.id} style={{ padding: "10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><span style={{ fontWeight: "bold", color: "#6b7280", marginRight: "10px" }}>#{skill.display_order}</span><span style={{ fontWeight: "600", color: "#4f46e5", marginRight: "10px" }}>{skill.subject}</span><span>{skill.skill_name}</span></div>
                    <div style={{ display: "flex", gap: "10px" }}><button onClick={() => setEditingSkill(skill)} style={{ background: "none", border: "none", cursor: "pointer" }}>✏️</button><button onClick={() => handleDeleteSkill(skill.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑️</button></div>
                  </div>
                ))}
              </div>
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
      </div>

      {generatedSheets.length > 0 && isDocumentReady && (
        <div id="printable-document" style={{ maxWidth: "800px", margin: "40px auto", padding: "40px", background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: "8px" }}>
          <div className="no-print" style={{ textAlign: "right", marginBottom: "20px" }}>
            <button onClick={() => window.print()} style={{ padding: "10px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>🖨️ Print Document</button>
          </div>
          {generatedSheets.map((sheet, idx) => (
            <div key={`ws-${idx}`} className={idx > 0 ? "page-break" : ""}>
              <div className="worksheet-header">{sheet.pupilName} | {sheet.subject}</div>
              <div dangerouslySetInnerHTML={{ __html: sheet.worksheet }} style={{ lineHeight: "1.8", fontSize: "16px" }} />
            </div>
          ))}
          <div className="page-break">
            <h1 style={{ textAlign: "center", borderBottom: "3px solid black", paddingBottom: "10px" }}>Answer Keys</h1>
            {generatedSheets.map((sheet, idx) => (
              <div key={`ans-${idx}`} style={{ marginTop: "30px" }}>
                <h3>{sheet.pupilName} | {sheet.subject}</h3>
                <div dangerouslySetInnerHTML={{ __html: sheet.answers }} style={{ fontSize: "14px", color: "#374151", background: "#f9fafb", padding: "15px", borderRadius: "6px", border: "1px dashed #d1d5db" }} />
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <option value="Maths">Maths</option><option value="Writing">Writing</option><option value="Reading">Reading</option><option value="Spelling">Spelling</option><option value="Timestables">Timestables</option>
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
