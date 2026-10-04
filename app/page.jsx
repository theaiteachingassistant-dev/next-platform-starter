"use client";
import { useState, useEffect } from "react";

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

  if (isSaved) {
    return (
      <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px" }}>
        <h2>🎓 KS2 AI Teaching Assistant</h2>
        <p>Your API key is securely locked in this browser.</p>
        <button style={{ padding: "10px 20px", background: "#22c55e", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
          Enter Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px" }}>
      <h2>Setup Your Secure Access</h2>
      <p>To ensure strict UK GDPR compliance, your pupil data and API key will never be stored on our servers. Please paste your Google AI Studio key below to lock it into your work laptop.</p>
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
  );
}
