import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from 'babylonjs';
import { InspectionAngle, InspectionLabel, Hotspot } from '@/types';
import { HotspotManager, CoordinateFinder } from '@/lib/hotspotManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Map, RotateCcw } from 'lucide-react';

interface Inspection360ViewProps {
  images: Partial<Record<InspectionAngle, string>>;
  onLabelClick?: (label: InspectionLabel) => void;
  onHotspotClick?: (hotspot: Hotspot, angle: InspectionAngle) => void;
  initialLabels?: InspectionLabel[];
  onCoordinatePicked?: (coords: { x: number; y: number; z: number }, angle: InspectionAngle) => void;
  showCoordinateFinder?: boolean;
}

const Inspection360View: React.FC<Inspection360ViewProps> = ({
  images,
  onLabelClick,
  onHotspotClick,
  initialLabels = [],
  onCoordinatePicked,
  showCoordinateFinder = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const photoDomeRef = useRef<BABYLON.PhotoDome | null>(null);
  const hotspotManagerRef = useRef<HotspotManager | null>(null);
  const coordinateFinderRef = useRef<CoordinateFinder | null>(null);

  const [currentAngle, setCurrentAngle] = useState<InspectionAngle>('front');
  const [labels, setLabels] = useState<InspectionLabel[]>(initialLabels);
  const [activeHotspots, setActiveHotspots] = useState<string[]>([]);
  const [isCoordinatePickerActive, setIsCoordinatePickerActive] = useState(false);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const isMarkingModeRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const lastClickPosRef = useRef({ x: 0, y: 0 });

  const angles: InspectionAngle[] = ['front', 'left_side', 'right_side', 'rear', 'top'];

  // Sync marking mode ref with state
  useEffect(() => {
    isMarkingModeRef.current = isMarkingMode;
  }, [isMarkingMode]);

  // Sync marking mode ref with state
  useEffect(() => {
    isMarkingModeRef.current = isMarkingMode;
  }, [isMarkingMode]);

  useEffect(() => {
    if (!mountRef.current) return;

    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      mountRef.current.appendChild(canvas);

      // Initialize engine and scene
      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);

      engineRef.current = engine;
      sceneRef.current = scene;

      // Create camera for 360° view
      const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, 0), scene);
      camera.attachControl(canvas, true);
      camera.inertia = 0.7;
      camera.angularSensibility = 1000;

      // Initial lighting (subtle for background focus)
      const ambientLight = new BABYLON.HemisphericLight(
        'ambientLight',
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      ambientLight.intensity = 0.8;

      // Create PhotoDome for 360° image
      if (images.front) {
        const photoDome = new BABYLON.PhotoDome(
          'photo',
          images.front,
          {
            resolution: 32,
            size: 1000,
            useDirectMapping: false,
          },
          scene
        );
        photoDomeRef.current = photoDome;
      }

      // Initialize hotspot manager
      const hotspotManager = new HotspotManager(scene);
      hotspotManagerRef.current = hotspotManager;

      // Initialize coordinate finder
      const coordinateFinder = new CoordinateFinder(scene, camera);
      coordinateFinderRef.current = coordinateFinder;

      // Add initial labels as hotspots
      initialLabels.forEach((label) => {
        if (label.angle === currentAngle) {
          // Get mock position - in real scenario, this would come from the label data
          const mockPosition = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: 1 };
          hotspotManager.addHotspot(
            {
              id: label.id,
              position: mockPosition,
              label: label.text,
              isClickable: true,
              onClick: () => onLabelClick?.(label),
            },
            label.angle
          );
        }
      });

      // Coordinate picker mode with double-click detection
      if (showCoordinateFinder || isMarkingModeRef.current) {
        scene.onPointerObservable.add((pointerInfo) => {
          if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            const currentTime = Date.now();
            const currentPos = { x: scene.pointerX, y: scene.pointerY };
            
            // Check for double-click: within 300ms and within 10px of previous click
            const isDoubleClick = 
              (currentTime - lastClickTimeRef.current < 300) &&
              Math.abs(currentPos.x - lastClickPosRef.current.x) < 10 &&
              Math.abs(currentPos.y - lastClickPosRef.current.y) < 10;

            lastClickTimeRef.current = currentTime;
            lastClickPosRef.current = currentPos;

            // Only process if in marking mode (for 360 viewer) or coordinate picker active
            if (isDoubleClick && isMarkingModeRef.current) {
              const coords = coordinateFinder.getCoordinatesFromClick(
                scene.pointerX,
                scene.pointerY
              );
              if (coords) {
                onCoordinatePicked?.(coords, currentAngle);
              }
            } else if (isCoordinatePickerActive && !isMarkingModeRef.current) {
              const coords = coordinateFinder.getCoordinatesFromClick(
                scene.pointerX,
                scene.pointerY
              );
              if (coords) {
                onCoordinatePicked?.(coords, currentAngle);
                setIsCoordinatePickerActive(false);
              }
            }
          }
        });
      }

      // Handle window resize
      const handleResize = () => {
        engine.resize();
      };
      window.addEventListener('resize', handleResize);

      // Render loop
      engine.runRenderLoop(() => {
        scene.render();
      });

      return () => {
        window.removeEventListener('resize', handleResize);
        scene.dispose();
        engine.dispose();
      };
    } catch (error) {
      console.error('Error initializing 360 inspection view:', error);
    }
  }, []);

  // Handle angle changes
  const handleAngleChange = (angle: InspectionAngle) => {
    setCurrentAngle(angle);

    if (photoDomeRef.current && images[angle]) {
      // Update the PhotoDome texture
      const newTexture = new BABYLON.Texture(images[angle], sceneRef.current);
      photoDomeRef.current.photoTexture = newTexture;
    }

    // Update hotspots for the new angle
    if (hotspotManagerRef.current) {
      hotspotManagerRef.current.clearAll();

      // Add hotspots for the current angle
      labels
        .filter((l) => l.angle === angle)
        .forEach((label) => {
          const mockPosition = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: 1 };
          hotspotManagerRef.current?.addHotspot(
            {
              id: label.id,
              position: mockPosition,
              label: label.text,
              color: getSeverityColor(label.severity),
              isClickable: true,
              onClick: () => onLabelClick?.(label),
            },
            angle
          );
        });
    }
  };

  const getSeverityColor = (severity?: string): BABYLON.Color3 => {
    switch (severity) {
      case 'pass':
        return new BABYLON.Color3(0, 1, 0);
      case 'warning':
        return new BABYLON.Color3(1, 1, 0);
      case 'fail':
        return new BABYLON.Color3(1, 0, 0);
      default:
        return new BABYLON.Color3(1, 0.5, 0);
    }
  };

  const handleAddLabel = () => {
    setIsCoordinatePickerActive(true);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* 3D View */}
      <div
        ref={mountRef}
        className={`flex-1 bg-slate-900 relative ${
          isMarkingMode || isCoordinatePickerActive ? 'cursor-crosshair' : ''
        }`}
        style={{ minHeight: '600px' }}
      />

      {/* Controls */}
      <div className="bg-card border-t border-border p-4 space-y-4">
        {/* Mode Indicator & Help Text */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
          <button
            onClick={() => setIsMarkingMode(!isMarkingMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              isMarkingMode
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {isMarkingMode ? '🎯 Marking Mode' : '🔄 Navigation Mode'}
          </button>
          <p className="text-xs text-muted-foreground">
            {isMarkingMode
              ? 'Double-click to mark damage location (300ms window within 10px)'
              : 'Free rotation - drag to navigate'}
          </p>
        </div>
        {/* Angle Navigation */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">View Angle</label>
          <div className="grid grid-cols-5 gap-2">
            {angles.map((angle) => (
              <Button
                key={angle}
                variant={currentAngle === angle ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleAngleChange(angle)}
                className="capitalize"
              >
                {angle.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Labels */}
        {labels.filter((l) => l.angle === currentAngle).length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Labels on this view</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {labels
                .filter((l) => l.angle === currentAngle)
                .map((label) => (
                  <Card key={label.id} className="p-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">{label.text}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {label.severity?.toUpperCase() || 'INFO'}
                        </Badge>
                        {label.data && Object.keys(label.data).length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Data: {Object.keys(label.data).length}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLabels((prev) => prev.filter((l) => l.id !== label.id));
                        if (hotspotManagerRef.current) {
                          hotspotManagerRef.current.removeHotspot(label.id);
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-border">
          {showCoordinateFinder && (
            <Button
              variant={isCoordinatePickerActive ? 'default' : 'outline'}
              size="sm"
              onClick={handleAddLabel}
              className="flex items-center gap-2"
            >
              <Map className="w-4 h-4" />
              {isCoordinatePickerActive ? 'Picking...' : 'Add Label'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (hotspotManagerRef.current) {
                hotspotManagerRef.current.clearAll();
              }
              setLabels([]);
            }}
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Inspection360View;
