'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Helper to format dates to UK standards
const formatDate = (dateString) => {
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('en-GB', options);
};

// Routing logic for the new database enums
const getTypeConfig = (type) => {
  switch (type) {
    case 'parents_evening': return { label: "Parents' Evening", color: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'end_of_year': return { label: 'End of Year', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'send_plan': return { label: 'SEND Plan', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    default: return { label: 'Worksheet Pack', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
  }
};

export default function WorksheetBankPage() {
  const { userId } = useAuth();
  const { session } = useSession();
  
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null); // Strict error surfacing protocol
  const [docFilter, setDocFilter] = useState('all');

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
    if (userId && supabase) fetchDocuments();
  }, [userId, supabase]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('generated_worksheets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (fetchError) throw fetchError;
      
      setDocuments(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load documents from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter pipeline handling legacy worksheets and new reports
  const displayedDocs = docFilter === 'all' 
    ? documents 
    : documents.filter(doc => doc.type === docFilter || (docFilter === 'worksheet' && !doc.type));

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen relative">
      
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0 z-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">7-Day Document Bank</h1>
            <p className="text-sm text-slate-500 font-medium">Access your generated worksheets and official reports.</p>
          </div>
        </div>
        
        {/* Prominent 7-Day Purge Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-amber-500 text-lg">⚠️</span>
          <p className="text-sm font-bold text-amber-800">
            Data Retention Protocol: <span className="font-medium text-amber-700">All documents are permanently purged after 7 days to protect API bandwidth. Please download or print essential files.</span>
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6 flex flex-col gap-6 pb-20">
        
        {/* Defensive Error Surfacing */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-red-500 text-lg">🚨</span>
              <p className="text-sm font-bold text-red-800">Connection Error: <span className="font-medium">{error}</span></p>
            </div>
            <button onClick={fetchDocuments} className="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded transition-colors">Retry</button>
          </div>
        )}

        {/* Global Filter Navigation */}
        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex overflow-x-auto w-full" style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 'all', label: 'All Documents', icon: '📂' },
              { id: 'worksheet', label: 'Worksheets', icon: '📝' },
              { id: 'parents_evening', label: "Parents' Evening", icon: '👥' },
              { id: 'end_of_year', label: 'End of Year', icon: '🎓' },
              { id: 'send_plan', label: 'SEND Plans', icon: '🎯' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDocFilter(tab.id)}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  docFilter === tab.id 
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Engine */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold text-sm tracking-wider uppercase">Loading Secure Bank...</p>
          </div>
        ) : displayedDocs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">🗄️</div>
            <h3 className="text-lg font-extrabold text-slate-800">No Documents Found</h3>
            <p className="text-slate-500 font-medium text-sm mt-1">
              {docFilter === 'all' 
                ? "Your bank is currently empty. Generated files will appear here." 
                : "No active documents match this specific filter category."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedDocs.map(doc => {
              const typeConfig = getTypeConfig(doc.type || 'worksheet');
              return (
                <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded border ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-center">
                      {formatDate(doc.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-extrabold text-slate-800 truncate mb-1">
                      {doc.payload?.title || 'Generated Document'}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 line-clamp-2">
                      {doc.payload?.description || 'Click view to open this document in the compiler.'}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <Link href={`/dashboard/worksheet-bank/${doc.batch_id || doc.id}`} className="flex-1 text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black py-2.5 rounded-lg transition-colors border border-indigo-200 tracking-wide uppercase">
                      View & Export
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}
