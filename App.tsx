
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Rankings from './pages/Rankings';
import TempleList from './pages/TempleList';
import Login from './pages/Login';
import About from './pages/About';
import Guidelines from './pages/Guidelines';
import Faqs from './pages/Faqs';
import Connect from './pages/Connect';
import AIStudio from './pages/AIStudio';
import WasteAnalysis from './pages/WasteAnalysis';
import Shop from './pages/Shop';
import Training from './pages/Training';
import NotFound from './pages/NotFound';
import TrackDriver from './pages/TrackDriver';
import AIChatBot from './components/AIChatBot';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import TempleDashboard from './pages/dashboards/TempleDashboard';
import NgoDashboard from './pages/dashboards/NgoDashboard';
import UserDashboard from './pages/dashboards/UserDashboard';
import DryingUnitDashboard from './pages/dashboards/DryingUnitDashboard';
import { User, UserRole } from './types';
import { supabase } from './lib/supabaseClient';
import { BowArrowLogo } from './constants';
import { ThemeProvider } from './ThemeContext';

// Protected Route Wrapper
interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles: UserRole[];
  user: User | null;
  loading: boolean;
}

const ProtectedRoute = ({ children, allowedRoles, user, loading }: ProtectedRouteProps) => {
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-slate-900">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-stone-600 dark:text-stone-300 font-semibold">Loading session...</div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" replace />;

  // Admin has universal supervision clearance
  if (user.role === UserRole.ADMIN || allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-slate-900 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-2xl border border-stone-200 dark:border-slate-700 text-center">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
          🔒
        </div>
        <h2 className="text-xl font-bold text-stone-800 dark:text-white mb-2">Role Clearance Required</h2>
        <p className="text-sm text-stone-600 dark:text-stone-300 mb-6">
          You are signed in as <span className="font-bold text-orange-600">{user.role}</span>. This panel is reserved for <span className="font-bold text-stone-800 dark:text-white">{allowedRoles.join(' / ')}</span>.
        </p>
        <div className="space-y-3">
          <Link
            to="/login"
            className="block w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md transition-all text-sm"
          >
            Switch to {allowedRoles[0]} Role
          </Link>
          <Link
            to={
              user.role === UserRole.TEMPLE ? '/temple-dashboard' :
              user.role === UserRole.DRYING_UNIT ? '/du-dashboard' :
              user.role === UserRole.NGO ? '/ngo-dashboard' : '/user-dashboard'
            }
            className="block w-full py-3 px-4 bg-stone-100 dark:bg-slate-700 hover:bg-stone-200 dark:hover:bg-slate-600 text-stone-700 dark:text-stone-200 font-semibold rounded-xl transition-all text-sm"
          >
            Go to My {user.role} Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

// Layout Manager Component
interface LayoutManagerProps {
  children?: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const LayoutManager = ({ children, user, onLogout }: LayoutManagerProps) => {
  const location = useLocation();
  // Hide Navbar/Footer for Dashboards AND the Tracking Page
  const isDashboard = location.pathname.includes('dashboard');
  const isTracking = location.pathname.includes('/track/');

  const hideChrome = isDashboard || isTracking;

  return (
    <div className="flex flex-col min-h-screen dark:bg-slate-900">
      {!hideChrome && <Navbar user={user} onLogout={onLogout} />}
      <main className={!hideChrome ? "flex-grow pt-20" : "flex-grow"}>
        {children}
      </main>
      {!hideChrome && <Footer />}
      <AIChatBot />
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data && data.user) {
          await fetchUserProfile(data.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Session check failed", e);
        setLoading(false);
      }
    };

    checkSession();

    // 2. Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
       if(authListener && authListener.subscription) authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const res = await supabase.from('profiles').select('*').eq('id', userId).single();
      let data = res.data;

      // Self-healing: if no profile exists yet, create or fallback using auth user info
      if (!data) {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (authUser) {
          const isAdmin = authUser.email?.toLowerCase() === 'jagannatha.vm@gmail.com';
          const newProfile = {
            id: userId,
            email: authUser.email,
            full_name: isAdmin ? 'System Admin' : (authUser.displayName || 'Devotee'),
            role: isAdmin ? UserRole.ADMIN : UserRole.PERSON,
            green_coins: isAdmin ? 1000 : 100,
            green_stars: 5,
            verification_status: 'APPROVED',
            is_disabled: false
          };
          await supabase.from('profiles').upsert(newProfile);
          data = newProfile;
        }
      }
      
      if (data) {
        if (data.is_disabled) {
          await handleLogout();
          alert("Your session has been terminated because your account is disabled. Please contact admin.");
          return;
        }

        setUser({
          id: data.id,
          name: data.full_name || 'User',
          role: data.role as UserRole,
          greenCoins: data.green_coins || 0,
          greenStars: data.green_stars || 0,
          isVolunteer: data.is_volunteer || false,
          isDisabled: data.is_disabled || false
        });
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.id) {
      fetchUserProfile(loggedInUser.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-slate-900">
       <div className="relative mb-4">
         <div className="absolute inset-0 bg-orange-500 blur-lg opacity-20 rounded-full"></div>
         <BowArrowLogo className="w-16 h-16 text-orange-600 animate-pulse" color="#ea580c" />
       </div>
       <div className="text-stone-600 dark:text-stone-300 font-bold">Initializing Ecosystem...</div>
    </div>
  );

  return (
    <ThemeProvider>
      <Router>
        <LayoutManager user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/temples" element={<TempleList />} />
            <Route path="/ai-studio" element={<AIStudio />} />
            <Route path="/scan" element={<WasteAnalysis />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/training" element={<Training />} />
            <Route path="/guidelines" element={<Guidelines />} />
            <Route path="/faqs" element={<Faqs />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            
            {/* New Route for Tracking */}
            <Route path="/track/:id" element={<TrackDriver />} />
            
            {/* Protected Dashboards */}
            <Route path="/admin-dashboard" element={
              <ProtectedRoute user={user} loading={loading} allowedRoles={[UserRole.ADMIN]}>
                <AdminDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } />
            <Route path="/temple-dashboard" element={
              <ProtectedRoute user={user} loading={loading} allowedRoles={[UserRole.TEMPLE]}>
                <TempleDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } />
            <Route path="/du-dashboard" element={
              <ProtectedRoute user={user} loading={loading} allowedRoles={[UserRole.DRYING_UNIT]}>
                <DryingUnitDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } />
            <Route path="/ngo-dashboard" element={
              <ProtectedRoute user={user} loading={loading} allowedRoles={[UserRole.NGO]}>
                <NgoDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } />
            <Route path="/user-dashboard" element={
              <ProtectedRoute user={user} loading={loading} allowedRoles={[UserRole.PERSON]}>
                <UserDashboard onLogout={handleLogout} />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </LayoutManager>
      </Router>
    </ThemeProvider>
  );
};

export default App;
