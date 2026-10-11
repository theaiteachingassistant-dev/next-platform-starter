'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const SUBJECTS = ['All', 'maths', 'writing', 'reading', 'spelling', 'times-tables'];

export default function ClassStatsPage() {
  const { userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await session?.getToken({ template: 'supabase' });
          const headers = new Headers(options?.headers);
          if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`);
          return fetch(url, { ...options, headers });
        }
      }
    });
  }, [session]);

  const [pupils, setPupils] = useState([]);
  const [skills, setSkills] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [collapsed, setCollapsed] = useState({ whole: false, send: false, pp: false, eal: false });
  const [modal, setModal] = useState({ isOpen: false, demo: '', color: '', title: '' });
  
  const [modSelected, setModSelected] = useState([]);

  useEffect(() => {
    if (userId && supabase) fetchData();
  }, [userId, supabase]);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, sRes, prRes] = await Promise.all([
      supabase.from('pupils').select('*').eq('user_id', userId),
      supabase.from('curriculum_skills').select('*').eq('user_id', userId),
      supabase.from('pupil_progress').select('*').eq('user_id', userId)
    ]);
    if (pRes.data) setPupils(pRes.data);
    if (sRes.data) setSkills(sRes.data);
    if (prRes.data) setProgress(prRes.data);
    setLoading(false);
  };

  // 1. Math Engine (Zero-Blank Architecture)
  const calculateStats = (group) => {
    if (group.length === 0) return null;
    
    let relevantProgress = progress.filter(p => group.some(pup => pup.id === p.pupil_id) && p.status !== 'blank');
    
    if (subjectFilter !== 'All') {
      const activeSkillIds = skills.filter(s => s.subject === subjectFilter).map(s => s.id);
      relevantProgress = relevantProgress.filter(p => activeSkillIds.includes(p.skill_id));
    }

    const total = relevantProgress.length;
    if (total === 0) return { total: 0, green: 0, orange: 0, red: 0, count: group.length };

    const gCount = relevantProgress.filter(p => p.status === 'green').length;
    const oCount = relevantProgress.filter(p => p.status === 'orange').length;
    const rCount = relevantProgress.filter(p => p.status === 'red').length;

    return {
      total,
      count: group.length,
      green: Math.round((gCount / total) * 100),
      orange: Math.round((oCount / total) * 100),
      red: Math.round((rCount / total) * 100)
    };
  };

  const demos = useMemo(() => ({
    whole: pupils,
    send: pupils.filter(p => p.is_send),
    pp: pupils.filter(p => p.is_pp),
    eal: pupils.filter(p => p.is_eal)
  }), [pupils]);

  const stats = {
    whole: calculateStats(demos.whole),
    send: calculateStats(demos.send),
    pp: calculateStats(demos.pp),
    eal: calculateStats(demos.eal)
  };

  // 2. Deep Dive Algorithm
  const getDeepDiveData = () => {
    if (!modal.isOpen) return { pupils: [], topics: [] };
    const group = demos[modal.demo];
    const targetColor = modal.color;
    
    let relevantSkills = skills;
    if (subjectFilter !== 'All') relevantSkills = skills.filter(s => s.subject === subjectFilter);
    const skillIds = relevantSkills.map(s => s.id);
    
    // Pupil Proportional Ranking
    const pupilRanks = group.map(pupil => {
      const pProg = progress.filter(p => p.pupil_id === pupil.id && skillIds.includes(p.skill_id) && p.status !== 'blank');
      const totalAssessed = pProg.length;
      const targetCount = pProg.filter(p => p.status === targetColor).length;
      const pct = totalAssessed === 0 ? 0 : (targetCount / totalAssessed) * 100;
      return { ...pupil, pct, targetCount, totalAssessed };
    }).filter(p => p.targetCount > 0).sort((a, b) => b.pct - a.pct);

    // Topic Bottleneck Ranking
    const groupProg = progress.filter(p => group.some(pup => pup.id === p.pupil_id) && skillIds.includes(p.skill_id));
    const topicRanks = relevantSkills.map(skill => {
      const topicProg = groupProg.filter(p => p.skill_id === skill.id && p.status !== 'blank');
      const targetCount = topicProg.filter(p => p.status === targetColor).length;
      return { ...skill, targetCount };
    }).filter(t => t.targetCount > 0).sort((a, b) => b.targetCount - a.targetCount).slice(0, 3);

    return { pupils: pupilRanks, topics: topicRanks };
  };

  // 3. Export Engines
  const exportCSV = () => {
    let csv = `Class Analytics Export - Subject: ${subjectFilter}\n\n`;
    csv += `Demographic,Pupils,Assessed Topics,% Green,% Orange,% Red\n`;
    
    Object.entries(stats).forEach(([key, data]) => {
      if (data) {
        const title = key === 'whole' ? 'Whole Class' : key.toUpperCase();
        csv += `${title},${data.count},${data.total},${data.green}%,${data.orange}%,${data.red}%\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `class-stats-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Navigation Trigger
  const jumpToMatrix = (subject, skillId) => {
    router.push(`/dashboard?tab=${subject}&skill=${skillId}`);
  };

  const jumpToDrawer = (pupilId) => {
    router.push(`/dashboard?openDrawer=${pupilId}`);
  };

  const toggleMod = (id) => {
    setModSelected(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  if (loading) return <div className="p-8 text-slate-500 font-bold text-center">Crunching Dataset...</div>;

  const SVGDonut = ({ data, demoKey, title }) => {
    if (!data) return null;
    if (collapsed[demoKey]) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setCollapsed({...collapsed, [demoKey]: false})}>
          <span className="font-extrabold text-slate-700">{title} ({data.count})</span>
          <span className="text-xs font-bold text-slate-400">Expand ↕</span>
        </div>
      );
    }

    const gDash = data.total === 0 ? 0 : data.green;
    const oDash = data.total === 0 ? 0 : data.orange;
    const rDash = data.total === 0 ? 0 : data.red;
    
    const oOffset = 100 - gDash;
    const rOffset = oOffset - oDash;

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col relative print:border-none print:shadow-none">
        <button onClick={() => setCollapsed({...collapsed, [demoKey]: true})} className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-slate-600 print:hidden">Collapse</button>
        <h3 className="font-extrabold text-slate-800 mb-1">{title}</h3>
        <p className="text-xs font-bold text-slate-400 mb-6">{data.count} Pupil{data.count !== 1 ? 's' : ''} | {data.total} Marks</p>
        
        {data.total === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm font-bold text-slate-300">No Assessment Data</div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative pb-4">
            <svg viewBox="0 0 36 36" className="w-32 h-32 mb-4">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="4"></circle>
              {gDash > 0 && <circle onClick={() => setModal({isOpen: true, demo: demoKey, color: 'green', title})} cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4" strokeDasharray={`${gDash} ${100 - gDash}`} strokeDashoffset="25" className="cursor-pointer hover:stroke-emerald-400 transition-all"></circle>}
              {oDash > 0 && <circle onClick={() => setModal({isOpen: true, demo: demoKey, color: 'orange', title})} cx="18" cy="18" r="15.915" fill="transparent" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${oDash} ${100 - oDash}`} strokeDashoffset={oOffset + 25} className="cursor-pointer hover:stroke-amber-300 transition-all"></circle>}
              {rDash > 0 && <circle onClick={() => setModal({isOpen: true, demo: demoKey, color: 'red', title})} cx="18" cy="18" r="15.915" fill="transparent" stroke="#ef4444" strokeWidth="4" strokeDasharray={`${rDash} ${100 - rDash}`} strokeDashoffset={rOffset + 25} className="cursor-pointer hover:stroke-red-400 transition-all"></circle>}
            </svg>
            <div className="grid grid-cols-3 w-full gap-2 text-center border-t border-slate-100 pt-4 mt-2">
              <button onClick={() => setModal({isOpen: true, demo: demoKey, color: 'green', title})} className="flex flex-col items-center hover:bg-slate-50 p-1 rounded transition-colors"><span className="text-[10px] font-black text-emerald-600 uppercase">Green</span><span className="text-lg font-extrabold text-slate-800">{data.green}%</span></button>
              <button onClick={() => setModal({isOpen: true, demo: demoKey, color: 'orange', title})} className="flex flex-col items-center hover:bg-slate-50 p-1 rounded transition-colors"><span className="text-[10px] font-black text-amber-500 uppercase">Orange</span><span className="text-lg font-extrabold text-slate-800">{data.orange}%</span></button>
              <button onClick={() => setModal({isOpen: true, demo: demoKey, color: 'red', title})} className="flex flex-col items-center hover:bg-slate-50 p-1 rounded transition-colors"><span className="text-[10px] font-black text-red-600 uppercase">Red</span><span className="text-lg font-extrabold text-slate-800">{data.red}%</span></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const deepDive = getDeepDiveData();

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-auto w-full">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #printable-stats, #printable-stats * { visibility: visible; }
          #printable-stats { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center shadow-sm shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Class Analytics</h1>
          <p className="text-xs text-slate-500 font-medium">True mastery calculated from marked topics only.</p>
        </div>
        <div className="flex gap-2">
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="text-sm font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-indigo-500">
            {SUBJECTS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects Aggregate' : s.replace('-', ' ').toUpperCase()}</option>)}
          </select>
          <button onClick={exportCSV} className="bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">Export CSV</button>
          <button onClick={handlePrint} className="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">Export PDF</button>
        </div>
      </header>

      <div id="printable-stats" className="p-6 space-y-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SVGDonut data={stats.whole} demoKey="whole" title="Whole Class" />
          <SVGDonut data={stats.send} demoKey="send" title="SEND Support" />
          <SVGDonut data={stats.pp} demoKey="pp" title="Pupil Premium" />
          <SVGDonut data={stats.eal} demoKey="eal" title="EAL" />
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:hidden">
          <h2 className="text-lg font-extrabold text-slate-800 mb-4 border-b border-slate-100 pb-2">Pupil Moderation & Assessment Tool</h2>
          <div className="flex gap-4">
            <div className="w-64 shrink-0 border-r border-slate-100 pr-4 h-64 overflow-y-auto">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Select Roster</h4>
              {pupils.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                  <input type="checkbox" checked={modSelected.includes(p.id)} onChange={() => toggleMod(p.id)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                  <span className="text-sm font-bold text-slate-700">{p.name} {p.surname_initial}.</span>
                </label>
              ))}
            </div>
            <div className="flex-1 overflow-x-auto">
              {modSelected.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm font-bold text-slate-400">Select pupils to compare mastery %.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border-b-2 border-slate-200 font-extrabold text-slate-700 text-sm">Pupil</th>
                      {SUBJECTS.filter(s => s !== 'All').map(s => <th key={s} className="p-2 border-b-2 border-slate-200 font-extrabold text-slate-700 text-sm capitalize text-center">{s.replace('-',' ')}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {modSelected.map(id => {
                      const p = pupils.find(x => x.id === id);
                      return (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="p-3 border-b border-slate-100 font-bold text-slate-800 text-sm cursor-pointer hover:text-indigo-600" onClick={() => jumpToDrawer(id)}>{p.name} {p.surname_initial}.</td>
                          {SUBJECTS.filter(s => s !== 'All').map(sub => {
                            const subSkills = skills.filter(s => s.subject === sub).map(s => s.id);
                            const pProg = progress.filter(pr => pr.pupil_id === id && subSkills.includes(pr.skill_id) && pr.status !== 'blank');
                            const gCount = pProg.filter(pr => pr.status === 'green').length;
                            const pct = pProg.length === 0 ? '-' : Math.round((gCount / pProg.length) * 100) + '%';
                            return <td key={sub} className="p-3 border-b border-slate-100 text-center font-bold text-slate-600 text-sm">{pct}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className={`px-6 py-4 border-b flex justify-between items-center ${modal.color === 'red' ? 'bg-red-50 border-red-100' : modal.color === 'orange' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <h3 className={`font-extrabold text-lg capitalize ${modal.color === 'red' ? 'text-red-900' : modal.color === 'orange' ? 'text-amber-900' : 'text-emerald-900'}`}>
                {modal.title} - Deep Dive: {modal.color}
              </h3>
              <button onClick={() => setModal({isOpen: false})} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>
            
            <div className="p-6 flex gap-6 overflow-hidden bg-slate-50">
              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Top 3 Bottleneck Topics</h4>
                  <p className="text-[10px] font-bold text-slate-400">Click topic to jump to matrix.</p>
                </div>
                <div className="overflow-y-auto p-2">
                  {deepDive.topics.length === 0 ? <p className="text-sm p-4 font-bold text-slate-400 text-center">No matching data.</p> : deepDive.topics.map((t, i) => (
                    <div key={t.id} onClick={() => jumpToMatrix(t.subject, t.id)} className="flex items-center justify-between p-3 mb-1 bg-white hover:bg-indigo-50 border border-slate-100 rounded-lg cursor-pointer transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-slate-300 group-hover:text-indigo-300">#{i+1}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 leading-tight">{t.skill_name}</p>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase">{t.subject}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${modal.color === 'red' ? 'bg-red-100 text-red-700' : modal.color === 'orange' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.targetCount} marks</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Highest Concentration Pupils</h4>
                  <p className="text-[10px] font-bold text-slate-400">Ranked by proportion of struggle/mastery.</p>
                </div>
                <div className="overflow-y-auto p-2">
                  {deepDive.pupils.length === 0 ? <p className="text-sm p-4 font-bold text-slate-400 text-center">No matching data.</p> : deepDive.pupils.map((p, i) => (
                    <div key={p.id} onClick={() => jumpToDrawer(p.id)} className="flex items-center justify-between p-3 mb-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-700 hover:text-indigo-600">{p.name} {p.surname_initial}.</p>
                        <p className="text-[10px] font-bold text-slate-400">{p.targetCount} marks out of {p.totalAssessed} assessed</p>
                      </div>
                      <span className="text-sm font-black text-slate-800">{Math.round(p.pct)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
