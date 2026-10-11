'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams, useRouter } from 'next/navigation';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const READING_AGES = [
  'Phonics Phase 1', 'Phonics Phase 2', 'Phonics Phase 3', 'Phonics Phase 4',
  'Phonics Phase 5', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'
];

const SUBJECTS = ['maths', 'writing', 'reading', 'spelling', 'times-tables'];

function SortableHeader({ id, skill_name, onSettingsClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border-b border-slate-200 border-r w-24 min-w-[96px] text-center font-bold text-slate-700 bg-slate-50 leading-tight cursor-grab active:cursor-grabbing hover:bg-slate-100 relative z-20 align-bottom group"
    >
      <div className="flex flex-col items-center justify-end gap-1.5 h-full min-h-[60px] relative w-full">
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onSettingsClick(id); }}
          className="absolute top-0 right-0 p-1 text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Column Settings"
        >
          ⚙️
        </button>
        <span className="text-slate-400 text-sm leading-none select-none">⋮⋮</span>
        <span className="whitespace-normal break-words text-[11px] leading-tight px-1 pb-1">
          {skill_name}
        </span>
      </div>
    </th>
  );
}

export default function CommandCenterTab() {
  const { userId } = useAuth();
  const { session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: async (url, options = {}) => {
          try {
            const clerkToken = await session?.getToken({ template: 'supabase' });
            const headers = new Headers(options?.headers);
            if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`);
            return fetch(url, { ...options, headers });
          } catch (err) {
            throw err;
          }
        },
      },
    });
  }, [session]);

  const [activeTab, setActiveTab] = useState('master');
  const [isMounted, setIsMounted] = useState(false);
  
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [isConfirmingDeletePupil, setIsConfirmingDeletePupil] = useState(false);
  const [skillModal, setSkillModal] = useState({ isOpen: false, skill: null, isConfirmingDelete: false });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStatView, setDrawerStatView] = useState('chart'); 
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memoryModal, setMemoryModal] = useState({ isOpen: false, pupilId: null, skillId: null, notes: '', days: '7' });
  const [cellError, setCellError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [columnError, setColumnError] = useState(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newSkillName, setNewSkillName] = useState('');

  const [sweepOverrides, setSweepOverrides] = useState({});

  const initialPupilState = {
    name: '', surname_initial: '', gender: 'Neutral', year_group: '3',
    reading_age: 'Year 3', reading_tier: 'Expected', interests: '',
    is_send: false, send_type: '', is_pp: false, is_eal: false
  };
  const [newPupil, setNewPupil] = useState(initialPupilState);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedPupils = useMemo(() => {
    return [...pupils].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [pupils]);

  const renderPupilName = (pupil) => {
    if (!pupil.name || !pupil.name.trim()) return <span className="text-red-500 italic text-sm">(Unnamed Pupil)</span>;
    return `${pupil.name} ${pupil.surname_initial ? `${pupil.surname_initial}.` : ''}`;
  };

  useEffect(() => {
    setIsMounted(true);
    const qTab = searchParams.get('tab');
    if (qTab && SUBJECTS.includes(qTab)) { setActiveTab(qTab); } 
    else {
      const savedTab = localStorage.getItem('ks2_active_tab');
      if (savedTab) setActiveTab(savedTab);
    }
    if (userId && supabase) fetchDashboardData();
  }, [userId, supabase, searchParams]);

  useEffect(() => {
    if (!isLoading && pupils.length > 0) {
      const qDrawer = searchParams.get('openDrawer');
      if (qDrawer) {
        const pTarget = pupils.find(p => p.id === qDrawer);
        if (pTarget) { setSelectedPupil(pTarget); setIsDrawerOpen(true); }
        router.replace('/dashboard');
      }
    }
  }, [isLoading, pupils, searchParams, router]);

  useEffect(() => {
    if (isMounted) localStorage.setItem('ks2_active_tab', activeTab);
    setNewSkillName(''); setColumnError(null); setCellError(null);
    setMemoryModal({ isOpen: false, pupilId: null, skillId: null, notes: '', days: '7' });
    setSkillModal({ isOpen: false, skill: null, isConfirmingDelete: false });
  }, [activeTab, isMounted]);

  const fetchDashboardData = async () => {
    if (!supabase) return;
    setIsLoading(true);
    const [pupilsRes, skillsRes, progressRes] = await Promise.all([
      supabase.from('pupils').select('*').eq('user_id', userId),
      supabase.from('curriculum_skills').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
      supabase.from('pupil_progress').select('*').eq('user_id', userId)
    ]);
    if (pupilsRes.data) setPupils(pupilsRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (progressRes.data) setProgress(progressRes.data);
    setIsLoading(false);
  };

  const calculateTarget = (pupilId, subject) => {
    const subjectSkills = skills.filter(s => s.subject === subject).sort((a, b) => a.order_index - b.order_index);
    let firstOrange = null;
    let firstDecayingGreen = null;
    const now = new Date();

    for (const skill of subjectSkills) {
      const pData = progress.find(pr => pr.pupil_id === pupilId && pr.skill_id === skill.id);
      if (!pData || pData.status === 'blank') continue; 
      if (pData.status === 'red') return skill.id; 
      if (pData.status === 'orange' && !firstOrange) firstOrange = skill.id;
      if (pData.status === 'green' && pData.next_review_date) {
        if (now >= new Date(pData.next_review_date) && !firstDecayingGreen) firstDecayingGreen = skill.id;
      }
    }
    return firstOrange || firstDecayingGreen || 'all-clear';
  };

  const handleTargetOverride = (pupilId, subject, skillId) => {
    setSweepOverrides(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [subject]: skillId } }));
  };

  const getMorningReviewDate = (daysToAdd) => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(daysToAdd));
    d.setHours(7, 0, 0, 0); 
    return d.toISOString();
  };

  // Phase 2: Click-Cycle Architecture
  const handleCellCycle = async (pupilId, skillId, event) => {
    if (event) event.preventDefault();
    if (!supabase) return;
    setCellError(null);
    
    try {
      const existing = progress.find(p => p.pupil_id === pupilId && p.skill_id === skillId);
      const baseStatus = existing ? existing.status : 'blank';
      
      let isVisuallyBlue = false;
      if (baseStatus === 'green' && existing?.next_review_date) {
        if (new Date().getTime() >= new Date(existing.next_review_date).getTime()) {
          isVisuallyBlue = true;
        }
      }

      let nextStatus;
      let nextReview = null;

      if (isVisuallyBlue) {
        nextStatus = 'green';
        nextReview = getMorningReviewDate(84); // Option B: Reset to 12 weeks
      } else {
        const cycle = { 'blank': 'red', 'red': 'orange', 'orange': 'green', 'green': 'blank' };
        nextStatus = cycle[baseStatus];
        if (nextStatus === 'green') nextReview = getMorningReviewDate(84); // Standard 12 weeks
      }

      const updatedCell = { ...existing, status: nextStatus, last_assessed_at: new Date().toISOString(), next_review_date: nextReview };
      let newProgress = [...progress];
      
      if (existing) {
        newProgress[newProgress.findIndex(p => p.id === existing.id)] = updatedCell;
      } else {
        newProgress.push({ pupil_id: pupilId, skill_id: skillId, status: nextStatus, user_id: userId, id: 'temp-'+Date.now(), last_assessed_at: updatedCell.last_assessed_at, next_review_date: nextReview });
      }
      setProgress(newProgress);

      if (existing) {
        const { error } = await supabase.from('pupil_progress').update({ status: nextStatus, last_assessed_at: updatedCell.last_assessed_at, next_review_date: nextReview }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('pupil_progress').insert([{ user_id: userId, pupil_id: pupilId, skill_id: skillId, status: nextStatus, next_review_date: nextReview }]).select();
        if (error) throw error;
        if (data) setProgress(prev => prev.map(p => (p.pupil_id === pupilId && p.skill_id === skillId) ? data[0] : p));
      }
    } catch (err) { setCellError(`Update failed: ${err.message}`); fetchDashboardData(); }
  };

  const handleRightClick = (e, pupilId, skillId) => {
    e.preventDefault(); setCellError(null);
    const existing = progress.find(p => p.pupil_id === pupilId && p.skill_id === skillId);
    setMemoryModal({ isOpen: true, pupilId, skillId, notes: existing?.memory_notes || '', days: '7' });
  };

  const saveMemoryOverride = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setCellError(null); setIsSaving(true);
    
    try {
      const nextReview = getMorningReviewDate(memoryModal.days); 
      const assessedAt = new Date().toISOString();
      const existing = progress.find(p => p.pupil_id === memoryModal.pupilId && p.skill_id === memoryModal.skillId);
      
      const updatedCell = { ...existing, status: 'green', memory_notes: memoryModal.notes, next_review_date: nextReview, last_assessed_at: assessedAt };
      let newProgress = [...progress];

      if (existing) {
        newProgress[newProgress.findIndex(p => p.id === existing.id)] = updatedCell;
        setProgress(newProgress);
        const { error } = await supabase.from('pupil_progress').update({ status: 'green', memory_notes: memoryModal.notes, next_review_date: nextReview, last_assessed_at: assessedAt }).eq('id', existing.id);
        if (error) throw error;
      } else {
        newProgress.push({ pupil_id: memoryModal.pupilId, skill_id: memoryModal.skillId, status: 'green', user_id: userId, id: 'temp-'+Date.now(), memory_notes: memoryModal.notes, next_review_date: nextReview, last_assessed_at: assessedAt });
        setProgress(newProgress);
        const { data, error } = await supabase.from('pupil_progress').insert([{ user_id: userId, pupil_id: memoryModal.pupilId, skill_id: memoryModal.skillId, status: 'green', memory_notes: memoryModal.notes, next_review_date: nextReview }]).select();
        if (error) throw error;
        if (data) setProgress(prev => prev.map(p => (p.pupil_id === memoryModal.pupilId && p.skill_id === memoryModal.skillId) ? data[0] : p));
      }
      setMemoryModal({ isOpen: false, pupilId: null, skillId: null, notes: '', days: '7' });
    } catch(err) { setCellError(`Override failed: ${err.message}`); fetchDashboardData(); } 
    finally { setIsSaving(false); }
  };

  const handleDeletePupil = async () => {
    if (!supabase || !selectedPupil) return;
    try {
      const { error } = await supabase.from('pupils').delete().eq('id', selectedPupil.id);
      if (error) throw error;
      setPupils(pupils.filter(p => p.id !== selectedPupil.id));
      setProgress(progress.filter(p => p.pupil_id !== selectedPupil.id));
      closeDrawer();
    } catch(err) { setCellError(`Delete failed: ${err.message}`); }
  };

  const handleDeleteSkill = async () => {
    if (!supabase || !skillModal.skill) return;
    try {
      const { error } = await supabase.from('curriculum_skills').delete().eq('id', skillModal.skill.id);
      if (error) throw error;
      setSkills(skills.filter(s => s.id !== skillModal.skill.id));
      setProgress(progress.filter(p => p.skill_id !== skillModal.skill.id));
      setSkillModal({ isOpen: false, skill: null, isConfirmingDelete: false });
    } catch(err) { setColumnError(`Delete failed: ${err.message}`); }
  };

  const openSkillSettings = (skillId) => {
    const targetSkill = skills.find(s => s.id === skillId);
    if (targetSkill) setSkillModal({ isOpen: true, skill: targetSkill, isConfirmingDelete: false });
  };

  const handleAddPupil = async (e) => {
    e.preventDefault();
    if (!newPupil.name || !newPupil.name.trim()) { setSaveError("Pupil must have a valid name."); return; }
    if (!userId || !supabase) return;
    setIsSaving(true); setSaveError(null);
    try {
      const { data, error } = await supabase.from('pupils').insert([{ ...newPupil, name: newPupil.name.trim(), user_id: userId }]).select();
      if (error) throw error;
      if (data) { setPupils([...pupils, data[0]]); closeAddModal(); }
    } catch (error) { setSaveError(error.message); } finally { setIsSaving(false); }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkillName.trim() || !userId || !supabase) return;
    setIsAddingSkill(true); setColumnError(null);
    try {
      const { data, error } = await supabase.from('curriculum_skills').insert([{ user_id: userId, subject: activeTab, skill_name: newSkillName.trim(), order_index: activeSkills.length }]).select();
      if (error) throw error;
      if (data) { setSkills([...skills, data[0]]); setNewSkillName(''); }
    } catch (err) { setColumnError(err.message); } finally { setIsAddingSkill(false); }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !supabase) return;
    setColumnError(null);
    
    const oldIndex = activeSkills.findIndex(s => s.id === active.id);
    const newIndex = activeSkills.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(activeSkills, oldIndex, newIndex);
    
    const updatedSkills = skills.map(skill => {
      const reorderedSkill = newOrder.find(ns => ns.id === skill.id);
      return reorderedSkill ? { ...skill, order_index: newOrder.indexOf(reorderedSkill) } : skill;
    });
    setSkills(updatedSkills);
    
    try {
      for (let i = 0; i < newOrder.length; i++) {
        const { error } = await supabase.from('curriculum_skills').update({ order_index: i }).eq('id', newOrder[i].id);
        if (error) throw error;
      }
    } catch (err) { setColumnError(err.message); fetchDashboardData(); }
  };

  const handleProfileUpdate = async (field, value) => {
    if (!supabase) return;
    const updatedPupil = { ...selectedPupil, [field]: value };
    setSelectedPupil(updatedPupil);
    setPupils(pupils.map(p => p.id === updatedPupil.id ? updatedPupil : p));
    await supabase.from('pupils').update({ [field]: value }).eq('id', updatedPupil.id);
  };

  const openPupilDrawer = (pupil) => { setSelectedPupil(pupil); setDrawerStatView('chart'); setIsDrawerOpen(true); };
  const closeDrawer = () => { setIsDrawerOpen(false); setTimeout(() => { setSelectedPupil(null); setIsConfirmingDeletePupil(false); setDrawerStatView('chart'); }, 300); };
  const closeAddModal = () => { setIsAddModalOpen(false); setSaveError(null); setNewPupil(initialPupilState); };

  const getDrawerStats = () => {
    if (!selectedPupil) return null;
    const pProg = progress.filter(p => p.pupil_id === selectedPupil.id && p.status !== 'blank');
    const totalP = pProg.length;
    const classProg = progress.filter(p => p.status !== 'blank');
    const totalClass = classProg.length;

    const pGreen = totalP === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'green').length / totalP) * 100);
    const pOrange = totalP === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'orange').length / totalP) * 100);
    const pRed = totalP === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'red').length / totalP) * 100);
    const classGreen = totalClass === 0 ? 0 : Math.round((classProg.filter(p => p.status === 'green').length / totalClass) * 100);

    return { pGreen, pOrange, pRed, classGreen, totalP, pProg };
  };

  const drawerStats = getDrawerStats();
  const activeSkills = skills.filter(s => s.subject === activeTab).sort((a, b) => a.order_index - b.order_index);

  // Phase 2: Master Tab Reassessment Audit
  const getBlueCells = () => {
    const blueItems = [];
    sortedPupils.forEach(pupil => {
      const pProg = progress.filter(p => p.pupil_id === pupil.id && p.status === 'green' && p.next_review_date && new Date().getTime() >= new Date(p.next_review_date).getTime());
      if (pProg.length > 0) {
        const topics = pProg.map(pr => {
          const sk = skills.find(s => s.id === pr.skill_id);
          return sk ? `${sk.skill_name} (${sk.subject.toUpperCase()})` : null;
        }).filter(Boolean);
        if (topics.length > 0) blueItems.push({ pupil: pupil.name, topics });
      }
    });
    return blueItems;
  };

  const blueRoster = useMemo(() => getBlueCells(), [progress, sortedPupils, skills]);

  const printRoster = () => {
    const printWin = window.open('', '_blank');
    let html = '<html><head><title>Reassessment Roster</title><style>body{font-family:sans-serif; padding: 20px;} h2{color:#1e3a8a;} .pupil{margin-bottom:15px; border-bottom:1px solid #ccc; padding-bottom:10px;} .pupil h3{margin:0 0 5px 0;} ul{margin:0; padding-left:20px;} li{font-size:14px; margin-bottom:4px;}</style></head><body>';
    html += '<h2>🔄 Memory Reassessment Roster (Decayed Topics)</h2>';
    blueRoster.forEach(item => {
      html += `<div class="pupil"><h3>${item.pupil}</h3><ul>`;
      item.topics.forEach(t => html += `<li>${t}</li>`);
      html += `</ul></div>`;
    });
    html += '</body></html>';
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative min-h-0 w-full">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-col sm:flex-row justify-between sm:items-center shadow-sm z-10 shrink-0 gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">Tactical Command Center</h1>
          <p className="text-xs text-slate-500 font-medium">
            {activeTab === 'master' ? 'Master Staging Area: Ready for Sweep' : `${activeTab.replace('-', ' ').toUpperCase()} Intervention Matrix`}
          </p>
        </div>
        {activeTab === 'master' && (
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all flex justify-center items-center gap-2">
            🚀 Execute Batch Sweep
          </button>
        )}
      </header>

      {cellError && (
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 text-center shrink-0 shadow-inner">
          ⚠️ {cellError}
        </div>
      )}

      <main className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex justify-center items-center flex-1 text-slate-400 font-medium">Loading Database...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 flex-1 flex flex-col min-h-0">
            
            {/* MASTER TAB */}
            {activeTab === 'master' && (
              <div className="flex-1 overflow-auto">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Intervention Targets</p>
                  <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    + Add Pupil
                  </button>
                </div>
                
                {/* Phase 2: Reassessment Roster */}
                {blueRoster.length > 0 && (
                  <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                      <div>
                        <h3 className="font-extrabold text-blue-900 flex items-center gap-2">🔄 Reassessment Roster</h3>
                        <p className="text-xs text-blue-700 font-medium">These topics have reached 0% battery and require a quick verbal check.</p>
                      </div>
                      <button onClick={printRoster} className="text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto">
                        Print Audit Checklist
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {blueRoster.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                          <span className="font-black text-slate-800 text-sm block mb-2">{item.pupil}</span>
                          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                            {item.topics.map((t, i) => <li key={i} className="font-bold">{t}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sortedPupils.length === 0 ? (
                  <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-500 font-medium">No pupils in roster.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedPupils.map(pupil => (
                      <div key={pupil.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                          <button onClick={() => openPupilDrawer(pupil)} className="font-extrabold text-slate-800 hover:text-indigo-600 transition-colors text-left">
                            {renderPupilName(pupil)}
                          </button>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold border border-slate-200">
                            {pupil.reading_age}
                          </span>
                        </div>
                        <div className="space-y-2.5 flex-1">
                          {SUBJECTS.map(sub => {
                            const currentTargetId = sweepOverrides[pupil.id]?.[sub] || calculateTarget(pupil.id, sub);
                            const subSkills = skills.filter(s => s.subject === sub).sort((a,b) => a.order_index - b.order_index);
                            return (
                              <div key={sub} className="flex justify-between items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-wider w-16 shrink-0">
                                  {sub.replace('-', ' ')}
                                </span>
                                <select 
                                  className="flex-1 text-xs p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500 overflow-hidden text-ellipsis"
                                  value={currentTargetId}
                                  onChange={(e) => handleTargetOverride(pupil.id, sub, e.target.value)}
                                >
                                  <option value="all-clear">✅ No Intervention</option>
                                  {subSkills.map(s => (
                                    <option key={s.id} value={s.id}>{s.skill_name}</option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBJECT MATRIX TAB */}
            {activeTab !== 'master' && (
              <div className="h-full flex flex-col flex-1 min-h-0">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 shrink-0">
                  <h2 className="text-lg font-bold text-slate-800 capitalize mt-2">{activeTab.replace('-', ' ')}</h2>
                  <div className="flex flex-col items-end w-full sm:w-auto">
                    <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <input type="text" required value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="New Column (e.g. Fractions)" className="border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-full sm:w-64" />
                      <button type="submit" disabled={isAddingSkill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:bg-indigo-400 w-full sm:w-auto whitespace-nowrap">
                        {isAddingSkill ? '...' : '+ Add Column'}
                      </button>
                    </form>
                    {columnError && (
                      <div className="text-red-600 text-xs font-bold mt-2 bg-red-50 px-3 py-1.5 rounded border border-red-100 w-full text-center sm:text-right">
                        🚨 {columnError}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm relative min-h-0">
                  {sortedPupils.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Add pupils in the Master Tab to populate this grid.</div>
                  ) : activeSkills.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">Use the "+ Add Column" button above to build your {activeTab} curriculum.</div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                          <tr>
                            <th className="p-3 border-b border-slate-200 border-r w-auto whitespace-nowrap pr-6 font-extrabold text-slate-700 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] sticky left-0 z-40 align-bottom pb-2">
                              Class Roster
                            </th>
                            <SortableContext items={activeSkills.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                              {activeSkills.map(skill => (
                                <SortableHeader key={skill.id} id={skill.id} skill_name={skill.skill_name} onSettingsClick={openSkillSettings} />
                              ))}
                            </SortableContext>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPupils.map(pupil => (
                            <tr key={pupil.id} className="hover:bg-slate-50 transition-colors group/row">
                              <td className="p-3 border-b border-slate-200 border-r bg-white group-hover/row:bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-auto whitespace-nowrap pr-6">
                                <button onClick={() => openPupilDrawer(pupil)} className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors text-left w-full">
                                  {renderPupilName(pupil)}
                                </button>
                              </td>
                              {activeSkills.map(skill => {
                                const cellData = progress.find(p => p.pupil_id === pupil.id && p.skill_id === skill.id);
                                const baseStatus = cellData ? cellData.status : 'blank';
                                
                                // Phase 2: Depletion Engine Math
                                let visualStatus = baseStatus;
                                let fillPercentage = 100;

                                if (baseStatus === 'green' && cellData?.last_assessed_at && cellData?.next_review_date) {
                                  const start = new Date(cellData.last_assessed_at).getTime();
                                  const end = new Date(cellData.next_review_date).getTime();
                                  const now = new Date().getTime();

                                  if (now >= end) {
                                    visualStatus = 'blue';
                                    fillPercentage = 0;
                                  } else {
                                    const totalDuration = end - start;
                                    const elapsed = now - start;
                                    const drainPct = (elapsed / totalDuration) * 100;
                                    fillPercentage = Math.max(0, 100 - drainPct);
                                  }
                                }

                                let bgClass = 'bg-slate-50 hover:bg-slate-100 border-slate-200 group-hover/row:border-slate-300';
                                let innerFill = null;

                                if (visualStatus === 'red') bgClass = 'bg-red-500 hover:bg-red-600 border-red-600 shadow-inner';
                                if (visualStatus === 'orange') bgClass = 'bg-amber-400 hover:bg-amber-500 border-amber-500 shadow-inner';
                                if (visualStatus === 'blue') bgClass = 'bg-blue-500 hover:bg-blue-600 border-blue-600 shadow-inner';
                                
                                if (visualStatus === 'green') {
                                  if (fillPercentage >= 80) {
                                    bgClass = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 shadow-inner';
                                  } else {
                                    // Liquid Drain UI Architecture
                                    bgClass = 'bg-slate-50 border-emerald-600 shadow-inner relative overflow-hidden group/cell';
                                    innerFill = <div className="absolute bottom-0 left-0 w-full bg-emerald-400 group-hover/cell:bg-emerald-500 transition-colors" style={{ height: `${fillPercentage}%` }}></div>;
                                  }
                                }

                                return (
                                  <td key={`${pupil.id}-${skill.id}`} className="p-1 border-b border-slate-200 border-r text-center align-middle">
                                    <div className="flex items-center justify-center relative">
                                      <button 
                                        onClick={(e) => handleCellCycle(pupil.id, skill.id, e)} 
                                        onContextMenu={(e) => handleRightClick(e, pupil.id, skill.id)}
                                        className={`w-8 h-8 rounded-sm transition-all border shadow-sm relative block ${bgClass}`}
                                      >
                                        {innerFill}
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </DndContext>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="shrink-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="grid grid-flow-col auto-cols-[minmax(95px,1fr)] w-full overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`nav div::-webkit-scrollbar { display: none; }`}</style>
          
          {[
            { id: 'master', label: 'Master', icon: '🎯' },
            { id: 'maths', label: 'Maths', icon: '➗' },
            { id: 'writing', label: 'Writing', icon: '✍️' },
            { id: 'reading', label: 'Reading', icon: '📖' },
            { id: 'spelling', label: 'Spelling', icon: '🔤' },
            { id: 'times-tables', label: 'Times Tables', icon: '✖️' }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`py-3.5 flex flex-col items-center gap-1 border-t-2 transition-all ${
                activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-bold whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* 1. Memory Override Modal */}
      {memoryModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">🧠 Memory Override</h3>
              <button onClick={() => setMemoryModal({...memoryModal, isOpen: false})} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={saveMemoryOverride} className="flex flex-col">
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-tight">
                  Manually force this cell to Green (Mastered) and set a custom decay timer. It will trigger at 7:00 AM on the target day.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trigger ⏱️ Review In:</label>
                  <select value={memoryModal.days} onChange={(e) => setMemoryModal({...memoryModal, days: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="1">1 Day (Severe Struggle)</option>
                    <option value="7">1 Week (Standard Anchor)</option>
                    <option value="28">4 Weeks (Term Check)</option>
                    <option value="84">12 Weeks (Deep Retrieval)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Specific Struggle Notes</label>
                  <textarea rows="3" value={memoryModal.notes} onChange={(e) => setMemoryModal({...memoryModal, notes: e.target.value})} placeholder="e.g. Mixed up the denominator." className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
                <button type="button" onClick={() => setMemoryModal({...memoryModal, isOpen: false})} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="submit" disabled={isSaving} className={`px-4 py-2 text-white rounded-lg text-sm font-bold transition-colors ${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Set Timer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Column Deletion Modal */}
      {skillModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">⚙️ Column Settings</h3>
              <button onClick={() => setSkillModal({ isOpen: false, skill: null, isConfirmingDelete: false })} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Column Name</label>
                <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                  {skillModal.skill?.skill_name}
                </div>
              </div>
              <div className="pt-4 border-t border-red-100">
                {!skillModal.isConfirmingDelete ? (
                  <button onClick={() => setSkillModal({ ...skillModal, isConfirmingDelete: true })} className="w-full py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">
                    Delete Entire Column
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleDeleteSkill} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                      Confirm Erase
                    </button>
                    <button onClick={() => setSkillModal({ ...skillModal, isConfirmingDelete: false })} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add Pupil Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-lg text-slate-800">Add New Pupil</h3>
              <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            <form id="add-pupil-form" onSubmit={handleAddPupil} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-5">
                {saveError && <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-lg text-sm font-medium">🚨 {saveError}</div>}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                    <input type="text" value={newPupil.name} onChange={(e) => setNewPupil({...newPupil, name: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Leo" />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Initial</label>
                    <input type="text" maxLength="1" value={newPupil.surname_initial} onChange={(e) => setNewPupil({...newPupil, surname_initial: e.target.value.toUpperCase()})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-center" placeholder="M" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select value={newPupil.gender} onChange={(e) => setNewPupil({...newPupil, gender: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral/Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Year Group</label>
                    <select value={newPupil.year_group} onChange={(e) => setNewPupil({...newPupil, year_group: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                      {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Reading Age</label>
                    <select value={newPupil.reading_age} onChange={(e) => setNewPupil({...newPupil, reading_age: e.target.value})} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1">Reading Tier</label>
                    <select value={newPupil.reading_tier} onChange={(e) => setNewPupil({...newPupil, reading_tier: e.target.value})} className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="Working Towards">Working Towards (WTS)</option><option value="Expected">Expected (EXP)</option><option value="Higher">Higher / Greater Depth (GDS)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">3 Key Interests</label>
                  <input type="text" value={newPupil.interests} onChange={(e) => setNewPupil({...newPupil, interests: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Minecraft, football, baking" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_send} onChange={(e) => setNewPupil({...newPupil, is_send: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">SEND</span></label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_eal} onChange={(e) => setNewPupil({...newPupil, is_eal: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">EAL</span></label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"><input type="checkbox" checked={newPupil.is_pp} onChange={(e) => setNewPupil({...newPupil, is_pp: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" /><span className="text-xs font-bold text-slate-700">PP</span></label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
                <button type="button" onClick={closeAddModal} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="submit" disabled={isSaving} className={`px-5 py-2.5 text-white rounded-lg text-sm font-bold transition-colors ${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{isSaving ? 'Saving...' : 'Save Pupil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. WIDENED 2-COLUMN PUPIL PROFILE DRAWER */}
      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={closeDrawer}></div>
      <div className={`fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedPupil && drawerStats && (
          <div className="p-6 flex flex-col h-full bg-slate-50">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
              <div className="flex gap-2 items-center flex-1">
                <input 
                  type="text" 
                  value={selectedPupil.name || ''} 
                  onChange={(e) => handleProfileUpdate('name', e.target.value)}
                  className="text-3xl font-extrabold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 w-full max-w-[200px] transition-colors"
                  placeholder="First Name"
                />
                <input 
                  type="text" 
                  maxLength="1"
                  value={selectedPupil.surname_initial || ''} 
                  onChange={(e) => handleProfileUpdate('surname_initial', e.target.value.toUpperCase())}
                  className="text-3xl font-extrabold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 w-12 text-center transition-colors"
                  placeholder="Initial"
                />
              </div>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 font-black text-2xl shrink-0">&times;</button>
            </div>
            
            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* LEFT COLUMN */}
              <div className="w-1/2 space-y-6 overflow-y-auto pr-2">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wider flex items-center gap-2">📖 Reading Engine Calibration</h3>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Reading Age</label>
                    <select value={selectedPupil.reading_age || 'Year 3'} onChange={(e) => handleProfileUpdate('reading_age', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                      {READING_AGES.map(age => <option key={age} value={age}>{age}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Mastery Tier</label>
                    <select value={selectedPupil.reading_tier || 'Expected'} onChange={(e) => handleProfileUpdate('reading_tier', e.target.value)} className="w-full p-2.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                      <option value="Working Towards">Working Towards (WTS)</option><option value="Expected">Expected (EXP)</option><option value="Higher">Higher / Greater Depth (GDS)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-2">Context Variables</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Gender</label>
                      <select value={selectedPupil.gender || 'Neutral'} onChange={(e) => handleProfileUpdate('gender', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                        <option value="Boy">Boy</option><option value="Girl">Girl</option><option value="Neutral">Neutral/Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Year Group</label>
                      <select value={selectedPupil.year_group || '3'} onChange={(e) => handleProfileUpdate('year_group', e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                        {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>Year {y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">3 Key Interests</label>
                    <input type="text" value={selectedPupil.interests || ''} onChange={(e) => handleProfileUpdate('interests', e.target.value)} placeholder="e.g. Minecraft, football..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_pp || false} onChange={(e) => handleProfileUpdate('is_pp', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">Pupil Premium</span></label>
                    <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"><input type="checkbox" checked={selectedPupil.is_eal || false} onChange={(e) => handleProfileUpdate('is_eal', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">EAL</span></label>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={selectedPupil.is_send || false} onChange={(e) => handleProfileUpdate('is_send', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" /><span className="text-sm font-bold text-slate-700">SEND Support</span></label>
                    {selectedPupil.is_send && <input type="text" value={selectedPupil.send_type || ''} onChange={(e) => handleProfileUpdate('send_type', e.target.value)} placeholder="Specify need (e.g. Dyslexia, ADHD...)" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />}
                  </div>
                </div>

                <div className="pt-4 border-t border-red-100 shrink-0">
                  {!isConfirmingDeletePupil ? (
                    <button onClick={() => setIsConfirmingDeletePupil(true)} className="w-full py-3 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors">
                      Delete Pupil
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleDeletePupil} className="flex-1 py-3 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">
                        Confirm Delete
                      </button>
                      <button onClick={() => setIsConfirmingDeletePupil(false)} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-900 flex justify-between items-center shrink-0">
                  <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">📊 Mastery Profile</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded">Based on {drawerStats.totalP} marked topics</span>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-8 overflow-y-auto">
                  {drawerStatView === 'chart' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Comparative Benchmark</span>
                        <span className="text-2xl font-black text-emerald-500 leading-none">{drawerStats.pGreen}% Green</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                            <span>{selectedPupil.name}</span>
                            <span>{drawerStats.pGreen}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{width: `${drawerStats.pGreen}%`}}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>Class Average</span>
                            <span>{drawerStats.classGreen}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-slate-300 h-full rounded-full transition-all duration-500" style={{width: `${drawerStats.classGreen}%`}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-48 border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                       <div className={`px-4 py-2 flex justify-between items-center text-white ${drawerStatView === 'green' ? 'bg-emerald-500' : drawerStatView === 'orange' ? 'bg-amber-400' : 'bg-red-500'}`}>
                         <h4 className="text-xs font-black uppercase tracking-wider">{drawerStatView} Topics</h4>
                         <button onClick={() => setDrawerStatView('chart')} className="text-xs font-bold hover:underline opacity-90 hover:opacity-100">← Back to Chart</button>
                       </div>
                       <div className="overflow-y-auto p-2 bg-slate-50 flex-1">
                          {drawerStats.pProg.filter(p => p.status === drawerStatView).length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 text-center p-4">No topics in this tier.</p>
                          ) : (
                            drawerStats.pProg.filter(p => p.status === drawerStatView).map(prog => {
                               const sk = skills.find(s => s.id === prog.skill_id);
                               return sk ? (
                                 <div key={sk.id} className="text-sm font-bold text-slate-700 p-2 border-b border-slate-100 last:border-0 flex justify-between items-center">
                                   <span>{sk.skill_name}</span>
                                   <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">{sk.subject}</span>
                                 </div>
                               ) : null;
                            })
                          )}
                       </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-6 flex flex-col items-center flex-1 justify-center relative">
                    <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest absolute top-4">Click slice to view topics</p>
                    {drawerStats.totalP === 0 ? (
                      <p className="text-slate-300 font-bold text-sm">No Assessment Data</p>
                    ) : (
                      <svg viewBox="0 0 36 36" className="w-40 h-40 drop-shadow-sm mt-4">
                         <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4"></circle>
                         {drawerStats.pGreen > 0 && <circle onClick={() => setDrawerStatView('green')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={`${drawerStats.pGreen} ${100 - drawerStats.pGreen}`} strokeDashoffset="25" className="cursor-pointer hover:stroke-emerald-400 transition-colors"></circle>}
                         {drawerStats.pOrange > 0 && <circle onClick={() => setDrawerStatView('orange')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${drawerStats.pOrange} ${100 - drawerStats.pOrange}`} strokeDashoffset={(100 - drawerStats.pGreen) + 25} className="cursor-pointer hover:stroke-amber-300 transition-colors"></circle>}
                         {drawerStats.pRed > 0 && <circle onClick={() => setDrawerStatView('red')} cx="18" cy="18" r="15.915" fill="transparent" stroke="#ef4444" strokeWidth="4" strokeDasharray={`${drawerStats.pRed} ${100 - drawerStats.pRed}`} strokeDashoffset={(100 - drawerStats.pGreen - drawerStats.pOrange) + 25} className="cursor-pointer hover:stroke-red-400 transition-colors"></circle>}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
