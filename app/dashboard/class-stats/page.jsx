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

  // Securely initialize Supabase with Clerk authentication
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

  // Fetch the core datasets
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

        {/* The Master Subject Toggle */}
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
      <main className="flex-1 overflow-auto p-6 bg-slate-50 space-y-6">
        
        {/* Placeholder for Step 3: Headline Widgets */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-100/50">
          <h2 className="text-lg font-extrabold text-slate-400 mb-2">Step 3: Headline Widgets Staging Area</h2>
          <p className="text-sm font-semibold text-slate-400">Curriculum Bottleneck, Memory Decay, and Distance Travelled will inject here.</p>
        </div>

        {/* Placeholder for Step 4 & 5 */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-100/50">
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
