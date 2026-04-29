import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import RoyalTyresIcon from '@/components/RoyalTyresIcon';
import { motion } from 'framer-motion';
import { firebaseConfigured } from '@/lib/firebase';

function getFirebaseErrorMessage(code: string, message?: string): string {
  // Handle custom domain error messages
  if (message?.includes('@royaltyres.co.za')) {
    return message;
  }
  
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':   return 'No account found with these credentials';
    case 'auth/wrong-password':        return 'Incorrect password';
    case 'auth/invalid-email':         return 'Invalid email address';
    case 'auth/email-already-in-use':  return 'An account with this email already exists';
    case 'auth/weak-password':         return 'Password must be at least 6 characters';
    case 'auth/user-disabled':         return 'This account has been disabled';
    case 'auth/too-many-requests':     return 'Too many failed attempts — try again later';
    case 'auth/popup-closed-by-user':  return '';
    case 'auth/network-request-failed': return 'Network error — check your connection';
    case 'auth/operation-not-supported-in-this-environment': return 'Google Sign-in is not available (popups may be blocked)';
    default:                           return message || 'Something went wrong — please try again';
  }
}

const LoginPage = () => {
  const { user, loading, loginWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate(user.role === 'admin' ? '/admin' : '/mechanic', { replace: true });
    }
  }, [user, loading, navigate]);

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null); setErrorCode(null);
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
  };

  // Email validation - basic format check
  const validateEmail = (emailStr: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Strong password validation
  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z)' };
    }
    if (!/[a-z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter (a-z)' };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one number (0-9)' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one special character (!@#$%^&* etc.)' };
    }
    return { valid: true };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields'); return; }
    
    if (mode === 'signup') {
      // Additional validation for signup
      if (!name.trim()) { setError('Please enter your name'); return; }
      
      // Email format validation
      if (!validateEmail(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }
      
      // Password match validation
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
      
      // Strong password validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        setError(passwordValidation.message || 'Password does not meet requirements');
        return;
      }
    }
    
    setIsSubmitting(true); setError(null);
    try {
      if (mode === 'signup') await signUpWithEmail(name.trim(), email.trim(), password);
      else await loginWithEmail(email.trim(), password);
    } catch (err: any) {
      const msg = getFirebaseErrorMessage(err.code ?? '');
      if (msg) setError(msg);
      setErrorCode(err.code ?? null);
    } finally { setIsSubmitting(false); }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-input bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition disabled:opacity-50";
  const labelCls = "block text-xs font-medium text-foreground/70 mb-1";

  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-center items-center p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #1B2A5B 55%, #2a3f7a 100%)' }}>
        {/* grid overlay */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 48px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 48px)' }} />
        {/* glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #E31E24 0%, transparent 70%)' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative z-10 text-center select-none"
        >
          <div className="inline-flex items-center justify-center mb-6">
            <RoyalTyresIcon size={80} className="drop-shadow-lg" />
          </div>
          <h1 className="text-white font-display font-bold text-4xl tracking-tight">Royal Tyres</h1>
          <p className="text-white/50 mt-3 text-sm tracking-wide uppercase">Vehicle Inspection System</p>
        </motion.div>

        <p className="absolute bottom-6 z-10 text-white/20 text-xs">&copy; 2026 Royal Tyres</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-[#f8fafc]">
        {/* Firebase misconfiguration banner */}
        {!firebaseConfigured && (
          <div className="w-full max-w-[400px] mb-6 flex gap-2 items-start rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Firebase not configured.</strong> Create a{' '}
              <code className="bg-amber-100 px-1 rounded">.env.local</code> file from{' '}
              <code className="bg-amber-100 px-1 rounded">.env.example</code> and add your Firebase credentials.
            </div>
          </div>
        )}

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <RoyalTyresIcon size={36} className="rounded-xl" />
          <span className="font-display font-bold text-xl text-foreground">Royal Tyres</span>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-[400px]"
        >
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === 'signin'
                ? 'Sign in to access your dashboard'
                : 'Get started with Royal Tyres today'}
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-6">
            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-3">

              {mode === 'signup' && (
                <div>
                  <label className={labelCls}>Full name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith" autoComplete="name" disabled={isSubmitting}
                    className={inputCls} />
                </div>
              )}

              <div>
                <label className={labelCls}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" disabled={isSubmitting}
                  className={inputCls} />
                {mode === 'signup' && email && !validateEmail(email) && (
                  <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min. 8 chars, 1 upper, 1 lower, 1 number, 1 special' : '••••••••'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    disabled={isSubmitting} className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && password && (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className={`flex items-center gap-1.5 ${password.length >= 8 ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-green-600' : 'bg-red-600'}`} />
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-green-600' : 'bg-red-600'}`} />
                      One uppercase letter (A-Z)
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[a-z]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${/[a-z]/.test(password) ? 'bg-green-600' : 'bg-red-600'}`} />
                      One lowercase letter (a-z)
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-green-600' : 'bg-red-600'}`} />
                      One number (0-9)
                    </div>
                    <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'bg-green-600' : 'bg-red-600'}`} />
                      One special character (!@#$%^&* etc.)
                    </div>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div>
                  <label className={labelCls}>Confirm password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password" autoComplete="new-password"
                      disabled={isSubmitting} className={inputCls + ' pr-10'} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                  {confirmPassword && password === confirmPassword && password && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Passwords match</p>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                    {errorCode === 'auth/email-already-in-use' && (
                      <button type="button" onClick={() => switchMode('signin')}
                        className="text-xs text-primary hover:underline font-medium mt-0.5 block">
                        Sign in to existing account →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-60 mt-1">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
                  : mode === 'signup'
                    ? 'Create Account'
                    : `Sign in`}
              </button>
            </form>
          </div>

          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground mt-5">
            {mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="text-primary font-semibold hover:underline">Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="text-primary font-semibold hover:underline">Sign in</button>
              </>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
