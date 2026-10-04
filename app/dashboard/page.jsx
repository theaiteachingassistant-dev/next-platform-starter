"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [pupils, setPupils] = useState([]);
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");
  
  // Data Entry State
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [isSend, setIsSend] = useState(false);
  const [isEal, setIsEal] = useState(false);
  const [isPp, setIsPp] = useState(false);
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  // Network Fetch: Retrieves only the rows mathematically locked to the user's token
  const fetchDatabase = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const token = await getToken();
      const supabase = createClerkSupabaseClient(token);
      
      const { data, error } = await supabase
        .from("pupils")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setPupils(data || []);
      setDbStatus(`✅ Database Connected. ${data?.length || 0} Pupils Enrolled.`);
    } catch (error) {
      setDbStatus("❌ Database Connection Failed. Check Vercel Variables.");
      console.error(error);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchDatabase();
  }, [fetchDatabase]);

  // Form Submission Logic
  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) {
      setFormMessage("❌ First name and last initial are required.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage("Encrypting and saving...");

    try {
      const token = await getToken();
      const supabase = createClerkSupabaseClient(token);
      
      const { error } = await supabase.from("pupils").insert({
        first_name: firstName,
        // Force uppercase for UI consistency
        last_initial: lastInitial.toUpperCase(), 
        is_send: isSend,
        is_eal: isEal,
        is_pp: isPp
      });

      if (error) throw error;

      setFormMessage("✅ Pupil securely added.");
      
      // Reset inputs immediately
      setFirstName("");
      setLastInitial("");
      setIsSend(false);
      setIsEal(false);
      setIsPp(false);
      
      // Hydrate UI with the new database count
      fetchDatabase();
      
      // Clear success text after 3 seconds
      setTimeout(() => setFormMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setFormMessage("❌ Failed to add pupil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent UI flashing before Clerk verifies identity
  if (!isLoaded) return null;

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      
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
            Enter pupil details below. Strict UK GDPR compliance is active: do not enter full surnames. The RLS engine will automatically bind this record to your cryptographic ID.
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
    </div>
  );
}
