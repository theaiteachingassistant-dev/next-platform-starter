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

  // Basic Handlers (Pupils & Skills)
  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!firstName || !lastInitial) { setPupilMessage("❌ First name and last initial required."); return; }
    setIsPupilSubmitting(true); setPupilMessage("Saving...");
    try {
      const token = await getToken({ template: "supabase" });
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase.from("pupils").insert({ user_id: userId, first_name: firstName, last_initial: lastInitial.toUpperCase(), is_send: isSend, is_eal: isEal, is_pp: isPp });
      if (error) throw error;
      setPupilMessage("✅ Pupil added.");
      setFirstName(""); setLastInitial(""); setIsSend(false); setIsEal(false); setIsPp(false);
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

  // BYOK Handlers
  const handleSaveKey = (e) => {
    e.preventDefault();
    if (!geminiKey.trim()) return;
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    setIsKeySaved(true); setGeminiKey(""); 
  };
  const handleClearKey = () => { localStorage.removeItem("gemini_api_key"); setIsKeySaved(false); };

  // Speech Recognition Handler (Web API)
  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNoteMessage("❌ Voice recognition not supported in this browser. Please type instead.");
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => { setIsRecording(true); setNoteMessage("🎤 Listening..."); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNoteText((prev) => prev + (prev ? " " : "") + transcript);
      setIsRecording(false);
      setNoteMessage("");
    };
    recognition.onerror = () => { setIsRecording(false); setNoteMessage("❌ Mic error. Please type."); };
    recognition.onend = () => { setIsRecording(false); };
    
    recognition.start();
  };

  // The AI Routing Engine
  const handleProcessNote = async () => {
    if (!noteText.trim()) return;
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      setNoteMessage("❌ Please save your Gemini API Key in the System Configuration first.");
      return;
    }
    if (pupils.length === 0 || skills.length === 0) {
      setNoteMessage("❌ You must add at least one pupil and one skill before routing notes.");
      return;
    }

    setIsProcessingNote(true);
    setNoteMessage("🧠 AI is analyzing the note...");

    try {
      // 1. Prepare Context (Strip unneeded data to save tokens)
      const mappedPupils = pupils.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_initial}` }));
      const mappedSkills = skills.map(s => ({ id: s.id, subject: s.subject, skill: s.skill_name }));

      // 2. The Strict JSON Prompt
      const prompt = `
        You are an AI assistant for a teacher. Read the teacher's note and map it to ONE pupil and ONE skill from the provided lists.
        Determine their status: 'Achieved' (mastered/nailed it), 'Practising' (struggling/working on it), or 'Introduced' (started today). Default to 'Practising' if unsure.
        
        Teacher's Note: "${noteText}"
        
        Available Pupils (JSON): ${JSON.stringify(mappedPupils)}
        Available Skills (JSON): ${JSON.stringify(mappedSkills)}
        
        Respond ONLY with a raw, valid JSON object exactly like this (no markdown, no backticks, no extra text):
        {
          "pupil_id": "the-uuid-of-the-pupil",
          "skill_id": "the-uuid-of-the-skill",
          "status": "Practising"
        }
      `;

      // 3. Direct API Call to Google (BYOK)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error("Google AI API rejected the request. Check your API key.");
      const data = await response.json();
      
      // 4. Parse the AI's Response
      const rawText = data.candidates[0].content.parts[0].text.trim();
      const cleanJson = rawText.replace(/```json/g, "").replace(/
