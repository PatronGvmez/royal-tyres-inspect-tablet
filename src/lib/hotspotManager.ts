import * as BABYLON from 'babylonjs';
import { Hotspot, InspectionAngle } from '@/types';

/**
 * Hotspot Management System for 360° Inspection
 * Handles creation, management, and interaction with inspection hotspots
 */

export interface HotspotConfig {
  id: string;
  position: { x: number; y: number; z: number };
  color?: BABYLON.Color3;
  size?: number;
  label: string;
  onClick?: () => void;
  isClickable?: boolean;
}

export class HotspotManager {
  private hotspots: Map<string, Hotspot> = new Map();
  private spheres: Map<string, BABYLON.Mesh> = new Map();
  private scene: BABYLON.Scene;
  private glowLayer: BABYLON.GlowLayer;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    // Single shared GlowLayer for all hotspots — avoids GPU memory leak
    this.glowLayer = new BABYLON.GlowLayer('hotspot-glow', scene);
    this.glowLayer.intensity = 1.5;
  }

  /**
   * Add a new hotspot to the scene
   */
  public addHotspot(config: HotspotConfig, angle: InspectionAngle): BABYLON.Mesh {
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      `hotspot-${config.id}`,
      { segments: 16, diameter: config.size || 0.3 },
      this.scene
    );

    sphere.position = new BABYLON.Vector3(config.position.x, config.position.y, config.position.z);

    const material = new BABYLON.StandardMaterial(`mat-${config.id}`, this.scene);
    material.emissiveColor = config.color || new BABYLON.Color3(1, 0.2, 0.2);
    material.alpha = 0.7;
    sphere.material = material;

    this.glowLayer.addIncludedOnlyMesh(sphere);

    // Store hotspot data
    const hotspot: Hotspot = {
      id: config.id,
      angle,
      position: config.position,
      label: config.label,
    };

    this.hotspots.set(config.id, hotspot);
    this.spheres.set(config.id, sphere);

    // Add click handler if provided
    if (config.onClick && config.isClickable !== false) {
      this.scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
          const pickResult = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh) => mesh === sphere
          );
          if (pickResult?.hit) {
            config.onClick?.();
          }
        }
      });
    }

    return sphere;
  }

  /**
   * Remove a hotspot from the scene
   */
  public removeHotspot(id: string): void {
    const sphere = this.spheres.get(id);
    if (sphere) {
      sphere.dispose();
      this.spheres.delete(id);
    }
    this.hotspots.delete(id);
  }

  /**
   * Get hotspot by ID
   */
  public getHotspot(id: string): Hotspot | null {
    return this.hotspots.get(id) || null;
  }

  /**
   * Get all hotspots for a specific angle
   */
  public getHotspotsByAngle(angle: InspectionAngle): Hotspot[] {
    return Array.from(this.hotspots.values()).filter((h) => h.angle === angle);
  }

  /**
   * Update hotspot position
   */
  public updateHotspotPosition(id: string, position: { x: number; y: number; z: number }): void {
    const sphere = this.spheres.get(id);
    const hotspot = this.hotspots.get(id);

    if (sphere) {
      sphere.position = new BABYLON.Vector3(position.x, position.y, position.z);
    }

    if (hotspot) {
      hotspot.position = position;
      this.hotspots.set(id, hotspot);
    }
  }

  /**
   * Change hotspot color (for severity indication)
   */
  public setHotspotSeverityColor(id: string, severity: 'pass' | 'warning' | 'fail'): void {
    const sphere = this.spheres.get(id);
    if (!sphere || !(sphere.material instanceof BABYLON.StandardMaterial)) return;

    let color = new BABYLON.Color3(0, 1, 0); // Green for pass

    if (severity === 'warning') {
      color = new BABYLON.Color3(1, 1, 0); // Yellow for warning
    } else if (severity === 'fail') {
      color = new BABYLON.Color3(1, 0, 0); // Red for fail
    }

    (sphere.material as BABYLON.StandardMaterial).emissiveColor = color;
  }

  /**
   * Show/hide a hotspot
   */
  public setHotspotVisibility(id: string, visible: boolean): void {
    const sphere = this.spheres.get(id);
    if (sphere) {
      sphere.isVisible = visible;
    }
  }

  /**
   * Clear all hotspots
   */
  public clearAll(): void {
    Array.from(this.spheres.values()).forEach((sphere) => sphere.dispose());
    this.spheres.clear();
    this.hotspots.clear();
  }

  /**
   * Get all hotspots
   */
  public getAllHotspots(): Hotspot[] {
    return Array.from(this.hotspots.values());
  }

  /**
   * Get sphere mesh for a hotspot
   */
  public getHotspotMesh(id: string): BABYLON.Mesh | null {
    return this.spheres.get(id) || null;
  }
}

/**
 * Raycaster utility for coordinate projection
 * Used by the coordinate finder tool
 */
export class CoordinateFinder {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Get 3D coordinates from screen position
   * Used for the coordinate finder tool
   */
  public getCoordinatesFromClick(screenX: number, screenY: number): {
    x: number;
    y: number;
    z: number;
  } | null {
    // Create a ray from camera through the click point
    const engine = this.scene.getEngine();
    const canvasWidth = engine.getRenderWidth();
    const canvasHeight = engine.getRenderHeight();

    const x = (screenX / canvasWidth) * 2 - 1;
    const y = (screenY / canvasHeight) * 2 - 1;

    const forward = this.camera.getDirection(BABYLON.Axis.Z);
    const right = BABYLON.Vector3.Cross(forward, BABYLON.Axis.Y).normalize();
    const up = BABYLON.Vector3.Cross(right, forward).normalize();

    const rayOrigin = this.camera.position.clone();
    const rayDirection = forward
      .scale(1)
      .add(right.scale(x * 0.5))
      .add(up.scale(y * 0.5))
      .normalize();

    const ray = new BABYLON.Ray(rayOrigin, rayDirection, 100);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh !== null);

    if (hit && hit.hit && hit.pickedPoint) {
      return {
        x: parseFloat(hit.pickedPoint.x.toFixed(3)),
        y: parseFloat(hit.pickedPoint.y.toFixed(3)),
        z: parseFloat(hit.pickedPoint.z.toFixed(3)),
      };
    }

    return null;
  }

  /**
   * Project coordinates to screen space
   */
  public projectToScreen(
    position: BABYLON.Vector3
  ): { x: number; y: number } | null {
    const engine = this.scene.getEngine();
    const canvasWidth = engine.getRenderWidth();
    const canvasHeight = engine.getRenderHeight();

    const screen = BABYLON.Vector3.Project(
      position,
      BABYLON.Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(canvasWidth, canvasHeight)
    );

    return {
      x: screen.x,
      y: screen.y,
    };
  }
}
