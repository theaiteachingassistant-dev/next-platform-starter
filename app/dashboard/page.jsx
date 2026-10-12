'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGeneration } from '../../context/GenerationContext';

import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import MasterTab from './components/MasterTab';
import SubjectMatrix from './components/SubjectMatrix';
import PupilDrawer from './components/PupilDrawer';
import ExecutionModal from './components/ExecutionModal';
import ExportModal from './components/ExportModal';

const READING_AGES = [
  'Phonics Phase 1', 'Phonics Phase 2', 'Phonics Phase 3', 'Phonics Phase 4',
  'Phonics Phase 5', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'
];

const SUBJECTS = ['maths', 'writing', 'reading', 'spelling', 'times-tables'];

function CommandCenterContent() {
  const { userId } = useAuth();
  const { session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addBatchToQueue, isProcessing } = useGeneration();
  
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [isMounted, setIsMounted] = useState(false);
  
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [isConfirmingDeletePupil, setIsConfirmingDeletePupil] = useState(false);
  const [skillModal, setSkillModal] = useState({ isOpen: false, skill: null, isConfirmingDelete: false });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStatView, setDrawerStatView] = useState('chart'); 
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memoryModal, setMemoryModal] = useState({ isOpen: false, pupilId: null, skillId: null, notes: '', days: '7' });
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
  const [selectedForSweep, setSelectedForSweep] = useState(new Set());

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
    const now = new Date();

    if (activeFilter !== 'all') {
      const targetCell = subjectSkills.find(skill => {
        const pData = progress.find(pr => pr.pupil_id === pupilId && pr.skill_id === skill.id);
        if (!pData) return false;
        if (activeFilter === 'blue') return pData.status === 'green' && pData.next_review_date && now >= new Date(pData.next_review_date);
        return pData.status === activeFilter;
      });
      return targetCell ? targetCell.id : 'all-clear';
    }

    let firstOrange = null;
    let firstDecayingGreen = null;
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
        nextReview = getMorningReviewDate(84); 
      } else {
        const cycle = { 'blank': 'red', 'red': 'orange', 'orange': 'green', 'green': 'blank' };
        nextStatus = cycle[baseStatus];
        if (nextStatus === 'green') nextReview = getMorningReviewDate(84); 
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

  const getBlueCells = () => {
    const blueItems = [];
    sortedPupils.forEach(pupil => {
      const pProg = progress.filter(p => p.pupil_id === pupil.id && p.status === 'green' && p.next_review_date && new Date().getTime() >= new Date(p.next_review_date).getTime());
      if (pProg.length > 0) {
        const blueSkillIds = [];
        const topics = pProg.map(pr => {
          const sk = skills.find(s => s.id === pr.skill_id);
          if (sk) {
            blueSkillIds.push(sk.id);
            return `${sk.skill_name} (${sk.subject.toUpperCase()})`;
          }
          return null;
        }).filter(Boolean);
        if (topics.length > 0) blueItems.push({ pupilId: pupil.id, pupil: pupil.name, topics, blueSkillIds });
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

  const toggleSelectPupil = (pupilId) => {
    const newSet = new Set(selectedForSweep);
    if (newSet.has(pupilId)) newSet.delete(pupilId);
    else newSet.add(pupilId);
    setSelectedForSweep(newSet);
  };

  const toggleSelectAll = (customList) => {
    const listToUse = (customList && Array.isArray(customList)) ? customList : sortedPupils;
    const ids = listToUse.map(p => p.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedForSweep.has(id));
    
    if (allSelected) {
      const newSet = new Set(selectedForSweep);
      ids.forEach(id => newSet.delete(id));
      setSelectedForSweep(newSet);
    } else {
      const newSet = new Set(selectedForSweep);
      ids.forEach(id => newSet.add(id));
      setSelectedForSweep(newSet);
    }
  };

  const executeBatchSweep = (subjectScope = 'all') => {
    if (selectedForSweep.size === 0 || isProcessing) return;
    
    const batch = Array.from(selectedForSweep).map(pupilId => {
      const pupil = pupils.find(p => p.id === pupilId);
      const mappedTopics = {};
      
      const targetSubjects = subjectScope === 'all' ? SUBJECTS : [subjectScope];

      targetSubjects.forEach(sub => {
        const targetId = sweepOverrides[pupilId]?.[sub] || calculateTarget(pupilId, sub);
        if (targetId === 'all-clear') {
          mappedTopics[sub.replace('-', '_')] = 'General mixed revision covering KS2 basics.';
        } else {
          const sk = skills.find(s => s.id === targetId);
          mappedTopics[sub.replace('-', '_')] = sk ? sk.skill_name : 'General mixed revision';
        }
      });

      return { pupil, topics: mappedTopics, isTestMode: false };
    });

    addBatchToQueue(batch);
    setSelectedForSweep(new Set());
    setIsExecutionModalOpen(false);
  };

  const executeReassessmentSweep = () => {
    if (blueRoster.length === 0 || isProcessing) return;

    const batch = blueRoster.map(item => {
      const pupil = pupils.find(p => p.id === item.pupilId);
      const mappedTopics = {};
      
      SUBJECTS.forEach(sub => {
        const subSkills = item.blueSkillIds.map(id => skills.find(s => s.id === id)).filter(s => s && s.subject === sub);
        if (subSkills.length > 0) {
          mappedTopics[sub.replace('-', '_')] = subSkills.map(s => s.skill_name).join(', ');
        } else {
          mappedTopics[sub.replace('-', '_')] = 'General mixed revision covering KS2 basics.';
        }
      });

      return { pupil, topics: mappedTopics, isTestMode: false };
    });

    addBatchToQueue(batch);
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative min-h-0 w-full">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row justify-between sm:items-center shadow-sm z-10 shrink-0 gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">Tactical Command Center</h1>
          <p className="text-xs text-slate-500 font-medium">
            {activeTab === 'master' ? 'Master Staging Area: Ready for Sweep' : `${activeTab.replace('-', ' ').toUpperCase()} Intervention Matrix`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={activeFilter} 
            onChange={(e) => setActiveFilter(e.target.value)} 
            className="text-sm font-bold bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">🔍 Show All Statuses</option>
            <option value="red">🚨 Filter: Red (Severe)</option>
            <option value="orange">⚠️ Filter: Orange</option>
            <option value="green">✅ Filter: Green</option>
            <option value="blue">🔄 Filter: Blue (Decayed)</option>
          </select>
          
          <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 transition-colors">
            🖨️ Export Data
          </button>

          {activeTab === 'master' ? (
            <button 
              onClick={() => setIsExecutionModalOpen(true)}
              disabled={selectedForSweep.size === 0 || isProcessing}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 ${selectedForSweep.size === 0 || isProcessing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              🚀 Execute Batch ({selectedForSweep.size})
            </button>
          ) : (
             <button 
                onClick={() => executeBatchSweep(activeTab)}
                disabled={selectedForSweep.size === 0 || isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 ${selectedForSweep.size === 0 || isProcessing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
             >
                ⚡ Generate {activeTab.replace('-', ' ')} ({selectedForSweep.size})
             </button>
          )}
        </div>
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
            {activeTab === 'master' ? (
              <MasterTab 
                sortedPupils={sortedPupils} selectedForSweep={selectedForSweep} toggleSelectAll={toggleSelectAll} 
                setIsAddModalOpen={setIsAddModalOpen} blueRoster={blueRoster} printRoster={printRoster} 
                executeReassessmentSweep={executeReassessmentSweep} isProcessing={isProcessing} 
                toggleSelectPupil={toggleSelectPupil} openPupilDrawer={openPupilDrawer} renderPupilName={renderPupilName} 
                SUBJECTS={SUBJECTS} sweepOverrides={sweepOverrides} calculateTarget={calculateTarget} 
                skills={skills} handleTargetOverride={handleTargetOverride}
              />
            ) : (
              <SubjectMatrix 
                activeTab={activeTab} handleAddSkill={handleAddSkill} newSkillName={newSkillName} 
                setNewSkillName={setNewSkillName} isAddingSkill={isAddingSkill} columnError={columnError} 
                sortedPupils={sortedPupils} activeSkills={activeSkills} handleDragEnd={handleDragEnd} 
                openSkillSettings={openSkillSettings} openPupilDrawer={openPupilDrawer} renderPupilName={renderPupilName} 
                progress={progress} handleCellCycle={handleCellCycle} handleRightClick={handleRightClick} 
                sensors={sensors} activeFilter={activeFilter}
                selectedForSweep={selectedForSweep} toggleSelectPupil={toggleSelectPupil} toggleSelectAll={toggleSelectAll}
              />
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

      {/* 3. Passing supabase and userId to the drawer so it can save notes */}
      <PupilDrawer 
        isDrawerOpen={isDrawerOpen} closeDrawer={closeDrawer} selectedPupil={selectedPupil} 
        handleProfileUpdate={handleProfileUpdate} drawerStats={drawerStats} drawerStatView={drawerStatView} 
        setDrawerStatView={setDrawerStatView} skills={skills} isConfirmingDeletePupil={isConfirmingDeletePupil} 
        setIsConfirmingDeletePupil={setIsConfirmingDeletePupil} handleDeletePupil={handleDeletePupil} READING_AGES={READING_AGES}
        supabase={supabase} userId={userId}
      />

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

      <ExecutionModal 
        isOpen={isExecutionModalOpen} 
        onClose={() => setIsExecutionModalOpen(false)} 
        onExecute={executeBatchSweep} 
        selectedCount={selectedForSweep.size} 
        SUBJECTS={SUBJECTS} 
      />
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        activeFilter={activeFilter} 
        pupils={pupils} 
        progress={progress} 
        skills={skills} 
        SUBJECTS={SUBJECTS} 
      />
    </div>
  );
}

export default function CommandCenterTab() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-50 text-slate-500 font-bold">Loading Tactical Command Center...</div>}>
      <CommandCenterContent />
    </Suspense>
  );
}
