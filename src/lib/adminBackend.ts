/**
 * Admin Backend Operations
 * Server-side admin functions using Firebase Admin SDK
 * 
 * NOTE: These operations require the Firebase Admin SDK service account
 * Service account file: royaltyersapp-firebase-adminsdk-fbsvc-406c1fbf93.json
 * 
 * In production, these should run on a backend server (Node.js/Express)
 * Never expose the service account private key in client-side code!
 */

import { JobCard, InspectionReport, User, VehicleInfo } from '@/types';

/**
 * Admin utility functions that require server-side implementation
 * These are referenced here but should be implemented on your backend
 */

/**
 * Create a new job card with vehicle information
 * ADMIN ONLY: Requires admin privileges
 */
export async function createJobCard(
  customer_name: string,
  license_plate: string,
  vehicle_info: VehicleInfo,
  service_details: string,
  admin_uid: string
): Promise<{ success: boolean; job_id?: string; error?: string }> {
  try {
    // This should be called from your backend API endpoint
    // Example backend endpoint: POST /api/admin/jobs
    const response = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin_uid}`,
      },
      body: JSON.stringify({
        customer_name,
        license_plate,
        vehicle_info,
        service_details,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create job card');
    }

    const data = await response.json();
    return { success: true, job_id: data.id };
  } catch (error) {
    console.error('Error creating job card:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk import job cards with CSV data
 * ADMIN ONLY: Requires admin privileges
 */
export async function bulkImportJobCards(
  jobsData: Array<{
    customer_name: string;
    license_plate: string;
    vehicle_info: VehicleInfo;
    service_details: string;
  }>,
  admin_uid: string
): Promise<{ success: boolean; imported: number; failed: number; errors?: string[] }> {
  try {
    const response = await fetch('/api/admin/jobs/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin_uid}`,
      },
      body: JSON.stringify({ jobs: jobsData }),
    });

    if (!response.ok) {
      throw new Error('Failed to bulk import jobs');
    }

    return await response.json();
  } catch (error) {
    console.error('Error bulk importing jobs:', error);
    return {
      success: false,
      imported: 0,
      failed: jobsData.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Generate admin reports
 * ADMIN ONLY: Requires admin privileges
 */
export async function generateAdminReport(
  report_type: 'daily' | 'weekly' | 'monthly',
  admin_uid: string
): Promise<{ success: boolean; report_url?: string; error?: string }> {
  try {
    const response = await fetch(`/api/admin/reports/${report_type}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${admin_uid}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate report');
    }

    const data = await response.json();
    return { success: true, report_url: data.url };
  } catch (error) {
    console.error('Error generating report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get admin statistics and analytics
 * ADMIN ONLY: Requires admin privileges
 */
export async function getAdminStats(
  admin_uid: string
): Promise<{
  success: boolean;
  stats?: {
    total_jobs: number;
    completed_jobs: number;
    in_progress_jobs: number;
    booked_jobs: number;
    test_drive_jobs: number;
    completion_rate: number;
    average_inspection_time: number;
    most_common_damage_type: string;
  };
  error?: string;
}> {
  try {
    const response = await fetch('/api/admin/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${admin_uid}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    const data = await response.json();
    return { success: true, stats: data };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Assign mechanics to jobs
 * ADMIN ONLY: Requires admin privileges
 */
export async function assignMechanicToJob(
  job_id: string,
  mechanic_uid: string,
  admin_uid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/admin/jobs/${job_id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin_uid}`,
      },
      body: JSON.stringify({ mechanic_uid }),
    });

    if (!response.ok) {
      throw new Error('Failed to assign job');
    }

    return { success: true };
  } catch (error) {
    console.error('Error assigning job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a job and related data
 * ADMIN ONLY: Requires admin privileges
 */
export async function deleteJob(
  job_id: string,
  admin_uid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/admin/jobs/${job_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${admin_uid}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete job');
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Archive completed jobs
 * ADMIN ONLY: Requires admin privileges
 */
export async function archiveCompletedJobs(
  days_after_completion: number,
  admin_uid: string
): Promise<{ success: boolean; archived: number; error?: string }> {
  try {
    const response = await fetch('/api/admin/jobs/archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin_uid}`,
      },
      body: JSON.stringify({ days: days_after_completion }),
    });

    if (!response.ok) {
      throw new Error('Failed to archive jobs');
    }

    const data = await response.json();
    return { success: true, archived: data.archived };
  } catch (error) {
    console.error('Error archiving jobs:', error);
    return {
      success: false,
      archived: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export inspection data as CSV
 * ADMIN ONLY: Requires admin privileges
 */
export async function exportInspectionData(
  date_from: string,
  date_to: string,
  admin_uid: string
): Promise<{ success: boolean; csv_url?: string; error?: string }> {
  try {
    const response = await fetch('/api/admin/export/inspections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admin_uid}`,
      },
      body: JSON.stringify({ date_from, date_to }),
    });

    if (!response.ok) {
      throw new Error('Failed to export data');
    }

    const data = await response.json();
    return { success: true, csv_url: data.url };
  } catch (error) {
    console.error('Error exporting data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate vehicle registration number (format check)
 * Can be used client-side for UX
 */
export function validateVehicleRegistration(registration: string): boolean {
  // South African registration format: e.g., "NK82ACE"
  // Adjust pattern based on your country's format
  const pattern = /^[A-Z]{2}\d{2}[A-Z]{3}$/;
  return pattern.test(registration.toUpperCase());
}

/**
 * Validate vehicle year
 */
export function validateVehicleYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 1;
}

/**
 * Format vehicle info for display
 */
export function formatVehicleInfo(vehicle: VehicleInfo): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.registration_number})`;
}

export default {
  createJobCard,
  bulkImportJobCards,
  generateAdminReport,
  getAdminStats,
  assignMechanicToJob,
  deleteJob,
  archiveCompletedJobs,
  exportInspectionData,
  validateVehicleRegistration,
  validateVehicleYear,
  formatVehicleInfo,
};
