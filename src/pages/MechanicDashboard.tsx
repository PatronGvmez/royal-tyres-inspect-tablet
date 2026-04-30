import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchJobCards, createJobCard, fetchAllJobPhotos, fetchActiveNudges, dismissNudge, acknowledgeNudge, acknowledgeJob } from '@/lib/firestore';
import { JobCard } from '@/types';
import { Nudge } from '@/lib/firestore';
import {
  Car, ClipboardCheck, ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  Wrench, AlertCircle, Gauge, CalendarDays, Plus, X, Bell,
  User as UserIcon, Hash, FileText, Clock, TrendingUp,
  History, RotateCcw, Eye, Search, Camera, UserCheck,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { ViewAngle, viewLabels, vehicleViewSVGs, VehicleType } from '@/components/inspection/VehicleSVGs';
import VehicleCardCarousel from '@/components/VehicleCardCarousel';
import MechanicAvatar from '@/components/MechanicAvatar';
import RoyalTyresIcon from '@/components/RoyalTyresIcon';
import { toast } from 'sonner';
import { useTour } from '@/hooks/use-tour';
import type { TourStep } from '@/hooks/use-tour';
import AppTour from '@/components/AppTour';

const MECHANIC_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'mechanic-profile-card',
    title: 'Your Profile Card',
    description: 'This is your personal workspace. Your name, date, and live queue summary are shown here.',
    placement: 'right',
  },
  {
    targetId: 'add-new-car-btn',
    title: 'Add a New Car',
    description: 'Tap here to register a new vehicle for inspection. You can enter the customer name, license plate, vehicle type and service details.',
    placement: 'right',
  },
  {
    targetId: 'mechanic-stats',
    title: 'Your Job Stats',
    description: 'A quick snapshot of your workload — booked jobs, active inspections, and completed jobs.',
    placement: 'right',
  },
  {
    targetId: 'search-filter-bar',
    title: 'Search & Filter',
    description: 'Search by customer name, license plate or job ID. Use the tabs to filter by status: All, My Jobs, Booked, In Progress, or Completed.',
    placement: 'bottom',
  },
  {
    targetId: 'incoming-jobs-section',
    title: 'Incoming Jobs',
    description: 'These are newly booked jobs available for any mechanic to claim. Tap a card and start by uploading photos of the vehicle.',
    placement: 'top',
  },
];

const today = new Date().toLocaleDateString('en-ZA', {
  weekday: 'long', day: 'numeric', month: 'long',
});

const statusLabel: Record<JobCard['status'], string> = {
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const statusClass: Record<JobCard['status'], string> = {
  booked: 'status-booked',
  in_progress: 'status-in-progress',
  completed: 'status-completed',
};

const statusAccent: Record<JobCard['status'], string> = {
  booked: 'hsl(var(--primary))',
  in_progress: 'hsl(var(--warning))',
  completed: 'hsl(var(--success))',
};

/** Returns the CTA label for an active job card. */
const getCtaLabel = (job: JobCard, hasPhotos: boolean): string => {
  if (job.status === 'booked' && !hasPhotos) return 'Add Photos';
  if (job.status === 'booked') return 'Start Inspection';
  if (job.status === 'in_progress') return 'Continue Inspection';
  return 'View Report';
};

/** Returns the 3-step workflow state for the progress strip. */
const getWorkflowSteps = (job: JobCard, hasPhotos: boolean) => [
  { label: 'Booked',  done: true,                                          active: !hasPhotos && job.status === 'booked' },
  { label: 'Photos',  done: hasPhotos || job.status !== 'booked',           active: !hasPhotos && job.status === 'booked' },
  { label: 'Inspect', done: job.status === 'in_progress' || job.status === 'completed', active: hasPhotos && job.status === 'booked' || job.status === 'in_progress' },
];

const VIEW_ANGLES: ViewAngle[] = ['front', 'rear', 'left', 'right'];

// Map vehicle_type → body style label shown in the Model dropdown
const VEHICLE_TYPE_TO_BODY: Record<string, string> = {
  sedan:    'Sedan',
  hatchback:'Hatchback',
  suv:      'SUV',
  bakkie:   'Bakkie',
  truck:    'Truck',
};
// Reverse map: body style label → vehicle_type key
const BODY_TO_VEHICLE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(VEHICLE_TYPE_TO_BODY).map(([k, v]) => [v, k])
);
const BODY_STYLE_OPTIONS = ['Sedan', 'Hatchback', 'SUV', 'Bakkie', 'Truck'];

const SERVICE_OPTIONS = [
  'Tyre Replacement',
  'Wheel Alignment',
  'Tyre Rotation & Balancing',
  'Other',
];

function compressImage(dataUrl: string, maxDim = 1024, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const vehicleTypeOptions = [
  { value: 'sedan',    label: 'Sedan'     },
  { value: 'hatchback',label: 'Hatchback' },
  { value: 'suv',      label: 'SUV'       },
  { value: 'bakkie',   label: 'Bakkie'    },
  { value: 'truck',    label: 'Truck'     },
];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';

/** Best-effort date label for a job card.
 *  Order: Firestore Timestamp → embedded ms timestamp in ID → "Historical" */
function getJobDateLabel(job: import('@/types').JobCard): string {
  let ms: number | null = null;
  if (job.created_at) {
    if (typeof job.created_at === 'object' && 'seconds' in job.created_at) {
      ms = job.created_at.seconds * 1000;
    } else if (typeof job.created_at === 'number') {
      ms = job.created_at;
    }
  }
  if (!ms) {
    const m = job.id.match(/JC-(\d{10,})/);
    if (m) ms = parseInt(m[1]);
  }
  if (!ms) return 'Historical';
  const d = new Date(ms);
  const now = new Date();
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Groups an array of job cards by their date label, preserving insertion order. */
function groupByDate(jobs: import('@/types').JobCard[]): { label: string; jobs: import('@/types').JobCard[] }[] {
  const map = new Map<string, import('@/types').JobCard[]>();
  jobs.forEach(j => {
    const label = getJobDateLabel(j);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(j);
  });
  return Array.from(map.entries()).map(([label, jobs]) => ({ label, jobs }));
}

const MechanicDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tour = useTour('mechanic', MECHANIC_TOUR_STEPS);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCompleted, setSelectedCompleted] = useState<JobCard | null>(null);
  const [reInspectService, setReInspectService] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [form, setForm] = useState({
    customer_name: '',
    license_plate: '',
    service_details: '',
    service_type: '',
    odometer: '',
    vehicle_type: 'sedan',
    model: VEHICLE_TYPE_TO_BODY['sedan'],
  });
  const [platePhoto, setPlatePhoto] = useState<string | null>(null);
  const [diskPhoto, setDiskPhoto] = useState<string | null>(null);
  const plateInputRef = useRef<HTMLInputElement>(null);
  const diskInputRef = useRef<HTMLInputElement>(null);

  const { data: allJobs = [], isLoading, isError } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      try {
        return await fetchJobCards();
      } catch {
        return [];
      }
    },
    refetchInterval: 15_000,
  });

  // All angle photos keyed by jobId, fetched in a single batch read
  const { data: allPhotos = {} } = useQuery({
    queryKey: ['all_job_photos'],
    queryFn: fetchAllJobPhotos,
  });
  // Convenience: front-only map for backward compat (hasPhotos checks)
  const frontPhotos: Record<string, string> = {};
  for (const [id, p] of Object.entries(allPhotos)) { if (p.front) frontPhotos[id] = p.front; }

  // Active nudges from admin — retry on failure to handle cold-start
  const { data: nudgesData } = useQuery<Nudge[]>({
    queryKey: ['nudges'],
    queryFn: fetchActiveNudges,
    refetchInterval: 15_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
  const nudges: Nudge[] = nudgesData ?? [];

  const dismissNudgeMutation = useMutation({
    mutationFn: (nudgeId: string) => dismissNudge(nudgeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const acknowledgeNudgeMutation = useMutation({
    mutationFn: (nudgeId: string) => acknowledgeNudge(nudgeId, 'Acknowledged'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const addJobMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const serviceDetails = data.service_type === 'Other'
        ? data.service_details.trim()
        : data.service_type;
      return createJobCard({
        vehicle_id: `V-${Date.now()}`,
        customer_name: data.customer_name.trim(),
        license_plate: data.license_plate.trim().toUpperCase(),
        service_details: serviceDetails,
        status: 'booked',
        vehicle_type: data.vehicle_type,
        model: data.model.trim() || undefined,
        mechanic_id: user?.id,
        license_plate_photo: platePhoto ?? undefined,
        disk_photo: diskPhoto ?? undefined,
        odometer: data.odometer ? Number(data.odometer) : undefined,
      });
    },
    onSuccess: (newJob) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created! Capture vehicle photos next.');
      setShowAddModal(false);
      setForm({ customer_name: '', license_plate: '', service_details: '', service_type: '', odometer: '', vehicle_type: 'sedan', model: VEHICLE_TYPE_TO_BODY['sedan'] });
      setPlatePhoto(null);
      setDiskPhoto(null);
      setPreviewIdx(0);
      navigate(`/mechanic/photo-upload/${newJob.id}`);
    },
    onError: () => toast.error('Failed to create job card — please try again.'),
  });

  const acknowledgeJobMutation = useMutation({
    mutationFn: (jobId: string) => acknowledgeJob(jobId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job claimed! It\'s now in your queue.');
    },
    onError: () => toast.error('Failed to claim job — please try again.'),
  });

  const reInspectMutation = useMutation({
    mutationFn: (job: JobCard) =>
      createJobCard({
        vehicle_id: job.vehicle_id,
        customer_name: job.customer_name,
        license_plate: job.license_plate,
        service_details: reInspectService.trim() || job.service_details,
        status: 'booked',
        image_url: job.image_url,
        vehicle_type: job.vehicle_type,
        mechanic_id: user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Re-inspection job card created!');
      setSelectedCompleted(null);
      setReInspectService('');
    },
    onError: () => toast.error('Failed to create re-inspection job.'),
  });

  const handleSubmit = () => {
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (!form.license_plate.trim()) { toast.error('License plate is required'); return; }
    if (!platePhoto) { toast.error('License plate photo is required'); return; }
    if (!form.service_type) { toast.error('Please select a service'); return; }
    if (form.service_type === 'Other' && !form.service_details.trim()) { toast.error('Please describe the service required'); return; }
    addJobMutation.mutate(form);
  };

  const searchLower = searchQuery.toLowerCase().trim();
  const matchesSearch = (j: JobCard) =>
    !searchLower ||
    j.customer_name.toLowerCase().includes(searchLower) ||
    j.license_plate.toLowerCase().includes(searchLower) ||
    j.id.toLowerCase().includes(searchLower) ||
    j.service_details.toLowerCase().includes(searchLower);

  // Booked + unclaimed — any mechanic can claim these
  const unclaimedJobs = allJobs.filter(j =>
    j.status === 'booked' && !j.mechanic_id && matchesSearch(j)
  );
  // Show the incoming section only when there are unclaimed booked jobs
  const showAvailableSection =
    unclaimedJobs.length > 0 &&
    (statusFilter === 'all' || statusFilter === 'booked');

  // This mechanic's own jobs
  const myJobs = allJobs.filter(j => j.mechanic_id === user?.id);
  const activeJobs = myJobs.filter(
    j => j.status !== 'completed' &&
    matchesSearch(j) &&
    (statusFilter === 'all' || statusFilter === 'my_jobs' || j.status === statusFilter)
  );
  const completedJobs = myJobs.filter(
    j => j.status === 'completed' &&
    matchesSearch(j) &&
    (statusFilter === 'all' || statusFilter === 'my_jobs' || statusFilter === 'completed')
  );
  const inProgressCount = myJobs.filter(j => j.status === 'in_progress').length;
  const bookedCount = myJobs.filter(j => j.status === 'booked').length;
  const hasNoResults = searchQuery.trim() !== '' && unclaimedJobs.length === 0 && activeJobs.length === 0 && completedJobs.length === 0;

  // Tab definitions for the filter bar
  const filterTabs = [
    { key: 'all',         label: 'All Jobs',    count: allJobs.length,                                          color: 'text-primary',  dot: 'bg-primary' },
    { key: 'my_jobs',     label: 'My Jobs',     count: myJobs.length,                                           color: 'text-success',  dot: 'bg-success' },
    { key: 'booked',      label: 'Booked',      count: allJobs.filter(j => j.status === 'booked').length,       color: 'text-primary',  dot: 'bg-primary' },
    { key: 'in_progress', label: 'In Progress', count: allJobs.filter(j => j.status === 'in_progress').length,  color: 'text-warning',  dot: 'bg-warning' },
    { key: 'completed',   label: 'Completed',   count: allJobs.filter(j => j.status === 'completed').length,    color: 'text-success',  dot: 'bg-success' },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navbar
        userName={user?.name}
        role="Mechanic"
        onLogout={logout}
        nudges={nudges}
        onDismissNudge={(id) => dismissNudgeMutation.mutate(id)}
        onAcknowledgeNudge={(id) => acknowledgeNudgeMutation.mutate(id)}
        showProfile
        onStartTour={tour.startTour}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {isLoading && (
          <div className="flex items-center justify-center py-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <div className="mt-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 xl:grid-cols-[300px_1fr]">

            {/* ── SIDEBAR ── */}
            <aside className="lg:sticky lg:top-20 lg:self-start space-y-3 mb-6 lg:mb-0">

              {/* Profile Card */}
              <div id="mechanic-profile-card" className="card-elevated overflow-hidden">
                {/* Hero banner — dark navy grid background with mechanic character */}
                <div className="h-32 relative overflow-hidden" style={{
                  background: '#c8d6f0',
                }}>
                  {/* Navy base */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #c8d6f0 0%, #dce8ff 60%, #eef3ff 100%)' }} />
                  {/* Royal Tyres logo — watermark */}
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'url(/royalryresback.png)',
                    backgroundSize: '65%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.35,
                  }} />
                  {/* Royal Tyres brand logo top-left */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <RoyalTyresIcon size={22} className="drop-shadow" />
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Royal Tyres</span>
                  </div>
                  {/* Role chip top-right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/70 backdrop-blur-sm rounded-full px-2.5 py-1 border border-slate-300">
                    <Wrench className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">Mechanic</span>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  {/* Avatar overlapping banner — mechanic character image */}
                  <div className="-mt-10 mb-2 relative w-20 h-20">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl border-[3px] border-card bg-card">
                      <img
                        src={['1','2'].includes(user?.avatarVariant ?? '1') ? `/mechanic${user?.avatarVariant ?? '1'}.png` : `/mechenic${user?.avatarVariant ?? '1'}.png`}
                        alt="Mechanic"
                        className="w-full h-full object-cover object-top"
                        draggable={false}
                      />
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h1 className="text-base font-display font-bold text-foreground leading-tight">
                        {user?.name ?? 'Mechanic'}
                      </h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{today}</span>
                      </div>
                    </div>
                    {/* Live status dot */}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-muted-foreground">Active</span>
                    </div>
                  </div>

                  {/* Queue summary pill */}
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted">
                    <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <p className="text-xs text-foreground">
                      {activeJobs.length > 0
                        ? <><span className="font-bold text-primary">{activeJobs.length}</span> job{activeJobs.length !== 1 ? 's' : ''} in your queue</>
                        : unclaimedJobs.length > 0
                          ? <><span className="font-bold text-primary">{unclaimedJobs.length}</span> booked job{unclaimedJobs.length !== 1 ? 's' : ''} incoming</>
                          : <span className="text-muted-foreground">All clear — no active jobs</span>}
                    </p>
                  </div>

                  <button
                    id="add-new-car-btn"
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Car
                  </button>
                </div>
              </div>

              {/* Stats — 3 cards */}
              <div id="mechanic-stats" className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Booked',      value: bookedCount,           icon: ClipboardCheck, bg: 'bg-primary/10',   text: 'text-primary' },
                  { label: 'In Progress', value: inProgressCount,        icon: Clock,          bg: 'bg-warning/10',   text: 'text-warning' },
                  { label: 'Done',        value: completedJobs.length,   icon: CheckCircle2,   bg: 'bg-success/10',   text: 'text-success' },
                ].map(s => (
                  <div key={s.label} className="card-elevated p-3 flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                      <s.icon className={`w-4 h-4 ${s.text}`} />
                    </div>
                    <p className={`text-xl font-display font-black leading-none ${s.text}`}>{s.value}</p>
                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* In-progress alert */}
              {inProgressCount > 0 && (
                <div className="rounded-xl border px-4 py-3 flex items-start gap-3" style={{ borderColor: 'hsl(var(--warning)/0.4)', background: 'hsl(var(--warning)/0.07)' }}>
                  <Gauge className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--warning))' }} />
                  <p className="text-xs text-foreground leading-snug">
                    <span className="font-semibold">{inProgressCount} inspection{inProgressCount > 1 ? 's' : ''}</span> in progress — tap a card to continue.
                  </p>
                </div>
              )}

              {isError && (
                <div className="flex items-center gap-2 px-1 py-2 rounded-lg bg-muted">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Demo data — Firestore unavailable.</span>
                </div>
              )}
            </aside>

            {/* ── MAIN ── */}
            <main className="space-y-8 min-w-0">

              {/* ── Search + Filter Bar ── */}
              <div id="search-filter-bar" className="card-elevated overflow-hidden">
                {/* Search row */}
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name, plate number, job ID or service…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className={`${inputCls} pl-9 ${searchQuery ? 'pr-9' : ''}`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex items-stretch overflow-x-auto scrollbar-none">
                  {filterTabs.map(({ key, label, count, color, dot }) => {
                    const isActive = statusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`relative flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 text-xs font-semibold transition-colors ${
                          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {label}
                          {count > 0 && (
                            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              isActive
                                ? `${dot} text-white`
                                : 'bg-muted text-muted-foreground'
                            }`}>{count}</span>
                          )}
                        </div>
                        {/* Active underline */}
                        {isActive && (
                          <span className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${dot}`} />
                        )}
                      </button>
                    );
                  })}
                  {(searchQuery || statusFilter !== 'all') && (
                    <button
                      onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors ml-auto"
                    >
                      <X className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>
              </div>

              {/* No results state */}
              {hasNoResults && (
                <div className="card-elevated p-10 text-center">
                  <Search className="w-10 h-10 text-muted-foreground opacity-30 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No inspections found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try a different name, plate number, or job ID.</p>
                  <button
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-muted text-xs font-semibold text-foreground hover:bg-muted/70 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                </div>
              )}

              {/* ── Incoming Booked Jobs — visible to all mechanics ── */}
              {showAvailableSection && (
                <section id="incoming-jobs-section">
                  {/* Section header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Incoming Jobs</h2>
                    <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold border border-success/20">
                      {unclaimedJobs.length} open
                    </span>
                  </div>

                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 items-start"
                    initial="hidden"
                    animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
                  >
                    {/* Unclaimed — claimable */}
                    {unclaimedJobs.map(job => (
                      <motion.div
                        key={job.id}
                        variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.3 }}
                        className="card-elevated overflow-hidden group hover:shadow-lg transition-all"
                      >
                        {/* Image area */}
                        <div className="relative h-32 overflow-hidden" style={{ background: 'var(--vehicle-card-bg)' }}>
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                          <VehicleCardCarousel
                            vehicleType={job.vehicle_type}
                            photos={allPhotos[job.id]}
                            licensePlate={job.license_plate}
                          />
                          {/* Open badge top-left */}
                          <div className="absolute top-2 left-2">
                            <span className="flex items-center gap-1 bg-success/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Open
                            </span>
                          </div>
                          {/* Job ID top-right */}
                          <div className="absolute top-2 right-2">
                            <span className="text-[9px] font-mono bg-black/40 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">{job.id}</span>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{job.customer_name}</p>
                            <span className="shrink-0 text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded tracking-widest border border-border">{job.license_plate}</span>
                          </div>
                          {(job.make || job.model || job.year) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {job.make && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{job.make}</span>}
                              {job.model && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-foreground">{job.model}</span>}
                              {job.year && <span className="text-[10px] font-mono text-muted-foreground">{job.year}</span>}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{job.service_details}</p>

                          {/* Claim CTA */}
                          <button
                            onClick={() => { if (!acknowledgeJobMutation.isPending) acknowledgeJobMutation.mutate(job.id); }}
                            disabled={acknowledgeJobMutation.isPending}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
                          >
                            {acknowledgeJobMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            Acknowledge &amp; Claim
                          </button>
                        </div>
                        {/* Coloured bottom border */}
                        <div className="h-0.5 w-full bg-success/70" />
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Divider before my jobs */}
                  {(activeJobs.length > 0 || completedJobs.length > 0) && (
                    <div className="flex items-center gap-3 mt-6 mb-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">My Jobs</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                </section>
              )}

              {/* Active jobs */}
              {activeJobs.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Today's Work Queue</h2>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Car
                    </button>
                  </div>

                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 items-start"
                    initial="hidden"
                    animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
                  >
                    {activeJobs.map((job) => {
                      const hasPhotos = !!frontPhotos[job.id];
                      const ctaLabel = getCtaLabel(job, hasPhotos);
                      const workflowSteps = getWorkflowSteps(job, hasPhotos);
                      const jobNudge = nudges.find(n => n.job_id === job.id) ?? null;
                      return (
                      <motion.button
                        variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.35 }}
                        key={job.id}
                        onClick={() => {
                          if (job.status === 'booked' && !hasPhotos) {
                            navigate(`/mechanic/photo-upload/${job.id}`);
                          } else {
                            navigate(`/mechanic/inspect/${job.id}`);
                          }
                        }}
                        className={`card-elevated w-full text-left overflow-hidden group hover:shadow-lg transition-all ${jobNudge ? 'ring-2 ring-warning/60 ring-offset-2 ring-offset-background' : ''}`}
                      >
                        {/* Image area — auto-rotating carousel */}
                        <div className="relative h-32 overflow-hidden" style={{ background: 'var(--vehicle-card-bg)' }}>
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                          <VehicleCardCarousel
                            vehicleType={job.vehicle_type}
                            photos={allPhotos[job.id]}
                            licensePlate={job.license_plate}
                          />
                          {/* status badge top-left */}
                          <div className="absolute top-2 left-2">
                            <span className={`status-badge ${statusClass[job.status]}`}>{statusLabel[job.status]}</span>
                          </div>
                          {/* alert + job id top-right */}
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {jobNudge && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning text-white text-[9px] font-bold uppercase tracking-wide">
                                <Bell className="w-2.5 h-2.5" /> Alert
                              </span>
                            )}
                            <span className="text-[9px] font-mono bg-black/40 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">{job.id}</span>
                          </div>
                        </div>

                        {/* Info area */}
                        <div className="p-4">
                          {/* Customer name + license plate on same row */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{job.customer_name}</p>
                            <span className="shrink-0 text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded tracking-widest border border-border">{job.license_plate}</span>
                          </div>
                          {/* Make / Model / Year badge row */}
                          {(job.make || job.model || job.year) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {job.make && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{job.make}</span>
                              )}
                              {job.model && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-foreground">{job.model}</span>
                              )}
                              {job.year && (
                                <span className="text-[10px] font-mono text-muted-foreground">{job.year}</span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{job.service_details}</p>

                          {/* Workflow step progress strip */}
                          <div className="mt-3 flex items-center gap-0">
                            {workflowSteps.map((step, i) => (
                              <div key={step.label} className="flex items-center" style={{ flex: i < workflowSteps.length - 1 ? '1' : 'none' }}>
                                <div className="flex items-center gap-1">
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                                    step.done
                                      ? 'bg-success text-white'
                                      : step.active
                                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                                        : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {step.done ? <CheckCircle2 className="w-2.5 h-2.5" /> : i + 1}
                                  </div>
                                  <span className={`text-[10px] font-medium ${
                                    step.done ? 'text-success' : step.active ? 'text-primary' : 'text-muted-foreground'
                                  }`}>{step.label}</span>
                                </div>
                                {i < workflowSteps.length - 1 && (
                                  <div className={`flex-1 h-px mx-1.5 ${ workflowSteps[i + 1].done || workflowSteps[i + 1].active ? 'bg-primary/40' : 'bg-border' }`} />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* CTA */}
                          <div
                            className="mt-2.5 flex items-center gap-2 text-xs font-semibold"
                            style={{ color: !hasPhotos && job.status === 'booked' ? 'hsl(var(--warning))' : statusAccent[job.status] }}
                          >
                            {!hasPhotos && job.status === 'booked' ? (
                              <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <ClipboardCheck className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span>{ctaLabel}</span>
                            <ChevronRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>

                        {/* Admin nudge message inline on card */}
                        {jobNudge && (
                          <div
                            className="mx-3 mb-3 flex items-center gap-2 px-2.5 py-2 rounded-lg"
                            style={{ background: 'hsl(var(--warning) / 0.10)', border: '1px solid hsl(var(--warning) / 0.30)' }}
                          >
                            <Bell className="w-3 h-3 shrink-0 text-warning" />
                            <p className="text-[11px] leading-tight text-foreground truncate">{jobNudge.message}</p>
                          </div>
                        )}

                        {/* Coloured bottom border by status */}
                        <div className="h-0.5 w-full" style={{ background: jobNudge || (!hasPhotos && job.status === 'booked') ? 'hsl(var(--warning))' : statusAccent[job.status] }} />
                      </motion.button>
                      );
                    })}
                  </motion.div>
                </section>
              )}

              {/* Empty state — only show when nothing incoming and no my jobs */}
              {activeJobs.length === 0 && !showAvailableSection && (
                <div className="card-elevated p-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-muted-foreground opacity-40" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">All clear for today</p>
                  <p className="text-xs text-muted-foreground mt-1.5">No active jobs — add a new car to get started.</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                  >
                    <Plus className="w-4 h-4" /> Add New Car
                  </button>
                </div>
              )}

              {/* Completed */}
              {completedJobs.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Completed</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {completedJobs.length} vehicle{completedJobs.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {groupByDate(completedJobs).map(({ label, jobs: group }) => (
                    <div key={label} className="mb-6">
                      {/* Date divider */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          label === 'Today'
                            ? 'bg-success/10 text-success border-success/30'
                            : label === 'Yesterday'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-border'
                        }`}>{label}</span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground">{group.length} job{group.length !== 1 ? 's' : ''}</span>
                      </div>

                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
                    initial="hidden"
                    animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
                  >
                    {group.map((job) => (
                      <motion.button
                        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.3 }}
                        key={job.id}
                        onClick={() => { setSelectedCompleted(job); setReInspectService(''); }}
                        className="card-elevated overflow-hidden group text-left hover:shadow-md transition-all cursor-pointer"
                      >
                        {/* Image — auto-rotating carousel */}
                        <div className="h-28 overflow-hidden relative" style={{ background: 'var(--vehicle-card-bg)' }}>
                          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                          <VehicleCardCarousel
                            vehicleType={job.vehicle_type}
                            photos={allPhotos[job.id]}
                            licensePlate={job.license_plate}
                          />
                          {/* job id top-left */}
                          <div className="absolute top-2 left-2">
                            <span className="text-[9px] font-mono bg-black/40 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">{job.id}</span>
                          </div>
                          {/* Done badge top-right */}
                          <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-green-500/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Done
                            </span>
                          </div>
                        </div>

                        {/* Info + CTA */}
                        <div className="p-3">
                          {/* Name + plate row */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{job.customer_name}</p>
                            <span className="shrink-0 text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded tracking-widest border border-border">{job.license_plate}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.service_details}</p>
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <Eye className="w-3 h-3" />
                            <span>View &amp; Re-Inspect</span>
                            <ChevronRight className="w-3 h-3 ml-auto group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                    </div>
                  ))}
                </section>
              )}
            </main>
          </div>
        )}
      </div>

      {/* ── Vehicle History / Re-Inspect Modal ── */}
      {selectedCompleted && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedCompleted(null)}
        >
          <div
            className="w-full max-w-lg bg-card rounded-2xl border border-border overflow-hidden"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative h-36 overflow-hidden" style={{ background: 'var(--vehicle-card-bg)' }}>
              {/* Bottom glow */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
              {(() => {
                const type = (vehicleViewSVGs[selectedCompleted.vehicle_type as VehicleType] ? selectedCompleted.vehicle_type : 'sedan') as VehicleType;
                const SVGComp = vehicleViewSVGs[type].front;
                return <SVGComp className="relative w-full h-full p-5" style={{ color: 'hsl(var(--primary))' }} />;
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
              {/* License */}
              <div className="absolute bottom-3 left-4">
                <span className="text-sm font-mono font-black text-background tracking-widest bg-foreground/50 backdrop-blur-sm px-3 py-1 rounded-lg">
                  {selectedCompleted.license_plate}
                </span>
              </div>
              {/* Close */}
              <button
                onClick={() => setSelectedCompleted(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/40 text-background hover:bg-foreground/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {/* ID */}
              <div className="absolute top-3 left-3">
                <span className="text-[10px] font-mono bg-foreground/50 text-background px-2 py-0.5 rounded-full">{selectedCompleted.id}</span>
              </div>
            </div>

            <div className="p-5">
              {/* Vehicle summary */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-display font-bold text-foreground">{selectedCompleted.customer_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selectedCompleted.service_details}</p>
                </div>
              </div>

              {/* History timeline stub */}
              <div className="mb-4 rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Service History</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="pb-2 flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Completed — {selectedCompleted.service_details}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full border border-dashed border-muted-foreground mt-1 flex-shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground italic">Next service will appear here…</p>
                  </div>
                </div>
              </div>

              {/* Re-inspect section */}
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    New Service / Reason for Re-inspection
                  </label>
                  <textarea
                    value={reInspectService}
                    onChange={e => setReInspectService(e.target.value)}
                    placeholder={`e.g. Follow-up on ${selectedCompleted.service_details}`}
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Leave blank to reuse the previous service description.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/mechanic/report/${selectedCompleted.id}`)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Report
                  </button>
                  <button
                    onClick={() => {
                      if (!reInspectService.trim() && !selectedCompleted.service_details.trim()) {
                        toast.error('Enter a service description');
                        return;
                      }
                      reInspectMutation.mutate(selectedCompleted);
                    }}
                    disabled={reInspectMutation.isPending}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
                  >
                    {reInspectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {reInspectMutation.isPending ? 'Creating…' : 'Re-Inspect'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add New Car Modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-card rounded-2xl border border-border overflow-hidden shadow-2xl"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-display font-bold text-foreground">Add New Vehicle</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Register a new car for inspection</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — split layout */}
            <div className="flex flex-col sm:flex-row">

              {/* Left: Preview */}
              <div className="sm:w-52 flex-shrink-0 bg-muted flex flex-col items-center justify-center p-4 gap-3">
                {/* Carousel */}
                {(() => {
                  const angle = VIEW_ANGLES[previewIdx];
                  const SVGComp = vehicleViewSVGs[form.vehicle_type as VehicleType]?.[angle];
                  return (
                    <div className="w-full space-y-2">
                      <div
                        className="relative w-full h-36 rounded-xl overflow-hidden border border-primary/20 flex items-center justify-center"
                        style={{ background: 'var(--vehicle-card-bg)' }}
                      >
                        {/* Glow */}
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                        {SVGComp ? (
                          <SVGComp
                            className="relative w-full h-full p-4 transition-opacity duration-200"
                            style={{ color: 'hsl(var(--primary))' }}
                          />
                        ) : (
                          <Car className="w-12 h-12 opacity-40" style={{ color: 'hsl(var(--primary))' }} />
                        )}
                        {/* Angle label */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                          <span className="text-[10px] font-semibold text-background/90 bg-foreground/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            {viewLabels[angle]}
                          </span>
                        </div>
                        {/* Prev / Next arrows */}
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewIdx((previewIdx - 1 + VIEW_ANGLES.length) % VIEW_ANGLES.length)}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewIdx((previewIdx + 1) % VIEW_ANGLES.length)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      </div>
                      {/* Dot indicators */}
                      <div className="flex items-center justify-center gap-1.5">
                        {VIEW_ANGLES.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setPreviewIdx(i)}
                            className={`rounded-full transition-all ${
                              i === previewIdx
                                ? 'w-4 h-1.5 bg-primary'
                                : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Type picker */}
                <div className="w-full space-y-1.5">
                  {vehicleTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setForm(f => ({
                          ...f,
                          vehicle_type: opt.value,
                          // auto-sync body style dropdown
                          model: VEHICLE_TYPE_TO_BODY[opt.value] ?? f.model,
                        }));
                        setPreviewIdx(0);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.vehicle_type === opt.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
                      }`}
                    >
                      {(() => { const ImgComp = vehicleViewSVGs[opt.value as VehicleType].front; return <ImgComp className="w-6 h-6 object-contain" />; })()}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Form */}
              <div className="flex-1 p-6 space-y-4">

                {/* Customer Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <UserIcon className="w-3 h-3 text-muted-foreground" />
                    Customer Name <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="e.g. Priya Naidoo"
                    className={inputCls}
                  />
                </div>

                {/* License Plate */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <Hash className="w-3 h-3 text-muted-foreground" />
                    License Plate <span className="text-accent">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.license_plate}
                      onChange={e => setForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))}
                      placeholder="e.g. KZN 778-PRY"
                      className={`${inputCls} font-mono tracking-widest flex-1`}
                    />
                    {/* Plate photo capture button */}
                    <button
                      type="button"
                      title="Capture license plate photo"
                      onClick={() => plateInputRef.current?.click()}
                      className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border transition-all ${
                        platePhoto
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <input
                      ref={plateInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const raw = ev.target?.result as string;
                          setPlatePhoto(await compressImage(raw));
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {platePhoto && (
                    <div className="mt-2 relative w-24 h-14 rounded-lg overflow-hidden border border-primary/40 group">
                      <img src={platePhoto} alt="Plate" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPlatePhoto(null)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {!platePhoto && (
                    <p className="text-[11px] text-muted-foreground mt-1">Tap the camera icon to capture plate photo (required)</p>
                  )}
                </div>

                {/* License Disk — optional */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <Camera className="w-3 h-3 text-muted-foreground" />
                    License Disk <span className="text-[10px] font-normal text-muted-foreground ml-1">(optional)</span>
                  </label>
                  {diskPhoto ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-24 h-14 rounded-lg overflow-hidden border border-border group">
                        <img src={diskPhoto} alt="Disk" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setDiskPhoto(null)}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => diskInputRef.current?.click()}
                        className="text-xs text-primary hover:underline"
                      >
                        Retake
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => diskInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-input text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture License Disk Photo
                    </button>
                  )}
                  <input
                    ref={diskInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const raw = ev.target?.result as string;
                        setDiskPhoto(await compressImage(raw));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Make / Model / Year — 3 columns */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Body Style</label>
                  <select
                    value={form.model}
                    onChange={e => {
                      const label = e.target.value;
                      const vType = BODY_TO_VEHICLE_TYPE[label] ?? 'sedan';
                      setForm(f => ({ ...f, model: label, vehicle_type: vType }));
                      setPreviewIdx(0);
                    }}
                    className={inputCls}
                  >
                    {BODY_STYLE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Service Required */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    Service Required <span className="text-accent">*</span>
                  </label>
                  <select
                    value={form.service_type}
                    onChange={e => setForm(f => ({ ...f, service_type: e.target.value, service_details: '' }))}
                    className={inputCls}
                  >
                    <option value="">Select a service…</option>
                    {SERVICE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {form.service_type === 'Other' && (
                    <textarea
                      value={form.service_details}
                      onChange={e => setForm(f => ({ ...f, service_details: e.target.value }))}
                      placeholder="Describe the service required…"
                      rows={2}
                      className={`${inputCls} resize-none mt-2`}
                    />
                  )}
                </div>

                {/* Odometer */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <Gauge className="w-3 h-3 text-muted-foreground" />
                    Odometer (km) <span className="text-[10px] font-normal text-muted-foreground ml-1">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.odometer}
                    onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
                    placeholder="e.g. 45000"
                    className={inputCls}
                  />
                </div>

                {/* Preview plate */}
                {form.license_plate && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                    <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Registering</p>
                      <p className="text-sm font-semibold text-foreground">{form.customer_name || '—'}</p>
                      {form.model && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{form.model}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold bg-foreground text-background px-2.5 py-1 rounded-lg tracking-widest">
                      {form.license_plate}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={addJobMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addJobMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {addJobMutation.isPending ? 'Creating…' : 'Create Job Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AppTour
        isOpen={tour.isOpen}
        step={tour.currentStep}
        stepIdx={tour.stepIdx}
        totalSteps={tour.totalSteps}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />
    </div>
  );
};

export default MechanicDashboard;
