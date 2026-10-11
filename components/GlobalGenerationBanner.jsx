'use client';

import React from 'react';
import { useGeneration } from '@/context/GenerationContext';

export default function GlobalGenerationBanner() {
  const {
    isProcessing,
    activeItem,
    completedCount,
    totalBatchSize,
    failedPupils,
  } = useGeneration();

  if (!isProcessing && failedPupils.length === 0 && completedCount === 0) {
    return null;
  }

  const progressPercent = totalBatchSize > 0 ? Math.round((completedCount / totalBatchSize) * 100) : 0;

  return (
    <aside aria-label="Worksheet generation status" className="w-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 shadow-md z-50 transition-all">
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        {isProcessing ? (
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
          <span className="text-emerald-400 font-bold">
            ✓ Generation Batch Complete ({completedCount}/{totalBatchSize})
          </span>
        )}

        {failedPupils.length > 0 && (
          <span className="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
            {failedPupils.length} Needs Attention
          </span>
        )}
      </div>

      {isProcessing && (
        <div className="w-full sm:w-48 bg-slate-800 rounded-full h-2 mt-2 sm:mt-0 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      )}
    </aside>
  );
}
