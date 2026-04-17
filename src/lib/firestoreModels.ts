import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { User, JobCard, InspectionReport } from '@/types';

/**
 * ============================================================================
 * USER OPERATIONS
 * ============================================================================
 */

export const UserModel = {
  // Create or update user profile
  async upsert(userId: string, userData: Partial<User>) {
    const userRef = doc(db, 'users', userId);
    return setDoc(userRef, userData, { merge: true });
  },

  // Get user by ID
  async getById(userId: string): Promise<User | null> {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as User) : null;
  },

  // Get all users
  async getAll(): Promise<User[]> {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User));
    } catch {
      return [];
    }
  },

  // Get users by role
  async getByRole(role: 'admin' | 'mechanic'): Promise<User[]> {
    try {
      const q = query(collection(db, 'users'), where('role', '==', role));
      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as User));
    } catch {
      return [];
    }
  },

  // Get user by email
  async getByEmail(email: string): Promise<User | null> {
    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snap = await getDocs(q);
      return snap.empty ? null : (snap.docs[0].data() as User);
    } catch {
      return null;
    }
  },

  // Update user role
  async updateRole(userId: string, role: 'admin' | 'mechanic') {
    const userRef = doc(db, 'users', userId);
    return updateDoc(userRef, { role });
  },

  // Delete user
  async delete(userId: string) {
    return deleteDoc(doc(db, 'users', userId));
  },
};

/**
 * ============================================================================
 * JOB CARD OPERATIONS
 * ============================================================================
 */

export const JobCardModel = {
  // Create new job card
  async create(jobCardData: Omit<JobCard, 'id'>) {
    const jobRef = doc(collection(db, 'job_cards'));
    const jobCardWithId = { ...jobCardData, id: jobRef.id };
    await setDoc(jobRef, jobCardWithId);
    return jobCardWithId;
  },

  // Get job card by ID
  async getById(jobCardId: string): Promise<JobCard | null> {
    const jobRef = doc(db, 'job_cards', jobCardId);
    const snap = await getDoc(jobRef);
    return snap.exists() ? (snap.data() as JobCard) : null;
  },

  // Get all job cards with optional filters
  async getAll(constraints: QueryConstraint[] = []) {
    try {
      const q = query(collection(db, 'job_cards'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((doc) => doc.data() as JobCard);
    } catch {
      return [];
    }
  },

  // Get job cards by status
  async getByStatus(status: string) {
    return this.getAll([where('status', '==', status)]);
  },

  // Get job cards for mechanic
  async getForMechanic(mechanicId: string) {
    return this.getAll([where('assigned_mechanic_id', '==', mechanicId)]);
  },

  // Get recent job cards
  async getRecent(limitCount: number = 10) {
    return this.getAll([orderBy('created_at', 'desc'), limit(limitCount)]);
  },

  // Update job card
  async update(jobCardId: string, updates: Partial<JobCard>) {
    const jobRef = doc(db, 'job_cards', jobCardId);
    return updateDoc(jobRef, updates);
  },

  // Update status
  async updateStatus(jobCardId: string, status: string) {
    return this.update(jobCardId, { status });
  },

  // Delete job card
  async delete(jobCardId: string) {
    return deleteDoc(doc(db, 'job_cards', jobCardId));
  },

  // Get job cards by vehicle
  async getByVehicle(vehicleId: string) {
    return this.getAll([where('vehicle_id', '==', vehicleId)]);
  },
};

/**
 * ============================================================================
 * INSPECTION REPORT OPERATIONS
 * ============================================================================
 */

export const InspectionReportModel = {
  // Create new inspection report
  async create(reportData: Omit<InspectionReport, 'id'>) {
    const reportRef = doc(collection(db, 'inspection_reports'));
    const reportWithId = { ...reportData, id: reportRef.id, created_at: Timestamp.now() };
    await setDoc(reportRef, reportWithId);
    return reportWithId;
  },

  // Get inspection report by ID
  async getById(reportId: string): Promise<InspectionReport | null> {
    const reportRef = doc(db, 'inspection_reports', reportId);
    const snap = await getDoc(reportRef);
    return snap.exists() ? (snap.data() as InspectionReport) : null;
  },

  // Get all inspection reports
  async getAll(constraints: QueryConstraint[] = []) {
    try {
      const q = query(collection(db, 'inspection_reports'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((doc) => doc.data() as InspectionReport);
    } catch {
      return [];
    }
  },

  // Get reports for job card
  async getForJobCard(jobCardId: string) {
    return this.getAll([where('job_card_id', '==', jobCardId), orderBy('created_at', 'desc')]);
  },

  // Get reports by inspection type
  async getByType(inspectionType: string) {
    return this.getAll([where('inspection_type', '==', inspectionType)]);
  },

  // Get recent reports
  async getRecent(limitCount: number = 20) {
    return this.getAll([orderBy('created_at', 'desc'), limit(limitCount)]);
  },

  // Update inspection report
  async update(reportId: string, updates: Partial<InspectionReport>) {
    const reportRef = doc(db, 'inspection_reports', reportId);
    return updateDoc(reportRef, updates);
  },

  // Delete inspection report
  async delete(reportId: string) {
    return deleteDoc(doc(db, 'inspection_reports', reportId));
  },
};

/**
 * ============================================================================
 * STATISTICAL OPERATIONS
 * ============================================================================
 */

export const StatsModel = {
  // Get job stats
  async getJobStats() {
    try {
      const allJobs = await JobCardModel.getAll();
      return {
        total: allJobs.length,
        completed: allJobs.filter((j) => j.status === 'completed').length,
        in_progress: allJobs.filter((j) => j.status === 'in_progress').length,
        booked: allJobs.filter((j) => j.status === 'booked').length,
      };
    } catch {
      return { total: 0, completed: 0, in_progress: 0, booked: 0 };
    }
  },

  // Get mechanic stats
  async getMechanicStats(mechanicId: string) {
    try {
      const jobs = await JobCardModel.getForMechanic(mechanicId);
      return {
        total_assigned: jobs.length,
        completed: jobs.filter((j) => j.status === 'completed').length,
        in_progress: jobs.filter((j) => j.status === 'in_progress').length,
        pending: jobs.filter((j) => j.status === 'booked').length,
      };
    } catch {
      return { total_assigned: 0, completed: 0, in_progress: 0, pending: 0 };
    }
  },

  // Get inspection stats
  async getInspectionStats() {
    try {
      const reports = await InspectionReportModel.getAll();
      return {
        total_inspections: reports.length,
        pre_service: reports.filter((r) => r.inspection_type === 'pre_service').length,
        post_service: reports.filter((r) => r.inspection_type === 'post_service').length,
      };
    } catch {
      return { total_inspections: 0, pre_service: 0, post_service: 0 };
    }
  },
};
