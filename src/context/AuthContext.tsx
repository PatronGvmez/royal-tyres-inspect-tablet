import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, createUserProfile, updateUserProfile } from '@/lib/firestore';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          let profile = await getUserProfile(firebaseUser.uid);
          if (!profile) {
            // Firestore doc missing (write failed or rules blocked it) —
            // reconstruct from Firebase Auth and re-save so it exists next time.
            profile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'mechanic',
            };
            try { await createUserProfile(firebaseUser.uid, profile); } catch { /* rules may block — still let them in */ }
          }
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch {
        // Firestore totally unreachable — let Firebase Auth user through with minimal profile
        if (firebaseUser) {
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: 'mechanic',
          });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const loginWithEmail = async (
    email: string,
    password: string,
    intendedRole: 'admin' | 'mechanic' = 'mechanic'
  ) => {
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
    }
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
      // Add scopes for email verification
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      
      const cred = await signInWithPopup(auth, googleProvider);
      const email = cred.user.email || '';
      
      // Check if user already exists in system (seeded by admin)
      let profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        // New user - create profile with intended role
        profile = {
          id: cred.user.uid,
          name: cred.user.displayName || 'Unknown',
          email,
          role: intendedRole,
        };
        await createUserProfile(cred.user.uid, profile);
      }
      setUser(profile);
    } catch (error: any) {
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
