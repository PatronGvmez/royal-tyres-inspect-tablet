import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '@/lib/firebase';
import { getUserProfile, createUserProfile, updateUserProfile, updateUserByAdmin } from '@/lib/firestore';
import { User } from '@/types';

// Google OAuth provider configuration
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string, intendedRole?: 'admin' | 'mechanic') => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string, role: 'admin' | 'mechanic') => Promise<void>;
  loginWithGoogle: (intendedRole?: 'admin' | 'mechanic') => Promise<void>;
  logout: () => void;
  updateUser: (data: { name?: string; email?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  loginWithGoogle: async () => {},
  logout: () => {},
  updateUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Captures the role explicitly chosen at login time so onAuthStateChanged
  // can use it as a fallback instead of hardcoding 'mechanic'.
  const pendingLoginRole = useRef<'admin' | 'mechanic' | null>(null);

  useEffect(() => {
    // If Firebase was not configured (missing .env.local), skip auth listener
    if (!firebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Safety timeout — if onAuthStateChanged never fires (bad credentials),
    // release the loading gate after 8 seconds so the UI isn't stuck blank.
    const timeout = setTimeout(() => setLoading(false), 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      try {
        if (firebaseUser) {
          let profile = await getUserProfile(firebaseUser.uid);
          if (!profile) {
            // Profile doc missing — only create it if we know the intended role
            // (i.e. the user just logged in via loginWithEmail/loginWithGoogle).
            // On session-restore (page refresh) we have no role signal — don't
            // create a doc with a hardcoded 'mechanic' role that would overwrite
            // a legitimate admin account.
            const fallbackRole = pendingLoginRole.current ?? null;
            if (fallbackRole) {
              profile = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                email: firebaseUser.email || '',
                role: fallbackRole,
              };
              try { await createUserProfile(firebaseUser.uid, profile); } catch { /* rules may block — still let them in */ }
            } else {
              // Session restore but no Firestore doc — cannot determine role safely.
              // Sign the user out so they are prompted to log in again.
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }
          }
          pendingLoginRole.current = null;
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch {
        // Firestore totally unreachable — preserve existing user state if available,
        // otherwise sign out to avoid routing to the wrong dashboard.
        if (!user) setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const loginWithEmail = async (
    email: string,
    password: string,
    intendedRole: 'admin' | 'mechanic' = 'mechanic'
  ) => {
    pendingLoginRole.current = intendedRole;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    let profile = await getUserProfile(cred.user.uid);
    if (!profile) {
      profile = {
        id: cred.user.uid,
        name: cred.user.displayName || email.split('@')[0],
        email,
        role: intendedRole,
      };
      await createUserProfile(cred.user.uid, profile);
    } else if (profile.role !== intendedRole) {
      // User is logging in and explicitly selected a different role —
      // update the stored profile so routing is correct.
      await updateUserByAdmin(cred.user.uid, { role: intendedRole });
      profile = { ...profile, role: intendedRole };
    }
    pendingLoginRole.current = null;
    setUser(profile);
  };

  const signUpWithEmail = async (
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'mechanic'
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const profile: User = {
      id: cred.user.uid,
      name,
      email,
      role,
    };
    await createUserProfile(cred.user.uid, profile);
    setUser(profile);
  };

  const loginWithGoogle = async (intendedRole: 'admin' | 'mechanic' = 'mechanic') => {
    try {
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      pendingLoginRole.current = intendedRole;
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email || '';
      let profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        profile = {
          id: cred.user.uid,
          name: cred.user.displayName || 'Unknown',
          email,
          role: intendedRole,
        };
        await createUserProfile(cred.user.uid, profile);
      } else if (profile.role !== intendedRole) {
        await updateUserByAdmin(cred.user.uid, { role: intendedRole });
        profile = { ...profile, role: intendedRole };
      }
      pendingLoginRole.current = null;
      setUser(profile);
    } catch (error: any) {
      pendingLoginRole.current = null;
      console.error('Google auth error:', error.message || error.code);
      throw error;
    }
  };

  const logout = () => {
    signOut(auth);
  };

  const updateUser = async (data: { name?: string; email?: string }) => {
    if (!user) return;
    await updateUserProfile(user.id, data);
    setUser(prev => prev ? { ...prev, ...data } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, signUpWithEmail, loginWithGoogle, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
