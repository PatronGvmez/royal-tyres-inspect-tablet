import { useState, useEffect, useRef } from 'react';
import { vehicleViewSVGs, VehicleType, ViewAngle } from '@/components/inspection/VehicleSVGs';

const ANGLES: ViewAngle[] = ['front', 'rear', 'left', 'right'];
const INTERVAL = 5000;

interface VehicleCardCarouselProps {
  vehicleType?: string;
  photos?: Partial<Record<string, string>>;
  licensePlate: string;
  className?: string;
  paused?: boolean;
}

const VehicleCardCarousel = ({
  vehicleType,
  photos = {},
  licensePlate,
  className = '',
  paused = false,
}: VehicleCardCarouselProps) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedType = vehicleType?.toLowerCase() as VehicleType;
  const type = (vehicleViewSVGs[normalizedType] ? normalizedType : 'sedan') as VehicleType;

  const transition = (next: number) => {
    setActiveIdx((cur) => {
      if (cur === next) return cur;
      setPrevIdx(cur);
      if (clearRef.current) clearTimeout(clearRef.current);
      clearRef.current = setTimeout(() => setPrevIdx(null), 1000);
      return next;
    });
  };

  useEffect(() => {
    if (paused || isHovered) return;
    const timer = setInterval(() => {
      setActiveIdx((cur) => {
        const next = (cur + 1) % ANGLES.length;
        setPrevIdx(cur);
        if (clearRef.current) clearTimeout(clearRef.current);
        clearRef.current = setTimeout(() => setPrevIdx(null), 1000);
        return next;
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [paused, isHovered]);

  useEffect(() => () => { if (clearRef.current) clearTimeout(clearRef.current); }, []);

  const renderSlide = (angle: ViewAngle) => {
    const photoUrl = photos[angle];
    // Both photos and SVGs are constrained to the upper area, leaving bottom-6 clear for dots
    const content = photoUrl ? (
      <img
        src={photoUrl}
        alt={`${licensePlate} ${angle}`}
        className="w-full h-full object-contain"
      />
    ) : (() => {
      const SVGComp = vehicleViewSVGs[type][angle];
      return (
        <SVGComp
          className="w-full h-full"
          style={{ color: 'hsl(var(--primary) / 0.7)', padding: '12px 16px 0' }}
        />
      );
    })();

    return (
      <div className="absolute inset-x-0 top-0 bottom-6">
        {content}
      </div>
    );
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outgoing slide */}
      {prevIdx !== null && (
        <div
          className="absolute inset-0 z-[1]"
          style={{ animation: 'carouselFadeOut 1s ease-in-out forwards' }}
        >
          {renderSlide(ANGLES[prevIdx])}
        </div>
      )}

      {/* Active slide */}
      <div
        key={activeIdx}
        className="absolute inset-0 z-[2]"
        style={{ animation: 'carouselFadeIn 1s ease-in-out forwards' }}
      >
        {renderSlide(ANGLES[activeIdx])}
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 pointer-events-none">
        {ANGLES.map((angle, idx) => {
          const hasPhoto = !!photos[angle];
          return (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); transition(idx); }}
              className={`rounded-full transition-all duration-300 pointer-events-auto ${
                idx === activeIdx
                  ? 'w-3.5 h-1.5 bg-white shadow'
                  : hasPhoto
                    ? 'w-1.5 h-1.5 bg-white/80 hover:bg-white'
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`View ${ANGLES[idx]}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VehicleCardCarousel;
