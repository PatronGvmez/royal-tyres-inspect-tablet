import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { UserModel } from '@/lib/firestoreModels';
import { 
  Users, UserPlus, Shield, Wrench, X, 
  Loader2, Search, ChevronLeft, ChevronRight, Mail 
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { toast } from 'sonner';

const UsersManagement = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'mechanic'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'mechanic' as 'admin' | 'mechanic' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        return await UserModel.getAll();
      } catch (error) {
        console.error('Failed to load users:', error);
        return [];
      }
    },
    refetchInterval: 30_000,
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; role: 'admin' | 'mechanic' }) => {
      // Check if user already exists
      const existing = await UserModel.getByEmail(userData.email);
      if (existing) throw new Error('User with this email already exists');
      
      // Create user with email as ID (for pre-seeding)
      const userId = userData.email.replace(/[^a-zA-Z0-9]/g, '_');
      await UserModel.upsert(userId, {
        id: userId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User added successfully');
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'mechanic' });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const admins = users.filter(u => u.role === 'admin');
  const mechanics = users.filter(u => u.role === 'mechanic');

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        userName={user?.name}
        role="Admin"
        onLogout={() => { logout(); navigate('/'); }}
        maxWidth="max-w-6xl"
        showProfile
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Users Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage team members and their roles</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Users</p>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-primary/40" />
            </div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Admins</p>
                <p className="text-2xl font-bold text-foreground">{admins.length}</p>
              </div>
              <Shield className="w-8 h-8 text-blue-500/40" />
            </div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mechanics</p>
                <p className="text-2xl font-bold text-foreground">{mechanics.length}</p>
              </div>
              <Wrench className="w-8 h-8 text-green-500/40" />
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center bg-muted rounded-lg p-1">
            {(['all', 'admin', 'mechanic'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  roleFilter === role ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {role === 'all' ? 'All' : role + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery || roleFilter !== 'all' ? 'No users match your filters' : 'No users found. Add your first team member!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="card-elevated p-4 hover:shadow-md transition-shadow flex items-center justify-between gap-4 cursor-pointer group"
                onClick={() => navigate(`/admin/users/${u.id}`)}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted">
                      <img
                        src={({
                          '1': '/mechanic1.png', '2': '/mechanic2.png',
                          '3': '/mechenic3.png', '4': '/mechenic4.png', '5': '/mechenic5.png',
                        })[(u as any).avatarVariant ?? (u.role === 'admin' ? '2' : '1')] ?? '/mechanic1.png'}
                        alt={u.name}
                        className="w-full h-full object-cover object-top scale-110"
                        draggable={false}
                      />
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-background ${
                      u.role === 'admin' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {u.role === 'admin' ? <Shield className="w-2.5 h-2.5 text-white" /> : <Wrench className="w-2.5 h-2.5 text-white" />}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <span className={`status-badge shrink-0 ${
                    u.role === 'admin' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
          <div 
            className="w-full max-w-md bg-card rounded-2xl border border-border p-6" 
            style={{ boxShadow: 'var(--shadow-modal)' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-display font-bold text-foreground">Add New User</h3>
                <p className="text-sm text-muted-foreground">Pre-seed a user for Google sign-in</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); addUserMutation.mutate(newUser); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'mechanic' })}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="mechanic">Mechanic</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUserMutation.isPending || !newUser.name || !newUser.email}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {addUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UsersManagement;
