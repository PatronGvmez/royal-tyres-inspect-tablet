import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from 'babylonjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { InspectionAngle } from '@/types';

interface CoordinateFinderProps {
  imageUrl: string;
  angle: InspectionAngle;
  onCoordinateSelected?: (coords: { x: number; y: number; z: number }) => void;
}

const CoordinateFinder: React.FC<CoordinateFinderProps> = ({
  imageUrl,
  angle,
  onCoordinateSelected,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedCoord, setSelectedCoord] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [isPickingMode, setIsPickingMode] = useState(false);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      mountRef.current.appendChild(canvas);

      const engine = new BABYLON.Engine(canvas, true);
      const scene = new BABYLON.Scene(engine);

      engineRef.current = engine;
      sceneRef.current = scene;

      // Camera
      const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, 0), scene);
      camera.attachControl(canvas, true);
      camera.inertia = 0.7;
      camera.angularSensibility = 1000;

      // Light
      const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
      light.intensity = 0.8;

      // PhotoDome
      new BABYLON.PhotoDome('photo', imageUrl, { resolution: 32, size: 1000 }, scene);

      // Coordinate picker
      scene.onPointerObservable.add((pointerInfo) => {
        if (
          pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
          isPickingMode
        ) {
          const pickResult = scene.pick(scene.pointerX, scene.pointerY);
          if (pickResult?.hit && pickResult.pickedPoint) {
            const coords = {
              x: parseFloat(pickResult.pickedPoint.x.toFixed(3)),
              y: parseFloat(pickResult.pickedPoint.y.toFixed(3)),
              z: parseFloat(pickResult.pickedPoint.z.toFixed(3)),
            };
            setSelectedCoord(coords);
            setIsPickingMode(false);
          }
        }
      });

      // Resize handler
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
      console.error('Error initializing coordinate finder:', error);
    }
  }, []);

  const handleStartPicking = () => {
    setIsPickingMode(!isPickingMode);
  };

  const handleCopyCoordinates = () => {
    if (selectedCoord) {
      const coordString = JSON.stringify(selectedCoord);
      navigator.clipboard.writeText(coordString);
      toast.success('Coordinates copied to clipboard!');
    }
  };

  const handleUseCoordinates = () => {
    if (selectedCoord) {
      onCoordinateSelected?.(selectedCoord);
      toast.success('Coordinates applied!');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* 3D View */}
      <div
        ref={mountRef}
        className={`flex-1 bg-slate-900 relative ${
          isPickingMode ? 'cursor-crosshair' : 'cursor-normal'
        }`}
        style={{ minHeight: '600px' }}
      />

      {/* Coordinate Display & Controls */}
      <div className="bg-card border-t border-border p-4 space-y-4">
        <div>
          <label className="text-sm font-semibold text-foreground block mb-2">
            Viewing Angle: <Badge className="ml-2">{angle.toUpperCase()}</Badge>
          </label>
          <p className="text-xs text-muted-foreground">
            Click on the 360° image to pick a specific coordinate point.
          </p>
        </div>

        {/* Coordinate Display */}
        {selectedCoord && (
          <Card className="p-3 bg-muted">
            <div className="text-sm font-mono space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">X:</span>
                <span className="text-foreground font-semibold">{selectedCoord.x}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Y:</span>
                <span className="text-foreground font-semibold">{selectedCoord.y}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Z:</span>
                <span className="text-foreground font-semibold">{selectedCoord.z}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={isPickingMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleStartPicking}
            className="flex items-center gap-2"
          >
            <Maximize2 className="w-4 h-4" />
            {isPickingMode ? 'Picking... Click to select' : 'Start Picking'}
          </Button>

          {selectedCoord && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCoordinates}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
              <Button variant="default" size="sm" onClick={handleUseCoordinates}>
                Use These Coordinates
              </Button>
            </>
          )}
        </div>

        {/* Manual Entry */}
        <div className="border-t border-border pt-4">
          <label className="text-sm font-semibold text-foreground block mb-2">
            Or Enter Manually
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Input
                type="number"
                placeholder="X"
                value={selectedCoord?.x ?? ''}
                onChange={(e) =>
                  setSelectedCoord({
                    ...selectedCoord!,
                    x: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.001"
                className="text-sm"
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="Y"
                value={selectedCoord?.y ?? ''}
                onChange={(e) =>
                  setSelectedCoord({
                    ...selectedCoord!,
                    y: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.001"
                className="text-sm"
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="Z"
                value={selectedCoord?.z ?? ''}
                onChange={(e) =>
                  setSelectedCoord({
                    ...selectedCoord!,
                    z: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.001"
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinateFinder;
