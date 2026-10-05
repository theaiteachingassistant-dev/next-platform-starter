"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

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
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  const [interestOne, setInterestOne] = useState("");
  const [interestTwo, setInterestTwo] = useState("");
  const [interestThree, setInterestThree] = useState("");
  
  // NEW: Reading Level State
  const [readingLevel, setReadingLevel] = useState("Year 3 Expected");

  const [isPupilSubmitting, setIsPupilSubmitting] = useState(false);
  const [pupilMessage, setPupilMessage] = useState("");

  // Curriculum Form State
  const [newSubject, setNewSubject] = useState("Maths");
  const [newSkillName, setNewSkillName] = useState("");
  const [newDisplayOrder, setNewDisplayOrder] = useState(1);
  const [isSkillSubmitting, setIsSkillSubmitting] = useState(false);
  const [skillMessage, setSkillMessage] = useState("");

  // BYOK State
  const [geminiKey, setGeminiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Voice Routing Note-Taker State
  const [noteText, setNoteText] = useState("");
  const [isProcessingNote, setIsProcessingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  // Worksheet Engine State
  const [wsPupilId, setWsPupilId] = useState("");
  const [wsSubject, setWsSubject] = useState("Weekly Pack");
  const [isGeneratingWs, setIsGeneratingWs] = useState(false);
  const [wsMessage, setWsMessage] = useState("");
  const [generatedSheets, setGeneratedSheets] = useState([]); 

  // Network Fetch
  const fetchDashboardData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { data: pupilsData, error: pupilsError } = await supabase.from("pupils").select("*").order("created_at", { ascending: false });
      if (pupilsError) throw pupilsError;
      setPupils(pupilsData || []);

      const { data: skillsData, error: skillsError } = await supabase.from("curriculum_skills").select("*").order("subject", { ascending: true }).order("display_order", { ascending: true });
      if (skillsError) throw skillsError;
      setSkills(skillsData || []);

      const { data: progressData, error: progressError } = await supabase.from("pupil_progress").select("*");
      if (progressError) throw progressError;
      setProgress(progressData || []);
      
      setDbStatus(`✅ Secure Connection. ${pupilsData?.length || 0} Pupils | ${skillsData?.length || 0} Skills`);
    } catch (error) {
      setDbStatus("❌ Database Connection Failed.");
      console.error(error);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchDashboardData();
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setIsKeySaved(true);
  }, [fetchDashboardData]);

  // General Handlers
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
        user_id: userId, 
        first_name: firstName, 
        last_initial: lastInitial.toUpperCase(), 
        is_send: isSend, 
        is_eal: isEal, 
        is_pp: isPp, 
        interests: combinedInterests,
        reading_level: readingLevel
      });
      setPupilMessage("✅ Pupil added.");
      setFirstName(""); setLastInitial(""); setIsSend(false); setIsEal(false); setIsPp(false); setInterestOne(""); setInterestTwo(""); setInterestThree(""); setReadingLevel("Year 3 Expected");
      fetchDashboardData();
      setTimeout(() => setPupilMessage(""), 3000);
    } catch (error) { setPupilMessage(`❌ Error: ${error.message}`); } finally { setIsPupilSubmitting(false); }
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

  const handleSaveKey = (e) => { e.preventDefault(); if (!geminiKey.trim()) return; localStorage.setItem("gemini_api_key", geminiKey.trim()); setIsKeySaved(true); setGeminiKey(""); };
  const handleClearKey = () => { localStorage.removeItem("gemini_api_key"); setIsKeySaved(false); };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isRecording) { setIsRecording(false); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); };
    recognition.onresult = (event) => { setNoteText((prev) => prev + (prev ? " " : "") + event.results[0][0].transcript); setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
    recognition.start();
  };

  const handleProcessNote = async () => {
    if (!noteText.trim()) return;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) return;
    setIsProcessingNote(true);
    try {
      const mappedPupils = pupils.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_initial}` }));
      const mappedSkills = skills.map(s => ({ id: s.id, subject: s.subject, skill: s.skill_name }));
      const prompt = `Read the teacher's note and map it to ONE pupil and ONE skill. Return raw JSON: { "pupil_id": "uuid", "skill_id": "uuid", "status": "Practising" }. Note: "${noteText}" Pupils: ${JSON.stringify(mappedPupils)} Skills: ${JSON.stringify(mappedSkills)}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json();
      const aiResult = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim());
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupil_progress").upsert({ user_id: userId, pupil_id: aiResult.pupil_id, skill_id: aiResult.skill_id, status: aiResult.status }, { onConflict: 'pupil_id,skill_id' });
      setNoteText(""); fetchDashboardData(); 
    } catch (error) { console.error(error); } finally { setIsProcessingNote(false); }
  };

  // ==========================================
  // DIFFERENTIATED WORKSHEET ENGINE
  // ==========================================
  const handleGenerateWorksheet = async () => {
    if (!wsPupilId) { setWsMessage("❌ Select a pupil first."); return; }
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { setWsMessage("❌ Missing API Key in BYOK settings."); return; }

    const targetPupil = pupils.find(p => p.id === wsPupilId);
    const interests = targetPupil.interests || "general fun topics";
    const readLevel = targetPupil.reading_level || "Year 3 Expected";
    const subjectsToRun = wsSubject === "Weekly Pack" ? ["Maths", "Writing", "Reading", "Spelling", "Timestables"] : [wsSubject];
    
    setIsGeneratingWs(true);
    setGeneratedSheets([]); 
    const newSheets = [];

    try {
      for (const subj of subjectsToRun) {
        setWsMessage(`⚙️ Synthesizing ${subj}...`);
        
        const subjSkills = skills.filter(s => s.subject === subj).sort((a,b) => a.display_order - b.display_order);
        
        // FIX: If no skill is mapped for a subject, don't skip. Default to "General Practice".
        let targetSkill = { skill_name: "General Age-Appropriate Practice" }; 
        
        if (subjSkills.length > 0) {
          let foundSkill = subjSkills.find(s => progress.find(p => p.skill_id === s.id && p.pupil_id === wsPupilId)?.status === 'Practising');
          if (!foundSkill) {
            foundSkill = subjSkills.find(s => {
              const stat = progress.find(p => p.skill_id === s.id && p.pupil_id === wsPupilId)?.status;
              return stat === 'Not Yet' || !stat;
            });
          }
          if (foundSkill) targetSkill = foundSkill;
        }

        let systemPrompt = `You are an expert UK primary school teacher. 
        CRITICAL: The child's reading ability is: "${readLevel}". You must strictly adapt all vocabulary, sentence structure, and text complexity to match this reading level exactly.
        Output ONLY raw, valid JSON in this exact format: { "worksheet": "<html> string", "answers": "<html> string" }. Do NOT use markdown code blocks (\`\`\`). Format HTML nicely using <h2>, <p>, <strong>, and lists. Add multiple <br> and underscores ____________ for physical writing lines after EVERY question. `;

        if (subj === "Maths") {
          systemPrompt += `Create a Maths worksheet for: "${targetSkill.skill_name}". Include: 5 arithmetic questions, then 3 word-problem reasoning questions based on the child's interests (${interests}), then 1 challenge question.`;
        } else if (subj === "Writing") {
          systemPrompt += `Create an English Writing worksheet for: "${targetSkill.skill_name}". Structure into 3 parts: 1) Identify the skill (find it in a sentence), 2) Apply the skill (fill in the blank), 3) Prove mastery (write an original paragraph about ${interests}).`;
        } else if (subj === "Reading") {
          systemPrompt += `Create a Reading comprehension worksheet. Write a short, engaging text (150 words) about the child's interests (${interests}). Follow it with 5 NFER-style comprehension questions focusing on: "${targetSkill.skill_name}".`;
        } else if (subj === "Spelling") {
          systemPrompt += `Create a Spelling worksheet for the rule/skill: "${targetSkill.skill_name}". Provide 8 words. Break them down phonetically to help pronunciation, then provide 3 blank lines next to each for copying/practice.`;
        } else if (subj === "Timestables") {
          systemPrompt += `Create a Timestables practice sheet focusing on: "${targetSkill.skill_name}". Provide 20 randomized questions (e.g., 3 x 4 =, 12 ÷ 3 =).`;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.7 }
          })
        });

        if (!response.ok) throw new Error(`Google API Error for ${subj}`);
        const data = await response.json();
        
        const rawText = data.candidates[0].content.parts[0].text.trim();
        const cleanJson = rawText.replace(/```json/g, "").replace(/```html/g, "").replace(/```/g, "");
        const parsed = JSON.parse(cleanJson);

        newSheets.push({
          subject: subj,
          skillName: targetSkill.skill_name,
          worksheet: parsed.worksheet,
          answers: parsed.answers
        });
      }

      setGeneratedSheets(newSheets);
      setWsMessage("✅ Document ready to print.");
      setTimeout(() => setWsMessage(""), 4000);

    } catch (error) {
      console.error(error);
      setWsMessage("❌ Generation failed. Check API key or prompt output.");
    } finally {
      setIsGeneratingWs(false);
    }
  };

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
        }
      `}} />

      <div className="no-print" style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", paddingBottom: "100px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, color: "#111827" }}>Command Center</h1>
            <p style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>{dbStatus}</p>
          </div>
          <UserButton />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "30px" }}>
          
          <div style={{ background: "#f0f9ff", border: "2px solid #bae6fd", padding: "25px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, color: "#0369a1", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>🎙️</span> Voice Note-Taker</h2>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={isProcessingNote} placeholder="e.g. 'Leo is struggling with 3-digit Addition today.'" style={{ width: "100%", height: "80px", padding: "10px", border: "1px solid #7dd3fc", borderRadius: "8px", resize: "none" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button onClick={toggleRecording} disabled={isProcessingNote} style={{ padding: "10px", background: isRecording ? "#ef4444" : "#e0f2fe", color: isRecording ? "white" : "#0284c7", border: "1px solid #7dd3fc", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isRecording ? "🔴 Stop" : "🎤 Dictate"}</button>
              <button onClick={handleProcessNote} disabled={isProcessingNote || !noteText.trim()} style={{ flex: 1, padding: "10px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isProcessingNote ? "Processing..." : "✨ Route Note"}</button>
            </div>
          </div>

          <div style={{ background: "#fdf4ff", border: "2px solid #f5d0fe", padding: "25px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>📄</span> Differentiated Worksheet Engine</h2>
            <p style={{ fontSize: "13px", color: "#a21caf", marginBottom: "15px" }}>Automatically targets the pupil's active gaps and injects their interests.</p>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <select value={wsPupilId} onChange={(e) => setWsPupilId(e.target.value)} disabled={isGeneratingWs} style={{ flex: 1, padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }}>
                <option value="">Select Pupil...</option>
                {pupils.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_initial}.</option>)}
              </select>
              <select value={wsSubject} onChange={(e) => setWsSubject(e.target.value)} disabled={isGeneratingWs} style={{ flex: 1, padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }}>
                <option value="Weekly Pack">Weekly Pack (All 5)</option>
                <option value="Maths">Maths Only</option>
                <option value="Writing">Writing Only</option>
                <option value="Reading">Reading Only</option>
                <option value="Spelling">Spelling Only</option>
                <option value="Timestables">Timestables Only</option>
              </select>
            </div>

            <button onClick={handleGenerateWorksheet} disabled={isGeneratingWs || !wsPupilId} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              {isGeneratingWs ? wsMessage || "Generating..." : "✨ Generate Resource"}
            </button>
            {!isGeneratingWs && wsMessage && <p style={{ marginTop: "10px", fontSize: "13px", color: "#86198f", textAlign: "center", fontWeight: "bold" }}>{wsMessage}</p>}
          </div>

        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px", marginBottom: "30px" }}>
          
          <div style={{ background: "#f9fafb", padding: "25px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "20px" }}>Pupil Onboarding</h2>
            <form onSubmit={handleAddPupil}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="First Name" />
                <input type="text" value={lastInitial} onChange={(e) => setLastInitial(e.target.value.substring(0, 1))} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="Last Initial (e.g. J)" maxLength={1} />
              </div>
              
              {/* NEW: Reading Level Dropdown */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563", display: "block", marginBottom: "5px" }}>Reading Level</label>
                <select value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}>
                  <option value="Phonics Phase 1/2 (Early Years)">Phonics Phase 1/2 (Early Years)</option>
                  <option value="Phonics Phase 3/4 (Reception/Year 1)">Phonics Phase 3/4 (Reception/Year 1)</option>
                  <option value="Phonics Phase 5/6 (Year 1/2)">Phonics Phase 5/6 (Year 1/2)</option>
                  <option value="Year 2 Expected">Year 2 Expected</option>
                  <option value="Year 3 Expected">Year 3 Expected</option>
                  <option value="Year 4 Expected">Year 4 Expected</option>
                  <option value="Year 5 Expected">Year 5 Expected</option>
                  <option value="Year 6 Expected">Year 6 Expected</option>
                  <option value="Year 6 Greater Depth">Year 6 Greater Depth</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563" }}>Child's Interests</label>
                <input type="text" value={interestOne} onChange={(e) => setInterestOne(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 1" />
                <input type="text" value={interestTwo} onChange={(e) => setInterestTwo(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 2" />
                <input type="text" value={interestThree} onChange={(e) => setInterestThree(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 3" />
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
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "750px", paddingRight: "10px" }}>
              {pupils.map((pupil) => {
                const isExpanded = expandedPupil === pupil.id;
                return (
                  <div key={pupil.id} style={{ border: "1px solid #e5e7eb", marginBottom: "8px", borderRadius: "6px", overflow: "hidden", background: "white" }}>
                    <div onClick={() => setExpandedPupil(isExpanded ? null : pupil.id)} style={{ padding: "12px 15px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: "600", fontSize: "15px" }}>{pupil.first_name} {pupil.last_initial}.</div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "15px", background: "#f8fafc", borderTop: "1px solid #e5e7eb" }}>
                        
                        <div style={{ marginBottom: "15px", fontSize: "13px", display: "grid", gap: "5px" }}>
                          <div><strong>Reading Level:</strong> <span style={{ color: "#4f46e5", fontWeight: "bold" }}>{pupil.reading_level || "Year 3 Expected"}</span></div>
                          {pupil.interests && <div><strong>Interests:</strong> {pupil.interests}</div>}
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {skills.map((skill) => {
                            const currentStatus = progress.find(pr => pr.pupil_id === pupil.id && pr.skill_id === skill.id)?.status || 'Not Yet';
                            let bg = "#fee2e2"; let col = "#991b1b"; let border = "#f87171"; 
                            if (currentStatus === 'Practising') { bg = "#fef3c7"; col = "#92400e"; border = "#fbbf24"; } 
                            if (currentStatus === 'Achieved') { bg = "#dcfce3"; col = "#166534"; border = "#4ade80"; } 
                            return (
                              <button key={skill.id} onClick={() => toggleSkillStatus(pupil.id, skill.id, currentStatus)} style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "4px", border: `1px solid ${border}`, background: bg, color: col, cursor: "pointer", fontWeight: "600" }}>
                                {skill.subject.substring(0,1)}: {skill.skill_name}
                              </button>
                            );
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
              <button type="submit" disabled={isSkillSubmitting} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}>Map New Skill</button>
            </form>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
            <h2 style={{ marginTop: 0, color: "#374151" }}>⚙ AI System Config</h2>
            <form onSubmit={handleSaveKey} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
              <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Paste Gemini API key..." style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} />
              <button type="submit" style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }}>Save Locally</button>
            </form>
          </div>
        </div>

      </div>

      {generatedSheets.length > 0 && (
        <div id="printable-document" style={{ maxWidth: "800px", margin: "40px auto", padding: "40px", background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: "8px" }}>
          
          <div className="no-print" style={{ textAlign: "right", marginBottom: "20px" }}>
            <button onClick={() => window.print()} style={{ padding: "10px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>🖨️ Print Document</button>
          </div>

          {generatedSheets.map((sheet, idx) => (
            <div key={`ws-${idx}`} className={idx > 0 ? "page-break" : ""}>
              <div className="worksheet-header">
                {sheet.subject} Practice: {sheet.skillName}
              </div>
              <div dangerouslySetInnerHTML={{ __html: sheet.worksheet }} style={{ lineHeight: "1.8", fontSize: "16px" }} />
            </div>
          ))}

          <div className="page-break">
            <h1 style={{ textAlign: "center", borderBottom: "3px solid black", paddingBottom: "10px" }}>Answer Keys</h1>
            {generatedSheets.map((sheet, idx) => (
              <div key={`ans-${idx}`} style={{ marginTop: "30px" }}>
                <h3>{sheet.subject}: {sheet.skillName}</h3>
                <div dangerouslySetInnerHTML={{ __html: sheet.answers }} style={{ fontSize: "14px", color: "#374151", background: "#f9fafb", padding: "15px", borderRadius: "6px", border: "1px dashed #d1d5db" }} />
              </div>
            ))}
          </div>

        </div>
      )}
    </>
  );
}
