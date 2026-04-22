import { useState, useCallback } from 'react';

export interface TourStep {
  /** id of the DOM element to spotlight */
  targetId: string;
  title: string;
  description: string;
  /** Where to position the tooltip relative to the highlighted element */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_KEY_PREFIX = 'royal_tyres_tour_seen_';

export function useTour(role: 'mechanic' | 'admin', steps: TourStep[]) {
  const storageKey = `${TOUR_KEY_PREFIX}${role}`;
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) !== 'true'; } catch { return false; }
  });
  const [stepIdx, setStepIdx] = useState(0);

  const startTour = useCallback(() => {
    setStepIdx(0);
    setIsOpen(true);
  }, []);

  const next = useCallback(() => {
    setStepIdx(i => {
      if (i < steps.length - 1) return i + 1;
      // Last step — mark done and close
      try { localStorage.setItem(storageKey, 'true'); } catch {}
      setIsOpen(false);
      return 0;
    });
  }, [steps.length, storageKey]);

  const prev = useCallback(() => {
    setStepIdx(i => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    try { localStorage.setItem(storageKey, 'true'); } catch {}
    setIsOpen(false);
    setStepIdx(0);
  }, [storageKey]);

  return {
    isOpen,
    stepIdx,
    currentStep: steps[stepIdx] ?? null,
    totalSteps: steps.length,
    startTour,
    next,
    prev,
    skip,
  };
}
