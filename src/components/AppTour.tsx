import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TourStep } from '@/hooks/use-tour';

interface Rect { top: number; left: number; width: number; height: number; }

interface AppTourProps {
  isOpen: boolean;
  step: TourStep | null;
  stepIdx: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const PAD = 8; // spotlight padding around target element

function getRect(targetId: string): Rect | null {
  const el = document.getElementById(targetId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

function useTargetRect(targetId: string | undefined, isOpen: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || !targetId) { setRect(null); return; }

    // Give the page a frame to render any layout before measuring
    let tries = 0;
    const measure = () => {
      const r = getRect(targetId);
      if (r) {
        setRect(r);
      } else if (tries < 10) {
        tries++;
        rafRef.current = requestAnimationFrame(measure);
      }
    };
    rafRef.current = requestAnimationFrame(measure);

    const onResize = () => { const r = getRect(targetId); if (r) setRect(r); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [targetId, isOpen]);

  return rect;
}

function tooltipPosition(rect: Rect | null, placement: TourStep['placement'], vpW: number, vpH: number) {
  const TOOLTIP_W = 320;
  const TOOLTIP_H = 160; // rough estimate
  const GAP = 14;

  if (!rect || placement === 'center') {
    return { top: vpH / 2 - TOOLTIP_H / 2, left: vpW / 2 - TOOLTIP_W / 2 };
  }

  const positions: Record<NonNullable<TourStep['placement']>, { top: number; left: number }> = {
    bottom: {
      top: rect.top + rect.height + GAP,
      left: Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 12), vpW - TOOLTIP_W - 12),
    },
    top: {
      top: rect.top - TOOLTIP_H - GAP,
      left: Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 12), vpW - TOOLTIP_W - 12),
    },
    right: {
      top: Math.min(Math.max(rect.top + rect.height / 2 - TOOLTIP_H / 2, 12), vpH - TOOLTIP_H - 12),
      left: rect.left + rect.width + GAP,
    },
    left: {
      top: Math.min(Math.max(rect.top + rect.height / 2 - TOOLTIP_H / 2, 12), vpH - TOOLTIP_H - 12),
      left: rect.left - TOOLTIP_W - GAP,
    },
    center: { top: vpH / 2 - TOOLTIP_H / 2, left: vpW / 2 - TOOLTIP_W / 2 },
  };

  const chosen = placement ?? 'bottom';
  const pos = positions[chosen];

  // Clamp to viewport so tooltip never goes off-screen
  return {
    top: Math.max(12, Math.min(pos.top, vpH - TOOLTIP_H - 12)),
    left: Math.max(12, Math.min(pos.left, vpW - TOOLTIP_W - 12)),
  };
}

export default function AppTour({ isOpen, step, stepIdx, totalSteps, onNext, onPrev, onSkip }: AppTourProps) {
  const rect = useTargetRect(step?.targetId, isOpen);
  const [vpSize, setVpSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const update = () => setVpSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const tooltipPos = tooltipPosition(rect, step?.placement, vpSize.w, vpSize.h);
  const isLast = stepIdx === totalSteps - 1;

  // Scroll target into view so it's always visible
  useEffect(() => {
    if (!step?.targetId) return;
    const el = document.getElementById(step.targetId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [step?.targetId]);

  return (
    <AnimatePresence>
      {isOpen && step && (
        <>
          {/* Dark backdrop using box-shadow cut-out technique */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{
              background: rect
                ? 'transparent'
                : 'rgba(0,0,0,0.65)',
            }}
          >
            {rect && (
              /* Full-screen SVG that punches out a rounded rectangle spotlight */
              <svg width="100%" height="100%" style={{ display: 'block' }}>
                <defs>
                  <mask id="tour-spotlight-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={rect.left}
                      y={rect.top}
                      width={rect.width}
                      height={rect.height}
                      rx="10"
                      ry="10"
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.68)"
                  mask="url(#tour-spotlight-mask)"
                />
              </svg>
            )}
          </motion.div>

          {/* Click-blocker overlay (lets users not interact with covered areas) */}
          <div className="fixed inset-0 z-[9998]" onClick={onSkip} style={{ cursor: 'default' }} />

          {/* Spotlight border highlight */}
          {rect && (
            <motion.div
              key={`highlight-${step.targetId}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed pointer-events-none z-[9999]"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                borderRadius: 10,
                boxShadow: '0 0 0 3px hsl(var(--primary)), 0 0 0 5px hsl(var(--primary) / 0.35)',
              }}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            key={`tooltip-${step.targetId}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, delay: 0.06 }}
            className="fixed z-[10000] w-[min(320px,calc(100vw-24px))]"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Step {stepIdx + 1} of {totalSteps}
                </span>
                <button
                  onClick={onSkip}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip tour
                </button>
              </div>

              {/* Progress bar */}
              <div className="mx-4 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={false}
                  animate={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Content */}
              <div className="px-4 pt-3 pb-2">
                <h3 className="font-display font-bold text-base text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between px-4 pb-4 pt-2 gap-2">
                <button
                  onClick={onPrev}
                  disabled={stepIdx === 0}
                  className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Back
                </button>
                <button
                  onClick={onNext}
                  className="flex-1 px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  {isLast ? 'Finish' : 'Next →'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
