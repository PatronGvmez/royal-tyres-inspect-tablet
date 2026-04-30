import { useState, useCallback, useEffect } from 'react';

export interface TourStep {
  /** id of the DOM element to spotlight */
  targetId: string;
  title: string;
  description: string;
  /** Where to position the tooltip relative to the highlighted element */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_KEY_PREFIX = 'royal_tyres_tour_seen_';

/**
 * Controls the guided tour.
 * The tour auto-opens exactly once per user per device (tracked in localStorage).
 * Passing `userId` scopes the key per user so different accounts on the same device
 * each see their own first-visit tour.
 */
export function useTour(role: 'mechanic' | 'admin', steps: TourStep[], userId?: string) {
  // Key is user-specific once userId is known; falls back to role-only until then.
  const storageKey = `${TOUR_KEY_PREFIX}${role}${userId ? `_${userId}` : ''}`;

  // Start closed — the effect below opens it on first visit to avoid a flash.
  const [isOpen, setIsOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Open automatically only if this user hasn't seen the tour yet.
  // Re-runs whenever storageKey changes (i.e., when userId resolves from undefined → value).
  useEffect(() => {
    if (!userId) return; // wait until we have a real user ID
    try {
      if (localStorage.getItem(storageKey) !== 'true') {
        setIsOpen(true);
      }
    } catch {}
  }, [storageKey, userId]);

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
