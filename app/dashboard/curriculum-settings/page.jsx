'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession, useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

import CurriculumSettingsTab from '../../../components/CurriculumSettingsTab';

export default function CurriculumSettingsPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();

  const [curriculum, setCurriculum] = useState([]);
  const [apiKey, setApiKey] = useState('');
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
        const { data } = await supabase.from('curriculum_skills').select('*').eq('user_id', user.id);
        if (data) setCurriculum(data);
      } catch (err) {
        console.error("Supabase Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, supabase]);

  const addSkill = async (skillData) => {
    if (!supabase) return;
    const { data } = await supabase.from('curriculum_skills').insert([{ ...skillData, user_id: user.id }]).select();
    if (data) setCurriculum([...curriculum, data[0]]);
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
      <CurriculumSettingsTab 
        curriculum={curriculum} 
        addSkill={addSkill} 
        apiKey={apiKey} 
        setApiKey={setApiKey} 
      />
    </div>
  );
}
