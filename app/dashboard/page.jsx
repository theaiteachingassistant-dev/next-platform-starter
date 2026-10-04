"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth(); 
  
  // Database State
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");
  
  // Pupil Form State
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
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

  // Network Fetch: Retrieves locked data for the active teacher
  const fetchDashboardData = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      // Fetch Pupils
      const { data: pupilsData, error: pupilsError } = await supabase
        .from("pupils")
        .select("*")
        .order("created_at", { ascending: false });
      if (pupilsError) throw pupilsError;
      setPupils(pupilsData || []);

      // Fetch Skills
      const { data: skillsData, error: skillsError } = await supabase
        .from("curriculum_skills")
        .select("*")
        .order("subject", { ascending: true })
        .order("display_order", { ascending: true });
      if (skillsError) throw skillsError;
      setSkills(skillsData || []);
      
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

  // Handlers
  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) {
      setPupilMessage("❌ First name and last initial required.");
      return;
    }
    setIsPupilSubmitting(true);
    setPupilMessage("Saving...");

    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { error } = await supabase.from("pupils").insert({
        user_id: userId, 
        first_name: firstName,
        last_initial: lastInitial.toUpperCase(), 
        is_send: isSend,
        is_eal: isEal,
        is_pp: isPp
      });

      if (error) throw error;
      setPupilMessage("✅ Pupil added.");
      setFirstName(""); setLastInitial(""); setIsSend(false); setIsEal(false); setIsPp(false);
      fetchDashboardData();
      setTimeout(() => setPupilMessage(""), 3000);
    } catch (error) {
      setPupilMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsPupilSubmitting(false);
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName) {
      setSkillMessage("❌ Skill name required.");
      return;
    }
    setIsSkillSubmitting(true);
    setSkillMessage("Saving...");

    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { error } = await supabase.from("curriculum_skills").insert({
        user_id: userId, 
        subject: newSubject,
        skill_name: newSkillName,
        display_order: parseInt(newDisplayOrder)
      });

      if (error) throw error;
      setSkillMessage("✅ Skill mapped.");
      setNewSkillName("");
      setNewDisplayOrder((prev) => parseInt(prev) + 1); // Auto-increments for fast left-to-right entry
      fetchDashboardData();
      setTimeout(() => setSkillMessage(""), 3000);
    } catch (error) {
      setSkillMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsSkillSubmitting(false);
    }
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!geminiKey.trim()) return;
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    setIsKeySaved(true);
    setGeminiKey(""); 
  };

  const handleClearKey = () => {
    localStorage.removeItem("gemini_api_key");
    setIsKeySaved(false);
  };

  if (!isLoaded) return null;

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", paddingBottom: "100px" }}>
      
      {/* Header Area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0, color: "#111827" }}>Command Center</h1>
          <p style={{ margin: "5px 0 0 0", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>{dbStatus}</p>
        </div>
        <UserButton />
      </div>

      {/* Row 1: Pupils & BYOK */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px", marginBottom: "30px" }}>
        
        <div style={{ background: "#f9fafb", padding: "25px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "20px" }}>Pupil Onboarding</h2>
          <form onSubmit={handleAddPupil}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="First Name" />
              <input type="text" value={lastInitial} onChange={(e) => setLastInitial(e.target.value.substring(0, 1))} disabled={isPupilSubmitting} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} placeholder="Last Initial (e.g. J)" maxLength={1} />
            </div>
            <div style={{ marginBottom: "25px", display: "flex", gap: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isSend} onChange={(e) => setIsSend(e.target.checked)} disabled={isPupilSubmitting} /> SEND</label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isEal} onChange={(e) => setIsEal(e.target.checked)} disabled={isPupilSubmitting} /> EAL</label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}><input type="checkbox" checked={isPp} onChange={(e) => setIsPp(e.target.checked)} disabled={isPupilSubmitting} /> PP</label>
            </div>
            <button type="submit" disabled={isPupilSubmitting} style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              {isPupilSubmitting ? "Saving..." : "Add Pupil"}
            </button>
            {pupilMessage && <p style={{ marginTop: "15px", fontSize: "14px", fontWeight: "600", color: pupilMessage.includes("❌") ? "#ef4444" : "#10b981", textAlign: "center" }}>{pupilMessage}</p>}
          </form>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "15px" }}>Active Cohort</h2>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "250px", border: "1px solid #f3f4f6", borderRadius: "6px", background: "#f9fafb", padding: "10px" }}>
            {pupils.length === 0 ? <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: "14px" }}>No pupils found.</div> : 
              pupils.map((pupil, i) => (
                <div key={i} style={{ background: "white", padding: "10px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "4px", marginBottom: "5px", border: "1px solid #e5e7eb", fontSize: "14px" }}>
                  <strong>{pupil.first_name} {pupil.last_initial}.</strong>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {pupil.is_send && <span style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>SEND</span>}
                    {pupil.is_pp && <span style={{ background: "#dbeafe", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>PP</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

      </div>

      {/* Row 2: Curriculum Manager */}
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
              </select>
              <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} disabled={isSkillSubmitting} placeholder="e.g. 3-digit Addition" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} />
              <input type="number" value={newDisplayOrder} onChange={(e) => setNewDisplayOrder(e.target.value)} disabled={isSkillSubmitting} placeholder="Order (1, 2, 3...)" style={{ padding: "10px", border: "1px solid #f0abfc", borderRadius: "6px" }} min="1" />
            </div>
            <button type="submit" disabled={isSkillSubmitting} style={{ width: "100%", padding: "12px", background: "#d946ef", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              {isSkillSubmitting ? "Mapping..." : "Map New Skill"}
            </button>
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

      {/* Row 3: BYOK Settings */}
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
