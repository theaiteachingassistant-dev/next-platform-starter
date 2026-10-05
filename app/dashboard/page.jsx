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
  
  // UI State for Matrix
  const [expandedPupil, setExpandedPupil] = useState(null);

  // Pupil Form State
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  
  // NEW: Interests State
  const [interestOne, setInterestOne] = useState("");
  const [interestTwo, setInterestTwo] = useState("");
  const [interestThree, setInterestThree] = useState("");

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

  // Manual Matrix Click Handler
  const toggleSkillStatus = async (pupilId, skillId, currentStatus) => {
    const cycle = {
      'Not Yet': 'Practising',
      'Practising': 'Achieved',
      'Achieved': 'Not Yet'
    };
    const nextStatus = cycle[currentStatus || 'Not Yet'] || 'Achieved';

    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      await supabase.from("pupil_progress").upsert(
        { user_id: userId, pupil_id: pupilId, skill_id: skillId, status: nextStatus },
        { onConflict: 'pupil_id,skill_id' }
      );
      fetchDashboardData(); 
    } catch (error) {
      console.error("Failed to update status manually:", error);
    }
  };

  // Form Handlers
  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) { setPupilMessage("❌ First name and last initial required."); return; }
    
    setIsPupilSubmitting(true); setPupilMessage("Saving...");
    try {
      const combinedInterests = [interestOne, interestTwo, interestThree].filter(Boolean).join(", ");

      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase.from("pupils").insert({ 
        user_id: userId, 
        first_name: firstName, 
        last_initial: lastInitial.toUpperCase(), 
        is_send: isSend, 
        is_eal: isEal, 
        is_pp: isPp,
        interests: combinedInterests
      });
      if (error) throw error;
      setPupilMessage("✅ Pupil added.");
      
      // Reset Form
      setFirstName(""); setLastInitial(""); setIsSend(false); setIsEal(false); setIsPp(false);
      setInterestOne(""); setInterestTwo(""); setInterestThree("");
      
      fetchDashboardData();
      setTimeout(() => setPupilMessage(""), 3000);
    } catch (error) { setPupilMessage(`❌ Error: ${error.message}`); } finally { setIsPupilSubmitting(false); }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName) { setSkillMessage("❌ Skill name required."); return; }
    setIsSkillSubmitting(true); setSkillMessage("Saving...");
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase.from("curriculum_skills").insert({ user_id: userId, subject: newSubject, skill_name: newSkillName, display_order: parseInt(newDisplayOrder) });
      if (error) throw error;
      setSkillMessage("✅ Skill mapped.");
      setNewSkillName(""); setNewDisplayOrder((prev) => parseInt(prev) + 1); 
      fetchDashboardData();
      setTimeout(() => setSkillMessage(""), 3000);
    } catch (error) { setSkillMessage(`❌ Error: ${error.message}`); } finally { setIsSkillSubmitting(false); }
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!geminiKey.trim()) return;
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    setIsKeySaved(true); setGeminiKey(""); 
  };
  const handleClearKey = () => { localStorage.removeItem("gemini_api_key"); setIsKeySaved(false); };

  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNoteMessage("❌ Voice recognition not supported in this browser. Please type instead."); return; }
    if (isRecording) { setIsRecording(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); setNoteMessage("🎤 Listening..."); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNoteText((prev) => prev + (prev ? " " : "") + transcript);
      setIsRecording(false); setNoteMessage("");
    };
    recognition.onerror = () => { setIsRecording(false); setNoteMessage("❌ Mic error. Please type."); };
    recognition.onend = () => { setIsRecording(false); };
    recognition.start();
  };

  // The AI Routing Engine
  const handleProcessNote = async () => {
    if (!noteText.trim()) return;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) { setNoteMessage("❌ Please save your Gemini API Key in the System Configuration first."); return; }
    
    setIsProcessingNote(true);
    setNoteMessage("🧠 AI is analyzing the note...");

    try {
      const mappedPupils = pupils.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_initial}` }));
      const mappedSkills = skills.map(s => ({ id: s.id, subject: s.subject, skill: s.skill_name }));

      const prompt = `
        You are an AI assistant for a teacher. Read the teacher's note and map it to ONE pupil and ONE skill from the provided lists.
        Determine their status: 'Achieved' (mastered/nailed it), 'Practising' (struggling/working on it), or 'Not Yet' (started today). Default to 'Practising' if unsure.
        
        Teacher's Note: "${noteText}"
        Available Pupils (JSON): ${JSON.stringify(mappedPupils)}
        Available Skills (JSON): ${JSON.stringify(mappedSkills)}
        
        Respond ONLY with a raw, valid JSON object exactly like this:
        { "pupil_id": "the-uuid-of-the-pupil", "skill_id": "the-uuid-of-the-skill", "status": "Practising" }
      `;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google AI: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text.trim();
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, ""); 
      const aiResult = JSON.parse(cleanJson);

      if (!aiResult.pupil_id || !aiResult.skill_id) throw new Error("AI could not find a matching pupil or skill.");

      setNoteMessage("🔐 Routing to secure database...");
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { error: dbError } = await supabase.from("pupil_progress").upsert(
        { user_id: userId, pupil_id: aiResult.pupil_id, skill_id: aiResult.skill_id, status: aiResult.status },
        { onConflict: 'pupil_id,skill_id' } 
      );

      if (dbError) throw dbError;

      setNoteMessage(`✅ Success! Updated database: ${aiResult.status}`);
      setNoteText("");
      fetchDashboardData(); 
      setTimeout(() => setNoteMessage(""), 4000);

    } catch (error) {
      console.error(error);
      setNoteMessage(`❌ Routing Failed: ${error.message}`);
    } finally {
      setIsProcessingNote(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", paddingBottom: "100px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, color: "#111827" }}>Command Center</h1>
          <p style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>{dbStatus}</p>
        </div>
        <UserButton />
      </div>

      {/* Row 1: Voice Routing Engine */}
      <div style={{ background: "#f0f9ff", border: "2px solid #bae6fd", padding: "25px", borderRadius: "8px", marginBottom: "30px" }}>
        <h2 style={{ marginTop: 0, color: "#0369a1", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>🎙️</span> Voice Routing AI Note-Taker</h2>
        <p style={{ fontSize: "14px", color: "#0c4a6e", marginBottom: "20px" }}>Dictate or type your note. The AI will analyze the text, find the correct pupil, find the specific skill, and update their secure digital file automatically.</p>
        
        <div style={{ display: "flex", gap: "15px", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <textarea 
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={isProcessingNote}
              placeholder="e.g. 'Leo is struggling with 3-digit Addition today. He needs more practice.' OR 'Sarah absolutely nailed identifying nouns.'"
              style={{ width: "100%", height: "100px", padding: "15px", border: "1px solid #7dd3fc", borderRadius: "8px", resize: "none", fontSize: "15px", fontFamily: "inherit" }}
            />
            
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button onClick={toggleRecording} disabled={isProcessingNote} style={{ padding: "12px 20px", background: isRecording ? "#ef4444" : "#e0f2fe", color: isRecording ? "white" : "#0284c7", border: "1px solid #7dd3fc", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                {isRecording ? "🔴 Stop Recording" : "🎤 Tap to Dictate"}
              </button>
              <button onClick={handleProcessNote} disabled={isProcessingNote || !noteText.trim()} style={{ flex: 1, padding: "12px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: isProcessingNote || !noteText.trim() ? "not-allowed" : "pointer", opacity: isProcessingNote || !noteText.trim() ? 0.6 : 1 }}>
                {isProcessingNote ? "Processing with AI..." : "✨ Process & Route Note"}
              </button>
            </div>
            
            {noteMessage && <p style={{ marginTop: "15px", fontSize: "14px", fontWeight: "600", color: noteMessage.includes("❌") ? "#ef4444" : "#0369a1" }}>{noteMessage}</p>}
          </div>
        </div>
      </div>

      {/* Row 2: Pupils & Interactive Matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "30px", marginBottom: "30px" }}>
        
        {/* UPDATED PUPIL FORM WITH INTERESTS */}
        <div style={{ background: "#f9fafb", padding: "25px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "20px" }}>Pupil Onboarding</h2>
          <form onSubmit={handleAddPupil}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="First Name" />
              <input type="text" value={lastInitial} onChange={(e) => setLastInitial(e.target.value.substring(0, 1))} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="Last Initial (e.g. J)" maxLength={1} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563" }}>Child's Interests (For AI Generation)</label>
              <input type="text" value={interestOne} onChange={(e) => setInterestOne(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 1 (e.g. Dinosaurs)" />
              <input type="text" value={interestTwo} onChange={(e) => setInterestTwo(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 2 (e.g. Space)" />
              <input type="text" value={interestThree} onChange={(e) => setInterestThree(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} placeholder="Interest 3 (e.g. Football)" />
            </div>

            <div style={{ marginBottom: "25px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isSend} onChange={(e) => setIsSend(e.target.checked)} disabled={isPupilSubmitting} /> SEND</label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isEal} onChange={(e) => setIsEal(e.target.checked)} disabled={isPupilSubmitting} /> EAL</label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isPp} onChange={(e) => setIsPp(e.target.checked)} disabled={isPupilSubmitting} /> PP</label>
            </div>
            <button type="submit" disabled={isPupilSubmitting} style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isPupilSubmitting ? "Saving..." : "Add Pupil"}</button>
            {pupilMessage && <p style={{ marginTop: "15px", fontSize: "14px", fontWeight: "600", color: pupilMessage.includes("❌") ? "#ef4444" : "#10b981", textAlign: "center" }}>{pupilMessage}</p>}
          </form>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>Interactive Cohort Matrix</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 15px 0" }}>Click on any pupil to view their skills. Click a skill badge to manually toggle status.</p>
          
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "600px", paddingRight: "10px" }}>
            {pupils.length === 0 ? <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: "14px" }}>No pupils found.</div> : 
              pupils.map((pupil) => {
                const isExpanded = expandedPupil === pupil.id;
                return (
                  <div key={pupil.id} style={{ border: "1px solid #e5e7eb", marginBottom: "8px", borderRadius: "6px", overflow: "hidden", background: "white" }}>
                    
                    <div onClick={() => setExpandedPupil(isExpanded ? null : pupil.id)} style={{ padding: "12px 15px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: "600", fontSize: "15px" }}>{pupil.first_name} {pupil.last_initial}.</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {pupil.is_send && <span style={{ background: "#fef3c7", padding: "3px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>SEND</span>}
                        {pupil.is_pp && <span style={{ background: "#dbeafe", padding: "3px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>PP</span>}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "15px", background: "#f8fafc", borderTop: "1px solid #e5e7eb" }}>
                        
                        {pupil.interests && (
                          <div style={{ marginBottom: "15px", fontSize: "13px", color: "#4b5563" }}>
                            <strong>Interests:</strong> {pupil.interests}
                          </div>
                        )}

                        {skills.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "#9ca3af" }}>Map curriculum skills below to track them here.</div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {skills.map((skill) => {
                              const currentStatus = progress.find(pr => pr.pupil_id === pupil.id && pr.skill_id === skill.id)?.status || 'Not Yet';
                              
                              let bg = "#fee2e2"; let col = "#991b1b"; let border = "#f87171"; 
                              if (currentStatus === 'Practising') { bg = "#fef3c7"; col = "#92400e"; border = "#fbbf24"; } 
                              if (currentStatus === 'Achieved') { bg = "#dcfce3"; col = "#166534"; border = "#4ade80"; } 
                              
                              return (
                                <button 
                                  key={skill.id}
                                  onClick={() => toggleSkillStatus(pupil.id, skill.id, currentStatus)}
                                  style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "4px", border: `1px solid ${border}`, background: bg, color: col, cursor: "pointer", fontWeight: "600", transition: "all 0.1s" }}
                                  title={`Click to change status. Currently: ${currentStatus}`}
                                >
                                  {skill.subject.substring(0,1)}: {skill.skill_name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>

      {/* Row 3: Curriculum Manager */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px", marginBottom: "30px" }}>
        <div style={{ background: "#fdf4ff", padding: "25px", borderRadius: "8px", border: "1px solid #f5d0fe" }}>
          <h2 style={{ marginTop: 0, color: "#86198f", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}><span>📚</span> Curriculum Skills Manager</h2>
          <p style={{ fontSize: "14px", color: "#a21caf", marginBottom: "20px" }}>Map your spreadsheet columns here. The <strong>Order Number</strong> dictates left-to-right progression.</p>
          
          <form onSubmit={handleAddSkill}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px", marginBottom: "20px" }}>
              <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} disabled={isSkillSubmitting} style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }}>
                <option value="Maths">Maths</option>
                <option value="Writing">Writing</option>
                <option value="Reading">Reading</option>
                <option value="Spelling">Spelling</option>
                <option value="Timestables">Timestables</option>
              </select>
              <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} disabled={isSkillSubmitting} placeholder="e.g. 3-digit Addition" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} />
              <input type="number" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value)} disabled={isSkillSubmitting} placeholder="Order (1, 2, 3...)" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} min="1" />
            </div>
            <button type="submit" disabled={isSkillSubmitting} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>{isSkillSubmitting ? "Mapping..." : "Map New Skill"}</button>
            {skillMessage && <p style={{ marginTop: "15px", fontSize: "14px", fontWeight: "600", color: skillMessage.includes("❌") ? "#ef4444" : "#10b981", textAlign: "center" }}>{skillMessage}</p>}
          </form>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>Mapped Skills</h2>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "200px", border: "1px solid #f3f4f6", borderRadius: "6px", background: "#f9fafb", padding: "10px" }}>
            {skills.length === 0 ? <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: "14px" }}>No skills mapped yet.</div> : 
              skills.map((skill, i) => (
                <div key={i} style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: "13px" }}>
                  <span style={{ fontWeight: "bold", color: "#6b7280", marginRight: "10px" }}>#{skill.display_order}</span>
                  <span style={{ fontWeight: "600", color: "#4f46e5", marginRight: "10px" }}>{skill.subject}</span>
                  <span>{skill.skill_name}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Row 4: BYOK Settings */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}><span>⚙</span> AI System Configuration (BYOK)</h2>
        {isKeySaved ? (
          <div style={{ display: "inline-block", background: "#ecfdf5", padding: "15px 20px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>✅</span>
              <div><div style={{ fontWeight: "600", color: "#065f46" }}>API Key Active</div></div>
              <button onClick={handleClearKey} style={{ marginLeft: "20px", padding: "6px 12px", background: "white", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Disconnect</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveKey} style={{ display: "flex", gap: "10px", maxWidth: "500px" }}>
            <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Paste Gemini API key..." style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} required />
            <button type="submit" style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Save Locally</button>
          </form>
        )}
      </div>
    </div>
  );
}
