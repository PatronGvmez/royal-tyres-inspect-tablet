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
 * Resolves a user profile, always treating the admin-panel (email-keyed) doc
 * as the authoritative source of truth for the `role` field.
 *
 * Why: users added via the admin dashboard have Firestore docs keyed by an
 * email-derived ID (e.g. "admin_royaltyres_co_za"). A past bug could also write
 * a UID-keyed doc with role:"mechanic", overriding the correct admin role.
 *
 * Strategy:
 *  1. Fetch both docs in parallel.
 *  2. If an email-keyed doc exists, it wins on role (admin panel is source of truth).
 *     Patch the UID-keyed doc if the role is stale or the doc is missing.
 *  3. If only the UID-keyed doc exists (self sign-up path), use it as-is.
 */
async function resolveProfile(uid: string, email: string | null): Promise<User | null> {
  const [byUid, byEmail] = await Promise.all([
    getUserProfile(uid),
    email ? UserModel.getByEmail(email) : Promise.resolve(null),
  ]);

  if (byEmail) {
    // Admin-panel doc is authoritative — build the canonical profile
    const canonical: User = { ...byEmail, id: uid };
    // Patch UID-keyed doc if it's missing or has a stale role
    if (!byUid) {
      try { await createUserProfile(uid, canonical); } catch { /* ignore */ }
    } else if (byUid.role !== byEmail.role) {
      try { await UserModel.updateRole(uid, byEmail.role); } catch { /* ignore */ }
    }
    return canonical;
  }

  return byUid ?? null;
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
