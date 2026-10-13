'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link'; // Added for seamless routing to the Reporting Hub

export default function PupilDrawer({
  isDrawerOpen, closeDrawer, selectedPupil, handleProfileUpdate,
  drawerStats, drawerStatView, setDrawerStatView, skills,
  isConfirmingDeletePupil, setIsConfirmingDeletePupil, handleDeletePupil, READING_AGES,
  supabase, userId
}) {
  const [expandedSections, setExpandedSections] = useState({
    reporting: true, // New reporting panel defaults to open
    reading: true,
    context: true,
    mastery: true,
    notes: true
  });

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [noteSearch, setNoteSearch] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Drawer-specific Voice Engine State
  const [drawerRecognition, setDrawerRecognition] = useState(null);
  const [isDrawerListening, setIsDrawerListening] = useState(false);
  const [drawerPendingAction, setDrawerPendingAction] = useState(null);
  const [drawerToast, setDrawerToast] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('ks2_drawer_prefs');
    if (saved) {
      try { setExpandedSections(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (selectedPupil && supabase) {
      fetchNotes();
    }
  }, [selectedPupil, supabase]);

  // Initialize Local Dictation Engine
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-GB';
        setDrawerRecognition(rec);
      }
    }
  }, []);

  // Map the Voice Routing Logic (Using dependencies to avoid stale state)
  useEffect(() => {
    if (!drawerRecognition) return;

    drawerRecognition.onstart = () => setIsDrawerListening(true);
    drawerRecognition.onend = () => setIsDrawerListening(false);
    
    drawerRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      const action = async () => {
        const { data, error } = await supabase.from('pupil_notes').insert([{
          user_id: userId,
          pupil_id: selectedPupil.id,
          content: `🗣️ Dictated: ${transcript}`,
          category: noteCategory
        }]).select();

        if (data && !error) {
          setNotes(prev => [data[0], ...prev]);
        }
      };
      
      setDrawerPendingAction({ action, message: `📝 Queuing dictated ${noteCategory} note...` });
    };
  }, [drawerRecognition, noteCategory, selectedPupil, supabase, userId]);

  // The 3-Second Holding Queue Timer
  useEffect(() => {
    if (drawerPendingAction) {
      const timer = setTimeout(() => {
        drawerPendingAction.action();
        setDrawerPendingAction(null);
        setDrawerToast("✅ Dictated note saved.");
        setTimeout(() => setDrawerToast(null), 2500);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [drawerPendingAction]);

  const toggleDrawerDictation = (e) => {
    e.preventDefault();
    if (!drawerRecognition) {
      alert("Voice dictation is not supported in this browser. Please use Chrome.");
      return;
    }
    isDrawerListening ? drawerRecognition.stop() : drawerRecognition.start();
  };

  const toggleSection = (section) => {
    const newState = { ...expandedSections, [section]: !expandedSections[section] };
    setExpandedSections(newState);
    localStorage.setItem('ks2_drawer_prefs', JSON.stringify(newState));
  };

  const fetchNotes = async () => {
    if (!supabase || !selectedPupil) return;
    const { data } = await supabase
      .from('pupil_notes')
      .select('*')
      .eq('pupil_id', selectedPupil.id)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !supabase || !userId) return;
    setIsSavingNote(true);
    
    const { data, error } = await supabase.from('pupil_notes').insert([{
      user_id: userId,
      pupil_id: selectedPupil.id,
      content: newNote.trim(),
      category: noteCategory
    }]).select();

    if (data && !error) {
      setNotes([data[0], ...notes]);
      setNewNote('');
    }
    setIsSavingNote(false);
  };

  const handleDeleteNote = async (noteId) => {
    if (!supabase) return;
    await supabase.from('pupil_notes').delete().eq('id', noteId);
    setNotes(notes.filter(n => n.id !== noteId));
  };

  const handleUpdateCategory = async (noteId, newCategory) => {
    if (!supabase) return;
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, category: newCategory } : n));
    await supabase.from('pupil_notes').update({ category: newCategory }).eq('id', noteId);
  };

  const filteredNotes = notes.filter(n => 
    n.content.toLowerCase().includes(noteSearch.toLowerCase()) || 
    n.category.toLowerCase().includes(noteSearch.toLowerCase())
  );

  const renderSubjectBars = () => {
    if (!drawerStats || !drawerStats.pProg) return null;
    const SUBJECTS = [
      { key: 'maths', label: 'Mathematics' },
      { key: 'reading', label: 'Reading' },
      { key: 'writing', label: 'Writing' },
      { key: 'spelling', label: 'Spelling' },
      { key: 'times-tables', label: 'Times Tables' }
    ];

    return SUBJECTS.map(sub => {
      const subSkills = skills.filter(s => s.subject === sub.key);
      const subSkillIds = subSkills.map(s => s.id);
      const subProg = drawerStats.pProg.filter(p => subSkillIds.includes(p.skill_id) && p.status !== 'blank');
      const total = subProg.length;
      
      if (total === 0) return null;

      const green = Math.round((subProg.filter(p => p.status === 'green').length / total) * 100);
      const orange = Math.round((subProg.filter(p => p.status === 'orange').length / total) * 100);
      const red = Math.round((subProg.filter(p => p.status === 'red').length / total) * 100);

      return (
        <div key={sub.key} className="mb-3 border border-slate-100 p-3 rounded-lg bg-slate-50 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold mb-2">
            <span className="text-slate-800">{sub.label}</span>
            <span className="text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">{total} Topics</span>
          </div>
          <div className="flex h-2.5 bg-slate-200 rounded-full overflow-hidden mb-1.5 shadow-inner">
            {green > 0 && <div className="bg-emerald-500" style={{ width: `${green}%` }}></div>}
            {orange > 0 && <div className="bg-amber-400" style={{ width: `${orange}%` }}></div>}
            {red > 0 && <div className="bg-red-500" style={{ width: `${red}%` }}></div>}
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
            <span className="text-emerald-600">{green}%</span>
            <span className="text-amber-500">{orange}%</span>
            <span className="text-red-500">{red}%</span>
          </div>
        </div>
      );
    });
  };

  if (!selectedPupil) return null;

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeDrawer}></div>
      
      <div className={`absolute top-0 right-0 h-full w-[75vw] max-w-none bg-slate-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {selectedPupil.name} {selectedPupil.surname_initial ? `${selectedPupil.surname_initial}.` : ''}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pupil Intervention Profile</p>
          </div>
          <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start content-start">
          
          {/* 0. REPORTING QUICK-LINKS (NEW) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm lg:col-span-2">
            <button onClick={() => toggleSection('reporting')} className="w-full px-5 py-3.5 bg-purple-50/50 hover:bg-purple-50 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-purple-900">
                <span>📋</span> AI Reporting Actions
              </div>
              <span className={`transform transition-transform text-purple-400 text-xs ${expandedSections.reporting ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.reporting && (
              <div className="p-4 border-t border-purple-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
                 <Link href={`/dashboard/reporting/parents-evening?pupilId=${selectedPupil.id}`} className="w-full py-3 px-4 bg-white border-2 border-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:border-purple-300 hover:bg-purple-50 transition-all flex flex-col gap-1 items-start group">
                   <span className="flex items-center gap-2 text-base"><span>👥</span> Parents' Evening Snapshot</span>
                   <span className="text-xs font-semibold text-purple-400 group-hover:text-purple-600 transition-colors">Open Workspace →</span>
                 </Link>
                 <Link href={`/dashboard/reporting/end-of-year?pupilId=${selectedPupil.id}`} className="w-full py-3 px-4 bg-white border-2 border-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:border-emerald-300 hover:bg-emerald-50 transition-all flex flex-col gap-1 items-start group">
                   <span className="flex items-center gap-2 text-base"><span>🎓</span> End of Year Report</span>
                   <span className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-600 transition-colors">Open Workspace →</span>
                 </Link>
                 <Link href={`/dashboard/reporting/send-plans?pupilId=${selectedPupil.id}`} className="w-full py-3 px-4 bg-white border-2 border-amber-100 text-amber-700 rounded-xl text-sm font-bold hover:border-amber-300 hover:bg-amber-50 transition-all flex flex-col gap-1 items-start group">
                   <span className="flex items-center gap-2 text-base"><span>🎯</span> SEND SMART Plan</span>
                   <span className="text-xs font-semibold text-amber-400 group-hover:text-amber-600 transition-colors">Open Workspace →</span>
                 </Link>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('reading')} className="w-full px-5 py-3.5 bg-indigo-50/50 hover:bg-indigo-50 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-indigo-900">
                <span>📖</span> Reading Engine Calibration
              </div>
              <span className={`transform transition-transform text-indigo-400 text-xs ${expandedSections.reading ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.reading && (
              <div className="p-5 border-t border-indigo-100 space-y-4 bg-white">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Reading Age</label>
                  <select value={selectedPupil.reading_age || 'Year 3'} onChange={(e) => handleProfileUpdate('reading_age', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500">
                    {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comprehension Tier</label>
                  <select value={selectedPupil.reading_tier || 'Expected'} onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500">
                    <option value="Working Towards">Working Towards (WTS)</option>
                    <option value="Expected">Expected (EXP)</option>
                    <option value="Higher">Higher Depth (GDS)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('context')} className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <span>⚙️</span> Context Variables
              </div>
              <span className={`transform transition-transform text-slate-400 text-xs ${expandedSections.context ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.context && (
              <div className="p-5 border-t border-slate-200 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
                    <select value={selectedPupil.gender} onChange={(e) => handleProfileUpdate('gender', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold">
                      <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Year</label>
                    <select value={selectedPupil.year_group} onChange={(e) => handleProfileUpdate('year_group', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold">
                      {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Personal Interests (For AI Context)</label>
                  <input type="text" value={selectedPupil.interests || ''} onChange={(e) => handleProfileUpdate('interests', e.target.value)} className="w-full p-2 border border-slate-200 rounded text-sm font-semibold" placeholder="e.g. Minecraft, Dinosaurs" />
                </div>
                <div className="flex gap-2 justify-between">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_send ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_send} onChange={(e) => handleProfileUpdate('is_send', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">SEND</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_eal ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_eal} onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">EAL</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-2 border rounded cursor-pointer transition-colors ${selectedPupil.is_pp ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={selectedPupil.is_pp} onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)} className="hidden" />
                    <span className="text-xs font-bold">PP</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('mastery')} className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-slate-800">
                <span>🎯</span> Mastery Profile
              </div>
              <span className={`transform transition-transform text-slate-400 text-xs ${expandedSections.mastery ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.mastery && drawerStats && (
              <div className="p-5 border-t border-slate-200 bg-white">
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setDrawerStatView('chart')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${drawerStatView === 'chart' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                    Global Overview
                  </button>
                  <button onClick={() => setDrawerStatView('list')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${drawerStatView === 'list' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                    Subject Breakdown
                  </button>
                </div>
                
                {drawerStatView === 'chart' ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-emerald-600">Mastered (Green)</span><span>{drawerStats.pGreen}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${drawerStats.pGreen}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-amber-500">Developing (Orange)</span><span>{drawerStats.pOrange}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${drawerStats.pOrange}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1"><span className="text-red-500">Struggling (Red)</span><span>{drawerStats.pRed}%</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${drawerStats.pRed}%` }}></div></div>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto pr-1">
                    {renderSubjectBars()}
                    {drawerStats.pProg.length === 0 && <p className="text-center text-xs text-slate-400 font-bold py-4">No topics assessed yet.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={() => toggleSection('notes')} className="w-full px-5 py-3.5 bg-sky-50/50 hover:bg-sky-50 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-sky-900">
                <span>📝</span> Observation Notes
              </div>
              <span className={`transform transition-transform text-sky-400 text-xs ${expandedSections.notes ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expandedSections.notes && (
              <div className="p-5 border-t border-sky-100 bg-white flex flex-col gap-4">
                
                <form onSubmit={handleAddNote} className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-inner">
                  <div className="relative">
                    <textarea 
                      value={newNote} 
                      onChange={(e) => setNewNote(e.target.value)} 
                      placeholder="Type a note, or click the mic to dictate instantly..." 
                      className="w-full p-3 pr-14 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 resize-none bg-white"
                      rows="2"
                    ></textarea>
                    
                    <button 
                      type="button"
                      onClick={toggleDrawerDictation}
                      className={`absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 rounded border transition-all ${isDrawerListening ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'}`}
                      title="Dictate Note (Auto-Saves)"
                    >
                      🎙️
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center gap-2">
                    <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 bg-white">
                      <option value="General">General</option>
                      <option value="Academic">Academic</option>
                      <option value="Behavior">Behavior</option>
                      <option value="Parent Contact">Parent Contact</option>
                      <option value="SEND / Intervention">SEND / Intervention</option>
                    </select>
                    <button type="submit" disabled={isSavingNote || !newNote.trim()} className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                      {isSavingNote ? 'Saving...' : 'Save Typed Note'}
                    </button>
                  </div>
                </form>

                <div className="relative">
                  <input 
                    type="text" 
                    value={noteSearch} 
                    onChange={(e) => setNoteSearch(e.target.value)} 
                    placeholder="🔍 Search notes by keyword or category..." 
                    className="w-full p-2.5 pl-9 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                  {filteredNotes.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 font-bold py-8 border-2 border-dashed border-slate-100 rounded-lg">No notes found.</p>
                  ) : (
                    filteredNotes.map(note => (
                      <div key={note.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm relative group hover:border-sky-200 transition-colors">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          
                          <select 
                            value={note.category}
                            onChange={(e) => handleUpdateCategory(note.id, e.target.value)}
                            className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 cursor-pointer hover:bg-sky-100 focus:ring-2 focus:ring-sky-500 outline-none transition-colors"
                          >
                            <option value="General">General</option>
                            <option value="Academic">Academic</option>
                            <option value="Behavior">Behavior</option>
                            <option value="Parent Contact">Parent Contact</option>
                            <option value="SEND / Intervention">SEND / Intervention</option>
                          </select>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">
                              {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button onClick={() => handleDeleteNote(note.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Note">
                              ✕
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
        </div>

        {/* 2. THE 3-SECOND DRAWER TOAST HOLDING QUEUE */}
        {(drawerPendingAction || drawerToast) && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 z-50 transition-all border border-slate-700">
            <span className="font-bold text-sm">{drawerPendingAction ? drawerPendingAction.message : drawerToast}</span>
            {drawerPendingAction && (
              <button 
                onClick={() => { setDrawerPendingAction(null); setDrawerToast("🚫 Note cancelled."); setTimeout(() => setDrawerToast(null), 2500); }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
              >
                Undo
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0">
          {!isConfirmingDeletePupil ? (
            <button onClick={() => setIsConfirmingDeletePupil(true)} className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">
              Remove Pupil from Roster
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleDeletePupil} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                Confirm Removal
              </button>
              <button onClick={() => setIsConfirmingDeletePupil(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
