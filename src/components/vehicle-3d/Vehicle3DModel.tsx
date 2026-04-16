import { useEffect, useRef, useState, type FC } from 'react';
import * as BABYLON from 'babylonjs';
import { VehicleDamage } from '@/types';
import { X, RotateCcw, ZoomIn, ZoomOut, Info } from 'lucide-react';

interface Vehicle3DModelProps {
  damages: VehicleDamage[];
  onAreaClick: (x: number, y: number, view: string) => void;
  vehicleType?: 'sedan' | 'hatchback' | 'suv' | 'bakkie' | 'truck';
  onRemoveDamage?: (idx: number) => void;
  onVehicleTypeChange?: (type: 'sedan' | 'hatchback' | 'suv' | 'bakkie' | 'truck') => void;
}

interface DamageMarker {
  mesh: BABYLON.Mesh;
  position: BABYLON.Vector3;
  damage: VehicleDamage;
}

const Vehicle3DModel: FC<Vehicle3DModelProps> = ({
  damages,
  onAreaClick,
  vehicleType = 'sedan',
  onRemoveDamage,
  onVehicleTypeChange,
}) => {
  
  // Hooks must be at the top level - called unconditionally
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const carRef = useRef<BABYLON.TransformNode | null>(null);
  const damageMarkersRef = useRef<DamageMarker[]>([]);
  const [stats, setStats] = useState({ major: 0, minor: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const isMarkingModeRef = useRef(false);
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    isMarkingModeRef.current = isMarkingMode;
  }, [isMarkingMode]);

  useEffect(() => {
    try {
      if (!mountRef.current) return;

      // Initialize engine and scene
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      mountRef.current.appendChild(canvas);

    const engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;

    // Camera setup - Arc rotate for better 3D viewing
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 4,
      Math.PI / 2.5,
      12,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 50;
    camera.inertia = 0.7;
    camera.angularSensibilityX = 1000;
    camera.angularSensibilityY = 1000;

    // Lighting
    const light1 = new BABYLON.PointLight('light1', new BABYLON.Vector3(5, 8, 5), scene);
    light1.intensity = 0.8;
    light1.range = 50;

    const light2 = new BABYLON.PointLight('light2', new BABYLON.Vector3(-5, 8, -5), scene);
    light2.intensity = 0.6;
    light2.range = 50;

    const ambientLight = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.4;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    (groundMat as any).albedoColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    (groundMat as any).specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = groundMat;

    // Create car
    const carBody = buildCar(scene, vehicleType);
    carRef.current = carBody;

    // Click detection for damage marking
    const pointerObservable = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && isMarkingModeRef.current) {
        const currentTime = Date.now();
        const currentPos = { x: scene.pointerX, y: scene.pointerY };
        
        // Check for double-click: within 300ms and within 10px
        const isDoubleClick = 
          (currentTime - lastClickTimeRef.current < 300) &&
          Math.abs(currentPos.x - lastClickPosRef.current.x) < 10 &&
          Math.abs(currentPos.y - lastClickPosRef.current.y) < 10;
        
        lastClickTimeRef.current = currentTime;
        lastClickPosRef.current = currentPos;
        
        if (isDoubleClick) {
          const pickResult = scene.pick(scene.pointerX, scene.pointerY);
          if (pickResult?.hit && pickResult.pickedMesh) {
            const hitPoint = pickResult.pickedPoint;
            if (hitPoint) {
              // Convert world position to normalized UV-like coordinates
              const x = (hitPoint.x + 10) / 20 * 100; // Assuming car bounds
              const y = (hitPoint.y + 5) / 10 * 100;
              onAreaClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)), 'three-d');
            }
          }
        }
      }
    });

    // Update damage markers
    const updateDamageMarkers = () => {
      // Clear old markers
      damageMarkersRef.current.forEach((marker) => {
        marker.mesh.dispose();
      });
      damageMarkersRef.current = [];

      // Add new markers
      damages.forEach((damage) => {
        const marker = BABYLON.MeshBuilder.CreateSphere(
          'damageMarker',
          { diameter: damage.severity === 'major' ? 0.4 : 0.25 },
          scene
        );

        const markerMat = new BABYLON.StandardMaterial('markerMat', scene);
        markerMat.emissiveColor = damage.severity === 'major'
          ? new BABYLON.Color3(1, 0.2, 0.2) // Red for major
          : new BABYLON.Color3(1, 0.8, 0.2); // Orange for minor

        marker.material = markerMat;
        marker.position = new BABYLON.Vector3(
          (damage.coordinates.x / 100) * 8 - 4,
          (damage.coordinates.y / 100) * 6 - 3,
          2.5
        );

        damageMarkersRef.current.push({
          mesh: marker,
          position: marker.position.clone(),
          damage,
        });
      });

      // Update stats
      const major = damages.filter((d) => d.severity === 'major').length;
      const minor = damages.filter((d) => d.severity === 'minor').length;
      setStats({ major, minor });
    };

    updateDamageMarkers();

    // Animation loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', handleResize);

    sceneRef.current = scene;
    engineRef.current = engine;

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      canvas.remove();
    };
    } catch (err) {
      console.error('Failed to initialize 3D model:', err);
      setError('Failed to load 3D view. Using 2D view instead.');
    }
  }, [vehicleType]);

  // Update markers when damages change
  useEffect(() => {
    if (sceneRef.current) {
      damageMarkersRef.current.forEach((marker) => {
        marker.mesh.dispose();
      });
      damageMarkersRef.current = [];

      damages.forEach((damage) => {
        const scene = sceneRef.current!;
        const marker = BABYLON.MeshBuilder.CreateSphere(
          'damageMarker',
          { diameter: damage.severity === 'major' ? 0.4 : 0.25 },
          scene
        );

        const markerMat = new BABYLON.StandardMaterial('markerMat', scene);
        markerMat.emissiveColor = damage.severity === 'major'
          ? new BABYLON.Color3(1, 0.2, 0.2)
          : new BABYLON.Color3(1, 0.8, 0.2);

        marker.material = markerMat;
        marker.position = new BABYLON.Vector3(
          (damage.coordinates.x / 100) * 8 - 4,
          (damage.coordinates.y / 100) * 6 - 3,
          2.5
        );

        damageMarkersRef.current.push({
          mesh: marker,
          position: marker.position.clone(),
          damage,
        });
      });

      const major = damages.filter((d) => d.severity === 'major').length;
      const minor = damages.filter((d) => d.severity === 'minor').length;
      setStats({ major, minor });
    }
  }, [damages]);

  const resetCamera = () => {
    if (sceneRef.current) {
      const camera = sceneRef.current.activeCamera as BABYLON.ArcRotateCamera;
      camera.alpha = Math.PI / 4;
      camera.beta = Math.PI / 2.5;
      camera.radius = 12;
    }
  };

  const zoomIn = () => {
    if (sceneRef.current) {
      const camera = sceneRef.current.activeCamera as BABYLON.ArcRotateCamera;
      camera.radius = Math.max(6, camera.radius - 2);
    }
  };

  const zoomOut = () => {
    if (sceneRef.current) {
      const camera = sceneRef.current.activeCamera as BABYLON.ArcRotateCamera;
      camera.radius = Math.min(20, camera.radius + 2);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      
      {/* Vehicle Type Selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(['sedan', 'hatchback', 'suv', 'bakkie', 'truck'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onVehicleTypeChange?.(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${
              vehicleType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <span>{type}</span>
          </button>
        ))}
      </div>
      
      {/* 3D Viewer */}
      <div
        ref={mountRef}
        className="relative w-full rounded-lg overflow-hidden border border-border bg-card"
        style={{ height: '400px' }}
      />

      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 justify-center">
          <button
            onClick={resetCamera}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-secondary transition-colors"
            title="Reset camera view"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-medium">Reset</span>
          </button>
          <button
            onClick={zoomIn}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-secondary transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-secondary transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
        
        {/* Mode Toggle */}
        <button
          onClick={() => setIsMarkingMode(!isMarkingMode)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            isMarkingMode
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={isMarkingMode ? 'Damage Marking Mode: Double-click to log damage' : 'Navigation Mode: Rotate freely'}
        >
          <span>{isMarkingMode ? '🎯 Marking Mode (Double-click to log)' : '🔄 Navigation Mode (Move freely)'}</span>
        </button>
      </div>

      {/* Damage Summary */}
      {damages.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-accent/10 border border-accent rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Major Damage</p>
            <p className="text-lg font-bold text-accent">{stats.major}</p>
          </div>
          <div className="bg-warning/10 border border-warning rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Minor Damage</p>
            <p className="text-lg font-bold text-warning">{stats.minor}</p>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
        <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground">
          {isMarkingMode
            ? 'Double-click on vehicle to mark damage • Scroll to zoom'
            : 'Drag to rotate • Scroll to zoom • Click "Marking Mode" to log damage'}
        </p>
      </div>

      {/* Damage List */}
      {damages.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold text-foreground">Logged Damage ({damages.length})</p>
          {damages.map((damage, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 p-2 bg-card border border-border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{damage.part}</p>
                <p className="text-[10px] text-muted-foreground">
                  {damage.damage_type} · {damage.severity}
                </p>
              </div>
              {onRemoveDamage && (
                <button
                  onClick={() => onRemoveDamage(idx)}
                  className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Get vehicle-specific dimensions
function getVehicleDimensions(vehicleType: string): {
  width: number;
  bodyHeight: number;
  depth: number;
  bodyY: number;
  roofHeight: number;
  roofDepth: number;
  roofY: number;
  roofZ: number;
  windshieldY: number;
  windshieldZ: number;
  rearWindowY: number;
  rearWindowZ: number;
} {
  const baseDims = {
    sedan: {
      width: 2.0,
      bodyHeight: 1.2,
      depth: 4.5,
      bodyY: 0.6,
      roofHeight: 0.6,
      roofDepth: 2.5,
      roofY: 1.5,
      roofZ: -0.3,
      windshieldY: 1.1,
      windshieldZ: 1.8,
      rearWindowY: 1.0,
      rearWindowZ: -2.0,
    },
    hatchback: {
      width: 1.9,
      bodyHeight: 1.35,
      depth: 4.0,
      bodyY: 0.65,
      roofHeight: 0.7,
      roofDepth: 2.2,
      roofY: 1.6,
      roofZ: -0.1,
      windshieldY: 1.15,
      windshieldZ: 1.7,
      rearWindowY: 1.1,
      rearWindowZ: -1.8,
    },
    suv: {
      width: 2.3,
      bodyHeight: 1.5,
      depth: 5.0,
      bodyY: 0.8,
      roofHeight: 0.65,
      roofDepth: 2.8,
      roofY: 1.75,
      roofZ: -0.2,
      windshieldY: 1.3,
      windshieldZ: 2.0,
      rearWindowY: 1.2,
      rearWindowZ: -2.2,
    },
    bakkie: {
      width: 2.0,
      bodyHeight: 1.1,
      depth: 5.5,
      bodyY: 0.55,
      roofHeight: 0.5,
      roofDepth: 2.0,
      roofY: 1.4,
      roofZ: 0.5,
      windshieldY: 1.0,
      windshieldZ: 2.0,
      rearWindowY: 0.9,
      rearWindowZ: -1.5,
    },
    truck: {
      width: 2.4,
      bodyHeight: 1.3,
      depth: 6.0,
      bodyY: 0.7,
      roofHeight: 0.55,
      roofDepth: 2.2,
      roofY: 1.6,
      roofZ: 0.8,
      windshieldY: 1.1,
      windshieldZ: 2.2,
      rearWindowY: 1.0,
      rearWindowZ: -1.8,
    },
  };

  return baseDims[vehicleType as keyof typeof baseDims] || baseDims.sedan;
}

// Build 3D car model
function buildCar(scene: BABYLON.Scene, vehicleType: string): BABYLON.TransformNode {
  const carRoot = new BABYLON.TransformNode('carRoot', scene);

  // Car material
  const bodyMat = new BABYLON.StandardMaterial('bodyMat', scene);
  (bodyMat as any).albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Dark gray
  (bodyMat as any).specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
  bodyMat.specularPower = 32;

  const windowMat = new BABYLON.StandardMaterial('windowMat', scene);
  (windowMat as any).albedoColor = new BABYLON.Color3(0.5, 0.7, 0.9);
  windowMat.alpha = 0.6;

  const wheelMat = new BABYLON.StandardMaterial('wheelMat', scene);
  (wheelMat as any).albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  (wheelMat as any).specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  const bumpMat = new BABYLON.StandardMaterial('bumpMat', scene);
  (bumpMat as any).albedoColor = new BABYLON.Color3(0.4, 0.4, 0.4);

  // Define vehicle dimensions based on type
  const vehicleDims = getVehicleDimensions(vehicleType);

  // Main body (box - simplified)
  const body = BABYLON.MeshBuilder.CreateBox('body', { 
    width: vehicleDims.width, 
    height: vehicleDims.bodyHeight, 
    depth: vehicleDims.depth 
  }, scene);
  body.position.y = vehicleDims.bodyY;
  body.parent = carRoot;
  body.material = bodyMat;

  // Roof
  const roof = BABYLON.MeshBuilder.CreateBox('roof', { 
    width: vehicleDims.width - 0.2, 
    height: vehicleDims.roofHeight, 
    depth: vehicleDims.roofDepth 
  }, scene);
  roof.position = new BABYLON.Vector3(0, vehicleDims.roofY, vehicleDims.roofZ);
  roof.parent = carRoot;
  roof.material = bodyMat;

  // Front windshield
  const windshield = BABYLON.MeshBuilder.CreateBox(
    'windshield',
    { width: vehicleDims.width - 0.1, height: 0.5, depth: 0.3 },
    scene
  );
  windshield.position = new BABYLON.Vector3(0, vehicleDims.windshieldY, vehicleDims.windshieldZ);
  windshield.rotation.z = -0.2;
  windshield.parent = carRoot;
  windshield.material = windowMat;

  // Rear window
  const rearWindow = BABYLON.MeshBuilder.CreateBox(
    'rearWindow',
    { width: vehicleDims.width - 0.2, height: 0.4, depth: 0.2 },
    scene
  );
  rearWindow.position = new BABYLON.Vector3(0, vehicleDims.rearWindowY, vehicleDims.rearWindowZ);
  rearWindow.rotation.z = 0.1;
  rearWindow.parent = carRoot;
  rearWindow.material = windowMat;

  // Front bumper
  const frontBumper = BABYLON.MeshBuilder.CreateBox(
    'frontBumper',
    { width: vehicleDims.width + 0.1, height: 0.3, depth: 0.2 },
    scene
  );
  frontBumper.position = new BABYLON.Vector3(0, 0.15, vehicleDims.depth / 2 + 0.1);
  frontBumper.parent = carRoot;
  frontBumper.material = bumpMat;

  // Rear bumper
  const rearBumper = BABYLON.MeshBuilder.CreateBox(
    'rearBumper',
    { width: vehicleDims.width + 0.1, height: 0.3, depth: 0.2 },
    scene
  );
  rearBumper.position = new BABYLON.Vector3(0, 0.15, -(vehicleDims.depth / 2 + 0.1));
  rearBumper.parent = carRoot;
  rearBumper.material = bumpMat;

  // Wheels (cylinder for more realistic look)
  const wheelSize = vehicleType === 'suv' || vehicleType === 'truck' ? 0.75 : vehicleType === 'hatchback' ? 0.6 : 0.65;
  const wheelWidth = vehicleType === 'suv' || vehicleType === 'truck' ? 0.5 : 0.4;
  const wheelY = vehicleType === 'suv' ? 0.5 : vehicleType === 'bakkie' || vehicleType === 'truck' ? 0.45 : 0.35;

  const wheelPositions = [
    new BABYLON.Vector3(-(vehicleDims.width / 2 + 0.15), wheelY, vehicleDims.depth / 2 - 0.8),
    new BABYLON.Vector3(vehicleDims.width / 2 + 0.15, wheelY, vehicleDims.depth / 2 - 0.8),
    new BABYLON.Vector3(-(vehicleDims.width / 2 + 0.15), wheelY, -(vehicleDims.depth / 2 - 0.8)),
    new BABYLON.Vector3(vehicleDims.width / 2 + 0.15, wheelY, -(vehicleDims.depth / 2 - 0.8)),
  ];

  wheelPositions.forEach((pos) => {
    const wheel = BABYLON.MeshBuilder.CreateCylinder('wheel', { diameter: wheelSize, height: wheelWidth }, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.position = pos;
    wheel.parent = carRoot;
    wheel.material = wheelMat;

    // Rim
    const rimSize = wheelSize * 0.75;
    const rim = BABYLON.MeshBuilder.CreateTorus('rim', { diameter: rimSize, thickness: rimSize * 0.2 }, scene);
    rim.position = pos;
    rim.parent = carRoot;
    rim.material = wheelMat;
  });

  // Side mirrors
  const mirrorPositions = [
    new BABYLON.Vector3(-(vehicleDims.width / 2 + 0.35), vehicleDims.bodyY + 0.2, vehicleDims.depth / 4),
    new BABYLON.Vector3(vehicleDims.width / 2 + 0.35, vehicleDims.bodyY + 0.2, vehicleDims.depth / 4),
  ];

  mirrorPositions.forEach((pos) => {
    const mirror = BABYLON.MeshBuilder.CreateBox('mirror', { width: 0.15, height: 0.2, depth: 0.1 }, scene);
    mirror.position = pos;
    mirror.parent = carRoot;
    mirror.material = bodyMat;
  });

  // Headlights
  const headlightPositions = [
    new BABYLON.Vector3(-(vehicleDims.width / 2 - 0.3), vehicleDims.bodyY + 0.15, vehicleDims.depth / 2 + 0.05),
    new BABYLON.Vector3(vehicleDims.width / 2 - 0.3, vehicleDims.bodyY + 0.15, vehicleDims.depth / 2 + 0.05),
  ];

  const lightMat = new BABYLON.StandardMaterial('lightMat', scene);
  (lightMat as any).albedoColor = new BABYLON.Color3(1, 1, 0.7);
  lightMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0);

  headlightPositions.forEach((pos) => {
    const headlight = BABYLON.MeshBuilder.CreateSphere('headlight', { diameter: 0.15 }, scene);
    headlight.position = pos;
    headlight.parent = carRoot;
    headlight.material = lightMat;
  });

  // Taillights
  const taillightPositions = [
    new BABYLON.Vector3(-(vehicleDims.width / 2 - 0.3), vehicleDims.bodyY + 0.15, -(vehicleDims.depth / 2 + 0.05)),
    new BABYLON.Vector3(vehicleDims.width / 2 - 0.3, vehicleDims.bodyY + 0.15, -(vehicleDims.depth / 2 + 0.05)),
  ];

  const tailMat = new BABYLON.StandardMaterial('tailMat', scene);
  (tailMat as any).albedoColor = new BABYLON.Color3(1, 0.2, 0.2);
  tailMat.emissiveColor = new BABYLON.Color3(0.5, 0, 0);

  taillightPositions.forEach((pos) => {
    const taillight = BABYLON.MeshBuilder.CreateSphere('taillight', { diameter: 0.15 }, scene);
    taillight.position = pos;
    taillight.parent = carRoot;
    taillight.material = tailMat;
  });

  return carRoot;
}

export default Vehicle3DModel;
