'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const SUBJECTS = [
  { key: 'all', label: 'All Subjects', icon: '🌍' },
  { key: 'maths', label: 'Maths', icon: '➗' },
  { key: 'reading', label: 'Reading', icon: '📖' },
  { key: 'writing', label: 'Writing', icon: '✍️' },
  { key: 'spelling', label: 'Spelling', icon: '🔤' },
  { key: 'times-tables', label: 'Times Tables', icon: '✖️' }
];

function ClassStatsContent() {
  const { userId } = useAuth();
  const { session } = useSession();

  const [activeSubject, setActiveSubject] = useState('all');
  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Accordion state for the headline widgets
  const [isWidgetsOpen, setIsWidgetsOpen] = useState(true);

  // Securely initialize Supabase
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

  // Fetch datasets
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

  // --- MATH ENGINE: HEADLINE WIDGETS ---
  const getWidgetData = () => {
    const activeSkills = activeSubject === 'all' ? skills : skills.filter(s => s.subject === activeSubject);
    const activeSkillIds = activeSkills.map(s => s.id);
    const activeProgress = progress.filter(p => activeSkillIds.includes(p.skill_id));

    // 1. Curriculum Bottlenecks (Highest Red)
    const redCounts = {};
    activeProgress.filter(p => p.status === 'red').forEach(p => {
      redCounts[p.skill_id] = (redCounts[p.skill_id] || 0) + 1;
    });
    const bottlenecks = Object.entries(redCounts)
      .map(([id, count]) => ({ skill: skills.find(s => s.id === id), count }))
      .filter(item => item.skill)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 2. Memory Decay Alert (Highest Blue)
    const now = new Date().getTime();
    const blueCounts = {};
    activeProgress.filter(p => p.status === 'green' && p.next_review_date && now >= new Date(p.next_review_date).getTime()).forEach(p => {
      blueCounts[p.skill_id] = (blueCounts[p.skill_id] || 0) + 1;
    });
    const decays = Object.entries(blueCounts)
      .map(([id, count]) => ({ skill: skills.find(s => s.id === id), count }))
      .filter(item => item.skill)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 3. The Invisible Child (Highest Blank Rate)
    const totalActiveSkills = activeSkills.length;
    const invisiblePupils = pupils.map(pupil => {
      const pupilProg = activeProgress.filter(p => p.pupil_id === pupil.id && p.status !== 'blank');
      const blankCount = totalActiveSkills - pupilProg.length;
      const blankPct = totalActiveSkills === 0 ? 0 : Math.round((blankCount / totalActiveSkills) * 100);
      return { pupil, blankPct, blankCount };
    }).sort((a, b) => b.blankPct - a.blankPct).slice(0, 3);

    // 4. Distance Travelled (Velocity - Recently converted to Green)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentGreens14 = activeProgress.filter(p => p.status === 'green' && p.last_assessed_at && new Date(p.last_assessed_at) >= fourteenDaysAgo).length;
    const recentGreens30 = activeProgress.filter(p => p.status === 'green' && p.last_assessed_at && new Date(p.last_assessed_at) >= thirtyDaysAgo).length;

    return { bottlenecks, decays, invisiblePupils, recentGreens14, recentGreens30, totalActiveSkills };
  };

  const widgetData = useMemo(getWidgetData, [activeSubject, skills, progress, pupils]);

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
      
      {/* GLOBAL HEADER & MASTER TOGGLE */}
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

      {/* MAIN DASHBOARD CANVAS */}
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50 flex flex-col gap-6">
        
        {/* EXPERT HEADLINE WIDGETS (COLLAPSIBLE) */}
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
              
              {/* Widget 1: Curriculum Bottleneck */}
              <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-red-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-3">
                  <span>🚨</span> Curriculum Bottlenecks
                </h3>
                {widgetData.bottlenecks.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400 italic">No red topics flagged.</p>
                ) : (
                  <ul className="space-y-2">
                    {widgetData.bottlenecks.map((b, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-700 truncate pr-2">{b.skill.skill_name}</span>
                        <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{b.count} pupils</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Widget 2: Memory Decay Alert */}
              <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5 mb-3">
                  <span>🧠</span> Memory Decay Alert
                </h3>
                {widgetData.decays.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400 italic">No decayed topics today.</p>
                ) : (
                  <ul className="space-y-2">
                    {widgetData.decays.map((d, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-700 truncate pr-2">{d.skill.skill_name}</span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{d.count} pupils</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wide">Target for Morning Starter</p>
              </div>

              {/* Widget 3: The Invisible Child */}
              <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-slate-400 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                  <span>👻</span> The Invisible Child
                </h3>
                {widgetData.totalActiveSkills === 0 ? (
                  <p className="text-sm font-semibold text-slate-400 italic">No skills available.</p>
                ) : (
                  <ul className="space-y-2">
                    {widgetData.invisiblePupils.map((p, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-700 truncate pr-2">
                          {p.pupil.name} {p.pupil.surname_initial ? `${p.pupil.surname_initial}.` : ''}
                        </span>
                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{p.blankPct}% Blank</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wide">Highest Unassessed Rate</p>
              </div>

              {/* Widget 4: Distance Travelled */}
              <div className="bg-white border border-emerald-200 rounded-lg p-4 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-3">
                  <span>🚀</span> Distance Travelled
                </h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Last 14 Days</span>
                    <span className="text-xl font-black text-emerald-600 leading-none">+{widgetData.recentGreens14} <span className="text-xs font-bold text-emerald-600/50">Topics Mastered</span></span>
                  </div>
                  <div className="flex justify-between items-end pt-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Last 30 Days</span>
                    <span className="text-lg font-black text-slate-700 leading-none">+{widgetData.recentGreens30} <span className="text-xs font-bold text-slate-400">Topics Mastered</span></span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Placeholder for Step 4 & 5 */}
        <div className="flex-1 min-h-[300px] border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-100/50 flex flex-col justify-center items-center">
          <h2 className="text-lg font-extrabold text-slate-400 mb-2">Step 4 & 5: Interactive Charts & Top Trumps</h2>
          <p className="text-sm font-semibold text-slate-400">The demographic pie charts and pupil comparison UI will render here.</p>
        </div>

      </main>
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
