'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

import MorningBriefingTab from '../../../components/MorningBriefingTab';

export default function MorningBriefingPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();

  const [pupils, setPupils] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [progress, setProgress] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
    if (!user || !supabase) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [pupilsRes, curriculumRes, progressRes] = await Promise.all([
          supabase.from('pupils').select('*').eq('user_id', user.id),
          supabase.from('curriculum_skills').select('*').eq('user_id', user.id),
          supabase.from('pupil_progress').select('*').eq('user_id', user.id)
        ]);

        if (pupilsRes.data) setPupils(pupilsRes.data);
        if (curriculumRes.data) setCurriculum(curriculumRes.data);
        if (progressRes.data) setProgress(progressRes.data);
      } catch (err) {
        console.error("Supabase Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, supabase]);

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

    await supabase.from('pupil_progress').upsert({ 
      user_id: user.id, pupil_id: pupilId, skill_id: skillId, status: newStatus 
    }, { onConflict: 'pupil_id, skill_id' });
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-pulse h-8 w-32 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50 w-full max-w-7xl mx-auto">
      <MorningBriefingTab 
        pupils={pupils} 
        curriculum={curriculum} 
        progress={progress} 
        updateProgress={updateProgress} 
      />
    </div>
  );
}
