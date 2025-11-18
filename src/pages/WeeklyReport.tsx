import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, ListChecks, Flame } from "lucide-react";
import { Select } from "@/components/ui/select";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Weekly Report</h1>
          {isAdmin ? (
            <select className="border rounded px-2 py-1" value={userIdFilter || ""} onChange={e => setUserIdFilter(e.target.value)}>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          ) : null}
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 space-y-6">
        {!latest ? (
          <Card>
            <CardHeader>
              <CardTitle>No weekly data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Your weekly report appears once the admin adds it.</div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Points Gained</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{latest.points_gained || 0}</div>
                  <Progress value={Math.min(100, (latest.points_gained || 0))} className="mt-2" />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Tasks Completed</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{latest.tasks_completed_count || 0}</div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4 text-secondary" /> Logs</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{latest.logs_count || 0}</div>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Highlights</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(latest.achievements || []).slice(0, 3).map((a, i) => (
                      <Badge key={i} variant="outline">{a}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">Week starting {latest.week_start}</div>
                  <div className="text-sm whitespace-pre-wrap">{latest.summary || ""}</div>
                  {latest.achievements?.length ? (
                    <div>
                      <div className="font-medium">Achievements</div>
                      <ul className="list-disc ml-4 text-sm">
                        {latest.achievements.map((a, i) => (<li key={i}>{a}</li>))}
                      </ul>
                    </div>
                  ) : null}
                  {latest.improvements?.length ? (
                    <div>
                      <div className="font-medium">Improvements</div>
                      <ul className="list-disc ml-4 text-sm">
                        {latest.improvements.map((a, i) => (<li key={i}>{a}</li>))}
                      </ul>
                    </div>
                  ) : null}
                  {latest.goals_next_week?.length ? (
                    <div>
                      <div className="font-medium">Goals for next week</div>
                      <ul className="list-disc ml-4 text-sm">
                        {latest.goals_next_week.map((a, i) => (<li key={i}>{a}</li>))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Points by week</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig}>
                    <LineChart data={pointsSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="Points" stroke="var(--color-Points)" dot />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks vs Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig}>
                    <BarChart data={workSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="Tasks" fill="var(--color-Tasks)" />
                      <Bar dataKey="Logs" fill="var(--color-Logs)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
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
  const pointsSeries = useMemo(() => reports.slice().reverse().map(r => ({ week: r.week_start, Points: r.points_gained || 0 })), [reports]);
  const workSeries = useMemo(() => [{ name: "This Week", Tasks: latest?.tasks_completed_count || 0, Logs: latest?.logs_count || 0 }], [latest]);

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <div className="flex justify-end">
          <select className="border rounded px-2 py-1" value={userIdFilter || ""} onChange={e => setUserIdFilter(e.target.value)}>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.username}</option>
            ))}
          </select>
        </div>
      ) : null}
      {!latest ? (
        <Card>
          <CardHeader>
            <CardTitle>No weekly data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Your weekly report appears once the admin adds it.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Points Gained</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latest.points_gained || 0}</div>
                <Progress value={Math.min(100, (latest.points_gained || 0))} className="mt-2" />
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks Completed</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latest.tasks_completed_count || 0}</div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Logs</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latest.logs_count || 0}</div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Highlights</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(latest.achievements || []).slice(0, 3).map((a, i) => (
                    <Badge key={i} variant="outline">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm">Week starting {latest.week_start}</div>
                <div className="text-sm whitespace-pre-wrap">{latest.summary || ""}</div>
                {latest.achievements?.length ? (
                  <div>
                    <div className="font-medium">Achievements</div>
                    <ul className="list-disc ml-4 text-sm">
                      {latest.achievements.map((a, i) => (<li key={i}>{a}</li>))}
                    </ul>
                  </div>
                ) : null}
                {latest.improvements?.length ? (
                  <div>
                    <div className="font-medium">Improvements</div>
                    <ul className="list-disc ml-4 text-sm">
                      {latest.improvements.map((a, i) => (<li key={i}>{a}</li>))}
                    </ul>
                  </div>
                ) : null}
                {latest.goals_next_week?.length ? (
                  <div>
                    <div className="font-medium">Goals for next week</div>
                    <ul className="list-disc ml-4 text-sm">
                      {latest.goals_next_week.map((a, i) => (<li key={i}>{a}</li>))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Points by week</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <LineChart data={pointsSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="Points" stroke="var(--color-Points)" dot />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks vs Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <BarChart data={workSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="Tasks" fill="var(--color-Tasks)" />
                    <Bar dataKey="Logs" fill="var(--color-Logs)" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};