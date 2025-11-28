import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Sparkles, Target, BookOpen, Users, TrendingUp, BarChart2, Trophy, MessageSquare, Megaphone, CalendarDays } from "lucide-react";
import TaskList from "@/components/TaskList";
import DailyLogsList from "@/components/DailyLogsList";
import BlogFeed from "@/components/BlogFeed";
import GroupChat from "@/components/GroupChat";
import logo from "@/assets/logo.png";
import { WeeklyReportEmbedded } from "@/pages/WeeklyReport";
import { LeaderboardEmbedded } from "@/pages/Leaderboard";
import Announcements from "@/pages/Announcements";
import CalendarPage from "@/pages/Calendar";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState<"tasks"|"logs"|"community"|"chat"|"weekly"|"leaderboard"|"announcements"|"calendar">("tasks");
  const [stats, setStats] = useState({
    tasks: 0,
    logs: 0,
    posts: 0,
  });

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

      // Fetch tasks count
      const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch logs count
      const { count: logsCount } = await supabase
        .from("daily_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Fetch posts count
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

    // Subscribe to profile changes (points, streak updates)
    const profileChannel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user?.id}`,
        },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    // Subscribe to tasks, logs, and posts changes for stats
    const statsChannel = supabase
      .channel("stats-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_logs",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blog_posts",
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab") || "";
    const map: Record<string, typeof section> = {
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

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-glow">Loading...</div>
      </div>
    );
  }

  return (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">

      {/* SIDEBAR (desktop + mobile drawer) */}
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b px-3 py-2 font-semibold text-lg">
          Menu
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "tasks"}
                onClick={() => setSection("tasks")}
              >
                <Target />
                <span>Tasks</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "logs"}
                onClick={() => setSection("logs")}
              >
                <BookOpen />
                <span>Daily Logs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "community"}
                onClick={() => setSection("community")}
              >
                <Users />
                <span>Community</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "chat"}
                onClick={() => setSection("chat")}
              >
                <MessageSquare />
                <span>Group Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "weekly"}
                onClick={() => setSection("weekly")}
              >
                <BarChart2 />
                <span>Weekly Report</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "leaderboard"}
                onClick={() => setSection("leaderboard")}
              >
                <Trophy />
                <span>Leaderboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "announcements"}
                onClick={() => setSection("announcements")}
              >
                <Megaphone />
                <span>Announcements</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={section === "calendar"}
                onClick={() => setSection("calendar")}
              >
                <CalendarDays />
                <span>Calendar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

          </SidebarMenu>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      {/* MAIN CONTENT */}
      <SidebarInset className="flex-1">

        {/* HEADER */}
        <header className="border-b bg-card shadow-card sticky top-0 z-20">
          <div className="px-4 py-4 flex justify-between items-center">

            {/* MOBILE MENU BUTTON HERE (MUST BE OUTSIDE SIDEBAR) */}
            <SidebarTrigger className="md:hidden mr-2" />

            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-8 w-auto" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Valai Veecee Meen Pidipom
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{profile.username}</p>
                <p className="text-xs text-muted-foreground">
                  🔥 {profile.streak} day streak | ⭐ {profile.points} points
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </header>
        <main className="px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-card hover:shadow-primary transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.tasks}</p>
              <p className="text-xs text-muted-foreground">Active tasks</p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-primary transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-secondary" />
                Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.logs}</p>
              <p className="text-xs text-muted-foreground">Daily logs</p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-primary transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.posts}</p>
              <p className="text-xs text-muted-foreground">Blog posts</p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-primary transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{profile.streak}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
            </CardContent>
          </Card>
        </div>

        {section === "tasks" && <TaskList userId={user.id} />}
        {section === "logs" && <DailyLogsList userId={user.id} />}
        {section === "community" && <BlogFeed userId={user.id} />}
        {section === "chat" && <GroupChat userId={user.id} />}
        {section === "weekly" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground"><BarChart2 className="h-4 w-4" />Weekly report loads when admin publishes data.</div>
            <WeeklyReportEmbedded userId={user.id} isAdmin={isAdmin} />
          </div>
        )}
        {section === "leaderboard" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground"><Trophy className="h-4 w-4" />Live ranking by points.</div>
            <LeaderboardEmbedded />
          </div>
        )}
        {section === "announcements" && <Announcements userId={user.id} />}
        {section === "calendar" && <CalendarPage userId={user.id} />}
        </main>
      </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;