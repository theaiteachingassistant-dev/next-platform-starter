"use client";
import { useState, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setIsSaved(true);
    }
  }, []);

  const saveKey = () => {
    if (apiKey.length > 20) {
      localStorage.setItem("gemini_api_key", apiKey);
      setIsSaved(true);
    } else {
      alert("Please enter a valid Google AI Studio key.");
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      
      {/* Header with User Profile Picture */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h2>KS2 AI Assistant</h2>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>

      {/* Screen for Logged-Out Strangers */}
      <SignedOut>
        <div style={{ textAlign: "center", padding: "40px", background: "#f3f4f6", borderRadius: "8px" }}>
          <h3>Teacher Access Portal</h3>
          <p style={{ marginBottom: "20px" }}>Please log in to access your secure dashboard.</p>
          <div style={{ padding: "10px 20px", background: "#3b82f6", color: "white", borderRadius: "5px", display: "inline-block", cursor: "pointer" }}>
            <SignInButton mode="modal" />
          </div>
        </div>
      </SignedOut>

      {/* Screen for Logged-In Teachers */}
      <SignedIn>
        {isSaved ? (
          <div style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <h3>✅ API Key Secured</h3>
            <p>Your workspace is ready. Your API key is safely locked on this device.</p>
            <button style={{ padding: "10px 20px", background: "#22c55e", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginTop: "10px" }}>
              Enter Dashboard
            </button>
          </div>
        ) : (
          <div style={{ padding: "20px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <h3>Setup Your Secure Access</h3>
            <p>To ensure strict UK GDPR compliance, your pupil data and API key will never be stored on our servers. Please paste your Google AI Studio key below.</p>
            <input 
              type="password" 
              placeholder="Paste your Gemini API key here..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: "100%", padding: "10px", margin: "10px 0", border: "1px solid #ccc", borderRadius: "4px" }}
            />
            <button onClick={saveKey} style={{ padding: "10px 20px", background: "#3b82f6", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
              Save Key Securely
            </button>
          </div>
        )}
      </SignedIn>

    </div>
  );
}
