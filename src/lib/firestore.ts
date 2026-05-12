import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { JobCard, InspectionReport, Inspection360, User, VehicleDamage } from '@/types';

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

/** Admin-only: update any user's name, role, or avatarVariant */
export async function updateUserByAdmin(
  uid: string,
  data: Partial<Pick<User, 'name' | 'role' | 'avatarVariant'>>
): Promise<void> {
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

/**
 * Mechanic acknowledges an unassigned job, claiming ownership.
 * Stamps mechanic_id onto the job card.
 */
export async function acknowledgeJob(jobId: string, mechanicId: string): Promise<void> {
  await updateDoc(doc(db, 'jobs', jobId), {
    mechanic_id: mechanicId,
    updated_at: serverTimestamp(),
  });
}

/**
 * Upload a base64-encoded photo to Firebase Storage and return the download URL.
 * This avoids storing large images in Firestore documents (1 MB limit).
 */
export async function uploadPhotoToStorage(
  base64Data: string,
  storagePath: string
): Promise<string> {
  try {
    // Convert base64 to Blob
    const byteString = atob(base64Data.split(',')[1] || base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      view[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/jpeg' });

    // Upload to storage
    const photoRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(photoRef, blob);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('Failed to upload photo to storage:', error);
    throw new Error(`Photo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function createJobCard(
  job: Omit<JobCard, 'id'>
): Promise<JobCard> {
  const id = `JC-${Date.now()}`;
  const payload = { ...job, id };
  
  // Remove undefined values to keep document size under Firestore's 1 MB limit
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  );
  
  await setDoc(doc(db, 'jobs', id), {
    ...cleanPayload,
    created_at: serverTimestamp(),
  });
  return payload;
}

export async function fetchJobCardById(id: string): Promise<JobCard | null> {
  const snap = await getDoc(doc(db, 'jobs', id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as JobCard) : null;
}

/**
 * Fetch all job cards that belong to a specific mechanic.
 * Intentionally avoids orderBy to prevent a composite-index requirement;
 * results are sorted in JS by created_at descending.
 */
export async function fetchJobsByMechanic(mechanicId: string): Promise<JobCard[]> {
  const snap = await getDocs(
    query(collection(db, 'jobs'), where('mechanic_id', '==', mechanicId))
  );
  const jobs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as JobCard));
  // Sort descending by created_at (Firestore Timestamp or epoch ms)
  return jobs.sort((a, b) => {
    const toMs = (v: unknown) => {
      if (!v) return 0;
      if (typeof v === 'object' && v !== null && 'seconds' in v) return (v as { seconds: number }).seconds * 1000;
      if (typeof v === 'number') return v;
      return 0;
    };
    return toMs(b.created_at) - toMs(a.created_at);
  });
}

/**
 * Compute per-mechanic job stats directly from the `jobs` collection.
 */
export async function fetchMechanicStats(mechanicId: string) {
  const jobs = await fetchJobsByMechanic(mechanicId);
  return {
    total_assigned: jobs.length,
    completed:   jobs.filter((j) => j.status === 'completed').length,
    in_progress: jobs.filter((j) => j.status === 'in_progress').length,
    pending:     jobs.filter((j) => j.status === 'booked').length,
    jobs,
  };
}

const SA_SEED_JOBS: Array<{
  customer_name: string; license_plate: string; status: JobCard['status'];
  service_details: string; vehicle_type: string;
  make: string; model: string; year: number; daysAgo: number;
}> = [
  { customer_name: 'Sipho Dlamini',      license_plate: 'CA 452-890',  status: 'booked', service_details: '4x Tyres & Wheel Alignment',            vehicle_type: 'sedan',    make: 'Toyota',        model: 'Corolla',  year: 2021, daysAgo: 0 },
  { customer_name: 'Thandi Nkosi',       license_plate: 'GP 128-TNK',  status: 'booked', service_details: 'Front Brake Pads & Disc Replacement',   vehicle_type: 'hatchback',make: 'VW',            model: 'Polo',     year: 2020, daysAgo: 1 },
  { customer_name: 'Bongani Zulu',       license_plate: 'WC 331-BZL',  status: 'booked', service_details: '2x Rear Tyres & Balancing',              vehicle_type: 'suv',      make: 'Ford',          model: 'Everest',  year: 2019, daysAgo: 2 },
  { customer_name: 'Ayanda Khumalo',     license_plate: 'KZN 744-AYK', status: 'booked', service_details: 'Suspension Check & 4x All-Terrain Tyres',vehicle_type: 'bakkie',   make: 'Toyota',        model: 'Hilux',    year: 2022, daysAgo: 3 },
  { customer_name: 'Lerato Molefe',      license_plate: 'EC 901-LRM',  status: 'booked', service_details: 'Full Service & 4x Truck Tyres',           vehicle_type: 'truck',    make: 'Hino',          model: '300',      year: 2018, daysAgo: 4 },
  { customer_name: 'Pieter van der Berg',license_plate: 'NW 987-PVB',  status: 'booked', service_details: '2x Front Tyres & Alignment',             vehicle_type: 'sedan',    make: 'BMW',           model: '3 Series', year: 2020, daysAgo: 5 },
  { customer_name: 'Fatima Davids',      license_plate: 'WC 147-FTD',  status: 'booked', service_details: 'Tyre Rotation & Nitrogen Fill',           vehicle_type: 'hatchback',make: 'Hyundai',       model: 'i20',      year: 2021, daysAgo: 6 },
  { customer_name: 'Ravi Naidoo',        license_plate: 'KZN 258-RVN', status: 'booked', service_details: 'Shock Absorbers & 4x Run-Flat Tyres',    vehicle_type: 'suv',      make: 'Nissan',        model: 'X-Trail',  year: 2023, daysAgo: 7 },
  { customer_name: 'Zanele Mokoena',     license_plate: 'GP 369-ZNM',  status: 'booked', service_details: 'Wheel Alignment & Balancing',            vehicle_type: 'bakkie',   make: 'Isuzu',         model: 'D-Max',    year: 2021, daysAgo: 8 },
  { customer_name: 'Kobus du Plessis',   license_plate: 'FS 741-KDP',  status: 'booked', service_details: '4x Tyres & Balancing',                   vehicle_type: 'sedan',    make: 'Mercedes-Benz', model: 'C220',     year: 2019, daysAgo: 9 },
];

/**
 * Deletes ALL documents from jobs, job_photos, inspections, inspections360,
 * and nudges collections. Used by admins to reset the app to a clean state.
 */
export async function clearAllAppData(): Promise<void> {
  const COLLECTIONS = ['jobs', 'job_photos', 'inspections', 'inspections360', 'nudges'];
  for (const col of COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    if (snap.empty) continue;
    // Firestore batches are capped at 500 ops — chunk if needed
    const refs = snap.docs.map(d => d.ref);
    for (let i = 0; i < refs.length; i += 500) {
      const batch = writeBatch(db);
      refs.slice(i, i + 500).forEach(r => batch.delete(r));
      await batch.commit();
    }
  }
}

/**
 * Deletes ALL jobs in Firestore and re-seeds 10 realistic SA jobs,
 * distributing them evenly across all mechanics found in the `users` collection.
 */
export async function clearAndReseedJobs(): Promise<void> {
  const DAY_MS = 86_400_000;
  const now = Date.now();

  // 1. Delete existing jobs in a batch
  const existingSnap = await getDocs(collection(db, 'jobs'));
  if (existingSnap.docs.length > 0) {
    const delBatch = writeBatch(db);
    existingSnap.docs.forEach((d) => delBatch.delete(d.ref));
    await delBatch.commit();
  }

  // 2. Seed 10 new unassigned jobs
  const seedBatch = writeBatch(db);
  SA_SEED_JOBS.forEach((s, i) => {
    const createdAt = now - s.daysAgo * DAY_MS;
    const id = `JC-${createdAt - i}`;
    const ref = doc(db, 'jobs', id);
    // Seed jobs are intentionally unassigned — mechanics acknowledge to claim them
    seedBatch.set(ref, {
      id,
      vehicle_id: `V-${createdAt - i}`,
      customer_name: s.customer_name,
      license_plate: s.license_plate,
      vehicle_type: s.vehicle_type,
      service_details: s.service_details,
      status: s.status,
      make: s.make,
      model: s.model,
      year: s.year,
      created_at: Timestamp.fromMillis(createdAt),
    });
  });
  await seedBatch.commit();
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
  // Cap all signature blobs at 200 KB each to stay well under Firestore's 1 MB document limit.
  const MAX_SIG = 204_800;
  // Cap each damage photo at 100 KB — damage photos should already be compressed at upload
  // time, but this is a backstop against old uncompressed photos that may be in state.
  const MAX_PHOTO = 102_400;
  const cap = (s: string | undefined, max: number) => (s && s.length > max ? s.slice(0, max) : s);
  const truncated = {
    ...report,
    signature_url: cap(report.signature_url, MAX_SIG),
    mechanic_signature_url: cap(report.mechanic_signature_url, MAX_SIG),
    customer_signature_url: cap(report.customer_signature_url, MAX_SIG),
    damages: report.damages.map(d =>
      d.photo_url ? { ...d, photo_url: cap(d.photo_url, MAX_PHOTO) } : d
    ),
  };
  // JSON round-trip strips ALL undefined values — top-level and nested inside objects/arrays.
  // Prevents both "Unsupported field value: undefined" and
  // "Property array contains an invalid nested entity" from Firestore.
  const payload = JSON.parse(JSON.stringify(truncated)) as Record<string, unknown>;
  console.log('[saveReport] sizes (bytes)', {
    total: JSON.stringify(payload).length,
    mechSig: (payload.mechanic_signature_url as string | undefined)?.length ?? 0,
    custSig: (payload.customer_signature_url as string | undefined)?.length ?? 0,
    damages: JSON.stringify(payload.damages).length,
  });
  // Use job_card_id as the document ID so re-submissions always overwrite the
  // previous report for the same job — prevents stale old docs from being returned.
  await setDoc(doc(db, 'inspections', report.job_card_id), {
    ...payload,
    saved_at: serverTimestamp(),
  });
}

export async function fetchInspectionReport(
  jobCardId: string
): Promise<InspectionReport | null> {
  // 1. Try new format first — document ID equals job_card_id (set after the fix)
  const directSnap = await getDoc(doc(db, 'inspections', jobCardId));
  if (directSnap.exists()) return directSnap.data() as InspectionReport;

  // 2. Fall back to legacy format — documents were stored under IR-<timestamp> IDs,
  //    ordered by saved_at descending so the most recent submission wins.
  const legacyQ = query(
    collection(db, 'inspections'),
    where('job_card_id', '==', jobCardId),
    orderBy('saved_at', 'desc'),
  );
  const legacySnap = await getDocs(legacyQ);
  if (legacySnap.empty) return null;
  return legacySnap.docs[0].data() as InspectionReport;
}

// ─── Inspection Drafts (auto-save for in-progress work) ───────────────────────

export interface InspectionDraft {
  job_card_id: string;
  tires: { front_left: string; front_right: string; rear_left: string; rear_right: string };
  damages: VehicleDamage[];
  tyreAdjustments: Record<string, Partial<Record<string, { x: number; y: number }>>>;
  customerName: string;
  saved_at?: unknown;
}

/** Persist in-progress inspection form state so mechanics can resume after navigating away. */
export async function saveInspectionDraft(
  jobId: string,
  draft: Omit<InspectionDraft, 'saved_at'>
): Promise<void> {
  // Cap each damage photo at 100 KB so the draft stays well under Firestore's 1 MB limit.
  const MAX_PHOTO = 102_400;
  const capped = {
    ...draft,
    damages: draft.damages.map(d =>
      d.photo_url && d.photo_url.length > MAX_PHOTO
        ? { ...d, photo_url: d.photo_url.slice(0, MAX_PHOTO) }
        : d
    ),
  };
  // JSON round-trip strips undefined so Firestore never rejects the auto-save payload
  // (damages array items have optional view/photo_url that can be undefined).
  const payload = JSON.parse(JSON.stringify(capped)) as Record<string, unknown>;
  await setDoc(doc(db, 'inspection_drafts', jobId), {
    ...payload,
    saved_at: serverTimestamp(),
  });
}

/** Load a previously saved draft for a job. Returns null if none exists. */
export async function fetchInspectionDraft(jobId: string): Promise<InspectionDraft | null> {
  const snap = await getDoc(doc(db, 'inspection_drafts', jobId));
  return snap.exists() ? (snap.data() as InspectionDraft) : null;
}

/** Remove the draft once the inspection has been fully submitted. */
export async function deleteInspectionDraft(jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'inspection_drafts', jobId));
}

/**
 * Saves a set of per-angle vehicle photos (compressed base64 data URLs) to a
 * dedicated `job_photos` collection so they survive page refreshes.
 * Images are compressed client-side before this call so each stays well under 150 KB.
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
 * Images are compressed client-side before this call so the document stays under 1 MB.
 */
export async function save360Inspection(
  inspection: Inspection360
): Promise<void> {
  await setDoc(doc(db, 'inspections360', inspection.id), {
    ...inspection,
    has_images: Object.keys(inspection.images).length > 0,
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
