import { useState, useRef, useEffect } from 'react';
import { LogOut, Sun, Moon, Bell, X, User, CheckCircle2, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import RoyalTyresIcon from '@/components/RoyalTyresIcon';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NavNudge {
  id: string;
  job_id: string;
  job_license_plate: string;
  customer_name: string;
  message: string;
  acknowledged?: boolean;
  response?: string;
  sent_at?: { seconds: number; nanoseconds: number } | null;
}

interface NavbarProps {
  userName?: string;
  role?: string;
  onLogout: () => void;
  maxWidth?: string;
  nudges?: NavNudge[];
  onDismissNudge?: (id: string) => void;
  onAcknowledgeNudge?: (id: string) => void;
  /** Pass true to show the avatar profile nav link */
  showProfile?: boolean;
  /** Called when the user clicks the tour help button */
  onStartTour?: () => void;
}

const Navbar = ({
  userName,
  role,
  onLogout,
  maxWidth = 'max-w-[1600px]',
  nudges = [],
  onDismissNudge,
  onAcknowledgeNudge,
  showProfile = false,
  onStartTour,
}: NavbarProps) => {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  const handleLogoutClick = () => setConfirmOpen(true);

  const unreadCount = nudges.filter(n => !n.acknowledged).length;

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate(role === 'Admin' ? '/admin' : '/mechanic')}>
          <RoyalTyresIcon size={32} className="rounded-lg" />
          <span className="font-display font-bold text-foreground text-base">Royal Tyres</span>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Username label */}
          {userName && (
            <div className="text-right mr-1">
              <p className="text-xs font-medium text-foreground leading-none">{userName}</p>
              {role && userName?.toLowerCase() !== role.toLowerCase() && (
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{role}</p>
              )}
            </div>
          )}

          {/* Profile avatar → navigates to /profile */}
          {showProfile && (
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-primary hover:border-primary/60 hover:bg-primary/25 transition-all"
              aria-label="View profile"
              title="My profile"
            >
              <User className="w-4 h-4" />
            </button>
          )}

          {/* Notification bell — mechanic only */}
          {onDismissNudge !== undefined && (
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setPanelOpen(o => !o)}
                className={`relative p-2 rounded-lg transition-colors ${
                  unreadCount > 0 ? 'text-warning bg-warning/10 hover:bg-warning/20' : 'text-muted-foreground hover:bg-muted'
                }`}
                aria-label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning animate-ping opacity-60 pointer-events-none" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning pointer-events-none" />
                  </>
                )}
              </button>

              {panelOpen && (
                <div className="absolute right-0 top-full mt-2 w-[340px] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5 text-warning" />
                      </div>
                      <span className="text-xs font-bold text-foreground">Notifications from Admin</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">
                        {unreadCount} unread
                      </span>
                    )}
                    {unreadCount === 0 && nudges.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> All done
                      </span>
                    )}
                  </div>

                  {nudges.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <Bell className="w-5 h-5 text-muted-foreground opacity-40" />
                      </div>
                      <p className="text-xs font-medium text-foreground">You're all caught up</p>
                      <p className="text-[10px] text-muted-foreground mt-1">No pending messages from admin</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-border">
                      {nudges.map(nudge => (
                        <div
                          key={nudge.id}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                            nudge.acknowledged ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-muted/50'
                          }`}
                        >
                          {/* Icon */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            nudge.acknowledged
                              ? 'bg-success/15 border border-success/20'
                              : 'bg-warning/10 border border-warning/20'
                          }`}>
                            {nudge.acknowledged
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                              : <Bell className="w-3.5 h-3.5 text-warning" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-snug">
                              <span className={`font-mono ${nudge.acknowledged ? 'text-success' : 'text-warning'}`}>
                                {nudge.job_license_plate}
                              </span>
                              {nudge.customer_name ? ` · ${nudge.customer_name}` : ''}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{nudge.message}</p>
                            {nudge.acknowledged && nudge.response && (
                              <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5" />{nudge.response}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                            {/* Tick (acknowledge) — only for unacknowledged */}
                            {!nudge.acknowledged && onAcknowledgeNudge && (
                              <button
                                onClick={() => onAcknowledgeNudge(nudge.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                                title="Mark as done"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* X (dismiss) */}
                            <button
                              onClick={() => onDismissNudge(nudge.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-4 py-2.5 border-t border-border bg-muted/30">
                    <p className="text-[10px] text-muted-foreground text-center">Refreshes automatically every 15 seconds</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Tour help button */}
          {onStartTour && (
            <button
              id="tour-help-btn"
              onClick={onStartTour}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Start guided tour"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Sign-out confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
};

export default Navbar;
