import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  User, Mail, Shield, Wrench, ChevronLeft,
  Pencil, Check, X, Loader2, Crown, KeyRound,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import RoyalTyresIcon from '@/components/RoyalTyresIcon';
import MechanicAvatar from '@/components/MechanicAvatar';
import { toast } from 'sonner';

const ProfilePage = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? '');

  const saveMutation = useMutation({
    mutationFn: (name: string) => updateUser({ name }),
    onSuccess: () => {
      toast.success('Display name updated');
      setEditingName(false);
    },
    onError: () => toast.error('Failed to save — please try again'),
  });

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const dashboardPath = user.role === 'admin' ? '/admin' : '/mechanic';

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={user.name}
        role={user.role === 'admin' ? 'Admin' : 'Mechanic'}
        onLogout={logout}
        showProfile={false}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Avatar hero card */}
        <div className="card-elevated overflow-hidden mb-6">
          {/* Hero banner */}
          <div className="h-40 relative" style={{ background: '#f0f4ff' }}>
            {/* Clip inner backgrounds but not the avatar that overhangs */}
            <div className="absolute inset-0 overflow-hidden rounded-t-[inherit]">
              {/* Light gradient base that lets the watermark read clearly */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #e8eeff 0%, #f5f7ff 55%, #ffffff 100%)' }} />
              {/* Royal Tyres logo — watermark, more visible */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'url(/royalryresback.png)',
                backgroundSize: '60%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.6,
              }} />
              {/* Brand logo top-left — navy */}
              <div className="absolute top-3 left-4 flex items-center gap-2">
                <RoyalTyresIcon size={26} className="drop-shadow" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: '#0f2d5e' }}>Royal Tyres</span>
              </div>
              {/* Role chip top-right — red */}
              <div className="absolute top-3 right-4">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }}>
                  {user.role === 'admin' ? <Crown className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                  {user.role === 'admin' ? 'Administrator' : 'Mechanic'}
                </span>
              </div>
              {/* Mechanic character — bottom right, larger */}
              {user.role !== 'admin' && (
                <div className="absolute bottom-0 right-4 h-full flex items-end">
                  <MechanicAvatar variant="1" size={115} className="drop-shadow-xl" />
                </div>
              )}
              {user.role === 'admin' && (
                <div className="absolute bottom-0 right-4 h-full flex items-end">
                  <MechanicAvatar variant="2" size={115} className="drop-shadow-xl" />
                </div>
              )}
            </div>{/* end overflow-hidden inner wrapper */}
            {/* Avatar — mechanic image overlapping banner, larger */}
            <div className="absolute -bottom-12 left-6 w-24 h-24 rounded-2xl shadow-2xl border-4 border-card overflow-hidden bg-card">
              <img
                src={user.role === 'admin' ? '/mechanic2.png' : '/mechanic1.png'}
                alt={user.name}
                className="w-full h-full object-cover object-center scale-110"
                draggable={false}
              />
            </div>
          </div>

          <div className="px-6 pt-16 pb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-display font-bold" style={{ color: '#0f2d5e' }}>{user.name}</h1>
                <p className="text-sm mt-0.5" style={{ color: '#1e4080' }}>{user.email}</p>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                {user.role === 'admin' ? <Crown className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                {user.role === 'admin' ? 'Administrator' : 'Mechanic'}
              </span>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="card-elevated divide-y divide-border">
          {/* Display Name — editable */}
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
                      if (e.key === 'Enter' && nameInput.trim()) saveMutation.mutate(nameInput.trim());
                      if (e.key === 'Escape') { setEditingName(false); setNameInput(user.name); }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    placeholder="Your name"
                  />
                  <button
                    onClick={() => saveMutation.mutate(nameInput.trim())}
                    disabled={saveMutation.isPending || !nameInput.trim()}
                    className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameInput(user.name); }}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <button
                    onClick={() => { setEditingName(true); setNameInput(user.name); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email — read-only */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email Address</p>
              <p className="text-sm text-foreground">{user.email}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Managed by your sign-in provider</p>
            </div>
          </div>

          {/* Role — read-only */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              {user.role === 'admin' ? (
                <Shield className="w-4 h-4 text-blue-500" />
              ) : (
                <Wrench className="w-4 h-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Role</p>
              <p className="text-sm font-medium text-foreground capitalize">{user.role}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Contact your administrator to change your role</p>
            </div>
          </div>

          {/* Account ID — read-only */}
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Account ID</p>
              <p className="text-xs font-mono text-muted-foreground break-all">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Admin shortcut */}
        {user.role === 'admin' && (
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

        {/* Sign out */}
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
