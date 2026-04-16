import { JobCard, InspectionReport, User } from '@/types';

export const mockUsers: User[] = [
  { id: '1', name: 'John Mechanic', role: 'mechanic', email: 'john@royaltyres.com' },
  { id: '2', name: 'Sarah Manager', role: 'admin', email: 'sarah@royaltyres.com' },
];

export const mockJobCards: JobCard[] = [
  {
    id: 'JC-001',
    vehicle_id: 'V001',
    customer_name: 'Marcus Johnson',
    license_plate: 'CA 452-890',
    status: 'booked',
    service_details: 'Replace 4x Tyres & Wheel Alignment',
    image_url: '/sedanfront.png',
    vehicle_type: 'sedan',
  },
  {
    id: 'JC-002',
    vehicle_id: 'V002',
    customer_name: 'Linda Nkosi',
    license_plate: 'GP 128-TTM',
    status: 'in_progress',
    service_details: 'Front Brake Pads & Disc Replacement',
    image_url: '/hatchback-front.png',
    vehicle_type: 'hatchback',
  },
  {
    id: 'JC-003',
    vehicle_id: 'V003',
    customer_name: 'David Smith',
    license_plate: 'WC 331-KLN',
    status: 'booked',
    service_details: '2x Rear Tyres & Balancing',
    image_url: '/sedanback.png',
    vehicle_type: 'sedan',
  },
  {
    id: 'JC-004',
    vehicle_id: 'V004',
    customer_name: 'Priya Naidoo',
    license_plate: 'KZN 778-PRY',
    status: 'test_drive',
    service_details: 'Suspension & Shock Absorber Check',
    image_url: '/hatchback-front1.png',
    vehicle_type: 'hatchback',
  },
  {
    id: 'JC-005',
    vehicle_id: 'V005',
    customer_name: 'James Williams',
    license_plate: 'EC 901-JWL',
    status: 'completed',
    service_details: 'Full Service & 4x Tyres',
    image_url: '/sedanfront.png',
    vehicle_type: 'sedan',
  },
];

export const mockInspectionReports: InspectionReport[] = [
  {
    id: 'IR-001',
    job_card_id: 'JC-005',
    inspection_type: 'pre_service',
    odometer: 87432,
    fuel_level: '3/4',
    tire_conditions: {
      front_left: 'Worn - 2mm tread',
      front_right: 'Worn - 1.5mm tread',
      rear_left: 'Fair - 3mm tread',
      rear_right: 'Good - 5mm tread',
    },
    damages: [
      { part: 'Front Bumper', damage_type: 'scratch', severity: 'minor', coordinates: { x: 50, y: 8 } },
      { part: 'Rear Left Door', damage_type: 'dent', severity: 'major', coordinates: { x: 25, y: 55 } },
    ],
    signature_url: 'data:image/png;base64,mock',
  },
];
