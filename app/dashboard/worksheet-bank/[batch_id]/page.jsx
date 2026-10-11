'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SUBJECTS = [
  { key: 'maths', label: 'Mathematics' },
  { key: 'reading', label: 'Reading Comprehension' },
  { key: 'writing', label: 'Writing & Grammar' },
  { key: 'spelling', label: 'Spelling Practice' },
  { key: 'times_tables', label: 'Times Tables Speed Check' }
];

export default function BatchPrintPage() {
  const { session } = useSession();
  const params = useParams();
  const router = useRouter();
  
  const [worksheets, setWorksheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await session?.getToken({ template: 'supabase' });
          const headers = new Headers(options?.headers);
          if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`);
          return fetch(url, { ...options, headers });
        },
      },
    });
  }, [session]);

  useEffect(() => {
    if (supabase && params?.batch_id) {
      fetchBatchData();
    }
  }, [supabase, params]);

  const fetchBatchData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generated_worksheets')
      .select('content, created_at, pupils(name, surname_initial)')
      .eq('batch_id', params.batch_id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setWorksheets(data);
    }
    setIsLoading(false);
  };

  const executePrint = () => {
    window.print();
  };

  const renderSubjectContent = (subjectKey, data) => {
    if (!data) return null;
    
    return (
      <div className="prose max-w-none text-sm print:text-[12pt] leading-relaxed prose-p:my-2 prose-headings:my-3">
        {subjectKey === 'maths' && (
          <>
            <p className="font-bold text-slate-500 italic mb-4 border-b pb-2">Focus: {data.objective}</p>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.worksheet_markdown}</ReactMarkdown>
          </>
        )}
        {subjectKey === 'reading' && (
          <>
            <div className="bg-slate-50 print:bg-transparent p-4 print:p-0 rounded-lg border border-slate-200 print:border-none mb-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.passage}</ReactMarkdown>
            </div>
            <h3 className="font-bold text-lg mb-2">Comprehension Questions</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.questions}</ReactMarkdown>
          </>
        )}
        {subjectKey === 'writing' && (
          <>
            <div className="mb-4 bg-indigo-50/50 print:bg-transparent p-4 print:p-0 rounded-lg border border-indigo-100 print:border-none">
              <h3 className="font-bold text-indigo-900 print:text-black mb-1">Stimulus / Task</h3>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.stimulus}</ReactMarkdown>
            </div>
            <div className="space-y-4">
              <div><h4 className="font-bold underline decoration-indigo-300">Stage 1: Try It</h4><ReactMarkdown remarkPlugins={[remarkGfm]}>{data.stage_1}</ReactMarkdown></div>
              <div><h4 className="font-bold underline decoration-indigo-300">Stage 2: Use It</h4><ReactMarkdown remarkPlugins={[remarkGfm]}>{data.stage_2}</ReactMarkdown></div>
              <div><h4 className="font-bold underline decoration-indigo-300">Stage 3: Prove It</h4><ReactMarkdown remarkPlugins={[remarkGfm]}>{data.stage_3}</ReactMarkdown></div>
            </div>
          </>
        )}
        {subjectKey === 'spelling' && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="font-bold mr-2">Target Words:</span>
              {data.target_words?.map((word, i) => (
                <span key={i} className="px-2 py-1 bg-slate-100 print:bg-transparent border border-slate-200 rounded text-xs font-bold">{word}</span>
              ))}
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.worksheet_markdown}</ReactMarkdown>
          </>
        )}
        {subjectKey === 'times_tables' && (
          <div className="text-lg">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.calculations}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen bg-slate-50 font-bold text-slate-500">Compiling Master Document...</div>;
  }

  if (worksheets.length === 0) {
    return <div className="p-10 text-center text-red-500 font-bold">Batch not found or has expired.</div>;
  }

  const generatedDate = new Date(worksheets[0].created_at).toLocaleDateString('en-GB');

  return (
    <div className="h-full overflow-y-auto bg-slate-100 print:bg-white text-slate-900 font-sans print:h-auto print:overflow-visible">
      
      {/* NO-PRINT ACTION BAR */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Print Staging Area</h1>
          <p className="text-xs text-slate-500 font-medium">Batch ID: {params.batch_id}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/dashboard/worksheet-bank')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">
            ← Back to Bank
          </button>
          <button onClick={executePrint} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2">
            🖨️ Print Master PDF
          </button>
        </div>
      </div>

      {/* MASTER DOCUMENT RENDER */}
      <div className="max-w-[210mm] mx-auto bg-white print:w-full print:max-w-none shadow-xl print:shadow-none my-8 print:my-0">
        
        {/* PART 1: THE WORKSHEETS */}
        {worksheets.map((sheet, index) => {
          const content = sheet.content;
          const pupilName = `${sheet.pupils?.name} ${sheet.pupils?.surname_initial || ''}`.trim();
          
          // Identify the very first subject generated for this specific child
          const firstValidSubKey = SUBJECTS.find(sub => content[sub.key])?.key;

          return (
            <div key={sheet.id || index}>
              {SUBJECTS.map((sub) => {
                if (!content[sub.key]) return null;
                const isFirstPage = sub.key === firstValidSubKey;

                return (
                  <div key={sub.key} className="break-after-page p-12 print:p-0 print:pt-4">
                    {/* DYNAMIC HEADER: Name only renders on the first page */}
                    <div className="flex justify-between items-end border-b-2 border-slate-800 pb-2 mb-6">
                      <div>
                        {isFirstPage && (
                          <h2 className="text-2xl font-black uppercase tracking-tight">{pupilName}</h2>
                        )}
                        <h3 className={`font-bold text-slate-600 ${isFirstPage ? 'text-lg mt-1' : 'text-2xl'}`}>
                          {sub.label}
                        </h3>
                      </div>
                      {isFirstPage && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-500">Date: {generatedDate}</p>
                        </div>
                      )}
                    </div>
                    {/* CONTENT */}
                    {renderSubjectContent(sub.key, content[sub.key])}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* PART 2: THE ANSWER KEYS */}
        <div className="p-12 print:p-0 print:pt-4">
          <div className="border-b-4 border-slate-900 pb-4 mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tight">Master Answer Keys</h1>
            <p className="text-slate-600 font-bold">Teacher Copy - {generatedDate}</p>
          </div>

          <div className="columns-1 md:columns-2 print:columns-2 gap-8">
            {worksheets.map((sheet, index) => {
              const content = sheet.content;
              const pupilName = `${sheet.pupils?.name} ${sheet.pupils?.surname_initial || ''}`.trim();

              return (
                <div key={`answers-${index}`} className="mb-8 break-inside-avoid">
                  <h2 className="text-xl font-extrabold bg-slate-100 print:bg-transparent border-b border-slate-300 print:border-black py-1 px-2 print:px-0 mb-3 uppercase">
                    {pupilName}
                  </h2>
                  <div className="space-y-4 px-2 print:px-0 text-sm print:text-[10pt]">
                    {SUBJECTS.map((sub) => {
                      if (!content[sub.key]?.answer_key) return null;
                      return (
                        <div key={`ans-${sub.key}`}>
                          <h4 className="font-bold underline mb-1">{sub.label}</h4>
                          <div className="prose prose-sm print:prose-p:my-1 text-slate-700 print:text-black">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {content[sub.key].answer_key}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
