'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGeneration } from '../context/GenerationContext';

export default function GlobalGenerationBanner() {
  const router = useRouter();
  const {
    isProcessing,
    isBatchFinished,
    activeItem,
    completedCount,
    totalBatchSize,
    failedPupils,
    dismissBanner
  } = useGeneration();

  if (!isProcessing && !isBatchFinished) {
    return null;
  }

  const progressPercent = totalBatchSize > 0 ? Math.round((completedCount / totalBatchSize) * 100) : 0;

  const handleOpenBank = () => {
    router.push(`/dashboard/worksheet-bank`);
    dismissBanner();
  };

  return (
    <aside 
      aria-label="Worksheet generation status" 
      className={`w-full text-white px-4 py-2 text-xs font-semibold flex flex-col sm:flex-row items-center justify-between border-b shadow-md z-50 transition-all ${isBatchFinished ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer border-emerald-500' : 'bg-slate-900 border-slate-800'}`}
      onClick={isBatchFinished ? handleOpenBank : undefined}
    >
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        {isProcessing && !isBatchFinished ? (
          <>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            <span>
              Generating Pack for <strong className="text-indigo-300">{activeItem?.pupil?.name || 'Pupil'}</strong> ({completedCount + 1}/{totalBatchSize})
            </span>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-white font-extrabold text-sm flex items-center gap-2">
              ✅ Generation Complete! ({completedCount}/{totalBatchSize} Packs Saved)
            </span>
            <span className="bg-emerald-800 text-emerald-100 px-3 py-1 rounded shadow-sm">
              Click to open Worksheet Bank ➔
            </span>
          </div>
        )}

        {failedPupils.length > 0 && (
          <span className="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
            {failedPupils.length} Needs Attention
          </span>
        )}
      </div>

      {isProcessing && !isBatchFinished && (
        <div className="w-full sm:w-48 bg-slate-800 rounded-full h-2 mt-2 sm:mt-0 overflow-hidden shrink-0">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      )}

      {isBatchFinished && (
        <button 
          onClick={(e) => { e.stopPropagation(); dismissBanner(); }} 
          className="mt-2 sm:mt-0 px-3 py-1 bg-emerald-800 hover:bg-emerald-900 rounded text-emerald-200 transition-colors"
        >
          Dismiss
        </button>
      )}
    </aside>
  );
}
