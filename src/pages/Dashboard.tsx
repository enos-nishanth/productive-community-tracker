import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

// Icons
import { 
  LogOut, Sparkles, Target, BookOpen, Users, TrendingUp, 
  BarChart2, Trophy, MessageSquare, Megaphone, CalendarDays, 
  Menu, X, ChevronLeft, ChevronRight
} from "lucide-react";

// Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card"; // Using base Card for cleaner custom styling
import TaskList from "@/components/TaskList";
import DailyLogsList from "@/components/DailyLogsList";
import BlogFeed from "@/components/BlogFeed";
import GroupChat from "@/components/GroupChat";
import { WeeklyReportEmbedded } from "@/pages/WeeklyReport";
import { LeaderboardEmbedded } from "@/pages/Leaderboard";
import Announcements from "@/pages/Announcements";
import CalendarPage from "@/pages/Calendar";

// Assets
import logo from "@/assets/logo.png";

// Types
type Section = "tasks" | "logs" | "community" | "chat" | "weekly" | "leaderboard" | "announcements" | "calendar";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState<Section>("tasks");
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop sidebar collapse state

  const [stats, setStats] = useState({
    tasks: 0,
    logs: 0,
    posts: 0,
  });

  // --- LOGIC: AUTH & DATA FETCHING (Preserved) ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }
      setProfile(data);
    };

    const fetchStats = async () => {
      if (!user) return;

      const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: logsCount } = await supabase
        .from("daily_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: postsCount } = await supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setStats({
        tasks: tasksCount || 0,
        logs: logsCount || 0,
        posts: postsCount || 0,
      });
    };

    fetchProfile();
    fetchStats();

    const checkRole = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
    };
    checkRole();

    // Subscriptions
    const profileChannel = supabase
      .channel("profile-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user?.id}` }, () => fetchProfile())
      .subscribe();

    const statsChannel = supabase
      .channel("stats-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user?.id}` }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_logs", filter: `user_id=eq.${user?.id}` }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "blog_posts", filter: `user_id=eq.${user?.id}` }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [user]);

  // --- LOGIC: NAVIGATION ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab") || "";
    const map: Record<string, Section> = {
      tasks: "tasks",
      logs: "logs",
      blog: "community",
      community: "community",
      chat: "chat",
      weekly: "weekly",
      leaderboard: "leaderboard",
      announcements: "announcements",
      calendar: "calendar",
    };
    if (map[tab]) setSection(map[tab]);
  }, [location.search]);

  useEffect(() => {
    navigate(`/dashboard?tab=${section}`, { replace: true });
  }, [section, navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  // --- MEMOIZED UI CONFIG ---
  const navItems = useMemo(() => [
    { key: "tasks", label: "Tasks", icon: Target, description: "Your daily focus and goals." },
    { key: "logs", label: "Daily Logs", icon: BookOpen, description: "Track your progress and insights." },
    { key: "community", label: "Community", icon: Users, description: "Public blog and sharing." },
    { key: "chat", label: "Group Chat", icon: MessageSquare, description: "Real-time peer connection." },
    { key: "weekly", label: "Weekly Report", icon: BarChart2, description: "Performance analytics." },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy, description: "Global ranking by points." },
    { key: "announcements", label: "Announcements", icon: Megaphone, description: "Team updates." },
    { key: "calendar", label: "Calendar", icon: CalendarDays, description: "Upcoming events." },
  ], []);

  // --- LOADING STATE ---
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-primary">
            <Sparkles className="h-10 w-10" />
          </div>
          <p className="text-lg font-medium text-muted-foreground animate-pulse">Loading Peacutoria...</p>
        </div>
      </div>
    );
  }

  // --- RENDER HELPERS ---
  const renderMainContent = () => {
    switch (section) {
      case "tasks": return <TaskList userId={user.id} />;
      case "logs": return <DailyLogsList userId={user.id} />;
      case "community": return <BlogFeed userId={user.id} />;
      case "chat": return <GroupChat userId={user.id} />;
      case "weekly": return <WeeklyReportEmbedded userId={user.id} isAdmin={isAdmin} />;
      case "leaderboard": return <LeaderboardEmbedded />;
      case "announcements": return <Announcements userId={user.id} />;
      case "calendar": return <CalendarPage userId={user.id} />;
      default: return <TaskList userId={user.id} />;
    }
  };

  // --- COMPONENT: CUSTOM SIDEBAR ---
  const SidebarComponent = ({ mobile = false }) => {
    const isMobileView = mobile;
    const isDesktopCollapsed = !mobile && isCollapsed;
    
    return (
    <div className={`
      flex flex-col h-full bg-white border-r border-gray-100 shadow-xl shadow-gray-200/50 transition-all duration-300 ease-in-out
      ${isMobileView ? 'w-64 p-4' : (isDesktopCollapsed ? 'w-20 p-2' : 'w-64 p-4')}
    `}>
      {/* Sidebar Header */}
      <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'} pb-6 mb-2 border-b border-gray-100 transition-all`}>
        <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'justify-center' : ''}`}>
           <img src={logo} alt="Logo" className="h-8 w-auto rounded-lg shadow-sm" />
          {!isDesktopCollapsed && (
            <div className="animate-in fade-in duration-300">
              <span className="text-xl font-bold bg-gradient-to-r from-teal-500 to-purple-600 bg-clip-text text-transparent">
                Peacutoria
              </span>
            </div>
          )}
        </div>
        
        {/* Toggle Buttons */}
        {isMobileView ? (
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`text-gray-400 hover:text-gray-700 ${isDesktopCollapsed ? 'mt-2 h-8 w-8' : ''}`}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200">
        {navItems.map((item) => {
          const isActive = section === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => { 
                setSection(item.key as Section); 
                if (mobile) setIsSidebarOpen(false); 
              }}
              title={isDesktopCollapsed ? item.label : undefined}
              className={`group flex items-center w-full p-3 rounded-xl transition-all duration-200 text-sm ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${isDesktopCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`h-5 w-5 ${!isDesktopCollapsed ? 'mr-3' : ''} ${isActive ? 'text-white' : 'text-blue-500'}`} />
              {!isDesktopCollapsed && (
                <div className="text-left animate-in fade-in duration-300">
                  <p className="font-semibold">{item.label}</p>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer User Info */}
      <div className={`mt-4 pt-4 border-t border-gray-100 ${isDesktopCollapsed ? 'flex flex-col items-center' : ''}`}>
        <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
            {!isDesktopCollapsed && (
              <div className="text-left overflow-hidden animate-in fade-in duration-300">
                  <p className="font-bold text-sm text-gray-900 truncate">{profile.username}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut} 
              className="text-gray-400 hover:text-red-500 hover:bg-red-50"
              title="Sign Out"
            >
                <LogOut className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-800 font-sans">
      
      {/* Background Subtle Gradient */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0.01) 60%), radial-gradient(circle at 90% 80%, rgba(6,182,212,0.05) 0%, rgba(6,182,212,0.01) 60%)' }} />
      
      <div className="relative z-10 flex min-h-screen">
        
        {/* DESKTOP SIDEBAR */}
        <div className="hidden lg:block h-screen sticky top-0 z-40">
          <SidebarComponent />
        </div>

        {/* MOBILE SIDEBAR OVERLAY */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        )}
        
        {/* MOBILE SIDEBAR DRAWER */}
        <div className={`fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarComponent mobile />
        </div>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden">

          {/* TOP HEADER BAR */}
          <header className="sticky top-2 z-30 bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl p-4 mb-8 shadow-sm">
            <div className="flex justify-between items-center">
              
              {/* Mobile Menu Trigger */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarOpen(true)} 
                className="lg:hidden text-gray-600 -ml-2"
              >
                <Menu className="h-6 w-6" />
              </Button>

              {/* Page Title */}
              <div className="flex-1 ml-2 lg:ml-0">
                <h1 className="text-2xl font-extrabold text-gray-900 capitalize">
                  {navItems.find(i => i.key === section)?.label || "Dashboard"}
                </h1>
                <p className="text-sm text-gray-500 hidden md:block">
                  {navItems.find(i => i.key === section)?.description}
                </p>
              </div>

              {/* User Stats/Badge */}
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-bold text-gray-900">{profile.username}</span>
                    {isAdmin && <Sparkles className="h-3 w-3 text-yellow-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 justify-end">
                    <span>⭐ {profile.points} pts</span>
                    <span>•</span>
                    <span>🔥 {profile.streak} days</span>
                  </p>
                </div>
                
                {/* Avatar / Profile Icon */}
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px]">
                   <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                      <span className="font-bold text-transparent bg-clip-text bg-gradient-to-tr from-blue-500 to-purple-600">
                        {profile.username?.charAt(0).toUpperCase()}
                      </span>
                   </div>
                </div>
              </div>
            </div>
          </header>

          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            
            {/* Points Card (Highlighted) */}
            <Card className="p-5 border-none shadow-lg bg-gradient-to-br from-white to-purple-50 ring-1 ring-purple-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Trophy className="h-24 w-24 text-purple-600" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Growth Points</h3>
                <p className="text-3xl font-black text-gray-900">{profile.points.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Total earned points</p>
              </div>
            </Card>

            {/* Other Stats */}
            {[
              { label: "Tasks", value: stats.tasks, icon: Target, color: "text-teal-600", bg: "bg-teal-50" },
              { label: "Logs", value: stats.logs, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Posts", value: stats.posts, icon: Users, color: "text-pink-600", bg: "bg-pink-50" },
            ].map((box, i) => (
              <Card key={i} className="p-5 border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${box.bg}`}>
                    <box.icon className={`h-6 w-6 ${box.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{box.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{box.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* MAIN CONTENT CONTAINER */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 p-6 min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
             {renderMainContent()}
          </div>

          <footer className="mt-12 text-center text-sm text-gray-400 py-4">
            <p>&copy; {new Date().getFullYear()} Peacutoria. All rights reserved.</p>
          </footer>

        </main>
      </div>
    </div>
  );
};

export default Dashboard;