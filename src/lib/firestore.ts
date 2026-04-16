import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { JobCard, InspectionReport, Inspection360, User } from '@/types';

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function createUserProfile(uid: string, data: User): Promise<void> {
  await setDoc(doc(db, 'users', uid), data);
}

export async function updateUserProfile(uid: string, data: Partial<Pick<User, 'name' | 'email'>>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data);
}

// ─── Job Cards ────────────────────────────────────────────────────────────────

export async function fetchJobCards(): Promise<JobCard[]> {
  const snap = await getDocs(
    query(collection(db, 'jobs'), orderBy('created_at', 'desc'))
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as JobCard));
}

export async function updateJobCardStatus(
  id: string,
  status: JobCard['status']
): Promise<void> {
  await updateDoc(doc(db, 'jobs', id), { status, updated_at: serverTimestamp() });
}

export async function createJobCard(
  job: Omit<JobCard, 'id'>
): Promise<JobCard> {
  const id = `JC-${Date.now()}`;
  const payload = { ...job, id };
  await setDoc(doc(db, 'jobs', id), {
    ...payload,
    created_at: serverTimestamp(),
  });
  return payload;
}

export async function fetchJobCardById(id: string): Promise<JobCard | null> {
  const snap = await getDoc(doc(db, 'jobs', id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as JobCard) : null;
}

/**
 * Seeds the jobs collection with sample data if it is empty.
 * If the collection already exists, patches any existing docs that are
 * missing vehicle_type so the dashboard images render correctly.
 */
export async function seedJobCards(jobs: JobCard[]): Promise<void> {
  const snap = await getDocs(collection(db, 'jobs'));
  if (snap.empty) {
    for (const job of jobs) {
      await setDoc(doc(db, 'jobs', job.id), {
        ...job,
        created_at: serverTimestamp(),
      });
    }
    return;
  }
  // Patch existing records that are missing vehicle_type
  const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as JobCard;
    if (!data.vehicle_type && byId[docSnap.id]?.vehicle_type) {
      await updateDoc(doc(db, 'jobs', docSnap.id), {
        vehicle_type: byId[docSnap.id].vehicle_type,
      });
    }
  }
}

// ─── Inspection Reports ───────────────────────────────────────────────────────

export async function saveInspectionReport(report: InspectionReport): Promise<void> {
  // Truncate very large signature blobs (> 200 KB) to avoid Firestore's 1 MB doc limit
  const payload: InspectionReport = {
    ...report,
    signature_url:
      report.signature_url && report.signature_url.length > 204_800
        ? report.signature_url.slice(0, 204_800)
        : report.signature_url,
  };
  await setDoc(doc(db, 'inspections', report.id), {
    ...payload,
    saved_at: serverTimestamp(),
  });
}

export async function fetchInspectionReport(
  jobCardId: string
): Promise<InspectionReport | null> {
  const q = query(
    collection(db, 'inspections'),
    where('job_card_id', '==', jobCardId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as InspectionReport;
}

/**
 * Saves a set of per-angle vehicle photos (base64 data URLs) to a dedicated
 * `job_photos` collection so they survive page refreshes and back-navigation.
 * Stored separately from the job card to keep the jobs collection lean.
 */
export async function saveJobPhotos(
  jobId: string,
  photos: Partial<Record<string, string>>
): Promise<void> {
  await setDoc(doc(db, 'job_photos', jobId), {
    photos,
    saved_at: serverTimestamp(),
  });
}

/**
 * Fetches the saved per-angle photos for a given job.
 * Returns an empty object if no photos have been saved yet.
 */
export async function fetchJobPhotos(
  jobId: string
): Promise<Partial<Record<string, string>>> {
  const snap = await getDoc(doc(db, 'job_photos', jobId));
  if (!snap.exists()) return {};
  return (snap.data().photos ?? {}) as Partial<Record<string, string>>;
}

/**
 * Fetches the front photo for every job that has uploaded photos, in a single
 * collection read. Returns a map of { [jobId]: frontPhotoDataUrl }.
 */
export async function fetchAllJobFrontPhotos(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, 'job_photos'));
  const result: Record<string, string> = {};
  snap.docs.forEach((d) => {
    const front = (d.data().photos as Record<string, string> | undefined)?.front;
    if (front) result[d.id] = front;
  });
  return result;
}

/**
 * Fetches ALL angle photos for every job in a single collection read.
 * Returns a map of { [jobId]: { front?: url, rear?: url, left?: url, right?: url, top?: url } }.
 */
export async function fetchAllJobPhotos(): Promise<Record<string, Partial<Record<string, string>>>> {
  const snap = await getDocs(collection(db, 'job_photos'));
  const result: Record<string, Partial<Record<string, string>>> = {};
  snap.docs.forEach((d) => {
    const photos = d.data().photos as Record<string, string> | undefined;
    if (photos && Object.keys(photos).length > 0) result[d.id] = photos;
  });
  return result;
}

// ─── 360° Inspections ─────────────────────────────────────────────────────────

/**
 * Saves a 360° inspection to Firestore.
 * Images are excluded because base64 data can exceed the 1 MB document limit.
 */
export async function save360Inspection(
  inspection: Inspection360
): Promise<void> {
  const { images: _images, ...rest } = inspection;
  await setDoc(doc(db, 'inspections360', inspection.id), {
    ...rest,
    has_images: Object.keys(_images).length > 0,
    saved_at: serverTimestamp(),
  });
}

// ─── Nudges (Admin → Mechanic notifications) ─────────────────────────────────

export interface Nudge {
  id: string;
  job_id: string;
  job_license_plate: string;
  customer_name: string;
  service_details: string;
  message: string;
  sent_at: { seconds: number; nanoseconds: number } | null;
  dismissed: boolean;
  /** Set to true automatically when mechanic completes the requested task */
  acknowledged?: boolean;
  /** Auto-populated response text when mechanic completes a task (e.g. "Photos uploaded") */
  response?: string;
  acknowledged_at?: { seconds: number; nanoseconds: number } | null;
}

/** Admin sends a reminder nudge for a specific job. */
export async function sendNudge(
  jobId: string,
  licensePlate: string,
  customerName: string,
  serviceDetails: string,
  message: string
): Promise<void> {
  const id = `nudge-${jobId}-${Date.now()}`;
  await setDoc(doc(db, 'nudges', id), {
    id,
    job_id: jobId,
    job_license_plate: licensePlate,
    customer_name: customerName,
    service_details: serviceDetails,
    message,
    sent_at: serverTimestamp(),
    dismissed: false,
    acknowledged: false,
  });
}

/** Fetch all undismissed nudges (mechanic dashboard polls this). */
export async function fetchActiveNudges(): Promise<Nudge[]> {
  const snap = await getDocs(
    query(
      collection(db, 'nudges'),
      where('dismissed', '==', false)
    )
  );
  const results = snap.docs.map(d => d.data() as Nudge);
  // Sort newest-first client-side (avoids composite index on dismissed + sent_at)
  return results.sort((a, b) => {
    const aTs = a.sent_at?.seconds ?? 0;
    const bTs = b.sent_at?.seconds ?? 0;
    return bTs - aTs;
  });
}

/** Fetch ALL nudges for a specific job (including dismissed) — for admin history view. */
export async function fetchNudgesForJob(jobId: string): Promise<Nudge[]> {
  const snap = await getDocs(
    query(collection(db, 'nudges'), where('job_id', '==', jobId))
  );
  const results = snap.docs.map(d => d.data() as Nudge);
  return results.sort((a, b) => {
    const aTs = a.sent_at?.seconds ?? 0;
    const bTs = b.sent_at?.seconds ?? 0;
    return bTs - aTs;
  });
}

/** Mechanic acknowledges a single nudge (task complete) — nudge stays visible with green state. */
export async function acknowledgeNudge(nudgeId: string, response: string): Promise<void> {
  await updateDoc(doc(db, 'nudges', nudgeId), {
    acknowledged: true,
    response,
    acknowledged_at: serverTimestamp(),
  });
}

/**
 * Auto-acknowledge all active unacknowledged nudges for a job when the mechanic
 * completes a task. Fire-and-forget — call with .catch(()=>{}) to avoid blocking.
 */
export async function acknowledgeNudgesForJob(jobId: string, response: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'nudges'),
      where('job_id', '==', jobId),
      where('dismissed', '==', false),
    )
  );
  const toAck = snap.docs.filter(d => !d.data().acknowledged);
  await Promise.all(toAck.map(d => acknowledgeNudge(d.id, response)));
}

/** Mechanic dismisses a nudge — removes it from the active list entirely. */
export async function dismissNudge(nudgeId: string): Promise<void> {
  await updateDoc(doc(db, 'nudges', nudgeId), { dismissed: true });
}
