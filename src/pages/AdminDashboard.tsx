import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchJobCards, fetchAllJobPhotos, sendNudge, fetchActiveNudges, fetchNudgesForJob, Nudge, clearAllAppData } from '@/lib/firestore';
import { JobCard } from '@/types';
import { Eye, Loader2, CheckCircle2, Camera, Bell, X, Users, Clock, LayoutGrid, List, Trash2, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { vehicleViewSVGs, VehicleType } from '@/components/inspection/VehicleSVGs';
import VehicleCardCarousel from '@/components/VehicleCardCarousel';
import { toast } from 'sonner';

/** Returns 3-step workflow state for a job card. */
const getWorkflowSteps = (job: JobCard, hasPhotos: boolean) => [
  { label: 'Booked',  done: true },
  { label: 'Photos',  done: hasPhotos || job.status !== 'booked' },
  { label: 'Inspect', done: job.status === 'in_progress' || job.status === 'completed' },
];

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

const columns: { status: JobCard['status']; label: string }[] = [
  { status: 'booked', label: 'Booked' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
];

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nudgeJob, setNudgeJob] = useState<JobCard | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudgeHistory, setNudgeHistory] = useState<Nudge[]>([]);
  const [nudgeHistoryLoading, setNudgeHistoryLoading] = useState(false);
  const [activeColumn, setActiveColumn] = useState<JobCard['status']>('booked');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearAllMutation = useMutation({
    mutationFn: clearAllAppData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['all_job_photos'] });
      queryClient.invalidateQueries({ queryKey: ['adminNudges'] });
      setShowClearConfirm(false);
      toast.success('All app data cleared. Fresh start!');
    },
    onError: () => toast.error('Failed to clear data — please try again.'),
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      try {
        const fetched = await fetchJobCards();
        return fetched.length > 0 ? fetched : mockJobCards;
      } catch {
        return mockJobCards;
      }
    },
    refetchInterval: 15_000,
  });

  // Active nudges for per-card indicators (admin side)
  const { data: adminNudges = [] } = useQuery<Nudge[]>({
    queryKey: ['adminNudges'],
    queryFn: fetchActiveNudges,
    refetchInterval: 15_000,
  });

  // All angle photos keyed by jobId for card carousels
  const { data: allPhotos = {} } = useQuery({
    queryKey: ['all_job_photos'],
    queryFn: fetchAllJobPhotos,
  });
  // Convenience: front-only map for hasPhotos checks
  const frontPhotos: Record<string, string> = {};
  for (const [id, p] of Object.entries(allPhotos)) { if (p.front) frontPhotos[id] = p.front; }

  const nudgeMutation = useMutation({
    mutationFn: ({ job, message }: { job: JobCard; message: string }) =>
      sendNudge(job.id, job.license_plate, job.customer_name, job.service_details, message),
    onSuccess: async () => {
      toast.success('Mechanic has been notified!');
      queryClient.invalidateQueries({ queryKey: ['adminNudges'] });
      // Refresh history for the current modal job
      if (nudgeJob) {
        const updated = await fetchNudgesForJob(nudgeJob.id).catch(() => []);
        setNudgeHistory(updated);
      }
      setNudgeMessage('');
    },
    onError: () => toast.error('Failed to send notification — try again'),
  });

  const openNudgeModal = async (job: JobCard) => {
    setNudgeJob(job);
    setNudgeMessage(`Please finish up: ${job.service_details} for ${job.license_plate}`);
    setNudgeHistory([]);
    setNudgeHistoryLoading(true);
    const history = await fetchNudgesForJob(job.id).catch(() => []);
    setNudgeHistory(history);
    setNudgeHistoryLoading(false);
  };

  /** Format relative time from a Firestore timestamp */
  const relativeTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const diffMs = Date.now() - ts.seconds * 1000;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getJobsByStatus = (status: JobCard['status']) => jobs.filter(j => j.status === status);

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={user?.name}
        role="Admin"
        onLogout={() => { logout(); navigate('/'); }}
        maxWidth="max-w-7xl"
        showProfile
      />

      {/* Kanban Board */}
      <div className="pt-4 sm:pt-6 max-w-7xl mx-auto">
        {/* Header — fixed padding */}
        <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
          <h2 className="text-xl font-display font-bold text-foreground">Job Board</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-sm text-destructive hover:bg-destructive/20 transition-colors"
              title="Clear all jobs and app data"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear Data</span>
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── MOBILE (< md): Tab navigation + single-column view ── */}
            <div className="md:hidden">
              {/* Column tab pills */}
              <div className="flex gap-2 overflow-x-auto pb-3 px-4">
                {columns.map(col => {
                  const count = getJobsByStatus(col.status).length;
                  const isActive = activeColumn === col.status;
                  return (
                    <button
                      key={col.status}
                      onClick={() => setActiveColumn(col.status)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {col.label}
                      <span className={`text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                        isActive ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Section title + view toggle */}
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={`status-badge text-xs ${statusClass[activeColumn]}`}>
                    {columns.find(c => c.status === activeColumn)?.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getJobsByStatus(activeColumn).length} jobs
                  </span>
                </div>
                <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Job cards for the active column */}
              <div className={`px-4 pb-8 ${viewMode === 'grid' ? 'space-y-3' : 'space-y-2'}`}>
                {getJobsByStatus(activeColumn).map((job, idx) => {
                  const hasPhotos = !!frontPhotos[job.id];
                  const steps = getWorkflowSteps(job, hasPhotos);
                  const jobNudge = adminNudges.find(n => n.job_id === job.id);
                  const vType = (vehicleViewSVGs[job.vehicle_type as VehicleType] ? job.vehicle_type : 'sedan') as VehicleType;
                  const SVGComp = vehicleViewSVGs[vType].front;

                  if (viewMode === 'list') {
                    return (
                      <div key={job.id} className="card-elevated flex items-center gap-3 p-3">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--vehicle-card-bg)' }}>
                          {frontPhotos[job.id]
                            ? <img src={frontPhotos[job.id]} alt={job.license_plate} className="w-full h-full object-cover" />
                            : <SVGComp className="w-full h-full p-2" style={{ color: 'hsl(var(--primary))' }} />
                          }
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-sm font-semibold text-foreground truncate">{job.customer_name}</p>
                            {hasPhotos && <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{job.service_details}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[9px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded tracking-widest flex-shrink-0">{job.license_plate}</span>
                            <div className="flex items-center gap-1">
                              {steps.map(s => (
                                <div key={s.label} className={`w-2 h-2 rounded-full ${s.done ? 'bg-success' : 'bg-muted-foreground/30'}`} title={s.label} />
                              ))}
                            </div>
                          </div>
                          {jobNudge && job.status !== 'completed' && (
                            <div className={`flex items-center gap-1 mt-1 text-[10px] font-semibold ${
                              jobNudge.acknowledged ? 'text-success' : 'text-warning'
                            }`}>
                              {jobNudge.acknowledged
                                ? <><CheckCircle2 className="w-3 h-3 flex-shrink-0" /><span className="truncate">{jobNudge.response ?? 'Acknowledged'}</span></>
                                : <><Clock className="w-3 h-3 animate-pulse flex-shrink-0" /><span className="truncate">Notified {relativeTime(jobNudge.sent_at)}</span></>
                              }
                            </div>
                          )}
                        </div>
                        {/* Action button */}
                        <div className="flex-shrink-0">
                          {job.status !== 'completed' ? (
                            <button
                              onClick={() => openNudgeModal(job)}
                              className="p-2.5 rounded-xl border border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 transition-colors"
                              title="Send nudge"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => navigate(`/admin/inspection/${job.id}`)}
                              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                              title="View Report"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Grid view — full-width card
                  return (
                    <motion.div
                      key={job.id}
                      className="card-elevated overflow-hidden"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                    >
                      <div className="h-36 overflow-hidden relative" style={{ background: 'var(--vehicle-card-bg)' }}>
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                        <VehicleCardCarousel
                          vehicleType={job.vehicle_type}
                          photos={allPhotos[job.id]}
                          licensePlate={job.license_plate}
                        />
                        {/* Status badge top-left */}
                        <div className="absolute top-2 left-2">
                          <span className={`status-badge ${statusClass[job.status]}`}>{statusLabel[job.status]}</span>
                        </div>
                        {hasPhotos && (
                          <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-green-500/80 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Photos
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        {/* Name + license plate row */}
                        <div className="flex items-center justify-between gap-2 min-w-0 mb-1">
                          <p className="text-base font-semibold text-foreground truncate">{job.customer_name}</p>
                          <span className="shrink-0 text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded tracking-widest border border-border">{job.license_plate}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{job.service_details}</p>
                        <div className="flex items-center gap-0 mt-3">
                          {steps.map((step, i) => (
                            <div key={step.label} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'none' }}>
                              <div className="flex items-center gap-0.5">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                                  step.done ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {step.done ? <CheckCircle2 className="w-2.5 h-2.5" /> : i + 1}
                                </div>
                                <span className={`text-xs font-medium ml-0.5 ${step.done ? 'text-success' : 'text-muted-foreground'}`}>
                                  {step.label}
                                </span>
                              </div>
                              {i < steps.length - 1 && (
                                <div className={`flex-1 h-px mx-1.5 ${steps[i + 1].done ? 'bg-success/40' : 'bg-border'}`} />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          {jobNudge && job.status !== 'completed' && (
                            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                              jobNudge.acknowledged ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            }`}>
                              {jobNudge.acknowledged
                                ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{jobNudge.response ?? 'Responded'}</span></>
                                : <><Clock className="w-3.5 h-3.5 shrink-0 animate-pulse" /><span className="truncate">Notified {relativeTime(jobNudge.sent_at)}</span></>
                              }
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground truncate flex-1 min-w-0">{job.id}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {job.status !== 'completed' && !hasPhotos && (
                                <span title="Needs Photos"><Camera className="w-3.5 h-3.5 text-warning" /></span>
                              )}
                              {job.status !== 'completed' ? (
                                <button
                                  onClick={() => openNudgeModal(job)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 transition-colors"
                                >
                                  <Bell className="w-3.5 h-3.5" /> Nudge
                                </button>
                              ) : (
                                <button
                                  onClick={() => navigate(`/admin/inspection/${job.id}`)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Report
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {getJobsByStatus(activeColumn).length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-xl p-12 text-center mt-2">
                    <p className="text-sm text-muted-foreground">No jobs in this column</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── TABLET / DESKTOP (md+): Horizontal-scroll kanban; 4-col grid on lg ── */}
            <div className="hidden md:block">
            <div className="overflow-x-auto pb-6 px-4 sm:px-6 kanban-scroll">
            <div className="flex gap-4 lg:grid lg:grid-cols-3" style={{ minWidth: 'max(100%, 48rem)' }}>
            {columns.map((col, colIdx) => (
            <motion.div
              key={col.status}
              className="flex-shrink-0 w-72 lg:w-auto space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: colIdx * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2 sticky left-0">
                <span className={`status-badge ${statusClass[col.status]}`}>{col.label}</span>
                <span className="text-xs text-muted-foreground">({getJobsByStatus(col.status).length})</span>
              </div>
              {getJobsByStatus(col.status).map((job, jobIdx) => {
                const hasPhotos = !!frontPhotos[job.id];
                const steps = getWorkflowSteps(job, hasPhotos);
                const jobNudge = adminNudges.find(n => n.job_id === job.id);
                return (
                <motion.div
                  key={job.id}
                  className="card-elevated overflow-hidden"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: colIdx * 0.1 + jobIdx * 0.05 }}
                >
                  {/* Vehicle image — auto-rotating carousel */}
                  <div className="h-28 overflow-hidden relative" style={{ background: 'var(--vehicle-card-bg)' }}>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--vehicle-card-glow)' }} />
                    <VehicleCardCarousel
                      vehicleType={job.vehicle_type}
                      photos={allPhotos[job.id]}
                      licensePlate={job.license_plate}
                    />
                    {hasPhotos && (
                      <div className="absolute top-2 right-2">
                        <span className="flex items-center gap-1 bg-green-500/80 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Photos
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    {/* Name + license plate row */}
                    <div className="flex items-center justify-between gap-2 min-w-0 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{job.customer_name}</p>
                      <span className="shrink-0 text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded tracking-widest border border-border">{job.license_plate}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{job.service_details}</p>

                    {/* Workflow step strip */}
                    <div className="flex items-center gap-0 mt-3">
                      {steps.map((step, i) => (
                        <div key={step.label} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'none' }}>
                          <div className="flex items-center gap-0.5">
                            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                              step.done ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                            }`}>
                              {step.done ? <CheckCircle2 className="w-2.5 h-2.5" /> : i + 1}
                            </div>
                            <span className={`text-[10px] font-medium ${
                              step.done ? 'text-success' : 'text-muted-foreground'
                            }`}>{step.label}</span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`flex-1 h-px mx-1 ${steps[i + 1].done ? 'bg-success/40' : 'bg-border'}`} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Card footer: JC-id + nudge pill + actions */}
                    <div className="mt-2.5 space-y-1.5">
                      {/* Nudge status pill — compact, inline */}
                      {jobNudge && job.status !== 'completed' && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold ${
                          jobNudge.acknowledged
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {jobNudge.acknowledged ? (
                            <><CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{jobNudge.response ?? 'Responded'}</span></>
                          ) : (
                            <><Clock className="w-3 h-3 shrink-0 animate-pulse" />
                            <span className="truncate">Notified {relativeTime(jobNudge.sent_at)}</span></>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground truncate flex-1 min-w-0">{job.id}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {job.status !== 'completed' && !hasPhotos && (
                            <span title="Needs Photos">
                              <Camera className="w-3.5 h-3.5 text-warning" />
                            </span>
                          )}
                          {job.status !== 'completed' && (
                            <button
                              onClick={() => openNudgeModal(job)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 transition-colors"
                              title="Send reminder to mechanic"
                            >
                              <Bell className="w-3 h-3" /> Nudge
                            </button>
                          )}
                          {job.status === 'completed' && (
                            <button
                              onClick={() => navigate(`/admin/inspection/${job.id}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                              <Eye className="w-3 h-3" />
                              Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
              {getJobsByStatus(col.status).length === 0 && (
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground">No jobs</p>
                </div>
              )}
            </motion.div>
          ))}
            </div>
          </div>
            </div>
          </>
        )}
      </div>
      {/* ── Nudge Modal ── */}
      {nudgeJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setNudgeJob(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Notify Mechanic</p>
                  <p className="text-[10px] text-muted-foreground">{nudgeJob.license_plate} · {nudgeJob.customer_name}</p>
                </div>
              </div>
              <button
                onClick={() => setNudgeJob(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Context pill */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-warning shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{nudgeJob.service_details}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Status: <span className="capitalize font-medium">{nudgeJob.status.replace('_', ' ')}</span>
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Message to mechanic</label>
                <textarea
                  value={nudgeMessage}
                  onChange={e => setNudgeMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-warning/30 focus:border-warning transition resize-none"
                  placeholder="Enter a message..."
                />
              </div>

              {/* Past Notifications History */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Past Notifications
                </p>
                {nudgeHistoryLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : nudgeHistory.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3 bg-muted/40 rounded-lg">No previous notifications for this job</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {nudgeHistory.map(n => (
                      <div key={n.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                        n.acknowledged
                          ? 'bg-success/5 border-success/20'
                          : n.dismissed
                            ? 'bg-muted/30 border-border opacity-60'
                            : 'bg-warning/5 border-warning/20'
                      }`}>
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                          n.acknowledged ? 'bg-success/15' : 'bg-warning/15'
                        }`}>
                          {n.acknowledged
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                            : <Bell className="w-3.5 h-3.5 text-warning" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground leading-snug">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">{relativeTime(n.sent_at)}</span>
                            {n.acknowledged && n.response && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5" />{n.response}
                              </span>
                            )}
                            {!n.acknowledged && !n.dismissed && (
                              <span className="text-[10px] font-medium text-warning/80 italic">Awaiting response…</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setNudgeJob(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!nudgeMessage.trim() || nudgeMutation.isPending}
                  onClick={() => nudgeMutation.mutate({ job: nudgeJob, message: nudgeMessage.trim() })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
                >
                  {nudgeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  {nudgeMutation.isPending ? 'Sending…' : 'Send Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear All Data confirmation dialog ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setShowClearConfirm(false)}>
          <div
            className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 space-y-4"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-foreground">Clear All App Data?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete <strong>all jobs, photos, inspections, and notifications</strong> from the database. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50"
              >
                {clearAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {clearAllMutation.isPending ? 'Clearing…' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
