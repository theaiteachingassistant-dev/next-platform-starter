'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ExecutionModal from '../components/ExecutionModal';
import { useGeneration } from '../context/GenerationContext';

const SUBJECTS = [
  { key: 'all', label: 'All Subjects', icon: '🌍' },
  { key: 'maths', label: 'Maths', icon: '➗' },
  { key: 'reading', label: 'Reading', icon: '📖' },
  { key: 'writing', label: 'Writing', icon: '✍️' },
  { key: 'spelling', label: 'Spelling', icon: '🔤' },
  { key: 'times-tables', label: 'Times Tables', icon: '✖️' }
];

const DEMOGRAPHIC_OPTIONS = [
  { value: 'all', label: 'Whole Class' },
  { value: 'send', label: 'SEND Only' },
  { value: 'eal', label: 'EAL Only' },
  { value: 'pp', label: 'Pupil Premium' },
  { value: 'boys', label: 'Boys' },
  { value: 'girls', label: 'Girls' }
];

const COLORS = { green: '#10b981', orange: '#fbbf24', red: '#ef4444' };

function ClassStatsContent() {
  const { userId } = useAuth();
  const { session } = useSession();
  const { addBatchToQueue, isProcessing } = useGeneration();

  const [activeSubject, setActiveSubject] = useState('all');
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(true);
  
  // Independent filters for the 4 chart cards
  const [chartFilters, setChartFilters] = useState({
    chart1: 'all', chart2: 'send', chart3: 'pp', chart4: 'eal'
  });

  // Drilldown Modal State
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [selectedForSweep, setSelectedForSweep] = useState(new Set());
  const [drilldownTitle, setDrilldownTitle] = useState('');

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

  useEffect(() => {
    if (userId && supabase) fetchDashboardData();
  }, [userId, supabase]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const [pupilsRes, skillsRes, progressRes] = await Promise.all([
      supabase.from('pupils').select('*').eq('user_id', userId),
      supabase.from('curriculum_skills').select('*').eq('user_id', userId),
      supabase.from('pupil_progress').select('*').eq('user_id', userId)
    ]);
    
    if (pupilsRes.data) setPupils(pupilsRes.data);
    if (skillsRes.data) setSkills(skillsRes.data);
    if (progressRes.data) setProgress(progressRes.data);
    setIsLoading(false);
  };

  const getWidgetData = () => {
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    const activeProgress = progress.filter(p => activeSkillIds.includes(p.skill_id));

    const redCounts = {};
    activeProgress.filter(p => p.status === 'red').forEach(p => {
      redCounts[p.skill_id] = (redCounts[p.skill_id] || 0) + 1;
    });
    const bottlenecks = Object.entries(redCounts)
      .map(([id, count]) => ({ skill: skills.find(s => s.id === id), count }))
      .filter(item => item.skill).sort((a, b) => b.count - a.count).slice(0, 3);

    const now = new Date().getTime();
    const blueCounts = {};
    activeProgress.filter(p => p.status === 'green' && p.next_review_date && now >= new Date(p.next_review_date).getTime()).forEach(p => {
      blueCounts[p.skill_id] = (blueCounts[p.skill_id] || 0) + 1;
    });
    const decays = Object.entries(blueCounts)
      .map(([id, count]) => ({ skill: skills.find(s => s.id === id), count }))
      .filter(item => item.skill).sort((a, b) => b.count - a.count).slice(0, 3);

    const totalActiveSkills = activeSkills.length;
    const invisiblePupils = pupils.map(pupil => {
      const pupilProg = activeProgress.filter(p => p.pupil_id === pupil.id && p.status !== 'blank');
      const blankCount = totalActiveSkills - pupilProg.length;
      const blankPct = totalActiveSkills === 0 ? 0 : Math.round((blankCount / totalActiveSkills) * 100);
      return { pupil, blankPct, blankCount };
    }).sort((a, b) => b.blankPct - a.blankPct).slice(0, 3);

    const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentGreens14 = activeProgress.filter(p => p.status === 'green' && p.last_assessed_at && new Date(p.last_assessed_at) >= fourteenDaysAgo).length;
    const recentGreens30 = activeProgress.filter(p => p.status === 'green' && p.last_assessed_at && new Date(p.last_assessed_at) >= thirtyDaysAgo).length;

    return { bottlenecks, decays, invisiblePupils, recentGreens14, recentGreens30, totalActiveSkills };
  };

  const widgetData = useMemo(getWidgetData, [activeSubject, skills, progress, pupils]);

  // --- CHART MATH ENGINE ---
  const getChartData = (demographicFilter) => {
    let filteredPupils = pupils;
    if (demographicFilter === 'send') filteredPupils = pupils.filter(p => p.is_send);
    if (demographicFilter === 'eal') filteredPupils = pupils.filter(p => p.is_eal);
    if (demographicFilter === 'pp') filteredPupils = pupils.filter(p => p.is_pp);
    if (demographicFilter === 'boys') filteredPupils = pupils.filter(p => p.gender === 'Boy');
    if (demographicFilter === 'girls') filteredPupils = pupils.filter(p => p.gender === 'Girl');

    const pupilIds = filteredPupils.map(p => p.id);
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    
    const activeProg = progress.filter(p => activeSkillIds.includes(p.skill_id) && pupilIds.includes(p.pupil_id) && p.status !== 'blank');
    
    const greenCount = activeProg.filter(p => p.status === 'green').length;
    const orangeCount = activeProg.filter(p => p.status === 'orange').length;
    const redCount = activeProg.filter(p => p.status === 'red').length;
    
    const chartData = [
      { name: 'Mastered', value: greenCount, color: COLORS.green, status: 'green', pupilIds },
      { name: 'Developing', value: orangeCount, color: COLORS.orange, status: 'orange', pupilIds },
      { name: 'Struggling', value: redCount, color: COLORS.red, status: 'red', pupilIds }
    ].filter(d => d.value > 0);

    return { data: chartData, total: greenCount + orangeCount + redCount };
  };

  // --- DRILLDOWN EXECUTION ---
  const handleSliceClick = (entry, demographicLabel) => {
    const targetStatus = entry.status;
    const poolPupilIds = entry.pupilIds;
    
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    
    // Find all pupils who have AT LEAST ONE topic with this status in the current subject scope
    const affectedPupils = pupils.filter(p => {
      if (!poolPupilIds.includes(p.id)) return false;
      return progress.some(pr => pr.pupil_id === p.id && activeSkillIds.includes(pr.skill_id) && pr.status === targetStatus);
    });

    setDrilldownTitle(`Targeting ${affectedPupils.length} pupils (${demographicLabel} - ${entry.name})`);
    setSelectedForSweep(new Set(affectedPupils.map(p => p.id)));
    setIsExecutionModalOpen(true);
  };

  const executeBatchSweep = (subjectScope = 'all') => {
    if (selectedForSweep.size === 0 || isProcessing) return;
    
    const batch = Array.from(selectedForSweep).map(pupilId => {
      const pupil = pupils.find(p => p.id === pupilId);
      const mappedTopics = {};
      const targetSubjects = subjectScope === 'all' ? SUBJECTS.filter(s => s.key !== 'all').map(s => s.key) : [subjectScope];

      targetSubjects.forEach(sub => {
        const subSkills = skills.filter(s => s.subject === sub).sort((a, b) => a.order_index - b.order_index);
        let targetId = 'all-clear';
        let firstOrange = null;
        let firstDecayingGreen = null;
        
        for (const skill of subSkills) {
          const pData = progress.find(pr => pr.pupil_id === pupilId && pr.skill_id === skill.id);
          if (!pData || pData.status === 'blank') continue; 
          if (pData.status === 'red') { targetId = skill.id; break; } 
          if (pData.status === 'orange' && !firstOrange) firstOrange = skill.id;
          if (pData.status === 'green' && pData.next_review_date && new Date().getTime() >= new Date(pData.next_review_date).getTime() && !firstDecayingGreen) {
            firstDecayingGreen = skill.id;
          }
        }
        
        if (targetId === 'all-clear') targetId = firstOrange || firstDecayingGreen || 'all-clear';
        
        if (targetId === 'all-clear') {
          mappedTopics[sub.replace('-', '_')] = 'General mixed revision.';
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

  const renderChartCard = (chartKey, title) => {
    const filter = chartFilters[chartKey];
    const { data, total } = getChartData(filter);
    const filterLabel = DEMOGRAPHIC_OPTIONS.find(o => o.value === filter)?.label || 'Group';

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-72">
        <div className="flex justify-between items-center mb-4 z-10">
          <h3 className="font-extrabold text-slate-800 tracking-tight">{title}</h3>
          <select 
            value={filter} 
            onChange={(e) => setChartFilters({...chartFilters, [chartKey]: e.target.value})}
            className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {DEMOGRAPHIC_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        
        <div className="flex-1 relative">
          {total === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip 
                  formatter={(value) => [`${value} Topics`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(entry) => handleSliceClick(entry, filterLabel)}
                  className="cursor-pointer focus:outline-none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity outline-none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
          
          {total > 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-2xl font-black text-slate-800">{total}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topics</span>
             </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">Aggregating Matrix Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative min-h-0 w-full overflow-hidden">
      
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 shrink-0">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">Class Analytics Hub</h1>
            <p className="text-sm text-slate-500 font-medium">Live demographic and curriculum intelligence.</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SUBJECTS.map((sub) => (
            <button
              key={sub.key}
              onClick={() => setActiveSubject(sub.key)}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                activeSubject === sub.key 
                  ? 'bg-white shadow-sm text-indigo-700 border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span>{sub.icon}</span>
              <span className="whitespace-nowrap">{sub.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50 flex flex-col gap-6">
        
        {/* EXPERT HEADLINE WIDGETS */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
          <button 
            onClick={() => setIsWidgetsOpen(!isWidgetsOpen)} 
            className="w-full px-5 py-3.5 bg-slate-800 hover:bg-slate-900 flex justify-between items-center transition-colors"
          >
            <div className="flex items-center gap-2 font-extrabold text-white tracking-wide">
              <span>⚡</span> Tactical Intelligence Briefing
            </div>
            <span className={`transform transition-transform text-slate-400 text-xs ${isWidgetsOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {isWidgetsOpen && (
            <div className="p-5 border-t border-slate-200 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-red-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-3"><span>🚨</span> Curriculum Bottlenecks</h3>
                {widgetData.bottlenecks.length === 0 ? <p className="text-sm font-semibold text-slate-400 italic">No red topics flagged.</p> : (
                  <ul className="space-y-2">{widgetData.bottlenecks.map((b, i) => (<li key={i} className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-700 truncate pr-2">{b.skill.skill_name}</span><span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{b.count} pupils</span></li>))}</ul>
                )}
              </div>
              <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5 mb-3"><span>🧠</span> Memory Decay Alert</h3>
                {widgetData.decays.length === 0 ? <p className="text-sm font-semibold text-slate-400 italic">No decayed topics today.</p> : (
                  <ul className="space-y-2">{widgetData.decays.map((d, i) => (<li key={i} className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-700 truncate pr-2">{d.skill.skill_name}</span><span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{d.count} pupils</span></li>))}</ul>
                )}
              </div>
              <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-slate-400 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3"><span>👻</span> The Invisible Child</h3>
                {widgetData.totalActiveSkills === 0 ? <p className="text-sm font-semibold text-slate-400 italic">No skills available.</p> : (
                  <ul className="space-y-2">{widgetData.invisiblePupils.map((p, i) => (<li key={i} className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-700 truncate pr-2">{p.pupil.name} {p.pupil.surname_initial ? `${p.pupil.surname_initial}.` : ''}</span><span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{p.blankPct}% Blank</span></li>))}</ul>
                )}
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-3"><span>🚀</span> Distance Travelled</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2"><span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Last 14 Days</span><span className="text-xl font-black text-emerald-600 leading-none">+{widgetData.recentGreens14} <span className="text-xs font-bold text-emerald-600/50">Topics Mastered</span></span></div>
                  <div className="flex justify-between items-end pt-1"><span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Last 30 Days</span><span className="text-lg font-black text-slate-700 leading-none">+{widgetData.recentGreens30} <span className="text-xs font-bold text-slate-400">Topics Mastered</span></span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INTERACTIVE PIE CHARTS */}
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <span>📊</span> Demographic Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {renderChartCard('chart1', 'Primary View')}
            {renderChartCard('chart2', 'Comparison A')}
            {renderChartCard('chart3', 'Comparison B')}
            {renderChartCard('chart4', 'Comparison C')}
          </div>
        </div>

        {/* Placeholder for Step 5 */}
        <div className="flex-1 min-h-[300px] border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-100/50 flex flex-col justify-center items-center">
          <h2 className="text-lg font-extrabold text-slate-400 mb-2">Step 5: Top Trumps Engine</h2>
          <p className="text-sm font-semibold text-slate-400">The side-by-side pupil comparison cards will render here next.</p>
        </div>

      </main>

      {/* DRILLDOWN BATCH GENERATION MODAL */}
      <ExecutionModal 
        isOpen={isExecutionModalOpen} 
        onClose={() => setIsExecutionModalOpen(false)} 
        onExecute={executeBatchSweep} 
        selectedCount={selectedForSweep.size} 
        SUBJECTS={SUBJECTS.filter(s => s.key !== 'all').map(s => s.key)}
        customTitle={drilldownTitle}
      />
    </div>
  );
}

export default function ClassStatsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-50 text-slate-500 font-bold">Loading Analytics Hub...</div>}>
      <ClassStatsContent />
    </Suspense>
  );
}
