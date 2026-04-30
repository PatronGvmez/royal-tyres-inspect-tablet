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
/** Normalize role to lowercase so Firestore values like "Admin" work correctly. */
function normalizeRole(role: string | undefined): 'admin' | 'mechanic' {
  return (role ?? '').toLowerCase() === 'admin' ? 'admin' : 'mechanic';
}

/**
 * Convert an email address to the doc ID used by the admin dashboard's
 * "Add User" flow: every non-alphanumeric character becomes an underscore.
 * e.g. "admin@royaltyres.co.za" → "admin_royaltyres_co_za"
 */
function emailToDocId(email: string): string {
  return email.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Try every possible Firestore document key for this user:
 *  1. users/{firebaseAuthUID}  — accounts created via sign-up flow
 *  2. users/{emailDerivedId}   — accounts pre-seeded via admin dashboard
 *  3. collection query by email — last resort (may be blocked by Firestore rules)
 *
 * If an email-keyed doc is found, its role is authoritative (admin panel is
 * source of truth). A UID-keyed doc is patched/created so future lookups
 * use the fast path.
 */
async function resolveProfile(uid: string, email: string | null): Promise<User | null> {
  const emailDocId = email ? emailToDocId(email) : null;

  // Fetch both direct-key lookups in parallel (these are never blocked by rules
  // the same way collection queries are)
  const [byUid, byEmailDocId] = await Promise.all([
    getUserProfile(uid).catch(() => null),
    emailDocId && emailDocId !== uid
      ? getUserProfile(emailDocId).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Fall back to email collection query only if direct reads found nothing
  const emailDoc = byEmailDocId ||
    (email && !byUid
      ? await UserModel.getByEmail(email).catch(() => null)
      : null);

  if (emailDoc) {
    // Email-keyed doc is authoritative for role
    const canonical: User = { ...emailDoc, id: uid, role: normalizeRole(emailDoc.role) };
    // Ensure a UID-keyed doc exists and has the correct role going forward
    if (!byUid) {
      try { await createUserProfile(uid, canonical); } catch { /* ignore */ }
    } else if (normalizeRole(byUid.role) !== canonical.role) {
      try { await UserModel.updateRole(uid, canonical.role); } catch { /* ignore */ }
    }
    return canonical;
  }

  if (byUid) return { ...byUid, role: normalizeRole(byUid.role) };
  return null;
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
