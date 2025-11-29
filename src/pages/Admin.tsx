import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, FileText, RefreshCw, PlusCircle, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type SummaryRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  streak: number | null;
  points: number | null;
  tasks_count: number;
  logs_count: number;
  posts_count: number;
  messages_count: number;
  role?: "admin" | "moderator" | "member" | null;
};

const Admin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailData, setDetailData] = useState<Record<string, { tasks: any[]; logs: any[]; posts: any[]; messages: any[] }>>({});
  const [search, setSearch] = useState("");
  const [reportModalFor, setReportModalFor] = useState<string | null>(null);
  const [reportDraft, setReportDraft] = useState<{ week_start: string; summary: string; achievements: string; improvements: string; points_gained: number; goals_next_week: string }>({ week_start: "", summary: "", achievements: "", improvements: "", points_gained: 0, goals_next_week: "" });
  const [recentModalFor, setRecentModalFor] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentData, setRecentData] = useState<Record<string, { tasks: any[]; logs: any[]; posts: any[]; messages: any[] }>>({});
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: "", content: "", pinned: false });
  const [announceImage, setAnnounceImage] = useState<File | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error("Failed to check role");
        navigate("/dashboard");
        return;
      }
      const admin = data?.role === "admin";
      setIsAdmin(admin);
      if (!admin) navigate("/dashboard");
    };
    checkRole();
  }, [user, navigate]);

  const fetchSummary = async () => {
    // Fallback: the RPC "get_user_activity_summary" is not registered in Supabase,
    // so we skip it and proceed with the manual aggregation below.
    const rpc = { data: null, error: { message: "RPC not available" } };
    if (!rpc.error && rpc.data) {
      const base = rpc.data as SummaryRow[];
      const rolesRes = await supabase.from("user_roles").select("user_id, role");
      const roleMap = (rolesRes.data || []).reduce<Record<string, SummaryRow["role"]>>((acc, r: any) => {
        acc[r.user_id] = r.role;
        return acc;
      }, {});
      setSummary(base.map(b => ({ ...b, role: roleMap[b.user_id] || "member" })));
      return;
    }
    const profilesRes = await supabase
      .from("profiles")
      .select("id, username, avatar_url, streak, points");
    if (profilesRes.error || !profilesRes.data) {
      toast.error("Failed to load profiles");
      return;
    }
    const tasksRes = await supabase.from("tasks").select("user_id");
    const logsRes = await supabase.from("daily_logs").select("user_id");
    const postsRes = await supabase.from("blog_posts").select("user_id");
    const msgsRes = await supabase.from("messages").select("user_id");
    const countBy = (rows: { user_id: string }[]) => rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.user_id] = (acc[r.user_id] || 0) + 1;
      return acc;
    }, {});
    const tasksMap = countBy(tasksRes.data || []);
    const logsMap = countBy(logsRes.data || []);
    const postsMap = countBy(postsRes.data || []);
    const msgsMap = countBy(msgsRes.data || []);
    const data: SummaryRow[] = (profilesRes.data || []).map((p: any) => ({
      user_id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      streak: p.streak,
      points: p.points,
      tasks_count: tasksMap[p.id] || 0,
      logs_count: logsMap[p.id] || 0,
      posts_count: postsMap[p.id] || 0,
      messages_count: msgsMap[p.id] || 0,
    }));
    const rolesRes = await supabase.from("user_roles").select("user_id, role");
    const roleMap = (rolesRes.data || []).reduce<Record<string, SummaryRow["role"]>>((acc, r: any) => {
      acc[r.user_id] = r.role;
      return acc;
    }, {});
    setSummary(data.map(b => ({ ...b, role: roleMap[b.user_id] || "member" })));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchSummary();
    const chan = supabase
      .channel("admin-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchSummary();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter(s => s.username.toLowerCase().includes(q));
  }, [summary, search]);

  const totals = useMemo(() => {
    const totalUsers = filtered.length;
    const adminCount = filtered.filter(f => f.role === "admin").length;
    const totalPoints = filtered.reduce((acc, r) => acc + (r.points || 0), 0);
    const avgStreak = filtered.length ? Math.round(filtered.reduce((acc, r) => acc + (r.streak || 0), 0) / filtered.length) : 0;
    return { totalUsers, adminCount, totalPoints, avgStreak };
  }, [filtered]);

  const toggleExpand = async (uid: string) => {
    const open = expanded[uid];
    const next = { ...expanded, [uid]: !open };
    setExpanded(next);
    if (next[uid] && !detailData[uid]) {
      const [tasks, logs, posts, messages] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("daily_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("blog_posts").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("messages").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);
      setDetailData({
        ...detailData,
        [uid]: {
          tasks: tasks.data || [],
          logs: logs.data || [],
          posts: posts.data || [],
          messages: messages.data || [],
        },
      });
    }
  };

  const openRecentForUser = async (uid: string) => {
    setRecentModalFor(uid);
    setRecentLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [tasks, logs, posts, messages] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("daily_logs").select("*").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("blog_posts").select("*").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    setRecentData((prev) => ({
      ...prev,
      [uid]: {
        tasks: tasks.data || [],
        logs: logs.data || [],
        posts: posts.data || [],
        messages: messages.data || [],
      },
    }));
    setRecentLoading(false);
  };

  const resetStreak = async (uid: string) => {
    const rpc = await supabase.rpc("reset_streak", { p_user_id: uid } as any);
    if (rpc.error) {
      const upd = await supabase.from("profiles").update({ streak: 0 }).eq("id", uid);
      if (upd.error) {
        toast.error("Failed to reset streak");
        return;
      }
    }
    toast.success("Streak reset");
    fetchSummary();
  };

  const resetPoints = async (uid: string) => {
    const { error: rpcError } = await supabase.rpc("reset_points", {
      user_id: uid
    });

    if (rpcError) {
      const { error: updError } = await supabase
        .from("profiles")
        .update({ points: 0 })
        .eq("id", uid);

      if (updError) {
        toast.error("Failed to reset points");
        return;
      }
    }

    toast.success("Points reset");
    fetchSummary();
  };


  const makeAdmin = async (uid: string) => {
    const res = await supabase
      .from("user_roles")
      .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id" });
    if (res.error) {
      toast.error("Failed to promote to admin");
      return;
    }
    toast.success("User promoted to admin");
    fetchSummary();
  };

  const makeMember = async (uid: string) => {
    const res = await supabase
      .from("user_roles")
      .upsert({ user_id: uid, role: "member" }, { onConflict: "user_id" });
    if (res.error) {
      toast.error("Failed to demote to member");
      return;
    }
    toast.success("User set to member");
    fetchSummary();
  };

  const submitWeekly = async (uid: string, form: { week_start: string; summary: string; achievements: string; improvements: string; points_gained: number; goals_next_week: string }) => {
    const achievements = form.achievements.split("\n").map(s => s.trim()).filter(Boolean);
    const improvements = form.improvements.split("\n").map(s => s.trim()).filter(Boolean);
    const goals = form.goals_next_week.split("\n").map(s => s.trim()).filter(Boolean);
    const rpc = await supabase.rpc("upsert_weekly_report", {
      p_user_id: uid,
      p_week_start: form.week_start,
      p_summary: form.summary || null,
      p_achievements: achievements.length ? achievements : null,
      p_improvements: improvements.length ? improvements : null,
      p_points_gained: form.points_gained || null,
      p_goals_next_week: goals.length ? goals : null,
    });
    if (rpc.error) {
      const ins = await supabase.from("weekly_reports").upsert({
        user_id: uid,
        week_start: form.week_start,
        summary: form.summary || null,
        achievements: achievements.length ? achievements : null,
        improvements: improvements.length ? improvements : null,
        points_gained: form.points_gained || null,
        goals_next_week: goals.length ? goals : null,
      }, { onConflict: "user_id,week_start" });
      if (ins.error) {
        toast.error("Failed to save weekly report");
        return;
      }
    }
    toast.success("Weekly report saved");
  };

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-glow">Loading...</div>
      </div>
    );
  }

  // 1. Updates to the main Return block to fix Icon errors
return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* --- Sticky, Glassmorphism Header --- */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-primary rounded-full hidden sm:block"></div>
            <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Input 
                placeholder="Search users..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="w-64 pl-4 bg-muted/50 border-transparent focus:border-input focus:bg-background transition-all" 
              />
            </div>
            
            <Button variant="ghost" size="icon" onClick={fetchSummary} className="text-muted-foreground hover:text-foreground [&_svg]:h-4 [&_svg]:w-4">
              {/* Wrapped icon styling to prevent Type Errors */}
              <RefreshCw />
            </Button>

            <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-md hover:shadow-lg transition-all rounded-full px-6 [&_svg]:mr-2 [&_svg]:h-4 [&_svg]:w-4">
                  <PlusCircle />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl sm:rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl">Compose Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input 
                    placeholder="Announcement Title" 
                    className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-0 border-b rounded-none focus:border-primary transition-colors"
                    value={announceForm.title} 
                    onChange={e => setAnnounceForm({ ...announceForm, title: e.target.value })} 
                  />
                  <Textarea 
                    placeholder="What would you like to announce?" 
                    className="min-h-[150px] resize-none bg-muted/30 border-0 focus-visible:ring-0"
                    value={announceForm.content} 
                    onChange={e => setAnnounceForm({ ...announceForm, content: e.target.value })} 
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="pin" className="rounded border-gray-300 text-primary focus:ring-primary" checked={announceForm.pinned} onChange={(e) => setAnnounceForm({ ...announceForm, pinned: e.target.checked })} />
                        <label htmlFor="pin" className="text-sm font-medium cursor-pointer select-none">Pin to top</label>
                      </div>
                      <Input type="file" accept="image/*" className="h-9 w-full sm:w-auto text-xs file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" onChange={(e) => setAnnounceImage(e.target.files?.[0] || null)} />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setAnnounceOpen(false)}>Cancel</Button>
                      <Button onClick={async () => {
                        if (!announceForm.title.trim() || !announceForm.content.trim()) { toast.error("Enter title and content"); return; }
                        let imageUrl: string | null = null;
                        if (announceImage) {
                          const sanitized = announceImage.name.replace(/\s+/g, "_").replace(/[^\w.-]/g, "_");
                          const path = `announcements/${Date.now()}_${sanitized}`;
                          const { data, error } = await supabase.storage.from("post-images").upload(path, announceImage);
                          if (!error) {
                            const { data: url } = supabase.storage.from("post-images").getPublicUrl(data.path);
                            imageUrl = url?.publicUrl || null;
                          }
                        }
                        const { error: insErr } = await supabase.from("announcements").insert({ user_id: user?.id as string, title: announceForm.title.trim(), content: announceForm.content.trim(), image_url: imageUrl, pinned: announceForm.pinned });
                        if (insErr) { toast.error("Failed to post announcement"); return; }
                        toast.success("Announcement posted");
                        setAnnounceOpen(false);
                        setAnnounceForm({ title: "", content: "", pinned: false });
                        setAnnounceImage(null);
                      }}>Post Announcement</Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
          
          {/* --- Stats Overview Section --- */}
          {/* FIX: Removed className from Icons and applied [&_svg] to parent div */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-card/50 backdrop-blur">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <h3 className="text-2xl font-bold mt-1">{totals.totalUsers}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 [&_svg]:h-5 [&_svg]:w-5">
                  <UsersIcon />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-card/50 backdrop-blur">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Admins</p>
                  <h3 className="text-2xl font-bold mt-1">{totals.adminCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 [&_svg]:h-5 [&_svg]:w-5">
                  <Crown />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-card/50 backdrop-blur">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Streak</p>
                  <h3 className="text-2xl font-bold mt-1">{totals.avgStreak}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 [&_svg]:h-5 [&_svg]:w-5">
                  <RefreshCw />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-card/50 backdrop-blur">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Points</p>
                  <h3 className="text-2xl font-bold mt-1">{totals.totalPoints}</h3>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 [&_svg]:h-5 [&_svg]:w-5">
                  <FileText />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- Main Users Table --- */}
          <Card className="shadow-lg border-muted/40 overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg font-semibold">User Management</CardTitle>
              <div className="sm:hidden w-32">
                 <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Streak</th>
                    <th className="py-3 px-4">Points</th>
                    <th className="py-3 px-4">Tasks</th>
                    <th className="py-3 px-4">Logs</th>
                    <th className="py-3 px-4">Posts</th>
                    <th className="py-3 px-4">Chat</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {filtered.map(row => (
                    <tr key={row.user_id} className="hover:bg-muted/20 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`relative h-9 w-9 rounded-full overflow-hidden border-2 ${expanded[row.user_id] ? 'border-primary' : 'border-transparent'}`}>
                             {row.avatar_url ? (
                                <img src={row.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                                  {row.username?.slice(0,2).toUpperCase()}
                                </div>
                              )}
                          </div>
                          <button className="font-medium text-foreground hover:text-primary hover:underline underline-offset-4 transition-all" onClick={() => toggleExpand(row.user_id)}>
                            {row.username}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">{row.streak ?? 0}</td>
                      <td className="py-3 px-4 font-mono font-medium text-primary">{row.points ?? 0}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.tasks_count}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.logs_count}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.posts_count}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.messages_count}</td>
                      <td className="py-3 px-4">
                        <Badge variant={row.role === "admin" ? "default" : "secondary"} className="uppercase text-[10px] tracking-wider">
                            {row.role || "member"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {/* Actions fixed with [&_svg] classes on buttons */}
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Dialog open={reportModalFor === row.user_id} onOpenChange={(open) => setReportModalFor(open ? row.user_id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="default" className="h-7 px-3 text-xs mr-2 shadow-sm [&_svg]:mr-1 [&_svg]:h-3 [&_svg]:w-3">
                                <PlusCircle /> Report
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Add Weekly Report — <span className="text-primary">{row.username}</span></DialogTitle>
                              </DialogHeader>
                              <form
                                className="space-y-4 pt-4"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  await submitWeekly(row.user_id, reportDraft);
                                  setReportModalFor(null);
                                  setReportDraft({ week_start: "", summary: "", achievements: "", improvements: "", points_gained: 0, goals_next_week: "" });
                                }}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Week Start</label>
                                    <Input type="date" value={reportDraft.week_start} onChange={e => setReportDraft({ ...reportDraft, week_start: e.target.value })} />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Points Gained</label>
                                    <Input type="number" value={reportDraft.points_gained} onChange={e => setReportDraft({ ...reportDraft, points_gained: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium">Summary</label>
                                  <Textarea className="min-h-[80px]" value={reportDraft.summary} onChange={e => setReportDraft({ ...reportDraft, summary: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Achievements</label>
                                      <Textarea className="min-h-[120px] text-xs" placeholder="One per line" value={reportDraft.achievements} onChange={e => setReportDraft({ ...reportDraft, achievements: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Improvements</label>
                                      <Textarea className="min-h-[120px] text-xs" placeholder="One per line" value={reportDraft.improvements} onChange={e => setReportDraft({ ...reportDraft, improvements: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Goals</label>
                                      <Textarea className="min-h-[120px] text-xs" placeholder="One per line" value={reportDraft.goals_next_week} onChange={e => setReportDraft({ ...reportDraft, goals_next_week: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                  <Button type="button" variant="outline" onClick={() => setReportModalFor(null)}>Cancel</Button>
                                  <Button type="submit">Save Report</Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={recentModalFor === row.user_id} onOpenChange={(open) => setRecentModalFor(open ? row.user_id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="secondary" className="h-7 px-3 text-xs [&_svg]:mr-1 [&_svg]:h-3 [&_svg]:w-3" onClick={() => openRecentForUser(row.user_id)}>
                                <CalendarDays /> Recent
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle className="text-xl">Activity History: <span className="text-primary">{row.username}</span></DialogTitle>
                              </DialogHeader>
                              {recentLoading ? (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading recent activity...</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-y-auto p-1">
                                  <Card className="flex flex-col h-full border-l-4 border-l-blue-500">
                                    <CardHeader className="py-3 px-4 bg-muted/20"><CardTitle className="text-sm font-bold">Tasks</CardTitle></CardHeader>
                                    <CardContent className="flex-1 overflow-auto p-3 space-y-2">
                                      {(recentData[row.user_id]?.tasks || []).map((t: any) => (
                                        <div key={t.id} className="bg-card border p-2.5 rounded-md shadow-sm text-sm">
                                          <div className="font-semibold">{t.title}</div>
                                          {t.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</div>}
                                          <div className="text-[10px] text-muted-foreground mt-2 text-right">{t.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.tasks || []).length && (<div className="text-xs text-muted-foreground text-center py-4">No recent tasks</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card className="flex flex-col h-full border-l-4 border-l-green-500">
                                    <CardHeader className="py-3 px-4 bg-muted/20"><CardTitle className="text-sm font-bold">Daily Logs</CardTitle></CardHeader>
                                    <CardContent className="flex-1 overflow-auto p-3 space-y-2">
                                      {(recentData[row.user_id]?.logs || []).map((l: any) => (
                                        <div key={l.id} className="bg-card border p-2.5 rounded-md shadow-sm text-sm">
                                          <div className="font-semibold">{l.title}</div>
                                          <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{l.content}</div>
                                          <div className="text-[10px] text-muted-foreground mt-2 text-right">{l.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.logs || []).length && (<div className="text-xs text-muted-foreground text-center py-4">No logs</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card className="flex flex-col h-full border-l-4 border-l-purple-500">
                                    <CardHeader className="py-3 px-4 bg-muted/20"><CardTitle className="text-sm font-bold">Posts</CardTitle></CardHeader>
                                    <CardContent className="flex-1 overflow-auto p-3 space-y-2">
                                      {(recentData[row.user_id]?.posts || []).map((p: any) => (
                                        <div key={p.id} className="bg-card border p-2.5 rounded-md shadow-sm text-sm">
                                          <div className="font-semibold">{p.title}</div>
                                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.content}</div>
                                          <div className="text-[10px] text-muted-foreground mt-2 text-right">{p.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.posts || []).length && (<div className="text-xs text-muted-foreground text-center py-4">No posts</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card className="flex flex-col h-full border-l-4 border-l-orange-500">
                                    <CardHeader className="py-3 px-4 bg-muted/20"><CardTitle className="text-sm font-bold">Chat</CardTitle></CardHeader>
                                    <CardContent className="flex-1 overflow-auto p-3 space-y-2">
                                      {(recentData[row.user_id]?.messages || []).map((m: any) => (
                                        <div key={m.id} className="bg-card border p-2.5 rounded-md shadow-sm text-sm">
                                          {m.content ? <div className="text-sm">{m.content}</div> : <div className="text-xs italic text-muted-foreground">[Attachment]</div>}
                                          <div className="text-[10px] text-muted-foreground mt-2 text-right">{m.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.messages || []).length && (<div className="text-xs text-muted-foreground text-center py-4">No messages</div>)}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          
                          <div className="flex gap-1 ml-2 [&_svg]:h-3 [&_svg]:w-3">
                             <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Reset Streak" onClick={() => resetStreak(row.user_id)}><RefreshCw /></Button>
                             <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Reset Points" onClick={() => resetPoints(row.user_id)}><FileText /></Button>
                             {row.role === "admin" ? (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Revoke Admin" onClick={() => makeMember(row.user_id)}><UsersIcon /></Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Make Admin" onClick={() => makeAdmin(row.user_id)}><Crown /></Button>
                              )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </CardContent>
          </Card>

          {/* --- Expanded Detail View --- */}
          <div className="space-y-6">
            {filtered.map(row => (
                expanded[row.user_id] ? (
                <div key={row.user_id} className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-px flex-1 bg-border"></div>
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">{row.username} • Deep Dive</span>
                        <div className="h-px flex-1 bg-border"></div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Col: Details */}
                    <Card className="xl:col-span-2 border shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-primary">
                                <UsersIcon />
                                User Activity Snapshot
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-muted-foreground border-b pb-1">Recent Tasks</h4>
                                <div className="space-y-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {(detailData[row.user_id]?.tasks || []).map(t => (
                                    <div key={t.id} className="p-3 rounded bg-muted/30 border text-sm hover:bg-muted transition-colors">
                                        {t.title}
                                    </div>
                                    ))}
                                    {!(detailData[row.user_id]?.tasks || []).length && <p className="text-xs text-muted-foreground italic">No tasks found.</p>}
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-muted-foreground border-b pb-1">Recent Logs</h4>
                                <div className="space-y-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {(detailData[row.user_id]?.logs || []).map(l => (
                                    <div key={l.id} className="p-3 rounded bg-muted/30 border text-sm hover:bg-muted transition-colors">
                                        <span className="font-medium">{l.title}</span>
                                    </div>
                                    ))}
                                    {!(detailData[row.user_id]?.logs || []).length && <p className="text-xs text-muted-foreground italic">No logs found.</p>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-muted-foreground border-b pb-1">Community Posts</h4>
                                <div className="space-y-2 h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {(detailData[row.user_id]?.posts || []).map(p => (
                                    <div key={p.id} className="p-3 rounded bg-muted/30 border text-sm">
                                        {p.title}
                                    </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-muted-foreground border-b pb-1">Chat History</h4>
                                <div className="space-y-2 h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {(detailData[row.user_id]?.messages || []).map(m => (
                                    <div key={m.id} className="p-3 rounded bg-muted/30 border text-sm text-muted-foreground">
                                        "{m.content}"
                                    </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        </CardContent>
                    </Card>

                    {/* Right Col: Form */}
                    <Card className="border-l-4 border-l-primary shadow-md">
                        <CardHeader className="bg-primary/5">
                            <CardTitle className="text-primary">Weekly Report</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <WeeklyReportForm userId={row.user_id} onSubmit={submitWeekly} />
                        </CardContent>
                    </Card>
                    </div>
                </div>
                ) : null
            ))}
        </div>
      </main>
    </div>
  );
};

// 2. Updated WeeklyReportForm to optionally accept className to prevent type errors
const WeeklyReportForm = ({ userId, onSubmit, className }: { userId: string; onSubmit: (uid: string, form: { week_start: string; summary: string; achievements: string; improvements: string; points_gained: number; goals_next_week: string }) => void; className?: string }) => {
  const [week_start, setWeekStart] = useState("");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [improvements, setImprovements] = useState("");
  const [points_gained, setPointsGained] = useState<number>(0);
  const [goals_next_week, setGoals] = useState("");
  
  return (
    <form
      className={`space-y-4 ${className || ''}`}
      onSubmit={e => {
        e.preventDefault();
        onSubmit(userId, { week_start, summary, achievements, improvements, points_gained, goals_next_week });
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Week Start</label>
          <Input type="date" className="bg-background" value={week_start} onChange={e => setWeekStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Points +</label>
          <Input type="number" className="bg-background" value={points_gained} onChange={e => setPointsGained(Number(e.target.value))} />
        </div>
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Summary</label>
        <Textarea className="bg-background min-h-[80px]" placeholder="Brief weekly summary..." value={summary} onChange={e => setSummary(e.target.value)} />
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Achievements</label>
        <Textarea className="bg-background min-h-[80px]" placeholder="- Item 1&#10;- Item 2" value={achievements} onChange={e => setAchievements(e.target.value)} />
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Improvements</label>
        <Textarea className="bg-background min-h-[80px]" placeholder="Areas to grow..." value={improvements} onChange={e => setImprovements(e.target.value)} />
      </div>
      
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Next Week Goals</label>
        <Textarea className="bg-background min-h-[80px]" placeholder="Target goals..." value={goals_next_week} onChange={e => setGoals(e.target.value)} />
      </div>
      
      <div className="pt-2">
        <Button type="submit" className="w-full font-bold shadow-md">Submit Report</Button>
      </div>
    </form>
  );
};
export default Admin;

const UsersIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.67 0-8 1.34-8 4v2h12v-2c0-2.66-5.33-4-8-4Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h8v-2c0-2.66-5.33-4-8-4Z"/></svg>;