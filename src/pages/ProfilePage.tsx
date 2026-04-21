import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  User, Mail, Shield, Wrench, ChevronLeft, ChevronRight,
  Pencil, Check, X, Loader2, Crown, KeyRound, UserCog,
  BarChart2, Car, TrendingUp, AlertTriangle,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import RoyalTyresIcon from '@/components/RoyalTyresIcon';
import MechanicAvatar from '@/components/MechanicAvatar';
import { toast } from 'sonner';
import { getUserProfile, updateUserByAdmin, fetchMechanicStats, fetchJobsByMechanic } from '@/lib/firestore';
import { User as UserType, JobCard } from '@/types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_SRCS: Record<string, string> = {
  '1': '/mechanic1.png',
  '2': '/mechanic2.png',
  '3': '/mechenic3.png',
  '4': '/mechenic4.png',
  '5': '/mechenic5.png',
};

const AVATAR_LABELS: Record<string, string> = {
  '1': 'Blue overalls, tyre',
  '2': 'Overalls, big wrench',
  '3': 'Thumbs up',
  '4': 'Wrench & smile',
  '5': 'Tyres, thumbs up',
};

function resolveAvatar(u: UserType): '1' | '2' | '3' | '4' | '5' {
  return (u.avatarVariant as '1' | '2' | '3' | '4' | '5') ?? (u.role === 'admin' ? '2' : '1');
}

function formatJobDate(created_at: JobCard['created_at']): string {
  if (!created_at) return '—';
  let ms: number;
  if (typeof created_at === 'object' && created_at !== null && 'seconds' in created_at) {
    ms = (created_at as { seconds: number }).seconds * 1000;
  } else {
    ms = Number(created_at);
  }
  if (isNaN(ms) || ms === 0) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  booked:      { label: 'Booked',      cls: 'bg-blue-500/10 text-blue-700' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700' },
  completed:   { label: 'Completed',   cls: 'bg-green-500/10 text-green-700' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { user: currentUser, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Present when admin navigates to /admin/users/:userId
  const { userId: targetUserId } = useParams<{ userId?: string }>();
  const isAdminEditMode = !!targetUserId && currentUser?.role === 'admin';

  // ── Fetch target user when in admin-edit mode ──────────────────────────────
  const { data: targetUser, isLoading: targetLoading } = useQuery({
    queryKey: ['user', targetUserId],
    queryFn: () => getUserProfile(targetUserId!),
    enabled: isAdminEditMode,
  });

  // The profile being displayed
  const profileUser = isAdminEditMode ? targetUser : currentUser;

  // ── Mechanic work stats — shown for admin viewing a mechanic AND for a mechanic's own profile ──
  // statsUserId: the UID whose jobs we query
  const statsUserId = isAdminEditMode ? targetUserId : currentUser?.id;
  // Show the panel when the profile being viewed belongs to a mechanic
  const showWorkPerformance =
    !!statsUserId &&
    ((isAdminEditMode && profileUser?.role === 'mechanic') ||
     (!isAdminEditMode && currentUser?.role === 'mechanic'));

  const { data: statsResult } = useQuery({
    queryKey: ['mechanic-stats', statsUserId],
    queryFn: () => fetchMechanicStats(statsUserId!),
    enabled: showWorkPerformance,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const mechanicStats = statsResult
    ? { total_assigned: statsResult.total_assigned, completed: statsResult.completed, in_progress: statsResult.in_progress, pending: statsResult.pending }
    : undefined;

  const recentJobs = (statsResult?.jobs ?? [])
    .slice(0, 8);

  // ── Local state ────────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingRole, setEditingRole] = useState(false);
  const [roleInput, setRoleInput] = useState<'admin' | 'mechanic'>('mechanic');

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Self-update (own profile)
  const selfSaveMutation = useMutation({
    mutationFn: (name: string) => updateUser({ name }),
    onSuccess: () => { toast.success('Display name updated'); setEditingName(false); },
    onError: () => toast.error('Failed to save — please try again'),
  });

  // Admin-update (another user's profile)
  const adminSaveMutation = useMutation({
    mutationFn: (data: Partial<Pick<UserType, 'name' | 'role' | 'avatarVariant'>>) =>
      updateUserByAdmin(targetUserId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile updated');
      setEditingName(false);
      setEditingRole(false);
    },
    onError: () => toast.error('Failed to save — please try again'),
  });

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!currentUser) return null;

  if (isAdminEditMode && targetLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAdminEditMode && !targetUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">User not found.</p>
        <button onClick={() => navigate('/admin/users')} className="text-sm text-primary underline">
          Back to Users
        </button>
      </div>
    );
  }

  if (!profileUser) return null;

  const dashboardPath = currentUser.role === 'admin' ? '/admin' : '/mechanic';
  const backPath = isAdminEditMode ? '/admin/users' : dashboardPath;
  const backLabel = isAdminEditMode ? 'Back to Users' : 'Back to Dashboard';
  const avatarVariant = resolveAvatar(profileUser);
  const isSelf = !isAdminEditMode;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartEditName = () => {
    setNameInput(profileUser.name);
    setEditingName(true);
  };

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    if (isSelf) {
      selfSaveMutation.mutate(nameInput.trim());
    } else {
      adminSaveMutation.mutate({ name: nameInput.trim() });
    }
  };

  const handleStartEditRole = () => {
    setRoleInput(profileUser.role);
    setEditingRole(true);
  };

  const handleSaveRole = () => {
    if (targetUserId === currentUser.id) {
      toast.warning('You are changing your own role — changes take effect on next sign-in.');
    }
    adminSaveMutation.mutate({ role: roleInput });
  };

  const handleAvatarChange = (v: '1' | '2' | '3' | '4' | '5') => {
    adminSaveMutation.mutate({ avatarVariant: v });
  };

  const isSaving = selfSaveMutation.isPending || adminSaveMutation.isPending;

  // ── Performance derived values ─────────────────────────────────────────────
  const completionRate =
    mechanicStats && mechanicStats.total_assigned > 0
      ? Math.round((mechanicStats.completed / mechanicStats.total_assigned) * 100)
      : null;
  const perfStatus =
    completionRate === null
      ? { label: 'No Activity Yet', color: 'text-muted-foreground', bg: 'bg-muted/50', dot: 'bg-muted-foreground', icon: TrendingUp }
      : completionRate >= 70
        ? { label: 'Performing Well', color: 'text-green-700', bg: 'bg-green-500/10', dot: 'bg-green-500', icon: TrendingUp }
        : completionRate >= 40
          ? { label: 'On Track', color: 'text-amber-700', bg: 'bg-amber-500/10', dot: 'bg-amber-500', icon: TrendingUp }
          : { label: 'Needs Attention', color: 'text-red-700', bg: 'bg-red-500/10', dot: 'bg-red-500', icon: AlertTriangle };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={currentUser.name}
        role={currentUser.role === 'admin' ? 'Admin' : 'Mechanic'}
        onLogout={logout}
        showProfile={false}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel}
        </button>

        {/* Admin editing badge */}
        {isAdminEditMode && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-medium">
            <UserCog className="w-4 h-4" />
            You are editing <strong className="ml-1">{profileUser.name}</strong>'s profile as admin
          </div>
        )}

        {/* Avatar hero card */}
        <div className="card-elevated overflow-hidden mb-6">
          <div className="h-40 relative" style={{ background: '#f0f4ff' }}>
            <div className="absolute inset-0 overflow-hidden rounded-t-[inherit]">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #e8eeff 0%, #f5f7ff 55%, #ffffff 100%)' }} />
              <div className="absolute inset-0" style={{
                backgroundImage: 'url(/royalryresback.png)',
                backgroundSize: '60%', backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat', opacity: 0.6,
              }} />
              <div className="absolute top-3 left-4 flex items-center gap-2">
                <RoyalTyresIcon size={26} className="drop-shadow" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#0f2d5e' }}>Royal Tyres</span>
              </div>
              <div className="absolute top-3 right-4">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }}>
                  {profileUser.role === 'admin' ? <Crown className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                  {profileUser.role === 'admin' ? 'Administrator' : 'Mechanic'}
                </span>
              </div>
              <div className="absolute bottom-0 right-4 h-full flex items-end">
                <MechanicAvatar variant={avatarVariant} size={115} className="drop-shadow-xl" />
              </div>
            </div>
            {/* Avatar thumbnail */}
            <div className="absolute -bottom-12 left-6 w-24 h-24 rounded-2xl shadow-2xl border-4 border-card overflow-hidden bg-card">
              <img
                src={AVATAR_SRCS[avatarVariant] ?? AVATAR_SRCS['1']}
                alt={profileUser.name}
                className="w-full h-full object-contain object-bottom p-1"
                draggable={false}
              />
            </div>
          </div>

          <div className="px-6 pt-16 pb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-display font-bold" style={{ color: '#0f2d5e' }}>{profileUser.name}</h1>
                <p className="text-sm mt-0.5" style={{ color: '#1e4080' }}>{profileUser.email}</p>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                {profileUser.role === 'admin' ? <Crown className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                {profileUser.role === 'admin' ? 'Administrator' : 'Mechanic'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Work Performance Panel ──────────────────────────────────── */}
        {showWorkPerformance && profileUser.role === 'mechanic' && (
          <div className="mt-6">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Work Performance</h2>
              </div>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${perfStatus.bg} ${perfStatus.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${perfStatus.dot}`} />
                {perfStatus.label}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Assigned', value: mechanicStats?.total_assigned ?? 0, color: 'text-foreground' },
                { label: 'Done',     value: mechanicStats?.completed ?? 0,      color: 'text-green-600' },
                { label: 'Active',   value: mechanicStats?.in_progress ?? 0,    color: 'text-amber-600' },
                { label: 'Pending',  value: mechanicStats?.pending ?? 0,        color: 'text-blue-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card-elevated px-3 py-3 text-center">
                  <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>

            {/* Completion rate progress bar */}
            {mechanicStats && mechanicStats.total_assigned > 0 && (
              <div className="card-elevated p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Completion Rate</span>
                  <span className={`text-sm font-bold ${perfStatus.color}`}>{completionRate ?? 0}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      (completionRate ?? 0) >= 70 ? 'bg-green-500' :
                      (completionRate ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${completionRate ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>0%</span>
                  <span className="text-muted-foreground/50">Target ≥ 70%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Recent assigned jobs */}
            <div className="card-elevated overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Assigned Jobs</span>
                {recentJobs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{recentJobs.length} most recent</span>
                )}
              </div>
              {recentJobs.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
                  <Car className="w-9 h-9 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">No jobs assigned yet</p>
                  <p className="text-xs text-muted-foreground/60">Jobs will appear here once this mechanic is assigned work</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentJobs.map((job) => {
                    const st = STATUS_CONFIG[job.status] ?? { label: job.status, cls: 'bg-muted text-muted-foreground' };
                    return (
                      <button
                        key={job.id}
                        onClick={() => navigate(`/admin/inspection/${job.id}`)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{job.customer_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[job.make, job.model, job.year].filter(Boolean).join(' ') || job.license_plate}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground hidden sm:block">{formatJobDate(job.created_at)}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details card */}
        <div className="card-elevated divide-y divide-border">

          {/* ── Display Name ────────────────────────────────────────────── */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Display Name</p>
              {editingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nameInput.trim()) handleSaveName();
                      if (e.key === 'Escape') { setEditingName(false); }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    placeholder="Display name"
                  />
                  <button onClick={handleSaveName} disabled={isSaving || !nameInput.trim()} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{profileUser.name}</p>
                  {/* Always editable: own name or admin editing */}
                  <button onClick={handleStartEditName} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Email ───────────────────────────────────────────────────── */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email Address</p>
              <p className="text-sm text-foreground">{profileUser.email}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Managed by the sign-in provider</p>
            </div>
          </div>

          {/* ── Role ── editable only by admin on other users ────────────── */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              {profileUser.role === 'admin'
                ? <Shield className="w-4 h-4 text-blue-500" />
                : <Wrench className="w-4 h-4 text-green-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Role</p>
              {isAdminEditMode && editingRole ? (
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={roleInput}
                    onChange={e => setRoleInput(e.target.value as 'admin' | 'mechanic')}
                    className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="mechanic">Mechanic</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={handleSaveRole} disabled={isSaving} className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditingRole(false)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground capitalize">{profileUser.role}</p>
                  {isAdminEditMode ? (
                    <button onClick={handleStartEditRole} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="w-3 h-3" /> Change
                    </button>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Contact your administrator to change your role</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Avatar picker — admin only ───────────────────────────────── */}
          {isAdminEditMode && (
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <UserCog className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Avatar</p>
                <div className="grid grid-cols-5 gap-2">
                  {(['1', '2', '3', '4', '5'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => handleAvatarChange(v)}
                      disabled={isSaving}
                      title={AVATAR_LABELS[v]}
                      className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${
                        avatarVariant === v
                          ? 'border-primary shadow-md ring-2 ring-primary/20 scale-105'
                          : 'border-border hover:border-primary/50 hover:shadow-sm'
                      }`}
                    >
                      <img
                        src={AVATAR_SRCS[v]}
                        alt={AVATAR_LABELS[v]}
                        className="w-full h-full object-contain object-bottom p-1"
                        draggable={false}
                      />
                      {avatarVariant === v && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Account ID ──────────────────────────────────────────────── */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Account ID</p>
              <p className="text-xs font-mono text-muted-foreground break-all">{profileUser.id}</p>
            </div>
          </div>
        </div>

        {/* Admin shortcut — only on own profile, only for admins */}
        {isSelf && currentUser.role === 'admin' && (
          <button
            onClick={() => navigate('/admin/users')}
            className="mt-4 w-full flex items-center justify-between gap-3 px-5 py-4 card-elevated hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">User Management</p>
                <p className="text-xs text-muted-foreground">Add, edit and monitor team members</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
          </button>
        )}

        {/* Sign out — only on own profile */}
        {isSelf && (
          <>
            <button
              onClick={() => setSignOutOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Sign out
            </button>
            <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll be returned to the login screen. Any unsaved changes will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { logout(); navigate('/'); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
};


export default ProfilePage;
