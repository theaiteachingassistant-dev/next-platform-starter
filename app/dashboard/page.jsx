'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, useUser, UserButton } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

// Import the extracted modules
import MorningBriefingTab from '../../components/MorningBriefingTab';
import TacticalMatrixTab from '../../components/TacticalMatrixTab';
import ResourceEngineTab from '../../components/ResourceEngineTab';
import CurriculumSettingsTab from '../../components/CurriculumSettingsTab';

export default function DashboardOrchestrator() {
  const { session } = useSession();
  const { user } = useUser();

  // Navigation & Auth State
  const [activeTab, setActiveTab] = useState('morning-briefing');
  const [apiKey, setApiKey] = useState('');
  
  // Database State
  const [pupils, setPupils] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize secure Supabase client using Clerk token
  const createClerkSupabaseClient = useCallback(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          fetch: async (url, options = {}) => {
            const clerkToken = await session?.getToken({ template: 'supabase' });
            const headers = new Headers(options?.headers);
            headers.set('Authorization', `Bearer ${clerkToken}`);
            return fetch(url, { ...options, headers });
          },
        },
      }
    );
  }, [session]);

  const supabase = createClerkSupabaseClient();

  // Fetch all initial data
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      const [pupilsRes, curriculumRes, progressRes] = await Promise.all([
        supabase.from('pupils').select('*').eq('user_id', user.id),
        supabase.from('curriculum_skills').select('*').eq('user_id', user.id),
        supabase.from('pupil_progress').select('*').eq('user_id', user.id)
      ]);

      if (pupilsRes.data) setPupils(pupilsRes.data);
      if (curriculumRes.data) setCurriculum(curriculumRes.data);
      if (progressRes.data) setProgress(progressRes.data);
      
      setIsLoading(false);
    };

    fetchData();
  }, [user, supabase]);

  // Database Mutation Handlers (Passed as Props)
  const addPupil = async (pupilData) => {
    const { data, error } = await supabase
      .from('pupils')
      .insert([{ ...pupilData, user_id: user.id }])
      .select();
    
    if (data) setPupils([...pupils, data[0]]);
    if (error) console.error('Error adding pupil:', error);
  };

  const addSkill = async (skillData) => {
    const { data, error } = await supabase
      .from('curriculum_skills')
      .insert([{ ...skillData, user_id: user.id }])
      .select();
    
    if (data) setCurriculum([...curriculum, data[0]]);
    if (error) console.error('Error adding skill:', error);
  };

  const updateProgress = async (pupilId, skillId, newStatus) => {
    // Optimistic UI update
    const existingIndex = progress.findIndex(p => p.pupil_id === pupilId && p.skill_id === skillId);
    let newProgress = [...progress];
    
    if (existingIndex >= 0) {
      newProgress[existingIndex].status = newStatus;
    } else {
      newProgress.push({ pupil_id: pupilId, skill_id: skillId, status: newStatus, user_id: user.id });
    }
    setProgress(newProgress);

    // Database upsert
    const { error } = await supabase
      .from('pupil_progress')
      .upsert({ 
        user_id: user.id,
        pupil_id: pupilId, 
        skill_id: skillId, 
        status: newStatus 
      }, { onConflict: 'pupil_id, skill_id' });

    if (error) console.error('Error updating progress:', error);
  };

  if (!user || isLoading) {
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
      {/* Global Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black text-slate-800 tracking-tight">KS2 Command<span className="text-indigo-600">.</span></span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <nav className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-sm sticky top-24 space-y-1">
            <button 
              onClick={() => setActiveTab('morning-briefing')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'morning-briefing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              📊 Morning Briefing
            </button>
            <button 
              onClick={() => setActiveTab('tactical-matrix')}
              className={`w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'tactical-matrix' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              🎯 Tactical Matrix
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

        {/* Dynamic Tab Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'morning-briefing' && (
            <MorningBriefingTab 
              pupils={pupils} 
              curriculum={curriculum} 
              progress={progress} 
              updateProgress={updateProgress}
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'tactical-matrix' && (
            <TacticalMatrixTab 
              pupils={pupils} 
              curriculum={curriculum} 
              progress={progress} 
              updateProgress={updateProgress}
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'resource-engine' && (
            <ResourceEngineTab 
              pupils={pupils} 
              addPupil={addPupil} 
              apiKey={apiKey} 
              curriculum={curriculum}
              progress={progress}
            />
          )}
          {activeTab === 'curriculum-settings' && (
            <CurriculumSettingsTab 
              curriculum={curriculum} 
              addSkill={addSkill} 
              apiKey={apiKey} 
              setApiKey={setApiKey} 
            />
          )}
        </main>

      </div>
    </div>
  );
}
