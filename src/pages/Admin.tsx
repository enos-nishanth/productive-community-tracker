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
    const rpc = await supabase.rpc("get_user_activity_summary", {});
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
    const rpc = await supabase.rpc("reset_streak", { p_user_id: uid });
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
    const rpc = await supabase.rpc("reset_points", { p_user_id: uid });
    if (rpc.error) {
      const upd = await supabase.from("profiles").update({ points: 0 }).eq("id", uid);
      if (upd.error) {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="flex gap-2">
            <Input placeholder="Search users" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
            <Button variant="outline" onClick={fetchSummary}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Card className="shadow-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UsersIcon /> Total Users</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{totals.totalUsers}</div></CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-yellow-500" /> Admins</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{totals.adminCount}</div></CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4 text-success" /> Avg Streak</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{totals.avgStreak}</div></CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Total Points</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{totals.totalPoints}</div></CardContent>
                </Card>
              </div>
              <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b bg-muted/30">
                    <th className="py-2 px-2">User</th>
                    <th className="py-2 px-2">Streak</th>
                    <th className="py-2 px-2">Points</th>
                    <th className="py-2 px-2">Tasks</th>
                    <th className="py-2 px-2">Logs</th>
                    <th className="py-2 px-2">Posts</th>
                    <th className="py-2 px-2">Messages</th>
                    <th className="py-2 px-2">Role</th>
                    <th className="py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.user_id} className="border-b hover:bg-muted/20">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="avatar" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-muted" />
                          )}
                          <button className="text-primary" onClick={() => toggleExpand(row.user_id)}>
                            {row.username}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-2">{row.streak ?? 0}</td>
                      <td className="py-2 px-2">{row.points ?? 0}</td>
                      <td className="py-2 px-2">{row.tasks_count}</td>
                      <td className="py-2 px-2">{row.logs_count}</td>
                      <td className="py-2 px-2">{row.posts_count}</td>
                      <td className="py-2 px-2">{row.messages_count}</td>
                      <td className="py-2 px-2">
                        <Badge variant={row.role === "admin" ? "secondary" : "outline"}>{row.role || "member"}</Badge>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => resetStreak(row.user_id)}>Reset Streak</Button>
                          <Button size="sm" variant="outline" onClick={() => resetPoints(row.user_id)}>Reset Points</Button>
                          {row.role === "admin" ? (
                            <Button size="sm" onClick={() => makeMember(row.user_id)}>Make Member</Button>
                          ) : (
                            <Button size="sm" onClick={() => makeAdmin(row.user_id)}>Make Admin</Button>
                          )}
                          <Dialog open={reportModalFor === row.user_id} onOpenChange={(open) => setReportModalFor(open ? row.user_id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" className="bg-primary text-primary-foreground"><PlusCircle className="h-4 w-4 mr-1" /> Add Weekly Report</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Weekly Report — {row.username}</DialogTitle>
                              </DialogHeader>
                              <form
                                className="space-y-3"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  await submitWeekly(row.user_id, reportDraft);
                                  setReportModalFor(null);
                                  setReportDraft({ week_start: "", summary: "", achievements: "", improvements: "", points_gained: 0, goals_next_week: "" });
                                }}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-xs mb-1">Week Start</div>
                                    <Input type="date" value={reportDraft.week_start} onChange={e => setReportDraft({ ...reportDraft, week_start: e.target.value })} />
                                  </div>
                                  <div>
                                    <div className="text-xs mb-1">Points Gained</div>
                                    <Input type="number" value={reportDraft.points_gained} onChange={e => setReportDraft({ ...reportDraft, points_gained: Number(e.target.value) })} />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs mb-1">Summary</div>
                                  <Textarea value={reportDraft.summary} onChange={e => setReportDraft({ ...reportDraft, summary: e.target.value })} />
                                </div>
                                <div>
                                  <div className="text-xs mb-1">Achievements (one per line)</div>
                                  <Textarea value={reportDraft.achievements} onChange={e => setReportDraft({ ...reportDraft, achievements: e.target.value })} />
                                </div>
                                <div>
                                  <div className="text-xs mb-1">Improvements (one per line)</div>
                                  <Textarea value={reportDraft.improvements} onChange={e => setReportDraft({ ...reportDraft, improvements: e.target.value })} />
                                </div>
                                <div>
                                  <div className="text-xs mb-1">Goals for Next Week (one per line)</div>
                                  <Textarea value={reportDraft.goals_next_week} onChange={e => setReportDraft({ ...reportDraft, goals_next_week: e.target.value })} />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button type="button" variant="outline" onClick={() => setReportModalFor(null)}>Cancel</Button>
                                  <Button type="submit">Save</Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <Dialog open={recentModalFor === row.user_id} onOpenChange={(open) => setRecentModalFor(open ? row.user_id : null)}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="secondary" onClick={() => openRecentForUser(row.user_id)}>
                                <CalendarDays className="h-4 w-4 mr-1" /> Last 7 Days
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>Past 7 Days — {row.username}</DialogTitle>
                              </DialogHeader>
                              {recentLoading ? (
                                <div className="p-6 text-sm text-muted-foreground">Loading recent activity...</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 max-h-64 overflow-auto">
                                      {(recentData[row.user_id]?.tasks || []).map((t: any) => (
                                        <div key={t.id} className="border p-2 rounded">
                                          <div className="font-medium">{t.title}</div>
                                          {t.description ? <div className="text-xs text-muted-foreground">{t.description}</div> : null}
                                          <div className="text-xs">{t.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.tasks || []).length && (<div className="text-xs text-muted-foreground">No tasks</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Logs</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 max-h-64 overflow-auto">
                                      {(recentData[row.user_id]?.logs || []).map((l: any) => (
                                        <div key={l.id} className="border p-2 rounded">
                                          <div className="font-medium">{l.title}</div>
                                          <div className="text-xs text-muted-foreground truncate">{l.content}</div>
                                          <div className="text-xs">{l.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.logs || []).length && (<div className="text-xs text-muted-foreground">No logs</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Community Posts</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 max-h-64 overflow-auto">
                                      {(recentData[row.user_id]?.posts || []).map((p: any) => (
                                        <div key={p.id} className="border p-2 rounded">
                                          <div className="font-medium">{p.title}</div>
                                          <div className="text-xs text-muted-foreground truncate">{p.content}</div>
                                          <div className="text-xs">{p.created_at}</div>
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.posts || []).length && (<div className="text-xs text-muted-foreground">No posts</div>)}
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Group Chat</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 max-h-64 overflow-auto">
                                      {(recentData[row.user_id]?.messages || []).map((m: any) => (
                                        <div key={m.id} className="border p-2 rounded">
                                          <div className="text-xs text-muted-foreground">{m.created_at}</div>
                                          {m.content ? <div className="text-sm">{m.content}</div> : <div className="text-xs">[Attachment]</div>}
                                        </div>
                                      ))}
                                      {!(recentData[row.user_id]?.messages || []).length && (<div className="text-xs text-muted-foreground">No messages</div>)}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {filtered.map(row => (
          expanded[row.user_id] ? (
            <div key={row.user_id} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>{row.username} Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium mb-2">Tasks</div>
                      <div className="space-y-1 max-h-64 overflow-auto">
                        {(detailData[row.user_id]?.tasks || []).map(t => (
                          <div key={t.id} className="border p-2 rounded">{t.title}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Daily Logs</div>
                      <div className="space-y-1 max-h-64 overflow-auto">
                        {(detailData[row.user_id]?.logs || []).map(l => (
                          <div key={l.id} className="border p-2 rounded">{l.title}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Community Posts</div>
                      <div className="space-y-1 max-h-64 overflow-auto">
                        {(detailData[row.user_id]?.posts || []).map(p => (
                          <div key={p.id} className="border p-2 rounded">{p.title}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Group Chat Messages</div>
                      <div className="space-y-1 max-h-64 overflow-auto">
                        {(detailData[row.user_id]?.messages || []).map(m => (
                          <div key={m.id} className="border p-2 rounded">{m.content}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weekly Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <WeeklyReportForm userId={row.user_id} onSubmit={submitWeekly} />
                </CardContent>
              </Card>
            </div>
          ) : null
        ))}
      </main>
    </div>
  );
};

const WeeklyReportForm = ({ userId, onSubmit }: { userId: string; onSubmit: (uid: string, form: { week_start: string; summary: string; achievements: string; improvements: string; points_gained: number; goals_next_week: string }) => void }) => {
  const [week_start, setWeekStart] = useState("");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [improvements, setImprovements] = useState("");
  const [points_gained, setPointsGained] = useState<number>(0);
  const [goals_next_week, setGoals] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        onSubmit(userId, { week_start, summary, achievements, improvements, points_gained, goals_next_week });
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs mb-1">Week Start</div>
          <Input type="date" value={week_start} onChange={e => setWeekStart(e.target.value)} />
        </div>
        <div>
          <div className="text-xs mb-1">Points Gained</div>
          <Input type="number" value={points_gained} onChange={e => setPointsGained(Number(e.target.value))} />
        </div>
      </div>
      <div>
        <div className="text-xs mb-1">Summary</div>
        <Textarea value={summary} onChange={e => setSummary(e.target.value)} />
      </div>
      <div>
        <div className="text-xs mb-1">Achievements (one per line)</div>
        <Textarea value={achievements} onChange={e => setAchievements(e.target.value)} />
      </div>
      <div>
        <div className="text-xs mb-1">Improvements (one per line)</div>
        <Textarea value={improvements} onChange={e => setImprovements(e.target.value)} />
      </div>
      <div>
        <div className="text-xs mb-1">Goals for Next Week (one per line)</div>
        <Textarea value={goals_next_week} onChange={e => setGoals(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit">Save Weekly Report</Button>
      </div>
    </form>
  );
};

export default Admin;

const UsersIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.67 0-8 1.34-8 4v2h12v-2c0-2.66-5.33-4-8-4Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h8v-2c0-2.66-5.33-4-8-4Z"/></svg>;