import React, { useState, useEffect, useRef } from 'react';
import { VehicleDamage } from '@/types';
import { vehicleViewSVGs, vehicleLabels, viewLabels, VehicleType, ViewAngle } from './VehicleSVGs';
import { Car, RotateCcw, Camera } from 'lucide-react';

export interface TyreOverlay {
  key: string;            // e.g. 'front_left'
  label: string;          // e.g. 'Front Left'
  conditionLabel: string; // e.g. 'Good'
  color: string;          // hex fill
  x: number;              // % left in diagram
  y: number;              // % top in diagram
}

interface CarDiagramProps {
  damages: VehicleDamage[];
  onAreaClick: (x: number, y: number, view: string) => void;
  onRemoveDamage?: (idx: number) => void;
  vehicleType?: VehicleType;
  onVehicleTypeChange?: (type: VehicleType) => void;
  photos?: Partial<Record<ViewAngle, string>>;
  tyreOverlays?: Partial<Record<ViewAngle, TyreOverlay[]>>;
  onTyrePositionChange?: (key: string, view: string, x: number, y: number) => void;
}

const vehicleTypes: VehicleType[] = ['sedan', 'hatchback', 'suv', 'bakkie', 'truck'];
const viewAngles: ViewAngle[] = ['front', 'rear', 'left', 'right', 'top'];

const CarDiagram: React.FC<CarDiagramProps> = ({ damages, onAreaClick, vehicleType = 'sedan', onVehicleTypeChange, photos, tyreOverlays, onTyrePositionChange }) => {
  const [selectedType, setSelectedType] = useState<VehicleType>(vehicleType);
  const [activeView, setActiveView] = useState<ViewAngle>('front');
  const [dragging, setDragging] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);

  // Sync when parent updates vehicleType (e.g. after job card loads)
  useEffect(() => {
    setSelectedType(vehicleType);
  }, [vehicleType]);

  const handleTypeChange = (type: VehicleType) => {
    setSelectedType(type);
    onVehicleTypeChange?.(type);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAreaClick(x, y, activeView);
  };

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    onAreaClick(x, y, activeView);
  };

  const SVGComponent = vehicleViewSVGs[selectedType][activeView];
  const viewDamages = damages.filter(d => (d as any).view === activeView);
  const viewTyreOverlays = tyreOverlays?.[activeView] ?? [];

  return (
    <div className="space-y-3">
      {/* View Angle Selector — dots show which angles have real photos */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground ml-1.5 shrink-0" />
        {viewAngles.map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`relative flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors text-center ${
              activeView === view
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {viewLabels[view]}
            {/* Green dot when a real photo exists for this angle */}
            {photos?.[view] && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      {/* Diagram Area */}
      <div
        ref={diagramRef}
        className="relative w-full rounded-lg overflow-hidden border border-border bg-card cursor-crosshair select-none"
        onClick={handleClick}
        onTouchStart={(e) => {
          // Don't open damage modal when touching a tyre overlay dot
          if ((e.target as HTMLElement).closest('[data-tyre-overlay]')) return;
          handleTouch(e);
        }}
        style={{ height: activeView === 'top' ? 320 : 260 }}
      >
        {/* Photo OR SVG — mutually exclusive. Photo hides the default model entirely. */}
        {photos?.[activeView] ? (
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-muted">
            <img
              src={photos[activeView]}
              alt={`${activeView} view`}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          /* Vehicle diagram — centred inside the fixed-height box */
          <div className="absolute inset-0 z-0 flex items-center justify-center p-6">
            <SVGComponent className="w-full max-w-[300px] h-auto text-foreground pointer-events-none" />
          </div>
        )}

        {/* Tyre condition overlays — draggable; dot centred at wheel coord; label floats above */}
        {viewTyreOverlays.map(ov => {
          const canDrag = !!onTyrePositionChange;
          const isDragging = dragging === ov.key;
          return (
            <div
              key={ov.key}
              data-tyre-overlay="true"
              className={`absolute z-20 ${canDrag ? '' : 'pointer-events-none'}`}
              style={{
                left: `${ov.x}%`,
                top: `${ov.y}%`,
                cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
              onPointerDown={canDrag ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(ov.key);
              } : undefined}
              onPointerMove={canDrag ? (e) => {
                if (dragging !== ov.key || !diagramRef.current) return;
                const rect = diagramRef.current.getBoundingClientRect();
                const x = Math.max(3, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100));
                const y = Math.max(3, Math.min(97, ((e.clientY - rect.top) / rect.height) * 100));
                onTyrePositionChange!(ov.key, activeView, x, y);
              } : undefined}
              onPointerUp={canDrag ? (e) => {
                e.stopPropagation();
                setDragging(null);
              } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Label above — z-30 ensures it always renders over the dot circle */}
              <div
                className="absolute z-30 px-1.5 py-0.5 rounded text-[8px] font-bold leading-tight whitespace-nowrap shadow-md select-none"
                style={{
                  background: ov.color, color: '#fff',
                  bottom: '100%', left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '3px',
                }}
              >
                {ov.conditionLabel}
                {canDrag && <span className="ml-1 opacity-60" style={{ fontSize: '7px' }}>⇕</span>}
              </div>
              {/* Dot — translate(-50%,-50%) centres it precisely on the coordinate */}
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform duration-100"
                style={{
                  background: ov.color,
                  transform: `translate(-50%, -50%) scale(${isDragging ? 1.35 : 1})`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full border border-white/70" />
              </div>
            </div>
          );
        })}

        {/* Damage pins */}
        {viewDamages.map((d) => {
          const globalIdx = damages.indexOf(d);
          return (
            <div
              key={globalIdx}
              className={`damage-pin z-20 ${d.severity === 'major' ? 'damage-pin-major' : 'damage-pin-minor'}`}
              style={{ position: 'absolute', left: `${d.coordinates.x}%`, top: `${d.coordinates.y}%` }}
              title={`${d.part}: ${d.damage_type} (${d.severity})`}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap bg-foreground text-background px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {d.part}
              </span>
            </div>
          );
        })}

        {/* Bottom-right badge: real photo indicator or fallback notice */}
        {photos?.[activeView] ? (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full pointer-events-none">
            <Camera className="w-3 h-3" /> Your Photo
          </div>
        ) : (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-foreground/20 backdrop-blur-sm text-foreground/60 text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
            Model preview
          </div>
        )}
      </div>

      {/* Damage count per angle — only shown when damages exist */}
      {damages.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {viewAngles.map(view => {
            const count = damages.filter(d => (d as any).view === view).length;
            if (count === 0) return null;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  activeView === view
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {viewLabels[view]}
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent text-accent-foreground text-[8px] font-bold">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Tap anywhere on the diagram to mark damage
      </p>
    </div>
  );
};

export default CarDiagram;
