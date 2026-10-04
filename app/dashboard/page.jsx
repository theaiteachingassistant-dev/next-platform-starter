"use client";
import { useState, useEffect } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "../utils/supabase";

export default function Dashboard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [pupils, setPupils] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [dbStatus, setDbStatus] = useState("Connecting to secure database...");

  // Network Check: Authenticate and fetch from Supabase
  useEffect(() => {
    const fetchDatabase = async () => {
      if (!isLoaded || !isSignedIn) return;
      
      try {
        // Retrieve the secure Clerk token and initialize Supabase
        const token = await getToken();
        const supabase = createClerkSupabaseClient(token);
        
        // Query the locked pupils table (RLS ensures you only see your own data)
        const { data, error } = await supabase.from("pupils").select("*");
        
        if (error) throw error;
        
        setPupils(data || []);
        setDbStatus(`✅ Database Connected. ${data?.length || 0} Pupils Enrolled.`);
      } catch (error) {
        setDbStatus("❌ Database Connection Failed. Check Netlify Variables.");
        console.error(error);
      }
    };
    
    fetchDatabase();
  }, [isLoaded, isSignedIn, getToken]);

  // Mock 'Gap' data for visual layout until the data-entry module is built
  const topGaps = [
    { subject: "Maths", skill: "Equivalent Fractions", count: 12, send: 3, pp: 4 },
    { subject: "Writing", skill: "Fronted Adverbials", count: 9, send: 1, pp: 2 },
    { subject: "Reading", skill: "Inference", count: 7, send: 2, pp: 5 }
  ];

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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
        
        {/* Left Column: Data & Action */}
        <div>
          {/* The Gap Matrix */}
          <div style={{ background: "#f9fafb", padding: "20px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #e5e7eb" }}>
            <h2 style={{ marginTop: 0, color: "#374151" }}>Top Class Gaps (The 'Nos')</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px" }}>
              {topGaps.map((gap, i) => (
                <div key={i} style={{ padding: "15px", background: "white", border: "1px solid #d1d5db", borderRadius: "6px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", fontWeight: "bold" }}>{gap.subject}</div>
                  <div style={{ fontSize: "18px", fontWeight: "600", margin: "5px 0", color: "#111827" }}>{gap.skill}</div>
                  <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", marginBottom: "12px" }}>{gap.count} Pupils Missed</div>
                  
                  {/* Vulnerable Cohort Tracking */}
                  <div style={{ fontSize: "12px", color: "#4b5563", display: "flex", gap: "10px" }}>
                    <span style={{ background: "#fef3c7", padding: "4px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #fde68a" }}>SEND: {gap.send}</span>
                    <span style={{ background: "#dbeafe", padding: "4px 8px", borderRadius: "4px", fontWeight: "600", border: "1px solid #bfdbfe" }}>PP: {gap.pp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Action Center */}
          <div style={{ border: "2px solid #3b82f6", padding: "20px", borderRadius: "8px", background: "#eff6ff" }}>
            <h2 style={{ marginTop: 0, color: "#1d4ed8", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>✨</span> AI Recommendation Engine
            </h2>
            <p style={{ margin: "0 0 10px 0" }}><strong>Immediate Target:</strong> Equivalent Fractions</p>
            <p style={{ color: "#1e3a8a", fontStyle: "italic", background: "#dbeafe", padding: "15px", borderRadius: "6px", margin: 0, lineHeight: "1.5" }}>
              "Generate tiered word problems for 12 pupils. Resources will be actively differentiated by their specific reading levels, incorporate their tracked individual interests to maximize engagement, and simplify phrasing for the 3 SEND pupils."
            </p>
            
            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button style={{ padding: "12px", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", flex: 1, fontWeight: "bold", fontSize: "14px" }}>
                Generate Group 1 (1-10)
              </button>
              <button style={{ padding: "12px", background: "#93c5fd", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", flex: 1, fontWeight: "bold", fontSize: "14px" }}>
                Generate Group 2 (11-20)
              </button>
              <button style={{ padding: "12px", background: "#93c5fd", color: "white", border: "none", borderRadius: "6px", cursor: "not-allowed", flex: 1, fontWeight: "bold", fontSize: "14px" }}>
                Generate Group 3 (21-30)
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#3b82f6", textAlign: "center", marginTop: "12px", marginBottom: 0, fontWeight: "500" }}>
              Execution is chunked into 10-pupil batches to strictly bypass Gemini API rate limits and browser timeouts.
            </p>
          </div>
        </div>

        {/* Right Column: Input & Archiving */}
        <div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "20px", borderRadius: "8px", height: "100%", display: "flex", flexDirection: "column" }}>
            <h2 style={{ marginTop: 0, color: "#374151" }}>Voice Routing</h2>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}>
              Tap to dictate. State the pupil's name first, then the note. The AI will instantly categorize it into their digital drawer.
            </p>
            
            <button 
              onClick={() => setIsRecording(!isRecording)}
              style={{ 
                width: "100%", padding: "20px", marginTop: "10px", fontSize: "16px", cursor: "pointer", border: "none", borderRadius: "8px",
                background: isRecording ? "#ef4444" : "#10b981", color: "white", fontWeight: "bold",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", transition: "all 0.2s"
              }}
            >
              {isRecording ? "🔴 Recording... Tap to Stop" : "🎤 Tap to Dictate Note"}
            </button>

            <div style={{ marginTop: "30px", flex: 1 }}>
              <h3 style={{ fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.5px" }}>Recent Files</h3>
              <div style={{ fontSize: "14px", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                <strong>Leo M:</strong> <span style={{ color: "#4b5563" }}>Struggles with borrowing across zero in column subtraction.</span>
              </div>
              <div style={{ fontSize: "14px", padding: "12px 0" }}>
                <strong>Mia C:</strong> <span style={{ color: "#4b5563" }}>Moved up to Phase 6 Phonics group. EAL vocabulary improving.</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
