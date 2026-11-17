import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import type { CurrencyCode, FavoriteRecord, UserProfile } from '../types/estora';

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: UserProfile | null;
  idToken: string | null;
  loadingAuth: boolean;
  authError: string | null;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  favoriteIds: Set<number>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  togglePropertyFavorite: (propertyId: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const syncBackendProfile = useCallback(async (token: string) => {
    try {
      const [{ user }, favs] = await Promise.all([
        apiFetch<{ user: UserProfile }>('/api/me', { token }),
        apiFetch<{ favorites: FavoriteRecord[] }>('/api/favorites', { token }),
      ]);
      setDbUser(user);
      if (user.preferredCurrency === 'UZS' || user.preferredCurrency === 'USD') {
        setCurrency(user.preferredCurrency);
      }
      setFavoriteIds(new Set(favs.favorites.map((f) => f.propertyId)));
    } catch (error) {
      console.error('Failed to synchronize profile:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          await syncBackendProfile(token);
        } catch (error) {
          console.error('Token retrieval failed:', error);
        }
      } else {
        setIdToken(null);
        setDbUser(null);
        setFavoriteIds(new Set());
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [syncBackendProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const token = await credential.user.getIdToken();
      setIdToken(token);
      await syncBackendProfile(token);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Не удалось выполнить вход через Google.';
      setAuthError(message);
    }
  }, [syncBackendProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setIdToken(null);
    setDbUser(null);
    setFavoriteIds(new Set());
  }, []);

  const refreshUser = useCallback(async () => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    setIdToken(token);
    await syncBackendProfile(token);
  }, [firebaseUser, syncBackendProfile]);

  const togglePropertyFavorite = useCallback(
    async (propertyId: number): Promise<boolean> => {
      if (!idToken) {
        await signInWithGoogle();
        return false;
      }
      const isCurrentlySaved = favoriteIds.has(propertyId);
      const method = isCurrentlySaved ? 'DELETE' : 'POST';
      await apiFetch(`/api/favorites/${propertyId}`, { method, token: idToken });
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) {
          next.delete(propertyId);
        } else {
          next.add(propertyId);
        }
        return next;
      });
      return !isCurrentlySaved;
    },
    [favoriteIds, idToken, signInWithGoogle]
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        idToken,
        loadingAuth,
        authError,
        currency,
        setCurrency,
        favoriteIds,
        signInWithGoogle,
        logout,
        refreshUser,
        togglePropertyFavorite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
