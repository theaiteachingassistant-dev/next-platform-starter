"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth(); 
  
  // Database State
  const [pupils, setPupils] = useState([]);
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");
  
  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  // BYOK (Bring Your Own Key) State
  const [geminiKey, setGeminiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Network Fetch: Retrieve only the rows mathematically locked to the user's token
  const fetchDatabase = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      
      const { data, error } = await supabase
        .from("pupils")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setPupils(data || []);
      setDbStatus(`✅ Database Connected. ${data?.length || 0} Pupils Enrolled.`);
    } catch (error) {
      setDbStatus("❌ Database Connection Failed.");
      console.error(error);
    }
  }, [getToken, isLoaded, isSignedIn]);

  // Initialization: Fetch DB and check local storage for API Key
  useEffect(() => {
    fetchDatabase();
    
    // Check if the user already saved their key in this browser
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setIsKeySaved(true);
    }
  }, [fetchDatabase]);

  // Form Submission: Add Pupil
  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) {
      setFormMessage("❌ First name and last initial are required.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage("Encrypting and saving...");

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

      setFormMessage("✅ Pupil securely added.");
      setFirstName("");
      setLastInitial("");
      setIsSend(false);
      setIsEal(false);
      setIsPp(false);
      
      fetchDatabase();
      setTimeout(() => setFormMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setFormMessage(`❌ Supabase Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // BYOK Handlers
  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!geminiKey.trim()) return;
    
    // Write the key to the device's local browser storage
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    setIsKeySaved(true);
    setGeminiKey(""); // Clear input field for visual security
  };

  const handleClearKey = () => {
    // Wipe the key from the device's local browser storage
    localStorage.removeItem("gemini_api_key");
    setIsKeySaved(false);
  };

  // Prevent UI flashing before Clerk verifies identity
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
        
        {/* Left Column: Secure Onboarding Form */}
        <div style={{ background: "#f9fafb", padding: "25px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "5px" }}>Pupil Onboarding</h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px", lineHeight: "1.5" }}>
            Enter pupil details below. Strict UK GDPR compliance is active: do not enter full surnames.
          </p>
          
          <form onSubmit={handleAddPupil}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "15px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "5px", color: "#374151" }}>First Name</label>
                <input 
                  type="text" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  disabled={isSubmitting}
                  style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} 
                  placeholder="e.g. Sarah"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "5px", color: "#374151" }}>Last Initial</label>
                <input 
                  type="text" 
                  value={lastInitial} 
                  onChange={(e) => setLastInitial(e.target.value.substring(0, 1))} 
                  disabled={isSubmitting}
                  style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px" }} 
                  placeholder="e.g. J"
                  maxLength={1}
                />
              </div>
            </div>

            <div style={{ marginBottom: "25px", display: "flex", gap: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                <input type="checkbox" checked={isSend} onChange={(e) => setIsSend(e.target.checked)} disabled={isSubmitting} />
                SEND Register
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                <input type="checkbox" checked={isEal} onChange={(e) => setIsEal(e.target.checked)} disabled={isSubmitting} />
                EAL
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                <input type="checkbox" checked={isPp} onChange={(e) => setIsPp(e.target.checked)} disabled={isSubmitting} />
                Pupil Premium
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{ width: "100%", padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? "Locking Record..." : "Securely Add Pupil"}
            </button>

            {formMessage && (
              <p style={{ marginTop: "15px", fontSize: "14px", fontWeight: "600", color: formMessage.includes("❌") ? "#ef4444" : "#10b981", textAlign: "center" }}>
                {formMessage}
              </p>
            )}
          </form>
        </div>

        {/* Right Column: Live Database Hydration */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "5px" }}>Active Cohort Roster</h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
            Live secure feed from Supabase. Only rendering rows linked to your token.
          </p>

          <div style={{ flex: 1, overflowY: "auto", maxHeight: "400px", border: "1px solid #f3f4f6", borderRadius: "6px", background: "#f9fafb", padding: "10px" }}>
            {pupils.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0", fontSize: "14px" }}>
                No pupils found in this secure compartment. Add one to begin.
              </div>
            ) : (
              pupils.map((pupil, index) => (
                <div key={index} style={{ background: "white", padding: "12px 15px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "4px", marginBottom: "5px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontWeight: "600", color: "#111827" }}>
                    {pupil.first_name} {pupil.last_initial}.
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {pupil.is_send && <span style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", border: "1px solid #fde68a", color: "#92400e" }}>SEND</span>}
                    {pupil.is_eal && <span style={{ background: "#e0e7ff", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", border: "1px solid #c7d2fe", color: "#3730a3" }}>EAL</span>}
                    {pupil.is_pp && <span style={{ background: "#dbeafe", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", border: "1px solid #bfdbfe", color: "#1e40af" }}>PP</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* NEW FULL-WIDTH ROW: BYOK System Configuration */}
      <div style={{ marginTop: "30px", background: "#fff", border: "1px solid #e5e7eb", padding: "25px", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0, color: "#374151", marginBottom: "5px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>⚙️</span> System Configuration (BYOK)
        </h2>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px", maxWidth: "800px", lineHeight: "1.5" }}>
          To enable AI features, connect your personal Google Gemini API key. 
          Your key is stored strictly on this device inside your browser&apos;s local storage. It is never sent to our servers.
        </p>

        {isKeySaved ? (
          <div style={{ display: "inline-block", background: "#ecfdf5", padding: "15px 20px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>✅</span>
              <div>
                <div style={{ fontWeight: "600", color: "#065f46" }}>API Key Active</div>
                <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>Ready for AI generation</div>
              </div>
              <button 
                onClick={handleClearKey}
                style={{ marginLeft: "20px", padding: "6px 12px", background: "white", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", transition: "0.2s" }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveKey} style={{ display: "flex", gap: "10px", maxWidth: "500px" }}>
            <input 
              type="password" 
              value={geminiKey} 
              onChange={(e) => setGeminiKey(e.target.value)} 
              placeholder="Paste your Gemini API key here..."
              style={{ flex: 1, padding: "10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" }} 
              required
            />
            <button 
              type="submit" 
              style={{ padding: "10px 20px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}
            >
              Save Locally
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
