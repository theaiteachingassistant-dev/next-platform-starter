'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useSession, useAuth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const GenerationContext = createContext(null);

export function GenerationProvider({ children }) {
  const { session } = useSession();
  const { userId } = useAuth();
  
  const [queue, setQueue] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [completedPacks, setCompletedPacks] = useState([]);
  const [failedPupils, setFailedPupils] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalBatchSize, setTotalBatchSize] = useState(0);
  
  // New state variables for Phase 4 Handoff
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [isBatchFinished, setIsBatchFinished] = useState(false);

  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // Initialize secure Supabase connection
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

  // Protect against accidental tab closure during generation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProcessingRef.current) {
        e.preventDefault();
        e.returnValue = 'Worksheet generation is active. Leaving now will cancel the remaining queue.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const addBatchToQueue = (items) => {
    // Generate a unique batch ID for Phase 4 grouping
    const newBatchId = `batch-${Date.now()}`;
    setCurrentBatchId(newBatchId);
    
    setCompletedPacks([]);
    setFailedPupils([]);
    setTotalBatchSize(items.length);
    setQueue(items);
    setIsProcessing(true);
    setIsBatchFinished(false);
  };

  const dismissBanner = () => {
    setIsBatchFinished(false);
    setCompletedPacks([]);
    setFailedPupils([]);
    setTotalBatchSize(0);
    setCurrentBatchId(null);
  };

  // Process the queue item by item
  useEffect(() => {
    if (!isProcessing || queue.length === 0) {
      if (queue.length === 0 && isProcessing) {
        setIsProcessing(false);
        setActiveItem(null);
        setIsBatchFinished(true); // Flag the batch as fully complete and waiting for user click
      }
      return;
    }

    const currentItem = queue[0];
    setActiveItem(currentItem);

    const executeGeneration = async () => {
      let success = false;
      let packData = null;

      // First attempt
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentItem),
        });

        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        packData = await res.json();
        success = true;
      } catch (err) {
        // Attempt single background retry with 3-second backoff
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const retryRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentItem),
          });
          if (!retryRes.ok) throw new Error(`Retry returned ${retryRes.status}`);
          packData = await retryRes.json();
          success = true;
        } catch (retryErr) {
          success = false;
        }
      }

      if (success && packData) {
        // STEP 2 INJECTION: Save to Supabase immediately
        if (supabase && userId && currentItem.pupil?.id) {
          try {
            await supabase.from('generated_worksheets').insert({
              user_id: userId,
              pupil_id: currentItem.pupil.id,
              batch_id: currentBatchId,
              content: packData
            });
          } catch (dbError) {
            console.error("Failed to save to Supabase:", dbError);
          }
        }
        setCompletedPacks((prev) => [...prev, packData]);
      } else {
        setFailedPupils((prev) => [...prev, currentItem]);
      }

      // 4-second delay before next item to respect rate limits
      await new Promise((r) => setTimeout(r, 4000));

      setQueue((prev) => prev.slice(1));
    };

    executeGeneration();
  }, [queue, isProcessing, supabase, userId, currentBatchId]);

  return (
    <GenerationContext.Provider
      value={{
        addBatchToQueue,
        dismissBanner,
        isProcessing,
        isBatchFinished,
        activeItem,
        completedCount: completedPacks.length,
        totalBatchSize,
        completedPacks,
        failedPupils,
        currentBatchId
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export const useGeneration = () => useContext(GenerationContext);
