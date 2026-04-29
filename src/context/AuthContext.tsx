import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '@/lib/firebase';
import { getUserProfile, createUserProfile, updateUserProfile } from '@/lib/firestore';
import { UserModel } from '@/lib/firestoreModels';
import { User } from '@/types';

/**
 * Resolves a user profile by UID first, then falls back to email lookup.
 * Users created via the admin dashboard have Firestore docs keyed by an
 * email-derived ID rather than the Firebase Auth UID. When found by email
 * we migrate the doc to use the UID so future lookups are fast.
 */
async function resolveProfile(uid: string, email: string | null): Promise<User | null> {
  // Primary: UID-keyed lookup (fast path for all sign-up created accounts)
  const byUid = await getUserProfile(uid);
  if (byUid) return byUid;

  // Fallback: email lookup (catches admin-pre-seeded accounts)
  if (!email) return null;
  const byEmail = await UserModel.getByEmail(email);
  if (!byEmail) return null;

  // Migrate: write a UID-keyed doc so this fallback only runs once
  const migrated: User = { ...byEmail, id: uid };
  try { await createUserProfile(uid, migrated); } catch { /* ignore write errors, still let user in */ }
  return migrated;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string, role?: 'admin' | 'mechanic') => Promise<void>;
  logout: () => void;
  updateUser: (data: { name?: string; email?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: () => {},
  updateUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          const profile = await resolveProfile(firebaseUser.uid, firebaseUser.email);
          if (!profile) {
            // No Firestore profile — cannot determine role safely. Sign out.
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }
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

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await resolveProfile(cred.user.uid, cred.user.email);
    if (!profile) {
      await signOut(auth);
      throw Object.assign(
        new Error('No account profile found. Contact your administrator.'),
        { code: 'auth/no-profile' }
      );
    }
    setUser(profile);
  };

  const signUpWithEmail = async (
    name: string,
    email: string,
    password: string,
    role: 'admin' | 'mechanic' = 'mechanic'
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

  const logout = () => {
    signOut(auth);
  };

  const updateUser = async (data: { name?: string; email?: string }) => {
    if (!user) return;
    await updateUserProfile(user.id, data);
    setUser(prev => prev ? { ...prev, ...data } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, signUpWithEmail, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
