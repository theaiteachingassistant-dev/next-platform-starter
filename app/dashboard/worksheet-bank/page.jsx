'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function WorksheetBankPage() {
  const { session } = useSession();
  const router = useRouter();

  const [worksheets, setWorksheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('batch'); // 'batch' or 'pupil'
  const [searchQuery, setSearchQuery] = useState('');

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
    if (supabase) fetchWorksheets();
  }, [supabase]);

  const fetchWorksheets = async () => {
    setIsLoading(true);
    // Fetch all worksheets and join with the pupils table to get the names
    const { data, error } = await supabase
      .from('generated_worksheets')
      .select('*, pupils(name, surname_initial)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
    } else {
      setWorksheets(data || []);
    }
    setIsLoading(false);
  };

  // Group the raw rows by batch_id for the Batch View
  const groupedBatches = useMemo(() => {
    const groups = {};
    worksheets.forEach(sheet => {
      if (!groups[sheet.batch_id]) {
        groups[sheet.batch_id] = {
          batch_id: sheet.batch_id,
          created_at: sheet.created_at,
          expires_at: sheet.expires_at,
          pupils: []
        };
      }
      groups[sheet.batch_id].pupils.push(sheet.pupils?.name || 'Unknown');
    });
    return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [worksheets]);

  // Filter individual worksheets for the Pupil Search View
  const filteredPupils = useMemo(() => {
    if (!searchQuery.trim()) return worksheets;
    return worksheets.filter(sheet => 
      sheet.pupils?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [worksheets, searchQuery]);

  // Expiration Logic: Returns true if less than 24 hours remain
  const isExpiringSoon = (expiresAt) => {
    const hoursRemaining = (new Date(expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursRemaining < 24 && hoursRemaining > 0;
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-GB', options);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-slate-50 text-slate-500 font-bold">
        Loading Worksheet Bank...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative min-h-0 w-full overflow-hidden">
      
      {/* HEADER & WARNING BANNER */}
      <header className="bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-center">
          <p className="text-amber-800 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            ⚠️ Automated Data Retention Policy Active
          </p>
          <p className="text-amber-700 text-xs font-medium">
            To preserve system bandwidth, all documents are permanently deleted 7 days after generation. Please print or save as PDF before expiration.
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">Worksheet Bank</h1>
            <p className="text-sm text-slate-500 font-medium">Access and print recently generated interventions.</p>
          </div>

          {/* VIEW TOGGLES */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
            <button 
              onClick={() => setViewMode('batch')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'batch' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Batch View
            </button>
            <button 
              onClick={() => setViewMode('pupil')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${viewMode === 'pupil' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Pupil Search
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-auto p-6 bg-slate-50">
        
        {viewMode === 'batch' ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            {groupedBatches.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 font-medium">No batches generated in the last 7 days.</p>
              </div>
            ) : (
              groupedBatches.map(batch => {
                const expiring = isExpiringSoon(batch.expires_at);
                return (
                  <div key={batch.batch_id} className={`bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${expiring ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-extrabold text-slate-800 text-lg">Class Sweep ({batch.pupils.length} Pupils)</h3>
                        {expiring && (
                          <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse">
                            Expires &lt; 24h
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-bold mb-2">Generated: {formatDate(batch.created_at)}</p>
                      <p className="text-xs text-slate-400 font-medium line-clamp-1">
                        Includes: {batch.pupils.join(', ')}
                      </p>
                    </div>
                    <button 
                      onClick={() => router.push(`/dashboard/worksheet-bank/${batch.batch_id}`)}
                      className={`shrink-0 px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm ${expiring ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                      Open & Print Batch
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <input 
                type="text" 
                placeholder="Search by pupil name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-md p-3 bg-white border border-slate-300 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPupils.length === 0 ? (
                <div className="col-span-full text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 font-medium">No individual worksheets found.</p>
                </div>
              ) : (
                filteredPupils.map(sheet => {
                  const expiring = isExpiringSoon(sheet.expires_at);
                  return (
                    <div key={sheet.id} className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col justify-between ${expiring ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-indigo-300 transition-colors'}`}>
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-extrabold text-slate-800 text-lg">{sheet.pupils?.name}</h3>
                          {expiring && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">Urgent</span>}
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                          {formatDate(sheet.created_at)}
                        </p>
                      </div>
                      <button 
                        onClick={() => router.push(`/dashboard/worksheet-bank/${sheet.batch_id}`)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                      >
                        View Document
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
