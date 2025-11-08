import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Sparkles, Target, BookOpen, Users, TrendingUp } from "lucide-react";
import TaskList from "@/components/TaskList";
import DailyLogsList from "@/components/DailyLogsList";
import BlogFeed from "@/components/BlogFeed";
import GroupChat from "@/components/GroupChat";
import logo from "@/assets/logo.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-auto" />
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
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

        {/* Tabs Content */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="logs">Daily Logs</TabsTrigger>
            <TabsTrigger value="blog">Community</TabsTrigger>
            <TabsTrigger value="chat">Group Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="animate-fade-in">
            <TaskList userId={user.id} />
          </TabsContent>

          <TabsContent value="logs" className="animate-fade-in">
            <DailyLogsList userId={user.id} />
          </TabsContent>

          <TabsContent value="blog" className="animate-fade-in">
            <BlogFeed userId={user.id} />
          </TabsContent>

          <TabsContent value="chat" className="animate-fade-in">
            <GroupChat userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;