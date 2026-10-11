'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const GenerationContext = createContext(null);

export function GenerationProvider({ children }) {
  const [queue, setQueue] = useState([]); // [{ pupil, topics, isTestMode }]
  const [activeItem, setActiveItem] = useState(null);
  const [completedPacks, setCompletedPacks] = useState([]);
  const [failedPupils, setFailedPupils] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalBatchSize, setTotalBatchSize] = useState(0);

  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

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
    setCompletedPacks([]);
    setFailedPupils([]);
    setTotalBatchSize(items.length);
    setQueue(items);
    setIsProcessing(true);
  };

  // Process the queue item by item
  useEffect(() => {
    if (!isProcessing || queue.length === 0) {
      if (queue.length === 0 && isProcessing) {
        setIsProcessing(false);
        setActiveItem(null);
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
        setCompletedPacks((prev) => [...prev, packData]);
      } else {
        setFailedPupils((prev) => [...prev, currentItem]);
      }

      // 4-second delay before next item to respect rate limits
      await new Promise((r) => setTimeout(r, 4000));

      setQueue((prev) => prev.slice(1));
    };

    executeGeneration();
  }, [queue, isProcessing]);

  return (
    <GenerationContext.Provider
      value={{
        addBatchToQueue,
        isProcessing,
        activeItem,
        completedCount: completedPacks.length,
        totalBatchSize,
        completedPacks,
        failedPupils,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export const useGeneration = () => useContext(GenerationContext);
