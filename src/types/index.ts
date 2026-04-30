export interface VehicleInfo {
  registration_number: string; // MANDATORY
  make: string; // MANDATORY
  model: string; // MANDATORY
  year: number; // MANDATORY
  color?: string;
  vin?: string;
  vehicle_type?: string;
}

export interface JobCard {
  id: string;
  vehicle_id: string;
  customer_name: string;
  license_plate: string;
  status: 'booked' | 'in_progress' | 'completed';
  service_details: string;
  make?: string;
  model?: string;
  year?: number;
  image_url?: string;
  vehicle_type?: string;
  view_photos?: Partial<Record<'front' | 'rear' | 'left' | 'right' | 'top', string>>;
  /** ID of the mechanic who created / owns this job */
  mechanic_id?: string;
  /** Compressed base64 photo of the license plate (taken at job creation) */
  license_plate_photo?: string;
  /** Compressed base64 photo of the license disk — optional */
  disk_photo?: string;
  /** Odometer reading in km at time of job creation */
  odometer?: number;
  /** Firestore server timestamp — seconds + nanoseconds, or raw ms number */
  created_at?: { seconds: number; nanoseconds: number } | number | string;
  updated_at?: string;
}

export interface VehicleDamage {
  part: string;
  damage_type: 'scratch' | 'dent' | 'crack';
  severity: 'minor' | 'major';
  coordinates: { x: number; y: number };
  view?: 'top' | 'left' | 'right' | 'front' | 'rear';
  photo_url?: string;
}

export interface InspectionReport {
  id: string;
  job_card_id: string;
  inspection_type: 'pre_service' | 'post_service';
  vehicle_info?: VehicleInfo; // Vehicle details (optional for backward compatibility)
  odometer?: number;
  fuel_level?: string;
  tire_conditions: {
    front_left: string;
    front_right: string;
    rear_left: string;
    rear_right: string;
  };
  damages: VehicleDamage[];
  /** Mechanic-dragged tyre marker positions — keyed by tyre key then view angle */
  tyreAdjustments?: Record<string, Partial<Record<string, { x: number; y: number }>>>;
  /** @deprecated use mechanic_signature_url */
  signature_url?: string;
  mechanic_name?: string;
  mechanic_signature_url?: string;
  mechanic_signed_at?: string;
  customer_name?: string;
  customer_signature_url?: string;
  customer_signed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'mechanic';
  email: string;
  avatarVariant?: '1' | '2' | '3' | '4' | '5';
}

// 360° Inspection System Types
export type InspectionAngle = 'front' | 'left_side' | 'right_side' | 'rear' | 'top';

export interface Hotspot {
  id: string;
  angle: InspectionAngle;
  position: { x: number; y: number; z: number }; // 3D coordinates
  label: string;
  damage?: VehicleDamage;
  metadata?: Record<string, any>;
}

export interface Inspection360 {
  id: string;
  job_card_id: string;
  images: Partial<Record<InspectionAngle, string>>; // URL to equirectangular images
  hotspots: Hotspot[];
  labels: InspectionLabel[];
  status: 'in_progress' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface InspectionLabel {
  id: string;
  hotspot_id: string;
  angle: InspectionAngle;
  text: string;
  severity?: 'pass' | 'warning' | 'fail';
  data?: {
    psi?: number;
    depth?: string;
    condition?: string;
    [key: string]: any;
  };
}

export interface StatusReport {
  id: string;
  inspection_id: string;
  job_card_id: string;
  vehicle_info: {
    license_plate: string;
    customer_name: string;
    odometer: number;
  };
  labels: InspectionLabel[];
  summary: {
    total_issues: number;
    pass_count: number;
    warning_count: number;
    fail_count: number;
  };
  generated_at: string;
}
