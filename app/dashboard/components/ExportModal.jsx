'use client';
import { useState } from 'react';

export default function ExportModal({ isOpen, onClose, activeFilter, pupils, progress, skills, SUBJECTS }) {
  const [format, setFormat] = useState('pdf');
  const [layout, setLayout] = useState('topic'); // 'topic' or 'pupil'

  if (!isOpen) return null;

  const handleExport = () => {
    // 1. Gather filtered data
    const exportData = [];
    pupils.forEach(pupil => {
      const pData = { pupilName: `${pupil.name} ${pupil.surname_initial || ''}`.trim(), topics: [] };
      progress.forEach(pr => {
        if (pr.pupil_id !== pupil.id) return;
        
        let match = false;
        if (activeFilter === 'all' && pr.status !== 'blank') match = true;
        if (activeFilter === 'blue' && pr.status === 'green' && pr.next_review_date && new Date() >= new Date(pr.next_review_date)) match = true;
        if (activeFilter !== 'all' && activeFilter !== 'blue' && pr.status === activeFilter) match = true;

        if (match) {
          const sk = skills.find(s => s.id === pr.skill_id);
          if (sk) pData.topics.push({ subject: sk.subject, skill: sk.skill_name, status: pr.status });
        }
      });
      if (pData.topics.length > 0) exportData.push(pData);
    });

    if (exportData.length === 0) {
      alert("No data matches the current filter to export.");
      return;
    }

    // 2. CSV EXPORT
    if (format === 'csv') {
      let csvContent = "data:text/csv;charset=utf-8,Pupil Name,Subject,Topic,Status\n";
      exportData.forEach(row => {
        row.topics.forEach(t => {
          csvContent += `"${row.pupilName}","${t.subject}","${t.skill}","${t.status}"\n`;
        });
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Intervention_Export_${activeFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onClose();
      return;
    }

    // 3. PDF EXPORT (Via Browser Print)
    const printWin = window.open('', '_blank');
    let html = `<html><head><title>TA Intervention Plan</title><style>
      body { font-family: sans-serif; padding: 20px; color: #333; }
      h1 { font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase; }
      .section { margin-bottom: 20px; break-inside: avoid; border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
      h2 { font-size: 18px; margin-top: 0; margin-bottom: 10px; color: #1e40af; }
      ul { margin: 0; padding-left: 20px; }
      li { font-size: 14px; margin-bottom: 5px; }
      .tag { display: inline-block; padding: 2px 6px; background: #eee; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-left: 8px;}
    </style></head><body>`;

    html += `<h1>Intervention Action Plan - Filter: ${activeFilter.toUpperCase()}</h1>`;

    if (layout === 'pupil') {
      // Option B: Grouped by Pupil
      exportData.forEach(row => {
        html += `<div class="section"><h2>${row.pupilName}</h2><ul>`;
        row.topics.forEach(t => { html += `<li><strong>${t.subject.toUpperCase()}:</strong> ${t.skill} <span class="tag">${t.status}</span></li>`; });
        html += `</ul></div>`;
      });
    } else {
      // Option A: Grouped by Topic
      SUBJECTS.forEach(sub => {
        const subSkills = skills.filter(s => s.subject === sub);
        subSkills.forEach(skill => {
          const pupilsWithTopic = exportData.filter(row => row.topics.some(t => t.skill === skill.skill_name));
          if (pupilsWithTopic.length > 0) {
            html += `<div class="section"><h2>${sub.toUpperCase()} - ${skill.skill_name}</h2><ul>`;
            pupilsWithTopic.forEach(p => { html += `<li>${p.pupilName}</li>`; });
            html += `</ul></div>`;
          }
        });
      });
    }

    html += '</body></html>';
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); onClose(); }, 250);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2">🖨️ Export Engine</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Export Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500">
              <option value="pdf">Printable PDF (Action Plan)</option>
              <option value="csv">Raw Spreadsheet (CSV)</option>
            </select>
          </div>
          {format === 'pdf' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">TA Document Layout</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="radio" value="topic" checked={layout === 'topic'} onChange={(e) => setLayout(e.target.value)} className="text-indigo-600" />
                  <span className="text-sm font-bold">Group by Topic (Small Group Focus)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="radio" value="pupil" checked={layout === 'pupil'} onChange={(e) => setLayout(e.target.value)} className="text-indigo-600" />
                  <span className="text-sm font-bold">Group by Pupil (1-to-1 Focus)</span>
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={handleExport} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors">
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}
