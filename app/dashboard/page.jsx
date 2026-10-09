'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession, useUser, UserButton } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

import MorningBriefingTab from '../../components/MorningBriefingTab';
import CommandCenterTab from '../../components/CommandCenterTab';
import ResourceEngineTab from '../../components/ResourceEngineTab';
import CurriculumSettingsTab from '../../components/CurriculumSettingsTab';

export default function DashboardOrchestrator() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();

  const [activeTab, setActiveTab] = useState('morning-briefing');
  const [apiKey, setApiKey] = useState('');
  
  const [pupils, setPupils] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      setDbError("CRITICAL: Vercel is missing the NEXT_PUBLIC Supabase keys. You must redeploy Vercel with 'Use existing Build Cache' unchecked.");
      return null;
    }

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: async (url, options = {}) => {
          try {
            const clerkToken = await session?.getToken({ template: 'supabase' });
            const headers = new Headers(options?.headers);
            if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`);
            return fetch(url, { ...options, headers });
          } catch (err) {
            console.error('Clerk Token Error:', err);
            throw err;
          }
        },
      },
    });
  }, [session]);

  useEffect(() => {
    if (!user || !supabase) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [pupilsRes, curriculumRes, progressRes] = await Promise.all([
          supabase.from('pupils').select('*').eq('user_id', user.id),
          supabase.from('curriculum_skills').select('*').eq('user_id', user.id),
          supabase.from('pupil_progress').select('*').eq('user_id', user.id)
        ]);

        if (pupilsRes.error) throw pupilsRes.error;
        if (curriculumRes.error) throw curriculumRes.error;
        if (progressRes.error) throw progressRes.error;

        if (pupilsRes.data) setPupils(pupilsRes.data);
        if (curriculumRes.data) setCurriculum(curriculumRes.data);
        if (progressRes.data) setProgress(progressRes.data);
      } catch (err) {
        console.error("Supabase Fetch Error:", err);
        setDbError(err.message || "Failed to fetch data from Supabase.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, supabase]);

  const addPupil = async (pupilData) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('pupils').insert([{ ...pupilData, user_id: user.id }]).select();
    if (data) setPupils([...pupils, data[0]]);
    if (error) setDbError(error.message);
  };

  const addSkill = async (skillData) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('curriculum_skills').insert([{ ...skillData, user_id: user.id }]).select();
    if (data) setCurriculum([...curriculum, data[0]]);
    if (error) setDbError(error.message);
  };

  const updateProgress = async (pupilId, skillId, newStatus) => {
    if (!supabase) return;
    const existingIndex = progress.findIndex(p => p.pupil_id === pupilId && p.skill_id === skillId);
    let newProgress = [...progress];
    
    if (existingIndex >= 0) {
      newProgress[existingIndex].status = newStatus;
    } else {
      newProgress.push({ pupil_id: pupilId, skill_id: skillId, status: newStatus, user_id: user.id });
    }
    setProgress(newProgress);

    const { error } = await supabase.from('pupil_progress').upsert({ 
      user_id: user.id, pupil_id: pupilId, skill_id: skillId, status: newStatus 
    }, { onConflict: 'pupil_id, skill_id' });

    if (error) setDbError(error.message);
  };

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-red-50 text-red-700 p-8 rounded-xl max-w-2xl border border-red-200 shadow-sm">
          <h2 className="text-2xl font-black mb-4">Connection Failed</h2>
          <p className="font-mono text-sm bg-white p-4 rounded border border-red-100">{dbError}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-32 bg-slate-200 rounded mb-4"></div>
          <p className="text-slate-400 text-sm">Authenticating Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black text-slate-800 tracking-tight">KS2 Command<span className="text-indigo-600">.</span></span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        <nav className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-sm sticky top-24 space-y-1">
            <button 
              onClick={() => setActiveTab('morning-briefing')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'morning-briefing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📊 Morning Briefing
            </button>
            <button 
              onClick={() => setActiveTab('command-center')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'command-center' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              🎯 Command Center
            </button>
            <button 
              onClick={() => setActiveTab('resource-engine')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'resource-engine' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              ⚙️ Resource Engine
            </button>
            <button 
              onClick={() => setActiveTab('curriculum-settings')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'curriculum-settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📚 Curriculum & Settings
            </button>
          </div>
        </nav>

        <main className="flex-1 min-w-0">
          {activeTab === 'morning-briefing' && (
            <MorningBriefingTab pupils={pupils} curriculum={curriculum} progress={progress} updateProgress={updateProgress} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'command-center' && (
            user?.publicMetadata?.tier === 'pro' ? (
              <CommandCenterTab />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm mt-2">
                <div className="bg-indigo-50 p-4 rounded-full mb-4"><span className="text-3xl">🔒</span></div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Pro Upgrade Required</h2>
                <p className="text-slate-600 mb-8 max-w-md">The Tactical Matrix ecosystem is explicitly designed for high-level KS2 tracking. Upgrade to the Pro tier to unlock full data integration.</p>
                <a href="/pricing" className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors">View Pro Plans</a>
              </div>
            )
          )}

          {activeTab === 'resource-engine' && (
            <ResourceEngineTab pupils={pupils} addPupil={addPupil} apiKey={apiKey} curriculum={curriculum} progress={progress} />
          )}

          {activeTab === 'curriculum-settings' && (
            <CurriculumSettingsTab curriculum={curriculum} addSkill={addSkill} apiKey={apiKey} setApiKey={setApiKey} />
          )}
        </main>
      </div>
    </div>
  );
}
