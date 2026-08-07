import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminUser } from "@/lib/admin";
import type { CreatorProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: CreatorProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(u: User) {
    try {
      const snap = await getDoc(doc(db, "creators", u.uid));
      if (snap.exists()) {
        setProfile(snap.data() as CreatorProfile);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user);
  }

  async function handleSignOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const isAdmin = isAdminUser(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        refreshProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
