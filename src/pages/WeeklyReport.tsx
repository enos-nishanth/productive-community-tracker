import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, ListChecks, Flame, Users, CalendarDays, BarChart3, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { toast } from "sonner";

type Report = Database["public"]["Tables"]["weekly_reports"]["Row"];


const WeeklyReportPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userIdFilter, setUserIdFilter] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; username: string }[]>([]);

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
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
      const admin = data?.role === "admin";
      setIsAdmin(admin);
      setUserIdFilter(user.id);
    };
    checkRole();
  }, [user]);

  const loadProfiles = async () => {
    const res = await supabase.from("profiles").select("id, username");
    if (!res.error && res.data) setProfiles(res.data as any);
  };

  const loadReports = async (uid: string) => {
    const res = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(12);
    if (res.error) {
      toast.error("Weekly reports not available");
      setReports([]);
      return;
    }
    setReports(res.data ?? []);
  };

  useEffect(() => {
    if (!userIdFilter) return;
    loadReports(userIdFilter);
    if (isAdmin) loadProfiles();
  }, [userIdFilter, isAdmin]);

  const latest = reports[0] || null;
  const chartConfig = { Points: { label: "Points", color: "hsl(var(--chart-1))" }, Tasks: { label: "Tasks", color: "hsl(var(--chart-2))" }, Logs: { label: "Logs", color: "hsl(var(--chart-3))" } } as const;
  const pointsSeries = useMemo(() => reports.slice().reverse().map(r => ({ week: r.week_start, Points: r.points_gained || 0 })), [reports]);
  const workSeries = useMemo(() => [{ name: "This Week", Tasks: latest?.tasks_completed_count || 0, Logs: latest?.logs_count || 0 }], [latest]);

  const currentProfile = useMemo(() => profiles.find(p => p.id === userIdFilter)?.username || "User", [profiles, userIdFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 max-w-6xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Weekly Report Dashboard</h1>
          </div>
          {isAdmin && profiles.length > 0 ? (
            <Select value={userIdFilter || ""} onValueChange={setUserIdFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {!latest ? (
          <Card className="shadow-lg border-dashed">
            <CardHeader><CardTitle>No Weekly Data for {currentProfile}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">The weekly report for this user is not yet available.</div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Latest Report: Week starting {latest.week_start}
            </div>
            
            {/* Key Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Points Gained</span>
                        <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-600">
                            <Trophy className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold mt-3">{latest.points_gained || 0}</div>
                    <Progress value={Math.min(100, (latest.points_gained || 0))} className="mt-3 h-2" />
                </CardContent>
              </Card>
              
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Tasks Completed</span>
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                            <Target className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold mt-3">{latest.tasks_completed_count || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total in week</div>
                </CardContent>
              </Card>
              
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Logs Submitted</span>
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                            <ListChecks className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold mt-3">{latest.logs_count || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Daily records</div>
                </CardContent>
              </Card>
              
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Top Achievements</span>
                        <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-600">
                            <Flame className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {(latest.achievements || []).slice(0, 3).map((a, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {a.split(' ')[0]}
                            </Badge>
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{latest.achievements?.length || 0} achievements total</div>
                </CardContent>
              </Card>
            </div>
            
            {/* Charts and Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Summary Card (col-span-1) */}
                <Card className="lg:col-span-1 shadow-lg">
                    <CardHeader className="border-b pb-4">
                        <CardTitle className="text-lg">Weekly Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-sm">
                        <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{latest.summary || "No detailed summary provided for this week."}</p>

                        {(latest.achievements?.length || 0) > 0 && (
                            <div className="pt-2 border-t">
                                <div className="font-semibold text-base mb-1 text-primary">Achievements</div>
                                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                                    {latest.achievements?.map((a, i) => (<li key={i}>{a}</li>))}
                                </ul>
                            </div>
                        )}
                        {(latest.improvements?.length || 0) > 0 && (
                            <div className="pt-2 border-t">
                                <div className="font-semibold text-base mb-1 text-primary">Key Improvements</div>
                                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                                    {latest.improvements?.map((a, i) => (<li key={i}>{a}</li>))}
                                </ul>
                            </div>
                        )}
                        {(latest.goals_next_week?.length || 0) > 0 && (
                            <div className="pt-2 border-t">
                                <div className="font-semibold text-base mb-1 text-primary">Next Week Goals</div>
                                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                                    {latest.goals_next_week?.map((a, i) => (<li key={i}>{a}</li>))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Charts (col-span-2) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Points Trend (Last 12 Weeks)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                                <LineChart data={pointsSeries} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Line type="monotone" dataKey="Points" stroke="var(--color-Points)" strokeWidth={2} dot={{ fill: "var(--color-Points)" }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Work Breakdown (This Week)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                                <BarChart data={workSeries} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent className="flex justify-center pt-2" />} />
                                    <Bar dataKey="Tasks" fill="var(--color-Tasks)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Logs" fill="var(--color-Logs)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default WeeklyReportPage;

export const WeeklyReportEmbedded = ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
  const [userIdFilter, setUserIdFilter] = useState<string | null>(userId);
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; username: string }[]>([]);

  const loadProfiles = async () => {
    const res = await supabase.from("profiles").select("id, username");
    if (!res.error && res.data) setProfiles(res.data as any);
  };

  const loadReports = async (uid: string) => {
    const res = await supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(12);
    if (!res.error && res.data) setReports(res.data as Report[]);
  };

  useEffect(() => {
    if (!userIdFilter) return;
    loadReports(userIdFilter);
    if (isAdmin) loadProfiles();
  }, [userIdFilter, isAdmin]);

  const latest = reports[0] || null;
  const chartConfig = { Points: { label: "Points", color: "hsl(var(--chart-1))" }, Tasks: { label: "Tasks", color: "hsl(var(--chart-2))" }, Logs: { label: "Logs", color: "hsl(var(--chart-3))" } } as const;
  
  // REVERSE reports for the chart so time goes Left -> Right
  const pointsSeries = useMemo(() => reports.slice().reverse().map(r => ({ week: r.week_start, Points: r.points_gained || 0 })), [reports]);
  const workSeries = useMemo(() => [{ name: "This Week", Tasks: latest?.tasks_completed_count || 0, Logs: latest?.logs_count || 0 }], [latest]);

  const currentProfile = useMemo(() => profiles.find(p => p.id === userIdFilter)?.username || "User", [profiles, userIdFilter]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Weekly Report
          </CardTitle>
          {isAdmin && profiles.length > 0 ? (
            <Select value={userIdFilter || ""} onValueChange={setUserIdFilter}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select User" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardHeader>
        <CardContent className="pt-6">
          {!latest ? (
            <div className="text-center py-4">
              <div className="text-base font-medium">No Report Available</div>
              <div className="text-sm text-muted-foreground">Report for {currentProfile} is pending.</div>
            </div>
          ) : (
            <>
              {/* Metric Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col items-start border-r pr-2 last:border-r-0">
                    <div className="p-1 bg-yellow-500/10 rounded-full text-yellow-600 mb-1">
                        <Trophy className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-bold">{latest.points_gained || 0}</div>
                    <div className="text-xs text-muted-foreground">Points</div>
                </div>
                
                <div className="flex flex-col items-start border-r pr-2 last:border-r-0">
                    <div className="p-1 bg-primary/10 rounded-full text-primary mb-1">
                        <Target className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-bold">{latest.tasks_completed_count || 0}</div>
                    <div className="text-xs text-muted-foreground">Tasks</div>
                </div>
                
                <div className="flex flex-col items-start border-r pr-2 last:border-r-0">
                    <div className="p-1 bg-indigo-500/10 rounded-full text-indigo-600 mb-1">
                        <ListChecks className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-bold">{latest.logs_count || 0}</div>
                    <div className="text-xs text-muted-foreground">Logs</div>
                </div>

                <div className="flex flex-col items-start">
                    <div className="p-1 bg-orange-500/10 rounded-full text-orange-600 mb-1">
                        <Flame className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-bold">{latest.achievements?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Highlights</div>
                </div>
              </div>
              
              {/* Detailed Content Section */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium pb-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Week starting <Badge variant="outline">{latest.week_start}</Badge>
                </div>
                
                {/* Summary (Added) */}
                {latest.summary && (
                    <div>
                        <div className="font-semibold text-sm">Summary</div>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{latest.summary}</p>
                    </div>
                )}

                {/* Achievements (Full List) */}
                {(latest.achievements?.length || 0) > 0 && (
                    <div>
                        <div className="font-semibold text-sm">Achievements</div>
                        <ul className="list-disc ml-5 text-sm text-muted-foreground mt-1">
                            {latest.achievements?.map((a, i) => (<li key={i}>{a}</li>))}
                        </ul>
                    </div>
                )}
                
                {/* Improvements (Added) */}
                {(latest.improvements?.length || 0) > 0 && (
                    <div>
                        <div className="font-semibold text-sm">Improvements</div>
                        <ul className="list-disc ml-5 text-sm text-muted-foreground mt-1">
                            {latest.improvements?.map((a, i) => (<li key={i}>{a}</li>))}
                        </ul>
                    </div>
                )}

                {/* Goals (Full List) */}
                {(latest.goals_next_week?.length || 0) > 0 && (
                    <div>
                        <div className="font-semibold text-sm">Next Goals</div>
                        <ul className="list-disc ml-5 text-sm text-muted-foreground mt-1">
                            {latest.goals_next_week?.map((a, i) => (<li key={i}>{a}</li>))}
                        </ul>
                    </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Embedded Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Points Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[180px] w-full">
              <LineChart data={pointsSeries} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                {/* FIX: Enable dots so single data points are visible */}
                <Line 
                    type="monotone" 
                    dataKey="Points" 
                    stroke="var(--color-Points)" 
                    strokeWidth={2} 
                    dot={{ r: 4, fill: "var(--color-Points)" }}
                    activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Work Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[180px] w-full">
              <BarChart data={workSeries} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <Bar dataKey="Tasks" fill="var(--color-Tasks)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Logs" fill="var(--color-Logs)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};