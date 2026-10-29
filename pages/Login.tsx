
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { BowArrowLogo } from '../constants';

interface LoginProps {
  onLogin: (user: any) => void;
}

interface NewsCard {
  id: string | number;
  location: string;
  metric: string;
  title: string;
  desc: string;
  query?: string;
  color: string;
  type: 'POLLUTION' | 'UPDATE';
}

const STATIC_POLLUTION_NEWS: NewsCard[] = [
  {
    id: 'p1',
    location: "New Delhi, India",
    metric: "AQI: 350+ (Severe)",
    title: "Toxic Smog & Air Quality Crisis",
    desc: "Real-time reports indicate hazardous PM2.5 levels. See how ritual waste combustion contributes to the crisis.",
    query: "Delhi air pollution AQI ritual waste",
    color: "bg-red-600",
    type: 'POLLUTION'
  },
  {
    id: 'p2',
    location: "Yamuna River",
    metric: "Dissolved Oxygen: < 3mg/L",
    title: "Toxic Froth Outbreak",
    desc: "Chemical runoff and floral waste dumping have created layers of toxic foam. Aquatic life is at critical risk.",
    query: "Yamuna river pollution toxic froth",
    color: "bg-orange-600",
    type: 'POLLUTION'
  },
  {
    id: 'p3',
    location: "Global Ocean Data",
    metric: "Microplastics: High",
    title: "The Silent Ocean Killer",
    desc: "Non-biodegradable ritual offerings (chunri, plastics) are breaking down into microplastics entering the food chain.",
    query: "microplastics ocean pollution religious waste",
    color: "bg-blue-600",
    type: 'POLLUTION'
  },
  {
    id: 'p4',
    location: "Urban Landfills",
    metric: "Methane Emission: Critical",
    title: "Organic Waste Rot",
    desc: "Unsegregated flower waste in landfills generates methane, a greenhouse gas 25x more potent than CO2.",
    query: "flower waste landfill methane emissions",
    color: "bg-yellow-600",
    type: 'POLLUTION'
  }
];

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<UserRole>(UserRole.PERSON);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: 'devotee@ayurveda.org', password: 'password123', fullName: 'Aarav Sharma' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prepopulate credentials for the chosen role for instant access
  useEffect(() => {
    if (activeTab === UserRole.ADMIN) {
      setFormData({ email: 'jagannatha.vm@gmail.com', password: 'Garuda@007', fullName: 'System Admin' });
    } else if (activeTab === UserRole.TEMPLE) {
      setFormData({ email: 'kashi@temple.org', password: 'password123', fullName: 'Kashi Vishwanath Temple' });
    } else if (activeTab === UserRole.DRYING_UNIT) {
      setFormData({ email: 'varanasi.du@ayurveda.org', password: 'password123', fullName: 'Varanasi Bio-Drying Cluster 01' });
    } else if (activeTab === UserRole.NGO) {
      setFormData({ email: 'swachhganga@ngo.org', password: 'password123', fullName: 'Swachh Ganga Foundation' });
    } else {
      setFormData({ email: 'devotee@ayurveda.org', password: 'password123', fullName: 'Aarav Sharma' });
    }
  }, [activeTab]);
  
  // Carousel State
  const [carouselData, setCarouselData] = useState<NewsCard[]>(STATIC_POLLUTION_NEWS);
  const [currentNewsIdx, setCurrentNewsIdx] = useState(0);
  
  const navigate = useNavigate();

  // Hardcoded Admin Credentials Requirement
  const ADMIN_EMAIL = "jagannatha.vm@gmail.com";

  // Fetch Updates and Setup Rotation
  useEffect(() => {
    const fetchUpdates = async () => {
      const { data } = await supabase
        .from('flash_updates')
        .select('*')
        .eq('audience', 'PUBLIC');

      if (data && data.length > 0) {
        const sortedData = data.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 3);

        const formattedUpdates: NewsCard[] = sortedData.map((u: any) => ({
          id: `u-${u.id}`,
          location: "System Broadcast",
          metric: u.type === 'ALERT' ? 'CRITICAL ALERT' : 'LATEST NEWS',
          title: u.title,
          desc: u.content,
          color: u.type === 'ALERT' ? 'bg-red-600' : 'bg-indigo-600',
          type: 'UPDATE'
        }));
        setCarouselData([...formattedUpdates, ...STATIC_POLLUTION_NEWS]);
      }
    };

    fetchUpdates();
  }, []);

  // Auto-rotate logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNewsIdx((prev) => (prev + 1) % carouselData.length);
    }, 5000); // 5 seconds rotation
    return () => clearInterval(timer);
  }, [carouselData]);

  const processLoginSuccess = async (user: any) => {
      // 1. ADMIN SELF-HEALING LOGIC
      if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          console.log("Admin detected. Enforcing role...");
          await supabase.from('profiles').upsert({
              id: user.id,
              email: user.email,
              full_name: 'System Admin',
              role: 'ADMIN',
              verification_status: 'APPROVED',
              is_disabled: false
          });
          const adminProfile = { role: 'ADMIN', full_name: 'System Admin', id: user.id, email: user.email };
          onLogin(adminProfile);
          navigate('/admin-dashboard');
          return;
      }

      // 2. Fetch Existing Profile
      let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // 3. ROLE EXCLUSIVITY CHECK
      if (profile) {
          if (profile.role !== activeTab && activeTab !== UserRole.ADMIN) {
              await supabase.auth.signOut();
              setErrorMsg(`Access Denied: This email is registered as a ${profile.role}. Please switch to the ${profile.role} tab to login.`);
              setLoading(false);
              return;
          }
      } else {
          // New User Setup
          const isPendingRole = activeTab === UserRole.DRYING_UNIT || activeTab === UserRole.NGO;
          const verificationStatus = isPendingRole ? 'PENDING' : 'APPROVED';
          const isDisabled = isPendingRole;
          
          await supabase.from('profiles').upsert({
              id: user.id,
              email: user.email,
              full_name: user.displayName || formData.fullName || 'New User',
              role: activeTab,
              green_coins: 0,
              waste_donated_kg: 0,
              volunteer_status: 'NONE',
              verification_status: verificationStatus,
              is_disabled: isDisabled
          });
          
          if (activeTab === UserRole.TEMPLE) {
               await supabase.from('temples').insert([{
                 owner_id: user.id,
                 name: user.displayName || formData.fullName || 'New Temple',
                 location: 'Location Pending',
                 waste_donated_kg: 0,
                 green_stars: 0,
                 description: 'New temple joining the network.'
               }]);
          }

          if (isPendingRole) {
              await supabase.from('notifications').insert([{
                user_id: 'ADMIN',
                title: `New ${activeTab} Registration Request`,
                message: `${activeTab} '${user.displayName || formData.fullName}' (${user.email}) has requested to join.`,
                type: 'ALERT',
                read: false,
                created_at: new Date().toISOString()
              }]);

              const subject = `New ${activeTab} Registration: ${user.displayName || formData.fullName}`;
              const body = `A new ${activeTab} has registered and is pending approval.\n\nName: ${user.displayName || formData.fullName}\nEmail: ${user.email}\n\nPlease verify in the Admin Dashboard.`;
              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(ADMIN_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              
              window.open(gmailUrl, '_blank');

              alert(`Registration Submitted! A verification email draft has been opened to notify the Admin.`);
              await supabase.auth.signOut();
              setLoading(false);
              return;
          }
          
          const res = await supabase.from('profiles').select('*').eq('id', user.id).single();
          profile = res.data;
      }
      
      if (profile) {
          if ((profile.role === UserRole.DRYING_UNIT || profile.role === UserRole.NGO) && profile.verification_status === 'PENDING') {
              await supabase.auth.signOut();
              setErrorMsg("Account Pending Approval. Please wait for Admin verification.");
              setLoading(false);
              return;
          }
          if (profile.is_disabled) {
              await supabase.auth.signOut();
              setErrorMsg("Account Disabled. Please contact Admin.");
              setLoading(false);
              return;
          }
      }

      onLogin({...user, role: profile?.role || activeTab, name: profile?.full_name || user.displayName || 'User'});

      const role = profile?.role || activeTab;
      if (role === UserRole.ADMIN) navigate('/admin-dashboard');
      else if (role === UserRole.TEMPLE) navigate('/temple-dashboard');
      else if (role === UserRole.DRYING_UNIT) navigate('/du-dashboard');
      else if (role === UserRole.NGO) navigate('/ngo-dashboard');
      else navigate('/user-dashboard');
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithGoogle();
      if (error) throw error;
      if (data?.user) {
        await processLoginSuccess(data.user);
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setErrorMsg(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAccess = async (targetRole: UserRole) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      let email = 'devotee@ayurveda.org';
      let fullName = 'Aarav Sharma';
      let dest = '/user-dashboard';

      if (targetRole === UserRole.ADMIN) {
        email = ADMIN_EMAIL;
        fullName = 'System Admin';
        dest = '/admin-dashboard';
      } else if (targetRole === UserRole.TEMPLE) {
        email = 'kashi@temple.org';
        fullName = 'Kashi Vishwanath Temple';
        dest = '/temple-dashboard';
      } else if (targetRole === UserRole.DRYING_UNIT) {
        email = 'varanasi.du@ayurveda.org';
        fullName = 'Varanasi Bio-Drying Cluster 01';
        dest = '/du-dashboard';
      } else if (targetRole === UserRole.NGO) {
        email = 'swachhganga@ngo.org';
        fullName = 'Swachh Ganga Foundation';
        dest = '/ngo-dashboard';
      }

      const { data } = await supabase.auth.signInWithPassword({ email, password: targetRole === UserRole.ADMIN ? 'Garuda@007' : 'password123' });
      const user = data?.user || { id: `u_${targetRole.toLowerCase()}`, email, displayName: fullName };
      
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: targetRole,
        verification_status: 'APPROVED',
        is_disabled: false,
        green_coins: 500,
        green_stars: 5
      };

      await supabase.from('profiles').upsert(profileData);
      onLogin({ ...user, role: targetRole, name: fullName });
      navigate(dest);
    } catch (err: any) {
      setErrorMsg("Quick access failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkEmailRoleExclusivity = async (email: string) => {
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
      const { data: existingProfile } = await supabase.from('profiles').select('role').eq('email', email).single();
      if (existingProfile) {
          if (existingProfile.role !== activeTab) {
              setErrorMsg(`This email is already registered as ${existingProfile.role}. You cannot use it for ${activeTab}.`);
              setLoading(false);
              return false;
          }
      }
      return true;
  }

  const handleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);

    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();
    const fullName = formData.fullName.trim();

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      setLoading(false);
      return;
    }

    const allowed = await checkEmailRoleExclusivity(email);
    if (!allowed) return;

    try {
      let user = null;

      if (activeTab === UserRole.ADMIN) {
        if (email !== ADMIN_EMAIL) {
          setErrorMsg("Access Denied. Incorrect Admin ID.");
          setLoading(false);
          return;
        }
        if (password !== 'Garuda@007') {
          setErrorMsg("Invalid Admin Credentials.");
          setLoading(false);
          return;
        }
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError && signInData.user) {
          user = signInData.user;
        } else {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: 'System Admin', role: 'ADMIN' } }
          });
          if (signUpError && signUpError.code !== 'auth/email-already-in-use') {
             throw signUpError;
          }
          user = signUpData.user || (await supabase.auth.getUser()).data.user;
        }
      } 
      else {
        if (isRegistering) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role: activeTab } }
          });
          if (error) throw error;
          user = data.user;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          user = data.user;
        }
      }

      if (user) {
          await processLoginSuccess(user);
      }

    } catch (error: any) {
      console.error("Auth Error:", error);
      setErrorMsg(error.message || "Authentication failed. Please try again.");
      setLoading(false);
    }
  };

  const currentNews = carouselData[currentNewsIdx];

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-stone-100">
      
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-end p-12 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
           <img 
             src="https://www.mypuritour.com/wp-content/uploads/2022/10/mypuritourservice-1536x1020.jpg" 
             className="w-full h-full object-cover" 
             alt="Jagannath Temple Background"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/60 to-transparent"></div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0 opacity-10 pointer-events-none">
           <BowArrowLogo className="w-96 h-96 text-white" color="white" />
        </div>

        <div className="absolute top-10 left-10 flex items-center gap-3 z-10">
           <div className="bg-orange-600/90 backdrop-blur p-2 rounded-xl shadow-lg">
             <BowArrowLogo className="w-8 h-8 text-white" color="white" />
           </div>
           <div>
             <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Temple<span className="text-orange-500">2</span>Ayurveda</h1>
             <p className="text-[10px] text-stone-300 uppercase tracking-widest">Sanatani Sustainability</p>
           </div>
        </div>

        <div className="relative z-10 mb-8">
           <div key={currentNews.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl max-w-lg transform hover:scale-[1.02] transition-transform duration-500 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                 <span className={`px-2 py-1 rounded text-[10px] font-bold text-white ${currentNews.color}`}>
                    {currentNews.type}
                 </span>
                 <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
                    Live News Flash
                 </span>
              </div>
              <h2 className="text-2xl font-bold leading-tight mb-3 text-white drop-shadow-md">
                {currentNews.title}
              </h2>
              <p className="text-stone-200 text-sm leading-relaxed mb-4">
                {currentNews.desc}
              </p>
           </div>
           <div className="flex gap-2 mt-6 justify-center max-w-lg">
              {carouselData.map((_, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => setCurrentNewsIdx(idx)}
                   className={`h-2 rounded-full transition-all duration-300 shadow-sm ${idx === currentNewsIdx ? 'w-8 bg-orange-500' : 'w-2 bg-white/50 hover:bg-white'}`}
                 />
              ))}
           </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative bg-white lg:rounded-l-[3rem] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-20">
         <div className="max-w-md w-full p-4">
            <div className="text-center mb-10">
               <h2 className="text-3xl font-bold text-stone-800">Welcome Back</h2>
               <p className="text-stone-500 text-sm mt-2">Sign in to continue your Seva</p>
            </div>

            {/* Role Tabs */}
            <div className="flex flex-wrap p-1 bg-stone-100 rounded-2xl mb-8 border border-stone-200">
               {[
                 { id: UserRole.PERSON, label: 'Person', icon: '👤' },
                 { id: UserRole.TEMPLE, label: 'Temple', icon: '🏯' },
                 { id: UserRole.DRYING_UNIT, label: 'Drying Unit', icon: '🏭' }, // Renamed from NGO
                 { id: UserRole.NGO, label: 'Partner NGO', icon: '🤝' }, // New Role
                 { id: UserRole.ADMIN, label: 'Admin', icon: '🛡️' }
               ].map((role) => (
                 <button
                   key={role.id}
                   onClick={() => { setActiveTab(role.id); setErrorMsg(null); }}
                   className={`flex-1 min-w-[80px] flex flex-col items-center py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 ${
                     activeTab === role.id 
                       ? 'bg-white text-stone-800 shadow-md transform scale-105 border border-stone-100' 
                       : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200/50'
                   }`}
                 >
                   <span className="text-lg mb-1 filter grayscale-[0.5]">{role.icon}</span>
                   {role.label}
                 </button>
               ))}
            </div>

            {/* Form */}
            <div className="space-y-5">
               {/* Google Sign-In with Firebase Auth */}
               <button
                 type="button"
                 onClick={handleGoogleSignIn}
                 disabled={loading}
                 className="w-full flex items-center justify-center gap-3 bg-white hover:bg-stone-50 text-stone-800 font-bold py-3.5 px-4 rounded-xl border border-stone-200 shadow-sm hover:shadow transition-all text-sm group"
               >
                 <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                   <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                   <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                   <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                   <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                 </svg>
                 <span>Sign in with Google</span>
               </button>

               <div className="relative flex items-center justify-center py-1">
                 <div className="w-full border-t border-stone-200"></div>
                 <span className="bg-white px-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider absolute">or email credentials</span>
               </div>
               {errorMsg && (
                 <div className="bg-red-50 text-red-600 text-xs p-4 rounded-xl flex items-center gap-3 border border-red-100 animate-fade-in">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {errorMsg}
                 </div>
               )}
               
               {isRegistering && activeTab !== UserRole.ADMIN && (
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase ml-1">Full Name / Org Name</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-medium text-stone-800"
                      placeholder={activeTab === UserRole.TEMPLE ? "Temple Name" : "Name"}
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                    />
                 </div>
               )}

               <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase ml-1">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-medium text-stone-800"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase ml-1">Password</label>
                  <input 
                    type="password" 
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-medium text-stone-800"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
               </div>

               <button 
                 onClick={handleAuth}
                 disabled={loading}
                 className="w-full bg-stone-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none flex justify-center items-center gap-3 text-sm tracking-wide"
               >
                 {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                 ) : (
                    <>
                      {activeTab === UserRole.ADMIN ? 'Secure Admin Login' : (isRegistering ? 'Create Account' : 'Sign In')}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                 )}
               </button>

               {activeTab !== UserRole.ADMIN && (
                 <div className="text-center mt-8">
                    <p className="text-stone-500 text-sm">
                      {isRegistering ? "Already have an account?" : "New user?"}{' '}
                      <button 
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        {isRegistering ? "Sign In" : "Create Identity"}
                      </button>
                    </p>
                 </div>
               )}
                {/* Direct Dashboard Access / Role Switcher for instant testing */}
                <div className="pt-6 border-t border-stone-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Quick Direct Dashboard Access</span>
                    <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">1-Click</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAccess(UserRole.PERSON)}
                      className="p-2 text-left bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors flex items-center gap-2 text-xs font-semibold text-stone-700"
                    >
                      <span className="text-base">👤</span> Devotee Panel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAccess(UserRole.TEMPLE)}
                      className="p-2 text-left bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors flex items-center gap-2 text-xs font-semibold text-stone-700"
                    >
                      <span className="text-base">🏯</span> Temple Panel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAccess(UserRole.DRYING_UNIT)}
                      className="p-2 text-left bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors flex items-center gap-2 text-xs font-semibold text-stone-700"
                    >
                      <span className="text-base">🏭</span> Drying Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAccess(UserRole.NGO)}
                      className="p-2 text-left bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors flex items-center gap-2 text-xs font-semibold text-stone-700"
                    >
                      <span className="text-base">🤝</span> Partner NGO
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAccess(UserRole.ADMIN)}
                    className="w-full mt-2 p-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold"
                  >
                    <span>🛡️</span> System Admin Dashboard (Full Clearance)
                  </button>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Login;
