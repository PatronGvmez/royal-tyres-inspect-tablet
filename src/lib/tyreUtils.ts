import { TyreOverlay } from '@/components/inspection/CarDiagram';

export const TYRE_CONDITIONS = [
  { value: 'very_bad', label: 'Very Bad',    color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  { value: 'fair',     label: 'Fair / Worn', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  { value: 'good',     label: 'Good',        color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
] as const;

export type TyreConditionValue = typeof TYRE_CONDITIONS[number]['value'];

export const TYRE_POSITIONS = [
  { key: 'front_left'  as const, label: 'Front Left'  },
  { key: 'front_right' as const, label: 'Front Right' },
  { key: 'rear_left'   as const, label: 'Rear Left'   },
  { key: 'rear_right'  as const, label: 'Rear Right'  },
];

type TyrePositionMap = Record<string, Partial<Record<string, { x: number; y: number }>>>;

export const TYRE_WHEEL_COORDS: Record<string, TyrePositionMap> = {
  // Coordinates are % within the padded diagram box (p-5 padding applied to photo container).
  // front/rear views: wheels at bottom corners of the car.
  // left/right side views: front wheel on the near side, rear wheel further back.
  sedan: {
    front_left:  { front: { x: 68, y: 87 }, left:  { x: 24, y: 82 }, top: { x: 60, y: 23 } },
    front_right: { front: { x: 32, y: 87 }, right: { x: 76, y: 82 }, top: { x: 40, y: 23 } },
    rear_left:   { rear:  { x: 68, y: 87 }, left:  { x: 76, y: 82 }, top: { x: 60, y: 73 } },
    rear_right:  { rear:  { x: 32, y: 87 }, right: { x: 24, y: 82 }, top: { x: 40, y: 73 } },
  },
  hatchback: {
    front_left:  { front: { x: 68, y: 87 }, left:  { x: 24, y: 81 }, top: { x: 60, y: 22 } },
    front_right: { front: { x: 32, y: 87 }, right: { x: 76, y: 81 }, top: { x: 40, y: 22 } },
    rear_left:   { rear:  { x: 68, y: 87 }, left:  { x: 76, y: 81 }, top: { x: 60, y: 74 } },
    rear_right:  { rear:  { x: 32, y: 87 }, right: { x: 24, y: 81 }, top: { x: 40, y: 74 } },
  },
  suv: {
    front_left:  { front: { x: 68, y: 85 }, left:  { x: 25, y: 79 }, top: { x: 59, y: 21 } },
    front_right: { front: { x: 32, y: 85 }, right: { x: 75, y: 79 }, top: { x: 41, y: 21 } },
    rear_left:   { rear:  { x: 68, y: 85 }, left:  { x: 75, y: 79 }, top: { x: 59, y: 75 } },
    rear_right:  { rear:  { x: 32, y: 85 }, right: { x: 25, y: 79 }, top: { x: 41, y: 75 } },
  },
  bakkie: {
    front_left:  { front: { x: 68, y: 83 }, left:  { x: 23, y: 77 }, top: { x: 60, y: 20 } },
    front_right: { front: { x: 32, y: 83 }, right: { x: 77, y: 77 }, top: { x: 40, y: 20 } },
    rear_left:   { rear:  { x: 68, y: 83 }, left:  { x: 77, y: 78 }, top: { x: 60, y: 77 } },
    rear_right:  { rear:  { x: 32, y: 83 }, right: { x: 23, y: 78 }, top: { x: 40, y: 77 } },
  },
  truck: {
    front_left:  { front: { x: 68, y: 81 }, left:  { x: 22, y: 76 }, top: { x: 60, y: 19 } },
    front_right: { front: { x: 32, y: 81 }, right: { x: 78, y: 76 }, top: { x: 40, y: 19 } },
    rear_left:   { rear:  { x: 68, y: 81 }, left:  { x: 77, y: 77 }, top: { x: 60, y: 78 } },
    rear_right:  { rear:  { x: 32, y: 81 }, right: { x: 23, y: 77 }, top: { x: 40, y: 78 } },
  },
};

/**
 * Build tyreOverlays for CarDiagram from a saved tire_conditions record.
 * Returns a map keyed by view angle (front/rear/left/right/top).
 */
export function buildTyreOverlays(
  tireConditions: Record<string, string>,
  vehicleType: string,
): Partial<Record<string, TyreOverlay[]>> {
  const typeMap = TYRE_WHEEL_COORDS[vehicleType] ?? TYRE_WHEEL_COORDS.suv;
  const result: Partial<Record<string, TyreOverlay[]>> = {};

  TYRE_POSITIONS.forEach(({ key, label }) => {
    const value = tireConditions[key];
    if (!value) return;
    const condition = TYRE_CONDITIONS.find((c) => c.value === value);
    if (!condition) return;
    const viewCoords = typeMap[key];
    if (!viewCoords) return;

    Object.entries(viewCoords).forEach(([view, coords]) => {
      if (!result[view]) result[view] = [];
      result[view]!.push({
        key,
        label,
        conditionLabel: condition.label,
        color: condition.color,
        x: coords.x,
        y: coords.y,
      });
    });
  });

  return result;
}
