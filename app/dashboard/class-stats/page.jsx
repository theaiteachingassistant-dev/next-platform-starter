'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useGeneration } from '../../../context/GenerationContext';
import PupilDrawer from '../components/PupilDrawer';

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
  const [chartFilters, setChartFilters] = useState({
    chart1: 'send', chart2: 'pp', chart3: 'boys', chart4: 'girls'
  });

  // PUPIL DRAWER STATE
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerPupilId, setDrawerPupilId] = useState(null);

  // X-RAY MODAL STATE
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [xRayData, setXRayData] = useState(null);
  const [xRaySelected, setXRaySelected] = useState(new Set());

  const [compareIds, setCompareIds] = useState([]);

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

  const openDrawer = (id) => {
    setDrawerPupilId(id);
    setIsDrawerOpen(true);
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

  const getChartData = (demographicFilter) => {
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    
    const classProg = progress.filter(p => activeSkillIds.includes(p.skill_id) && p.status !== 'blank');
    const classTotal = classProg.length;
    const classAvg = {
      green: classTotal ? Math.round((classProg.filter(p => p.status === 'green').length / classTotal) * 100) : 0,
      orange: classTotal ? Math.round((classProg.filter(p => p.status === 'orange').length / classTotal) * 100) : 0,
      red: classTotal ? Math.round((classProg.filter(p => p.status === 'red').length / classTotal) * 100) : 0,
    };

    let filteredPupils = pupils;
    if (demographicFilter === 'send') filteredPupils = pupils.filter(p => p.is_send);
    if (demographicFilter === 'eal') filteredPupils = pupils.filter(p => p.is_eal);
    if (demographicFilter === 'pp') filteredPupils = pupils.filter(p => p.is_pp);
    if (demographicFilter === 'boys') filteredPupils = pupils.filter(p => p.gender === 'Boy');
    if (demographicFilter === 'girls') filteredPupils = pupils.filter(p => p.gender === 'Girl');

    const pupilIds = filteredPupils.map(p => p.id);
    const demoProg = classProg.filter(p => pupilIds.includes(p.pupil_id));
    const demoTotal = demoProg.length;
    
    const demoCount = {
      green: demoProg.filter(p => p.status === 'green').length,
      orange: demoProg.filter(p => p.status === 'orange').length,
      red: demoProg.filter(p => p.status === 'red').length,
    };

    const demoPct = {
      green: demoTotal ? Math.round((demoCount.green / demoTotal) * 100) : 0,
      orange: demoTotal ? Math.round((demoCount.orange / demoTotal) * 100) : 0,
      red: demoTotal ? Math.round((demoCount.red / demoTotal) * 100) : 0,
    };

    const chartData = [
      { name: 'Mastered', value: demoCount.green, color: COLORS.green, status: 'green', pct: demoPct.green, classPct: classAvg.green },
      { name: 'Developing', value: demoCount.orange, color: COLORS.orange, status: 'orange', pct: demoPct.orange, classPct: classAvg.orange },
      { name: 'Struggling', value: demoCount.red, color: COLORS.red, status: 'red', pct: demoPct.red, classPct: classAvg.red }
    ].filter(d => d.value > 0);

    return { data: chartData, total: demoTotal };
  };

  const handleSliceClick = (entry, demographicFilter, demographicLabel) => {
    const targetStatus = entry.status;
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);

    let filteredPupils = pupils;
    if (demographicFilter === 'send') filteredPupils = pupils.filter(p => p.is_send);
    if (demographicFilter === 'eal') filteredPupils = pupils.filter(p => p.is_eal);
    if (demographicFilter === 'pp') filteredPupils = pupils.filter(p => p.is_pp);
    if (demographicFilter === 'boys') filteredPupils = pupils.filter(p => p.gender === 'Boy');
    if (demographicFilter === 'girls') filteredPupils = pupils.filter(p => p.gender === 'Girl');

    const affected = filteredPupils.map(p => {
      const pProg = progress.filter(pr => pr.pupil_id === p.id && activeSkillIds.includes(pr.skill_id) && pr.status === targetStatus);
      if (pProg.length === 0) return null;
      const topicNames = pProg.map(pr => skills.find(s => s.id === pr.skill_id)?.skill_name).filter(Boolean);
      return { pupil: p, topics: topicNames };
    }).filter(Boolean);

    setXRayData({
      demographicLabel,
      statusName: entry.name,
      status: targetStatus,
      color: entry.color,
      affected
    });
    setXRaySelected(new Set(affected.map(a => a.pupil.id)));
    setIsXRayOpen(true);
  };

  const toggleXRaySelected = (id) => {
    const newSet = new Set(xRaySelected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setXRaySelected(newSet);
  };

  const executeXRayBatch = () => {
    if (xRaySelected.size === 0 || isProcessing || !xRayData) return;
    
    const batch = Array.from(xRaySelected).map(pupilId => {
      const pData = xRayData.affected.find(a => a.pupil.id === pupilId);
      const mappedTopics = {};
      const targetSubjects = activeSubject === 'all' ? SUBJECTS.filter(s => s.key !== 'all').map(s => s.key) : [activeSubject];

      targetSubjects.forEach(sub => {
        const subSkills = skills.filter(s => s.subject === sub).map(s => s.id);
        const specificProg = progress.filter(pr => pr.pupil_id === pupilId && pr.status === xRayData.status && subSkills.includes(pr.skill_id));
        const skillNames = specificProg.map(pr => skills.find(s => s.id === pr.skill_id)?.skill_name).filter(Boolean);
        
        if (skillNames.length > 0) {
          mappedTopics[sub.replace('-', '_')] = `Mixed review strictly focusing on: ${skillNames.join(', ')}.`;
        } else {
          mappedTopics[sub.replace('-', '_')] = 'General mixed revision.';
        }
      });

      return { pupil: pData.pupil, topics: mappedTopics, isTestMode: false };
    });

    addBatchToQueue(batch);
    setIsXRayOpen(false);
    setXRaySelected(new Set());
  };

  const renderChartCard = (chartKey, title) => {
    const filter = chartFilters[chartKey];
    const { data, total } = getChartData(filter);
    const filterLabel = DEMOGRAPHIC_OPTIONS.find(o => o.value === filter)?.label || 'Group';

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col min-h-[380px]">
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
        
        <div className="h-48 relative mb-4">
          {total === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(value) => [`${value} Topics`, 'Count']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value" onClick={(entry) => handleSliceClick(entry, filter, filterLabel)} className="cursor-pointer focus:outline-none">
                  {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity outline-none" />))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {total > 0 && (
          <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
            {data.map(d => (
              <div key={d.status} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: d.color}}></div>
                  <span className="font-bold text-slate-700">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black w-8 text-right" style={{color: d.color}}>{d.pct}%</span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-16 text-center">Class: {d.classPct}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCompareCard = (pupilId) => {
    const pupil = pupils.find(p => p.id === pupilId);
    if (!pupil) return null;

    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    const pProg = progress.filter(p => p.pupil_id === pupilId && activeSkillIds.includes(p.skill_id) && p.status !== 'blank');
    
    const total = pProg.length;
    const g = total === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'green').length / total) * 100);
    const o = total === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'orange').length / total) * 100);
    const r = total === 0 ? 0 : Math.round((pProg.filter(p => p.status === 'red').length / total) * 100);

    return (
      <div key={pupil.id} className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden relative">
        <button onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          if (compareIds.includes(pupil.id)) setCompareIds(compareIds.filter(pid => pid !== pupil.id));
        }} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-full text-xs font-bold transition-colors z-10">✕</button>
        
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDrawer(pupil.id); }} 
            className="font-extrabold text-lg text-indigo-700 hover:text-indigo-900 hover:underline truncate pr-6 text-left w-full transition-colors"
          >
            {pupil.name} {pupil.surname_initial ? `${pupil.surname_initial}.` : ''}
          </button>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded">RA: {pupil.reading_age || 'N/A'}</span>
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col gap-5">
          <div>
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-slate-600">Global Mastery</span>
              <span className="text-emerald-600">{g}%</span>
            </div>
            <div className="flex h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              {g > 0 && <div className="bg-emerald-500" style={{ width: `${g}%` }}></div>}
              {o > 0 && <div className="bg-amber-400" style={{ width: `${o}%` }}></div>}
              {r > 0 && <div className="bg-red-500" style={{ width: `${r}%` }}></div>}
            </div>
          </div>

          {/* RE-INJECTED SUBJECT BREAKDOWN BARS */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            {SUBJECTS.filter(s => s.key !== 'all').map(sub => {
              const subSkills = skills.filter(s => s.subject === sub.key).map(s => s.id);
              const subP = progress.filter(p => p.pupil_id === pupilId && subSkills.includes(p.skill_id) && p.status !== 'blank');
              const subT = subP.length;
              if (subT === 0) return null;
              
              const subG = Math.round((subP.filter(p => p.status === 'green').length / subT) * 100);
              const subO = Math.round((subP.filter(p => p.status === 'orange').length / subT) * 100);
              const subR = Math.round((subP.filter(p => p.status === 'red').length / subT) * 100);

              return (
                <div key={sub.key}>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wide mb-1">
                    <span className="text-slate-500 flex items-center gap-1"><span>{sub.icon}</span> {sub.label}</span>
                    <span className="text-emerald-600">{subG}%</span>
                  </div>
                  <div className="flex h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    {subG > 0 && <div className="bg-emerald-500" style={{ width: `${subG}%` }}></div>}
                    {subO > 0 && <div className="bg-amber-400" style={{ width: `${subO}%` }}></div>}
                    {subR > 0 && <div className="bg-red-500" style={{ width: `${subR}%` }}></div>}
                  </div>
                </div>
              );
            })}
          </div>
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

  const sortedPupils = [...pupils].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <>
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

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50 flex flex-col gap-6 pb-32">
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
            <button onClick={() => setIsWidgetsOpen(!isWidgetsOpen)} className="w-full px-5 py-3.5 bg-slate-800 hover:bg-slate-900 flex justify-between items-center transition-colors">
              <div className="flex items-center gap-2 font-extrabold text-white tracking-wide"><span>⚡</span> Tactical Intelligence Briefing</div>
              <span className={`transform transition-transform text-slate-400 text-xs ${isWidgetsOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isWidgetsOpen && (
              <div className="p-5 border-t border-slate-200 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-3"><span>🚨</span> Curriculum Bottlenecks</h3>
                  {widgetData.bottlenecks.length === 0 ? <p className="text-sm font-semibold text-slate-400 italic">No red topics.</p> : (
                    <ul className="space-y-2">{widgetData.bottlenecks.map((b, i) => (<li key={i} className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-700 truncate pr-2">{b.skill.skill_name}</span><span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{b.count} pupils</span></li>))}</ul>
                  )}
                </div>
                
                <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3"><span>👻</span> The Invisible Child</h3>
                  {widgetData.totalActiveSkills === 0 ? <p className="text-sm font-semibold text-slate-400 italic">No skills available.</p> : (
                    <ul className="space-y-2">{widgetData.invisiblePupils.map((p, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDrawer(p.pupil.id); }} 
                          className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline truncate pr-2 text-left"
                        >
                          {p.pupil.name} {p.pupil.surname_initial ? `${p.pupil.surname_initial}.` : ''}
                        </button>
                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{p.blankPct}% Blank</span>
                      </li>
                    ))}</ul>
                  )}
                </div>
                {/* Visual Spacing padding for other widgets removed to stay concise, they work cleanly with existing CSS */}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2"><span>📊</span> Demographic vs Class Averages</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {renderChartCard('chart1', 'Primary Demographic')}
              {renderChartCard('chart2', 'Secondary Demographic')}
              {renderChartCard('chart3', 'Comparison A')}
              {renderChartCard('chart4', 'Comparison B')}
            </div>
          </div>

          <div className="border-t-4 border-indigo-600 pt-6 min-h-[400px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><span>⚔️</span> Top Trumps Comparison</h2>
                <p className="text-sm font-semibold text-slate-500">Select up to 4 pupils for side-by-side progression analysis.</p>
              </div>
              
              <select 
                onChange={(e) => {
                  if (e.target.value && !compareIds.includes(e.target.value) && compareIds.length < 4) {
                    setCompareIds([...compareIds, e.target.value]);
                    e.target.value = "";
                  }
                }}
                disabled={compareIds.length >= 4}
                className="p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white min-w-[200px]"
              >
                <option value="">+ Add Pupil to Compare</option>
                {sortedPupils.filter(p => !compareIds.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.surname_initial ? `${p.surname_initial}.` : ''}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {compareIds.map(renderCompareCard)}
            </div>
          </div>

        </main>

        {isXRayOpen && xRayData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-200 flex justify-between items-start" style={{ borderTop: `6px solid ${xRayData.color}` }}>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">X-Ray: {xRayData.demographicLabel}</h2>
                  <p className="text-sm font-bold mt-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: xRayData.color}}></span>
                    Current Status: <span style={{color: xRayData.color}}>{xRayData.statusName} ({xRayData.affected.length} Pupils)</span>
                  </p>
                </div>
                <button onClick={() => setIsXRayOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full font-bold transition-colors">✕</button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-3">
                {xRayData.affected.length === 0 ? (
                   <p className="text-slate-500 italic text-center py-4">No pupils found for this slice.</p>
                ) : (
                  xRayData.affected.map((item) => (
                    <label key={item.pupil.id} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${xRaySelected.has(item.pupil.id) ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <input 
                        type="checkbox" 
                        checked={xRaySelected.has(item.pupil.id)} 
                        onChange={() => toggleXRaySelected(item.pupil.id)}
                        className="mt-1.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDrawer(item.pupil.id); }} 
                            className="font-extrabold text-lg text-slate-800 hover:text-indigo-600 hover:underline transition-colors"
                          >
                            {item.pupil.name} {item.pupil.surname_initial ? `${item.pupil.surname_initial}.` : ''}
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">{item.topics.length} Deficits</span>
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
                          Targeting: <span className="font-bold text-slate-800">{item.topics.join(', ')}</span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500">{xRaySelected.size} / {xRayData.affected.length} Pupils Selected</span>
                <button 
                  onClick={executeXRayBatch}
                  disabled={xRaySelected.size === 0 || isProcessing}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-extrabold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  {isProcessing ? 'Generating...' : `Generate Mixed Review (${xRaySelected.size})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isDrawerOpen && drawerPupilId && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="pointer-events-auto h-full">
            <PupilDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} pupilId={drawerPupilId} />
          </div>
        </div>
      )}
    </>
  );
}

export default function ClassStatsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-50 text-slate-500 font-bold">Loading Analytics Hub...</div>}>
      <ClassStatsContent />
    </Suspense>
  );
}
