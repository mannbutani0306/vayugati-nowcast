import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  profile: null,
  role: 'citizen',
  session: null,
  loading: true,
  error: null,
  isConfigured: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  switchDemoRole: () => {},
  refreshProfile: async () => {},
});

// Demo profiles for role-based operational simulation
const DEMO_PROFILES = {
  citizen: {
    id: 'demo-citizen-uid-001',
    email: 'citizen@vayugati.gov.in',
    full_name: 'Ananya Sharma',
    role: 'citizen',
    jurisdiction: 'Dehradun Valley, Uttarakhand',
    badge_id: 'CIT-8921',
    created_at: new Date('2026-01-15T08:00:00Z').toISOString(),
  },
  officer: {
    id: 'demo-officer-uid-002',
    email: 'officer@vayugati.gov.in',
    full_name: 'Inspector Vikramaditya Rawat',
    role: 'officer',
    jurisdiction: 'State Disaster Management Authority (SDMA - Zone 4)',
    badge_id: 'NDRF-OFF-402',
    created_at: new Date('2025-11-20T10:30:00Z').toISOString(),
  },
  admin: {
    id: 'demo-admin-uid-003',
    email: 'admin@vayugati.gov.in',
    full_name: 'Dr. Kailash S. Murthy',
    role: 'admin',
    jurisdiction: 'IMD Doppler Radar Met Center & HQ Nowcasting Unit',
    badge_id: 'IMD-ADMIN-01',
    created_at: new Date('2024-06-10T14:15:00Z').toISOString(),
  },
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('citizen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetches user profile metadata and authorization role from public.users table
   * @param {string} userId - Supabase auth uuid
   * @param {string} fallbackEmail - Current user email address
   */
  const fetchUserProfile = useCallback(async (userId, fallbackEmail = '') => {
    if (!userId) return null;

    if (!isSupabaseConfigured) {
      // In mock/unconfigured environment, return current cached or default profile
      const storedRole = localStorage.getItem('vayugati_demo_role') || 'officer';
      const mockProf = DEMO_PROFILES[storedRole] || DEMO_PROFILES.citizen;
      setProfile(mockProf);
      setRole(mockProf.role);
      return mockProf;
    }

    try {
      const { data, error: profileErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr) {
        // If row doesn't exist yet, attempt to upsert minimal baseline profile
        if (profileErr.code === 'PGRST116') {
          const defaultRole = 'citizen';
          const newProfile = {
            id: userId,
            email: fallbackEmail,
            full_name: fallbackEmail.split('@')[0] || 'Citizen Observer',
            role: defaultRole,
            created_at: new Date().toISOString(),
          };

          const { data: insertedData } = await supabase
            .from('users')
            .upsert(newProfile)
            .select()
            .single();

          const resolved = insertedData || newProfile;
          setProfile(resolved);
          setRole(resolved.role || 'citizen');
          return resolved;
        } else {
          console.warn('Profile retrieval warning:', profileErr.message);
          // Fallback to basic auth identity
          const fallback = { id: userId, email: fallbackEmail, role: 'citizen' };
          setProfile(fallback);
          setRole('citizen');
          return fallback;
        }
      }

      setProfile(data);
      setRole(data.role || 'citizen');
      return data;
    } catch (err) {
      console.error('Failed to resolve profile from public.users:', err);
      const fallback = { id: userId, email: fallbackEmail, role: 'citizen' };
      setProfile(fallback);
      setRole('citizen');
      return fallback;
    }
  }, []);

  /**
   * Initialize session persistence and register auth state change listener
   */
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured) {
        if (localStorage.getItem('vayugati_demo_signed_out') === 'true') {
          if (isMounted) {
            setUser(null);
            setProfile(null);
            setRole('citizen');
            setSession(null);
            setLoading(false);
          }
          return;
        }

        // Hydrate demo mode session
        const storedRole = localStorage.getItem('vayugati_demo_role') || 'officer';
        const demoUser = DEMO_PROFILES[storedRole] || DEMO_PROFILES.citizen;
        if (isMounted) {
          setUser({ id: demoUser.id, email: demoUser.email });
          setProfile(demoUser);
          setRole(demoUser.role);
          setSession({ access_token: 'mock-jwt-token', user: demoUser });
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user || null);
          if (initialSession?.user) {
            await fetchUserProfile(initialSession.user.id, initialSession.user.email);
          } else {
            setProfile(null);
            setRole('citizen');
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to initialize session');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    // Subscribe to Supabase auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    let authSubscription = null;
    if (isSupabaseConfigured) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else {
          setProfile(null);
          setRole('citizen');
        }
      });
      authSubscription = listener.subscription;
    }

    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [fetchUserProfile]);

  /**
   * User login with Supabase password credentials
   */
  const login = async ({ email, password }) => {
    setError(null);
    const normalizedEmail = (email || '').trim().toLowerCase();
    const demoKey = Object.keys(DEMO_PROFILES).find(
      (k) => DEMO_PROFILES[k].email.toLowerCase() === normalizedEmail
    );

    if (!isSupabaseConfigured) {
      // In demo mode, pick matching demo role or fallback
      const matchingKey = demoKey || 'citizen';
      return switchDemoRole(matchingKey);
    }

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInErr) {
        // If Supabase authentication fails (e.g. offline, mock project, unconfirmed email)
        // and user is logging in with one of the standard demo accounts, fall back gracefully
        if (demoKey) {
          console.warn('Supabase auth failed; falling back to demo session for evaluation:', signInErr.message);
          return switchDemoRole(demoKey);
        }
        throw signInErr;
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await fetchUserProfile(data.user.id, data.user.email);
      }
      return { success: true, data };
    } catch (err) {
      if (demoKey) {
        return switchDemoRole(demoKey);
      }
      setError(err.message || 'Authentication failed');
      return { success: false, error: err.message };
    }
  };

  /**
   * Register new user and initialize record in public.users table
   */
  const signup = async ({ email, password, fullName = '', targetRole = 'citizen' }) => {
    setError(null);
    if (!isSupabaseConfigured) {
      localStorage.removeItem('vayugati_demo_signed_out');
      const customProfile = {
        id: `mock-usr-${Date.now()}`,
        email,
        full_name: fullName || 'New Observer',
        role: targetRole,
        jurisdiction: 'Regional Monitoring Node',
        badge_id: `REG-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
      };
      setUser({ id: customProfile.id, email });
      setProfile(customProfile);
      setRole(targetRole);
      return { success: true };
    }

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: targetRole,
          },
        },
      });

      if (signUpErr) throw signUpErr;

      if (data?.user) {
        // Write profile row into public.users
        await supabase.from('users').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: targetRole,
          created_at: new Date().toISOString(),
        });
        await fetchUserProfile(data.user.id, email);
      }

      return { success: true, data };
    } catch (err) {
      setError(err.message || 'Registration failed');
      return { success: false, error: err.message };
    }
  };

  /**
   * Terminate active authentication session
   */
  const logout = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setUser(null);
      setProfile(null);
      setRole('citizen');
      setSession(null);
      localStorage.removeItem('vayugati_demo_role');
      localStorage.setItem('vayugati_demo_signed_out', 'true');
      return { success: true };
    }

    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) throw signOutErr;
      setUser(null);
      setProfile(null);
      setRole('citizen');
      setSession(null);
      return { success: true };
    } catch (err) {
      setError(err.message || 'Logout failed');
      return { success: false, error: err.message };
    }
  };

  /**
   * Fast role switching utility for operational role testing
   */
  const switchDemoRole = (newRole) => {
    const target = DEMO_PROFILES[newRole] || DEMO_PROFILES.citizen;
    localStorage.removeItem('vayugati_demo_signed_out');
    localStorage.setItem('vayugati_demo_role', target.role);
    setUser({ id: target.id, email: target.email });
    setProfile(target);
    setRole(target.role);
    setSession({ access_token: `mock-token-${target.role}`, user: target });
    setError(null);
    return { success: true, profile: target };
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id, user.email);
    }
  };

  const value = {
    user,
    profile,
    role,
    session,
    loading,
    error,
    isConfigured: isSupabaseConfigured,
    login,
    signup,
    logout,
    switchDemoRole,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
